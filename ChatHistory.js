import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import dotenv from 'dotenv';
dotenv.config();


const client =  new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "ChatHistory";


export const getChatHistory = async (sessionId) => {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "sessionId = :sessionId",
    ExpressionAttributeValues: {
      ":sessionId": sessionId
    },
    ScanIndexForward: true // true for ascending order by sort key (timestamp)
  });

  try {
    const response = await docClient.send(command);
    return response.Items;
  } catch (error) {
    console.error("Error retrieving chat history:", error);
    throw error;
  }
};

