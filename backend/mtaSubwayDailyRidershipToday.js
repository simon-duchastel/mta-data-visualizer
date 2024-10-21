import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB
const dynamodb = new DynamoDBClient({ region: "us-west-2" });
const dynamodbClient = DynamoDBDocumentClient.from(dynamodb);
const tableName = 'MTA_Subway_Daily_Ridership';

// Useful constants
const timeZoneEST = "America/New_York";

// Function to calculate percentage of day passed in EST. Returns a float.
function calculateDayProgressInEST() {
    // get the current time and midnight (note this is localized to whatever timezone the
    // lambda is running in)
    const now = new Date();
    const midnight = new Date();
    midnight.setUTCHours(0, 0, 0, 0);

    // Calculate the elapsed time in ms
    const totalSecondsInDay = 24 * 60 * 60; // 24hrs x 60min x 60s
    const offsetMsFromEST = getOffsetFromEST();
    var elapsedMs = now - midnight;

    // adjust for the EST offest
    if (elapsedMs < offsetMsFromEST) {
        // if the elapsed time is less than the offset, then we're in a different day than EST.
        // we account for that by adding a day hours after subtracting
        const totalMsInDay = totalSecondsInDay * 1000;
        elapsedMs += totalMsInDay;
    }
    elapsedMs -= offsetMsFromEST;
    
    const elapsedSeconds = elapsedMs /= 1000; // convert ms to s
    return elapsedSeconds / totalSecondsInDay;
}

function getOffsetFromEST() {
    const now = new Date();
    now.setHours(0, 0, 0, 0, 0,)
    const est = new Date(now.toLocaleString("en-US", { timeZone: timeZoneEST }));
    return now - est; // difference between current time and EST-normalized in ms
}

export async function handler() {
    /**
     * AWS Lambda handler to retrieve the current day's subway ridership from DynamoDB
     * and calculate estimated ridership based on the percentage of the day passed.
     */
    try {
        const today = new Date();
        const dateFormatter = new Intl.DateTimeFormat('en-US', {
            weekday: "short",
            timeZone: timeZoneEST,
        });
        const dayOfWeek = dateFormatter.format(today);

        // Query DynamoDB for today's ridership data
        const params = {
            TableName: tableName,
            Key: {
                day_of_week: { S: dayOfWeek }
            }
        };

        const data = await dynamodbClient.send(new GetItemCommand(params));

        // Check if data was found
        if (!data.Item) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: `No data found for ${dayOfWeek}` }),
            };
        }

        // Get the ridership from DynamoDB
        const subwayRidership = parseInt(data.Item.subway_ridership.N);
        const dayProgress = calculateDayProgressInEST();
        const estimatedRidershipSoFar = Math.floor(subwayRidership * dayProgress);

        console.log(`Calculated that the day is ${dayProgress * 100}% in progresss`);
        return {
            statusCode: 200,
            body: JSON.stringify({
                day: dayOfWeek,
                estimated_ridership_today: subwayRidership,
                estimated_ridership_so_far: estimatedRidershipSoFar,
            }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Error fetching data: ${error.message}` }),
        };
    }
}
