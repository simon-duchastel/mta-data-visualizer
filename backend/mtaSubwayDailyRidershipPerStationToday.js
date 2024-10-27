import { DynamoDBClient, ScanCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB
const dynamodb = new DynamoDBClient({ region: "us-west-2" });
const dynamodbClient = DynamoDBDocumentClient.from(dynamodb);
const dailyTableName = 'MTA_Subway_Daily_Ridership';
const hourlyTableName = 'MTA_Subway_Hourly_Ridership_Per_Station';
const stationsTableName = 'MTA_Subway_Stations';

// Useful constants
const timeZoneEST = "America/New_York";
const secondsPerHour = 60 * 60;
const hoursPerDay = 24;
const TOP_N = 5; // Define the number of top stations you want to retrieve

// Function to calculate percentage of day passed in EST. Returns a float.
function calculateDayProgressInEST() {
    const now = new Date();
    const midnight = new Date();
    midnight.setUTCHours(0, 0, 0, 0);

    // Calculate the elapsed time in ms
    const totalSecondsInDay = 24 * 60 * 60; // 24hrs x 60min x 60s
    const offsetMsFromEST = getOffsetFromEST();
    let elapsedMs = now - midnight;

    if (elapsedMs < offsetMsFromEST) {
        // if the elapsed time is less than the offset, then we're in a different day than EST.
        // we account for that by adding a day hours after subtracting
        const totalMsInDay = totalSecondsInDay * 1000;
        elapsedMs += totalMsInDay;
    }
    elapsedMs -= offsetMsFromEST;

    const elapsedSeconds = elapsedMs / 1000; // convert ms to s
    return elapsedSeconds / totalSecondsInDay;
}

function getOffsetFromEST() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const est = new Date(now.toLocaleString("en-US", { timeZone: timeZoneEST }));
    return now - est; // difference between current time and EST-normalized in ms
}

export async function handler() {
    try {
        const today = new Date();
        const dateFormatter = new Intl.DateTimeFormat('en-US', {
            weekday: "short",
            timeZone: timeZoneEST,
        });
        const dayOfWeek = dateFormatter.format(today);

        // Query daily DynamoDB for today's ridership data
        const dailyParams = {
            TableName: dailyTableName,
            Key: {
                day_of_week: { S: dayOfWeek }
            }
        };

        const dailyData = await dynamodbClient.send(new GetItemCommand(dailyParams));

        // Check if data was found
        if (!dailyData.Item) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: `No data found for ${dayOfWeek}` }),
            };
        }

        // Get the daily ridership from DynamoDB
        const subwayRidership = parseInt(dailyData.Item.subway_ridership.N);

        // Scan MTA_Subway_Stations to get all complex_ids and metadata
        const scanParams = {
            TableName: stationsTableName
        };
        const stationData = await dynamodbClient.send(new ScanCommand(scanParams));

        // Collect station details with first name in list as complex name
        const stations = stationData.Items.map(item => ({
            complexId: item.complex_id.S,
            complexName: item.name.L[0].S, // Use the first name in the list
        }));

        const dayProgress = calculateDayProgressInEST();
        const numHoursPassed = Math.floor(dayProgress * hoursPerDay);
        const topStations = [];

        for (const station of stations) {
            const hourlyParams = {
                TableName: hourlyTableName,
                KeyConditionExpression: 'complex_id = :complexId and day_of_week = :dayOfWeek',
                ExpressionAttributeValues: {
                    ':complexId': { S: station.complexId },
                    ':dayOfWeek': { S: dayOfWeek }
                },
                Limit: 1
            };

            const hourlyData = await dynamodbClient.send(new QueryCommand(hourlyParams));

            // If hourly data exists for this station, calculate estimated ridership
            if (hourlyData.Items && hourlyData.Items.length > 0) {
                const ridership = parseInt(hourlyData.Items[0].ridership.N);
                topStations.push({
                    id: station.complexId,
                    name: station.complexName,
                    estimatedRidershipToday: subwayRidership,
                    estimatedRidershipSoFar: Math.floor(ridership * dayProgress), // Scale by day progress
                    ridersPerHour: Math.floor(ridership / hoursPerDay),
                });
            }
        }

        // Sort stations client-side by estimatedRidershipSoFar, descending
        topStations.sort((a, b) => b.estimatedRidershipSoFar - a.estimatedRidershipSoFar);

        return {
            statusCode: 200,
            body: JSON.stringify({
                day: dayOfWeek,
                stations: topStations.slice(0, TOP_N), // Limit to top N stations
            }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Error fetching data: ${error.message}` }),
        };
    }
}
