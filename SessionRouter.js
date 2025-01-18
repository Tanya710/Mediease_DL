import { Router } from 'express';
import createNewSession from '../controllers/session_controller.js';
import { isAuthenticated } from '../middleware/AuthMiddleware.js';


const sessionRouter = Router()

sessionRouter.post('/create-session',isAuthenticated, createNewSession);

export default sessionRouter