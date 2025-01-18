import { Router } from "express";
import { HealthRecommendations, WeeklyRecoveryPlan } from "../controllers/recommondation_controller.js";


const recommendationRouter = Router()

recommendationRouter.post("/recommendation", HealthRecommendations)
recommendationRouter.post("/recovery-plan", WeeklyRecoveryPlan)

export default recommendationRouter