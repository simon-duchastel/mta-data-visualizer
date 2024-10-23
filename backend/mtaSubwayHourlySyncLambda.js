import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB
const dynamodb = new DynamoDBClient({ region: "us-west-2" });
const dynamodbClient = DynamoDBDocumentClient.from(dynamodb);
const tableName = 'MTA_Subway_Hourly_Ridership';

// Useful contstants
const chunkSize = 1000;

// MTA Ridership API endpoint
const MTA_API_URL = 'https://data.ny.gov/resource/wujg-7c2s.json';

async function fetchMtaData(offset = 0, limit = chunkSize) {
    const selectClause = "$select=transit_timestamp,ridership";
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
        Sun: {
            hours: []
        }, Mon: {
            hours: []
        }, Tue: {
            hours: []
        }, Wed: {
            hours: []
        }, Thu: {
            hours: []
        }, Fri: {
            hours: []
        }, Sat: {
            hours: []
        } 
    };
    let offset = 0;
    let firstDate = null;
    let chunk;
    let lastAllowedDate = null;
    let lastDateInChunk;

    do {
        chunk = await fetchMtaData(offset);

        // If this is the first batch, capture the most recent date (first date)
        if (!firstDate && chunk.length > 0) {
            firstDate = new Date(chunk[0].transit_timestamp);
            lastAllowedDate = new Date(firstDate);
            lastAllowedDate.setDate(firstDate.getDate() - 7);
        }

        hourlyRidership = processChunk(chunk, hourlyRidership, lastAllowedDate);
        offset += chunk.length;

        lastDateInChunk = new Date(chunk[chunk.length - 1]?.transit_timestamp);
    } while (chunk.length === chunkSize && lastDateInChunk >= lastAllowedDate);

    hourlyRidership = ensureFullDayHours(hourlyRidership);
    hourlyRidership = populateDailyRidership(hourlyRidership);
    return hourlyRidership;
}

function processChunk(chunk, hourlyRidership, lastAllowedDate) {
    chunk.forEach(entry => {
        const date = new Date(entry.transit_timestamp);

        // Only process 7 days of data
        if (date >= lastAllowedDate) {
            const dayOfWeek = date.toLocaleString('en-US', { weekday: 'short' });
            const hour = date.getHours();

            if (!hourlyRidership[dayOfWeek]["hours"][hour]) {
                hourlyRidership[dayOfWeek]["hours"][hour] = { ridership: 0 };
            }

            hourlyRidership[dayOfWeek]["hours"][hour].ridership += parseInt(entry.ridership) || 0;
        }
    });
    return hourlyRidership;
}

// do a pass to ensure that each hour has populated,
// and set its ridership to 0 if not
function ensureFullDayHours(hourlyRidership) {
    Object.keys(hourlyRidership).forEach(day => {
        for (let hour = 0; hour < 24; hour++) {
            if (!hourlyRidership[day]["hours"][hour]) {
                hourlyRidership[day]["hours"][hour].ridership = 0;
            }
        }
    });
    return hourlyRidership;
}

// Add daily ridership to each day and add % of daily ridership
// to each hour
function populateDailyRidership(hourlyRidership) {
    for (day in hourlyRidership) {
        let dailyTotal = 0;

        hourlyRidership[day]["hours"].forEach(hourData => {
            dailyTotal += hourData.ridership;
        });

        // add "dailyRidership" for the day
        // add "percent_of_daily" to each hour
        hourlyRidership[day].dailyRidership = dailyTotal;
        hourlyRidership[day]["hours"].forEach(hourData => {
            hourData.percent_of_daily = (hourData.ridership / dailyTotal);
        });
    }

    return hourlyRidership;
}

async function storeToDynamoDB(data) {
    const putRequests = Object.keys(data).map(dayOfWeek => ({
        PutRequest: {
            Item: {
                day_of_week: dayOfWeek,
                daily_ridership: data[dayOfWeek].dailyRidership,
                hourly_ridership: data[dayOfWeek]["hours"],
            }
        }
    }));

    const batchParams = {
        RequestItems: {
            [tableName]: putRequests
        }
    };

    try {
        await dynamodbClient.send(new BatchWriteCommand(batchParams));
        console.log(`Successfully stored data in ${tableName}`);
    } catch (error) {
        throw new Error(`Error storing data in DynamoDB: ${error.message}`);
    }
}

export async function handler() {
    try {
        // Fetch and aggregate the most recent 7 days of MTA subway ridership data
        const aggregatedData = await fetchAndAggregateData();

        // Store the aggregated data into DynamoDB
        await storeToDynamoDB(aggregatedData);

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
