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
    const now = new Date();

    // Current time in EST
    const options = { timeZone: timeZoneEST, hour12: false };
    const currentEST = new Date(now.toLocaleString('en-US', options));

    // Start of the day in EST
    const startOfDayEST = new Date(currentEST);
    startOfDayEST.setHours(0, 0, 0, 0); // Midnight in EST

    // Calculate the elapsed seconds so far and then get a ratio from the total seconds
    const totalSecondsInDay = 24 * 60 * 60; // 24hrs x 60min x 60s
    const elapsedSeconds = Math.floor((currentEST - startOfDayEST) / 1000); // divide by 1000 to convert ms to s
    return elapsedSeconds / totalSecondsInDay;
}

export async function handler() {
    /**
     * AWS Lambda handler to retrieve the current day's subway ridership from DynamoDB
     * and calculate estimated ridership based on the percentage of the day passed.
     */
    try {
        const timeZone = "America/New_York";
        const today = new Date();
        const dateFormatter = new Intl.DateTimeFormat('en-US', {
            weekday: "short",
            timeZone: timeZone,
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
