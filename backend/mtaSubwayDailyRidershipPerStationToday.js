import { DynamoDBClient, BatchGetItemCommand, GetItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB
const dynamodb = new DynamoDBClient({ region: "us-west-2" });
const dynamodbClient = DynamoDBDocumentClient.from(dynamodb);
const dailyTableName = 'MTA_Subway_Daily_Ridership';
const hourlyTableName = 'MTA_Subway_Hourly_Ridership';
const hourlyPerStationTableName = 'MTA_Subway_Hourly_Ridership_Per_Station';
const stationsTableName = 'MTA_Subway_Stations';

// Useful constants
const timeZoneEST = "America/New_York";
const hoursPerDay = 24;

// Function to calculate percentage of day passed in EST
function calculateDayProgressInEST() {
    const now = new Date();
    const midnight = new Date();
    midnight.setUTCHours(0, 0, 0, 0);
    const totalSecondsInDay = 24 * 60 * 60;
    const offsetMsFromEST = getOffsetFromEST();
    let elapsedMs = now - midnight;

    if (elapsedMs < offsetMsFromEST) {
        const totalMsInDay = totalSecondsInDay * 1000;
        elapsedMs += totalMsInDay;
    }
    elapsedMs -= offsetMsFromEST;

    const elapsedSeconds = elapsedMs / 1000;
    return elapsedSeconds / totalSecondsInDay;
}

function getOffsetFromEST() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const est = new Date(now.toLocaleString("en-US", { timeZone: timeZoneEST }));
    return now - est;
}

export async function handler(event) {
    try {
        const top = parseInt(event.queryStringParameters?.top);
        if (isNaN(top) || top < 1 || top > 10) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "'top' must be an integer between 1 and 10" }),
            };
        }

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
        const hourlyParams = {
            TableName: hourlyTableName,
            Key: {
                day_of_week: { S: dayOfWeek }
            }
        }
        const dailyData = await dynamodbClient.send(new GetItemCommand(dailyParams));
        const hourlyData = await dynamodbClient.send(new GetItemCommand(hourlyParams));

        if (!dailyData.Item) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: `No data found for ${dayOfWeek}` }),
            };
        }
        const subwayRidership = parseInt(dailyData.Item.subway_ridership.N);

        // Scan MTA_Subway_Stations to get all complex_ids and metadata
        const scanParams = {
            TableName: stationsTableName
        };
        const stationData = await dynamodbClient.send(new ScanCommand(scanParams));

        const stations = stationData.Items.map(item => ({
            complexId: item.complex_id.S,
            complexName: item.name.L[0].S,
        }));

        // Calculate a scale factor since the hourly ridership is an underestimate
        // and daily ridership isn't
        const ridershipEstimatedFromHourly = parseInt(hourlyData.Item.daily_ridership.N);
        const ridershipRatio = subwayRidership / ridershipEstimatedFromHourly;

        const dayProgress = calculateDayProgressInEST();
        const numHoursPassed = Math.floor(dayProgress * hoursPerDay);
        const percentOfHourPassed = (dayProgress * hoursPerDay) - numHoursPassed;

        // Fetch all 24 hours of data for the top stations
        const topStations = [];
        for (const station of stations.slice(0, top)) {
            const keys = Array.from({ length: hoursPerDay }, (_, hour) => ({
                "complex_id": { S: `${station.complexId}-${dayOfWeek}-${hour}` }
            }));
            const hourlyParams = {
                RequestItems: {
                    [hourlyPerStationTableName]: {
                        Keys: keys
                    }
                }
            };
            const hourlyData = await dynamodbClient.send(new BatchGetItemCommand(hourlyParams));
            const hourlyRidership = hourlyData.Responses[hourlyPerStationTableName].map(item => parseInt(item.ridership.N));

            // Sum ridership data up to the current hour
            let estimatedRidershipSoFar = 0;
            for (let i = 0; i < numHoursPassed; i++) {
                estimatedRidershipSoFar += hourlyRidership[i];
            }
            estimatedRidershipSoFar += percentOfHourPassed * hourlyRidership[numHoursPassed];
            estimatedRidershipSoFar = Math.floor(estimatedRidershipSoFar * ridershipRatio);

            // Calculate riders per hour for the current hour, scaled
            const ridersPerHour = hourlyRidership[numHoursPassed] * ridershipRatio;

            // Calculate total estimated ridership for the day based on hourly totals
            const totalDayRidership = Math.floor(hourlyRidership.reduce((sum, hour) => sum + hour, 0) * ridershipRatio);

            topStations.push({
                id: station.complexId,
                name: station.complexName,
                estimatedRidershipToday: totalDayRidership,
                estimatedRidershipSoFar,
                ridersPerHour,
            });
        }

        topStations.sort((a, b) => b.estimatedRidershipSoFar - a.estimatedRidershipSoFar);

        return {
            statusCode: 200,
            body: JSON.stringify({
                day: dayOfWeek,
                estimated_ridership_today: subwayRidership,
                top_stations: topStations.slice(0, top),
            }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Error fetching data: ${error.message}` }),
        };
    }
}
