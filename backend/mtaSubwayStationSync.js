import { DynamoDBClient, DeleteTableCommand, CreateTableCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB
const dynamodb = new DynamoDBClient({ region: "us-west-2" });
const dynamodbClient = DynamoDBDocumentClient.from(dynamodb);
const tableName = 'MTA_Subway_Stations';

// Constants
const DATA_API_URL = 'https://data.ny.gov/resource/39hk-dx4f.json';

async function fetchStations() {
    // Query for unique stations
    const selectClause = "$select=complex_id,stop_name,borough,gtfs_latitude,gtfs_longitude";
    const groupByClause = "$group=complex_id,stop_name,borough,gtfs_latitude,gtfs_longitude";
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
    console.log(stations);

    // Store stations in DynamoDB
    await storeToDynamoDB(stations);
    console.log("All station data stored in DynamoDB.");
}

async function storeToDynamoDB(stations) {
    const putRequests = stations.map(station => ({
        PutRequest: {
            Item: {
                id: station.complex_id,
                name: station.stop_name,
                borough: station.borough,
                latitude: station.gtfs_latitude,
                longitude: station.gtfs_longitude
            }
        }
    }));

    // batch 25 requests at a time
    while (putRequests.length > 0) {
        const batchParams = {
            RequestItems: {
                [tableName]: putRequests.splice(0, 25)
            }
        };

        try {
            await dynamodbClient.send(new BatchWriteCommand(batchParams));
        } catch (error) {
            throw new Error(`Error storing data in DynamoDB: ${error.message}`);
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
