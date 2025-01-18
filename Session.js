import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
dotenv.config();


const client = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "Sessions";

export const createSession = async (userId) => {
  const sessionId = uuidv4();
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      sessionId,
      userId,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
    }
  });

  try {
    await docClient.send(command);
    return sessionId;
  } catch (error) {
    console.error("Error creating session:", error);
    throw error;
  }
};

export const updateSessionActivity = async (sessionId) => {
  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { sessionId },
    UpdateExpression: "SET lastActivity = :lastActivity, expiresAt = :expiresAt",
    ExpressionAttributeValues: {
      ":lastActivity": new Date().toISOString(),
      ":expiresAt": Math.floor(Date.now() / 1000) + (24 * 60 * 60)
    }
  });

  try {
    await docClient.send(command);
    return true;
  } catch (error) {
    console.error("Error updating session:", error);
    throw error;
  }
};

export const getSession = async (sessionId) => {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: { sessionId }
  });

  try {
    const response = await docClient.send(command);
    return response.Item;
  } catch (error) {
    console.error("Error getting session:", error);
    throw error;
  }
};

export const getUserSessions = async (userId) => {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "UserIdIndex",
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": userId
    }
  });

  try {
    const response = await docClient.send(command);
    return response.Items;
  } catch (error) {
    console.error("Error getting user sessions:", error);
    throw error;
  }
}; 

