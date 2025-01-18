import AWS from 'aws-sdk';
import dotenv from 'dotenv';
dotenv.config();


AWS.config.update({
    region:  process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,  // Replace with actual access key
    secretAccessKey:  process.env.AWS_SECRET_ACCESS_KEY  // Replace with actual secret key
});

const dynamoDb = new AWS.DynamoDB();

const createSessionsTable = {
    
    TableName: 'UserSessions',
    KeySchema: [
        { AttributeName: 'id', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' }
    ],
    ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
    }
      
};

// Create the Sessions table
dynamoDb.createTable(createSessionsTable, (err, data) => {
    if (err) {
        console.error("Unable to create table. Error:", JSON.stringify(err, null, 2));
    } else {
        console.log("Created table. Table description:", JSON.stringify(data, null, 2));
        
        // After table is created, enable TTL on the expiresAt attribute
        
    }
});
