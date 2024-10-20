import { DynamoDBClient, GetItemCommand  } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient} from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB
const dynamodb = new DynamoDBClient({ region: "us-west-2" });
const dynamodbClient = DynamoDBDocumentClient.from(dynamodb);
const tableName = 'MTA_Subway_Daily_Ridership';

export async function handler() {
    /**
     * AWS Lambda handler to retrieve the current day's subway ridership from DynamoDB.
     */
    try {
        const today = new Date();
        const dayOfWeek = today.toLocaleString('en-US', { weekday: 'short' });

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

        const subwayRidership = data.Item.subway_ridership.N; // Get the ridership count as a number
        return {
            statusCode: 200,
            body: JSON.stringify({
                day: dayOfWeek,
                subway_ridership: subwayRidership
            }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Error fetching data: ${error.message}` }),
        };
    }
}
