const axios = require('axios');
const AWS = require('aws-sdk');

// Initialize DynamoDB
const dynamodb = new AWS.DynamoDB.DocumentClient();
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

    const params = {
        '$select': 'date, subways_total_estimated_ridership',
        '$where': `date between '${dateStringTwoWeeksAgo}' and '${dateStringToday}'`,
        '$order': 'date DESC'
    };

    try {
        const response = await axios.get(MTA_API_URL, { params });
        return response.data;
    } catch (error) {
        throw new Error(`Error fetching data from MTA API: ${error.message}`);
    }
}

function groupByDayOfWeek(data) {
    /**
     * Group data by day of the week, keeping only the most recent entry for each day.
     */
    const dayOfWeekMap = {};

    data.forEach(entry => {
        const date = new Date(entry.date);
        const dayOfWeek = date.toLocaleString('en-US', { weekday: 'short' });

        if (!dayOfWeekMap[dayOfWeek]) {
            dayOfWeekMap[dayOfWeek] = entry;  // Take the most recent entry
        }
    });

    return dayOfWeekMap;
}

async function storeToDynamoDB(data) {
    /**
     * Store processed MTA data in DynamoDB, with 'day_of_week' as the key.
     */
    const putRequests = Object.keys(data).map(dayOfWeek => ({
        PutRequest: {
            Item: {
                day_of_week: dayOfWeek,  // Use day of the week as the key
                subways_ridership: data[dayOfWeek].subways_total_estimated_ridership
            }
        }
    }));

    const batchParams = {
        RequestItems: {
            [tableName]: putRequests
        }
    };

    try {
        await dynamodb.batchWrite(batchParams).promise();
    } catch (error) {
        throw new Error(`Error storing data in DynamoDB: ${error.message}`);
    }
}

exports.handler = async (event) => {
    /**
     * AWS Lambda handler to fetch, process, and store MTA ridership data.
     */
    try {
        // Step 1: Fetch the MTA ridership data for the last 2 weeks
        const mtaData = await fetchMtaData();

        // Step 2: Group the data by day of the week (keeping only the most recent entry for each day)
        const groupedData = groupByDayOfWeek(mtaData);

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
};
