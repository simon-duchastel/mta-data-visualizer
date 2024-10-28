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
    const selectClause = "$select=transit_timestamp,ridership,station_complex_id";
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
        Sun: { hours: Array(24).fill({ ridership: 0 }) },
        Mon: { hours: Array(24).fill({ ridership: 0 }) },
        Tue: { hours: Array(24).fill({ ridership: 0 }) },
        Wed: { hours: Array(24).fill({ ridership: 0 }) },
        Thu: { hours: Array(24).fill({ ridership: 0 }) },
        Fri: { hours: Array(24).fill({ ridership: 0 }) },
        Sat: { hours: Array(24).fill({ ridership: 0 }) }
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

    hourlyRidership = populateDailyRidership(hourlyRidership);
    perStationRidership = populateComplexDailyRidership(perStationRidership);
    return [hourlyRidership, perStationRidership];
}

function processChunk(chunk, hourlyRidership, perStationRidership, lastAllowedDate) {
    chunk.forEach(entry => {
        const date = new Date(entry.transit_timestamp);

        if (date >= lastAllowedDate) {
            const dayOfWeek = date.toLocaleString('en-US', { weekday: 'short' });
            const hour = date.getHours();
            const complexId = entry.station_complex_id;

            // Populate overall hourly ridership
            hourlyRidership[dayOfWeek].hours[hour].ridership += parseInt(entry.ridership) || 0;

            // Process per-station ridership
            if (!perStationRidership[complexId]) {
                perStationRidership[complexId] = {};
            }
            if (!perStationRidership[complexId][dayOfWeek]) {
                perStationRidership[complexId][dayOfWeek] = { hours: Array.from({ length: 24 }, () => ({ ridership: 0 })) }
            }
            perStationRidership[complexId][dayOfWeek].hours[hour].ridership += parseInt(entry.ridership) || 0;
        }
    });
    return [hourlyRidership, perStationRidership];
}

function populateDailyRidership(hourlyRidership) {
    for (const day in hourlyRidership) {
        let dailyTotal = hourlyRidership[day].hours.reduce((sum, hourData) => sum + hourData.ridership, 0);
        hourlyRidership[day].dailyRidership = dailyTotal;
        hourlyRidership[day].hours.forEach(hourData => {
            hourData.percent_of_daily = (hourData.ridership / dailyTotal) || 0;
        });
    }
    return hourlyRidership;
}

function populateComplexDailyRidership(perStationRidership) {
    for (const complexId in perStationRidership) {
        for (const day in perStationRidership[complexId]) {
            const hourDataArray = perStationRidership[complexId][day].hours;
            let dailyTotal = hourDataArray.reduce((sum, hourData) => sum + hourData.ridership, 0);
            perStationRidership[complexId][day].dailyTotal = dailyTotal;
            hourDataArray.forEach(hourData => {
                hourData.percent_of_daily = (hourData.ridership / dailyTotal) || 0;
            });
        }
    }
    return perStationRidership;
}

async function storeHourlyData(hourlyData) {
    const putRequests = Object.keys(hourlyData).map(dayOfWeek => ({
        PutRequest: {
            Item: {
                day_of_week: dayOfWeek,
                daily_ridership: hourlyData[dayOfWeek].dailyRidership,
                hourly_ridership: hourlyData[dayOfWeek].hours,
            }
        }
    }));

    await storeToDynamoDB(putRequests, hourlyTableName);
}

async function storePerStationData(perStationData) {
    const putRequests = [];

    for (const complexId in perStationData) {
        for (const dayOfWeek in perStationData[complexId]) {
            const hours = perStationData[complexId][dayOfWeek].hours;
            for (let hour = 0; hour < 24; hour++) {
                const ridership = hours[hour].ridership || 0;
                putRequests.push({
                    PutRequest: {
                        Item: {
                            complex_id: `${complexId}-${dayOfWeek}-${hour}`,
                            ridership: ridership,
                            percent_of_daily: hours[hour].percent_of_daily,
                        }
                    }
                });
            }
        }
    }

    await storeToDynamoDB(putRequests, perStationTableName);
}

async function storeToDynamoDB(putRequests, tableName) {
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
                console.error(`PUT to dynamo table ${tableName} attempt #${attempt} failed: ${error.message}`);

                if (attempt < MAX_WRITE_ATTEMPTS) {
                    console.log(`Retrying in ${WRITE_TIMEOUT_MS / 1000}s...`);
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
        const [hourlyRidership, perStationRidership] = await fetchAndAggregateData();
        await storeHourlyData(hourlyRidership);
        await storePerStationData(perStationRidership);
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
