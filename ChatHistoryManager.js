import {  getChatHistory } from '../models/ChatHistory.js';
import { createSession, updateSessionActivity, getSession, getUserSessions } from '../models/Session.js';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import dotenv from 'dotenv';
dotenv.config();

// Initialize the DynamoDB client
const dynamoDb = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Create a DynamoDB Document client
const docClient = DynamoDBDocumentClient.from(dynamoDb);

class ChatHistoryManager {
  static async createNewSession(userId) {
    if (!userId) {
      throw new Error('userId is required to create a new session');
    }
    return await createSession(userId);
  }

  static async saveMessage(sessionId,userId, role, content) {
    try {
      let messageContent = content;
      let messageType = "text";

      // Check if content is a JSON string containing file information
      if (typeof content === 'string' && content.startsWith('{')) {
        try {
          const parsedContent = JSON.parse(content);
          if (parsedContent.type === 'pdf_upload' || parsedContent.type === 'pdf_summary') {
            messageType = parsedContent.type;
            messageContent = {
              fileName: parsedContent.fileName,
              fileUrl: parsedContent.fileUrl,
              content: parsedContent.content // Only for pdf_summary
            };
          }
        } catch (e) {
          // If parsing fails, treat as regular text
          messageContent = content;
        }
      }

      // Convert timestamp to ISO string format
      const timestamp = new Date().toISOString();
      const command = new PutCommand({
        TableName: 'ChatHistory',
        Item: {
          sessionId,
          timestamp,  // Now using ISO string instead of numeric timestamp
          role,
          content: messageContent,
          type: messageType,
          userId
        }
      });

      await docClient.send(command);
      return { success: true };
    } catch (error) {
      console.error('Error saving message:', error);
      return { success: false, error };
    }
  }

  static async getSessionHistory(sessionId) {
    try {
      // Verify session exists
      const session = await getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Update session activity
      await updateSessionActivity(sessionId);

      // Get chat history
      return await getChatHistory(sessionId);
    } catch (error) {
      console.error('Error retrieving chat history:', error);
      throw error;
    }
  }

  static async formatHistoryForLangChain(sessionId) {
    const messages = await this.getSessionHistory(sessionId);
    return messages.map(msg => [msg.role, msg.content]);
  }

  static async getUserChatHistory(userId) {
    try {
      // First get all sessions for this user
      const userSessions = await getUserSessions(userId);
      
      // Then get chat history for each session
      const allHistory = await Promise.all(
        userSessions.map(async (session) => {
          const history = await getChatHistory(session.sessionId);
          return {
            sessionId: session.sessionId,
            createdAt: session.createdAt,
            messages: history
          };
        })
      );

      return allHistory;
    } catch (error) {
      console.error('Error retrieving user chat history:', error);
      throw error;
    }
  }
  
}

export default ChatHistoryManager;