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
        // use EST where the NYC MTA operates to get the current date in NYC
        const timeZone = "America/New_York"
        const today = new Date()
        const dateFormatter = new Intl.DateTimeFormat('en-US', {
            weekday: "short",
            timeZone: timeZone,
          })
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

        // Get the ridership count as a number and return it in the API
        const subwayRidership = parseInt(data.Item.subway_ridership.N);
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
