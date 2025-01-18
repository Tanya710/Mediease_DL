import { Router } from "express";
import { AnalyzeSelectedSymptoms } from "../controllers/symptoms_controller.js";




const symptomsRouter = Router()

symptomsRouter.post("/analyze-symptoms", AnalyzeSelectedSymptoms)

export default symptomsRouter