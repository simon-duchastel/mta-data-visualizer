import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB
const dynamodb = new DynamoDBClient({ region: "us-west-2" });
const dynamodbClient = DynamoDBDocumentClient.from(dynamodb);
const hourlyTableName = 'MTA_Subway_Hourly_Ridership';
const perStationTableName = 'MTA_Subway_Hourly_Ridership_Per_Station';

// Useful constants
const chunkSize = 1000;
const MAX_WRITE_ATTEMPTS = 3;
const WRITE_TIMEOUT_MS = 1000;
const WRITE_BATCH_SIZE = 10;

// MTA Ridership API endpoint
const MTA_API_URL = 'https://data.ny.gov/resource/wujg-7c2s.json';

async function fetchMtaData(offset = 0, limit = chunkSize) {
    const selectClause = "$select=transit_timestamp,ridership,complex_id";
    const whereClause = `$where=transit_mode='subway'`;
    const orderClause = "$order=transit_timestamp DESC";
    const limitClause = `$limit=${limit}&$offset=${offset}`;
    const url = encodeURI(`${MTA_API_URL}?${selectClause}&${whereClause}&${orderClause}&${limitClause}`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error fetching data: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

async function fetchAndAggregateData() {
    let hourlyRidership = {
        Sun: { hours: [] },
        Mon: { hours: [] },
        Tue: { hours: [] },
        Wed: { hours: [] },
        Thu: { hours: [] },
        Fri: { hours: [] },
        Sat: { hours: [] }
    };
    let perStationRidership = {};
    let offset = 0;
    let firstDate = null;
    let chunk;
    let lastAllowedDate = null;
    let lastDateInChunk;

    do {
        chunk = await fetchMtaData(offset);

        if (!firstDate && chunk.length > 0) {
            firstDate = new Date(chunk[0].transit_timestamp);
            lastAllowedDate = new Date(firstDate);
            lastAllowedDate.setDate(firstDate.getDate() - 7);
        }

        [hourlyRidership, perStationRidership] = processChunk(chunk, hourlyRidership, perStationRidership, lastAllowedDate);
        offset += chunk.length;

        lastDateInChunk = new Date(chunk[chunk.length - 1]?.transit_timestamp);
    } while (chunk.length === chunkSize && lastDateInChunk >= lastAllowedDate);

    hourlyRidership = ensureFullDayHours(hourlyRidership);
    hourlyRidership = populateDailyRidership(hourlyRidership);
    return { hourlyRidership, perStationRidership };
}

function processChunk(chunk, hourlyRidership, perStationRidership, lastAllowedDate) {
    chunk.forEach(entry => {
        const date = new Date(entry.transit_timestamp);

        if (date >= lastAllowedDate) {
            const dayOfWeek = date.toLocaleString('en-US', { weekday: 'short' });
            const hour = date.getHours();
            const complexId = entry.complex_id;

            // Populate overall hourly ridership
            if (!hourlyRidership[dayOfWeek].hours[hour]) {
                hourlyRidership[dayOfWeek].hours[hour] = { ridership: 0 };
            }

            hourlyRidership[dayOfWeek].hours[hour].ridership += parseInt(entry.ridership) || 0;

            // Process per-station ridership
            if (!perStationRidership[dayOfWeek]) {
                perStationRidership[dayOfWeek] = { complexId: [] };
            }
            if (!perStationRidership[complexId][dayOfWeek]) {
                perStationRidership[complexId][dayOfWeek] = { hours: Array(24).fill(0) };
            }
            perStationRidership[complexId][dayOfWeek].hours[hour] += parseInt(entry.ridership) || 0;
        }
    });
    return [hourlyRidership, perStationRidership];
}

function ensureFullDayHours(hourlyRidership) {
    Object.keys(hourlyRidership).forEach(day => {
        for (let hour = 0; hour < 24; hour++) {
            if (!hourlyRidership[day].hours[hour]) {
                hourlyRidership[day].hours[hour] = { ridership: 0 };
            }
        }
    });
    return hourlyRidership;
}

function populateDailyRidership(hourlyRidership) {
    for (const day in hourlyRidership) {
        let dailyTotal = 0;

        hourlyRidership[day].hours.forEach(hourData => {
            dailyTotal += hourData.ridership;
        });

        hourlyRidership[day].dailyRidership = dailyTotal;
        hourlyRidership[day].hours.forEach(hourData => {
            hourData.percent_of_daily = (hourData.ridership / dailyTotal);
        });
    }
    return hourlyRidership;
}

async function storeToDynamoDB(data, tableName) {
    const putRequests = Object.keys(data).map(key => ({
        PutRequest: {
            Item: {
                complex_id: key,
                hourly_ridership: data[key].hours
            }
        }
    }));

    // batch requests
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

async function storeHourlyData(aggregatedData) {
    const hourlyPutRequests = Object.keys(aggregatedData.hourlyRidership).map(dayOfWeek => ({
        PutRequest: {
            Item: {
                day_of_week: dayOfWeek,
                daily_ridership: aggregatedData.hourlyRidership[dayOfWeek].dailyRidership,
                hourly_ridership: aggregatedData.hourlyRidership[dayOfWeek].hours,
            }
        }
    }));

    const hourlyBatchParams = {
        RequestItems: {
            [hourlyTableName]: hourlyPutRequests
        }
    };

    await storeToDynamoDB(hourlyBatchParams.RequestItems, hourlyTableName);
    await storeToDynamoDB(aggregatedData.perStationRidership, perStationTableName);
}

export async function handler() {
    try {
        const aggregatedData = await fetchAndAggregateData();
        await storeHourlyData(aggregatedData);
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
