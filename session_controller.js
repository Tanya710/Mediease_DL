import ChatHistoryManager from "./ChatHistoryManager.js";



const createNewSession = async (req, res) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      const userId = req.user.userId;
      const sessionId = await ChatHistoryManager.createNewSession(userId);
      res.json({ sessionId });
    } catch (error) {
      console.error('Error creating new session:', error);
      res.status(500).json({ error: 'Failed to create new session' });
    }
  };

export default createNewSession