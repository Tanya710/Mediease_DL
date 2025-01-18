import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from 'dotenv';
dotenv.config();
const modelLangChain = new ChatGoogleGenerativeAI({
    modelName: "gemini-pro",
    temperature: 0,
    apiKey: process.env.GEMINI_API_KEY_SYMPTOMS
  });
  
  const analyzeHealthReport = async (reportSummary, symptoms, modelLangChain) => {
    const medicalAnalysisPrompt = ChatPromptTemplate.fromMessages([`
      Based on the following medical report summary and symptoms:
      
      Medical Report Summary:
      ${reportSummary}
      
      Reported Symptoms:
      ${symptoms.join(', ')}
      
      Please provide a comprehensive analysis including:
      
      1. Analysis of Current Condition:
         - Connection between symptoms and report results
      
      2. Potential Conditions:
         - Possible medical conditions indicated by the symptoms and report
         - Level of concern (urgent/non-urgent)
      
      3. Recommended Actions:
         - Suggested follow-up tests or examinations
         - Specialists that should be consulted (if any)
         - Timeline for seeking medical attention
      
      4. Lifestyle Recommendations:
         - Dietary adjustments if applicable
         - Physical activity modifications
         - Stress management techniques if relevant
      
      5. Warning Signs:
         - Symptoms that would require immediate medical attention
         - Conditions to monitor closely
      
      Please format the response in clearly labeled sections and prioritize the most critical information first.`
    ])
  
    const chain = medicalAnalysisPrompt.pipe(modelLangChain);
    
    try {
      const response = await chain.invoke({
        input: medicalAnalysisPrompt
      });
      
      return response.content;
    } catch (error) {
      throw new Error(`Error analyzing medical report: ${error.message}`);
    }
  };

  const generateRecoveryPlan = async (conditions, symptoms, modelLangChain) => {
    const recoveryPlanPrompt = ChatPromptTemplate.fromMessages([`
      Based on the following medical conditions and symptoms:
      
      Medical Conditions:
      ${conditions}
      
      Current Symptoms:
      ${symptoms.join(', ')}
      
      Please provide a detailed 7-day recovery plan including:
      
      1. Daily Schedule:
         - Morning routine
         - Afternoon activities
         - Evening routine
         - Rest periods
      
      2. Medication Schedule:
         - Name of recommended medications
         - Dosage for each medication
         - Timing of doses
         - Duration of medication course
         - Potential side effects to watch for
      
      3. Dietary Plan:
         - Recommended meals and timing
         - Foods to avoid
         - Nutritional supplements if needed
      
      4. Foods to avoid
      
      5. Physical Activities:
         - Type of exercises (if appropriate)
         - Duration and intensity
         - Specific precautions
      
      6. Recovery Milestones:
         - Expected progress indicators
         - Warning signs to watch for
         - When to seek medical attention


        
      
      Please provide this information in a structured, day-by-day format with clear sections for medications and general guidelines.
      Note: This is a general recommendation and patients should consult their healthcare provider before starting any medication. Just use a s`
    ]);

    const chain = recoveryPlanPrompt.pipe(modelLangChain);
    
    try {
      const response = await chain.invoke({
        input: recoveryPlanPrompt
      });
      
      return response.content;
    } catch (error) {
      throw new Error(`Error generating recovery plan: ${error.message}`);
    }
  };

  const WeeklyRecoveryPlan = async (req, res) => {
    try {
      const {conditions, symptoms } = req.body;

      // Input validation
      if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
        return res.status(400).json({
          error: 'Invalid input',
          message: 'Medical conditions are required and must be an array'
        });
      }

      const recoveryPlan = await generateRecoveryPlan(
        conditions,
        symptoms || [], 
        modelLangChain
      );

      res.json({
        message: 'Weekly recovery plan generated successfully',
        recoveryPlan: recoveryPlan
      });
    } catch (error) {
      console.error('Error generating recovery plan:', error);
      res.status(500).json({
        error: 'Error generating recovery plan',
        details: error.message
      });
    }
  };

  const HealthRecommendations = async (req, res) => {
    try {
      const { reportSummary, symptoms } = req.body;
  
      // Input validation
      if (!reportSummary) {
        return res.status(400).json({
          error: 'Invalid input',
          message: 'Medical report summary is required'
        });
      }
  
      // Symptoms are now optional
      const analysis = await analyzeHealthReport(reportSummary, symptoms || [], modelLangChain);
  
      res.json({
        message: 'Medical report and symptoms analyzed successfully',
        analysis: analysis
      });
    } catch (error) {
      console.error('Error processing medical analysis:', error);
      res.status(500).json({
        error: 'Error analyzing medical report and symptoms',
        details: error.message
      });
    }
  };

  export { 
    HealthRecommendations, 
    analyzeHealthReport,
    WeeklyRecoveryPlan,
    generateRecoveryPlan
  };