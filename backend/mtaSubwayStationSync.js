import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB
const dynamodb = new DynamoDBClient({ region: "us-west-2" });
const dynamodbClient = DynamoDBDocumentClient.from(dynamodb);
const tableName = 'MTA_Subway_Stations';

// Constants
const MTA_API_URL = 'https://data.ny.gov/resource/wujg-7c2s.json';

async function fetchStations() {
    const dateFourWeeksAgo = new Date();
    dateFourWeeksAgo.setDate(dateFourWeeksAgo.getDate() - 28);
    const fourWeeksAgoISO = dateFourWeeksAgo.toISOString().split('T')[0];

    // Query for unique stations in the past 4 weeks
    const selectClause = "$select=distinct station_complex_id,station_complex,borough,latitude,longitude";
    const whereClause = `$where=transit_mode='subway' and transit_timestamp >= '${fourWeeksAgoISO}'`;
    const url = encodeURI(`${MTA_API_URL}?${selectClause}&${whereClause}`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error fetching data: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

async function fetchAndStoreStations() {
    // Fetch stations
    const stations = await fetchStations();

    // Store stations in DynamoDB
    await storeToDynamoDB(stations);
    console.log("All station data stored in DynamoDB.");
}

async function storeToDynamoDB(stations) {
    const putRequests = stations.map(station => ({
        PutRequest: {
            Item: {
                id: station.station_complex_id,
                name: station.station_complex,
                borough: station.borough,
                latitude: station.latitude,
                longitude: station.longitude
            }
        }
    }));

    //  batch 25 requests at a time
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
