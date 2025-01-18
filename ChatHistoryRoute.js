import express from 'express';
import { getChatHistory } from '../models/ChatHistory.js';
import { isAuthenticated } from '../middleware/AuthMiddleware.js';
import ChatHistoryManager from '../controllers/ChatHistoryManager.js';

const ChatHistoryRouter = express.Router();

ChatHistoryRouter.get('/chat-history/:sessionId', isAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = await getChatHistory(sessionId);
    res.json({ messages });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});


ChatHistoryRouter.get('/c/history', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user.userId;
    const history = await ChatHistoryManager.getUserChatHistory(userId);
    res.json(history);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

export default ChatHistoryRouter;