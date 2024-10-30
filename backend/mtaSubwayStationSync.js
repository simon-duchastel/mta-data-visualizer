import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB
const dynamodb = new DynamoDBClient({ region: "us-west-2" });
const dynamodbClient = DynamoDBDocumentClient.from(dynamodb);
const tableName = 'MTA_Subway_Stations';

// Constants
const DATA_API_URL = 'https://data.ny.gov/resource/39hk-dx4f.json';
const MAX_WRITE_ATTEMPTS = 3;
const WRITE_TIMEOUT_MS = 1000;
const WRITE_BATCH_SIZE = 10;

async function fetchStations() {
    // Query for unique stations
    const selectClause = "$select=complex_id,stop_name,borough,gtfs_latitude,gtfs_longitude,daytime_routes";
    const groupByClause = "$group=complex_id,stop_name,borough,gtfs_latitude,gtfs_longitude,daytime_routes";
    const url = encodeURI(`${DATA_API_URL}?${selectClause}&${groupByClause}`);

    const response = await fetch(url);
    console.log(`Finished fetching data from ${DATA_API_URL}`);
    if (!response.ok) {
        throw new Error(`Error fetching data: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

async function fetchAndStoreStations() {
    // Fetch stations
    const stations = await fetchStations();

    // Group stations by complex_id and nest data
    const groupedStations = groupStations(stations);

    // Store grouped stations in DynamoDB
    await storeToDynamoDB(groupedStations);
    console.log("All station data stored in DynamoDB.");
}

function groupStations(stations) {
    const grouped = {};

    stations.forEach(station => {
        const id = station.complex_id;

        // Initialize the object for this complex_id if it doesn't exist
        if (!grouped[id]) {
            grouped[id] = {
                id: id,
                data: []
            };
        }

        // Push the station details into the data array
        grouped[id].data.push({
            name: station.stop_name,
            routes: station.daytime_routes,
            borough: station.borough,
            latitude: station.gtfs_latitude,
            longitude: station.gtfs_longitude
        });
    });

    // Convert the grouped object to an array and add canonical names
    const stationsWithName = Object.values(grouped).map(group => {
        // Set canonical name for the complex (if there are multiple)
        const updatedGroup = {
            ...group,
            name: group.data[0].name,
        };

        return updatedGroup;
    });

    // Count occurrences of canonical names to find duplicates
    const canonicalNameCount = {};
    stationsWithName.forEach(group => {
        canonicalNameCount[group.name] = (canonicalNameCount[group.name] || 0) + 1;
    });

    // Update station names if there are duplicates based on name
    result.forEach(group => {
        if (canonicalNameCount[group.name] > 1) {
            group.data.forEach(station => {
                const routes = station.routes.split(' ').join('/');
                station.name = `${station.name} (${routes})`;
            });
        }
    });

    return result;
}

async function storeToDynamoDB(stations) {
    const putRequests = stations.map(station => ({
        PutRequest: {
            Item: station
        }
    }));

    // Batch requests
    while (putRequests.length > 0) {
        const batchParams = {
            RequestItems: {
                [tableName]: putRequests.splice(0, WRITE_BATCH_SIZE)
            }
        };

        let attempt = 0;

        while (attempt < MAX_WRITE_ATTEMPTS) {
            try {
                await dynamodbClient.send(new BatchWriteCommand(batchParams));
                attempt = 0; // reset number of concurrent failed attempts to 0
                break;
            } catch (error) {
                attempt++;
                console.error(`PUT to dynamo table attempt #${attempt} failed: ${error.message}`);

                if (attempt < MAX_WRITE_ATTEMPTS) {
                    console.log(`Retrying in ${WRITE_TIMEOUT_MS/1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, WRITE_TIMEOUT_MS)); // Wait before retrying
                } else {
                    throw new Error(`Error storing data in DynamoDB after ${MAX_WRITE_ATTEMPTS} attempts: ${error.message}`);
                }
            }
        }
    }
}

export async function handler() {
    try {
        await fetchAndStoreStations();
        return {
            statusCode: 200,
            body: JSON.stringify('Success: Data stored in DynamoDB')
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify(`Error: ${error.message}`)
        };
    }
}
