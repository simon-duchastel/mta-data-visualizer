import { DynamoDBClient, } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand} from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB
const dynamodb = new DynamoDBClient({ region: "us-west-2" });
const dynamodbClient = DynamoDBDocumentClient.from(dynamodb);
const tableName = 'MTA_Subway_Daily_Ridership';

// MTA Ridership API endpoint
const MTA_API_URL = 'https://data.ny.gov/resource/vxuj-8kew.json';

async function fetchMtaData() {
    /**
     * Fetch the MTA ridership data from the last 2 weeks.
     */
    const today = new Date();
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(today.getDate() - 14);

    const dateStringToday = today.toISOString().split('T')[0];  // YYYY-MM-DD format
    const dateStringTwoWeeksAgo = twoWeeksAgo.toISOString().split('T')[0];

    const selectClause = "$select=date,subways_total_estimated_ridership";
    const whereClause = `$where=date between '${dateStringTwoWeeksAgo}' and '${dateStringToday}'`;
    const orderClause = "$order=date DESC";
    const url = encodeURI(`${MTA_API_URL}?${selectClause}&${whereClause}&${orderClause}`);

    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error making HTTP request to MTA data: ${response.status} ${response.statusText}`);
            }

            console.log(`Received ${response.status} from ${response.url}`);
            return response.json();
        }).then((data) => {
            const stringifiedData = JSON.stringify(data);
            console.log(`Parsed json response: ${stringifiedData}`);
            return data
        })
        .catch(error => {
            throw new Error(`Error fetching data from MTA API: ${error.message}`);
        });
}

function getSubwayRidershipByDayOfWeek(data) {
    /**
     * Group data by day of the week, keeping only the most recent entry for each day.
     */
    const dayOfWeekMap = {};

    data.forEach(entry => {
        const date = new Date(entry.date);
        const dayOfWeek = date.toLocaleString('en-US', { weekday: 'short' });

        const subwayRidership = parseInt(entry.subways_total_estimated_ridership)
        if (!dayOfWeekMap[dayOfWeek] && subwayRidership && subwayRidership > 0) {
            dayOfWeekMap[dayOfWeek] = subwayRidership;  // Take the most recent entry
        }
    });

    console.log(`Created updated dayOfWeek mapping: ${JSON.stringify(dayOfWeekMap)}`);

    return dayOfWeekMap;
}

async function storeToDynamoDB(data) {
    /**
     * Store processed MTA data in DynamoDB, with 'day_of_week' as the key.
     */
    const dataKeys = Object.keys(data);
    const putRequests = dataKeys.map(dayOfWeek => ({
        PutRequest: {
            Item: {
                day_of_week: dayOfWeek,  // Use day of the week as the key
                subway_ridership: data[dayOfWeek],
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
        console.log(`Successfully updated ${dataKeys.length} values in ${tableName}`);
    } catch (error) {
        throw new Error(`Error storing data in DynamoDB: ${error.message}`);
    }
}

export async function handler() {
    /**
     * AWS Lambda handler to fetch, process, and store MTA ridership data.
     */
    try {
        // Step 1: Fetch the MTA ridership data for the last 2 weeks
        const fetchStart = new Date();
        const mtaData = await fetchMtaData();
        const fetchEnd = new Date();
        console.log(`${MTA_API_URL} call duration: ${(fetchEnd - fetchStart) / 1000} seconds`);


        // Step 2: Group the data by day of the week (keeping only the most recent entry for each day)
        const groupedData = getSubwayRidershipByDayOfWeek(mtaData);

        // Step 3: Store the data into DynamoDB
        await storeToDynamoDB(groupedData);

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
