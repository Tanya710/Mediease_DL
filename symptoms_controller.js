
//symptoms controller.js
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from 'dotenv';
dotenv.config();



const modelLangChain = new ChatGoogleGenerativeAI({
    modelName: "gemini-1.5-flash",
    temperature: 0,
    apiKey: process.env.GEMINI_API_KEY_SYMPTOMS
  });


  const symptomsExtractionPrompt = ChatPromptTemplate.fromMessages([
    [
        "system",
        `
        You are a medical report analysis system. Your task is to give the symptoms that user might have after looking at the report:
        1. Return the symptoms that user might have after looking at the from the extracted text from medical report that is given to you
        2. Return them as a simple comma-separated list
        3. DO NOT include any analysis, recommendations, or other information
        4. Format each symptom as a clear, concise phrase
        5. Atleast give 6 symptoms that user might have
        
        Example output:
        fever, headache, muscle pain, fatigue
        `
    ],
    ["human", "{input}"]
]);


const medicalAnalysisPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `
      You are an expert medical analysis system specializing in diagnostic report interpretation. Your tasks are to:
      1. You are extracted text from the medical report.
      2. When given a list of selected symptoms, analyze their correlation and provide:
         - Potential conditions that might be indicated
         - Additional recommended medical tests or checkups
         - General health recommendations
      
      Always include appropriate medical disclaimers and encourage consulting healthcare professionals.
      `
    ],
    ["placeholder", "{chat_history}"],
    ["human", "{input}"]
  ]);
  

  const extractSymptoms = async (reportContent) => {
    try {
        // Ensure we have text content
        if (!reportContent) {
            throw new Error('No report content provided');
        }

        if (Array.isArray(reportContent) && reportContent[0]?.pageContent) {
            // Extract and combine the text content from all pages
            const fullText = reportContent
                .map(doc => doc.pageContent)
                .join('\n')
                .trim();
    
            if (!fullText) {
                throw new Error('No text content found in the documents');
            }
    
            reportContent = fullText;
        }

        console.log(reportContent)


        const chain = symptomsExtractionPrompt.pipe(modelLangChain);
        
        const response = await chain.invoke({
            input: `Extract only the symptoms from this medical report text:
                   ${reportContent}
                   Return just the symptoms as a comma-separated list.`
        });

        // Get the response content
        let symptomsText = response.content;

        console.log("sympotoms Text: ", symptomsText)

        // Clean up and split the symptoms into an array
        const symptoms = symptomsText
            .split(',')
            .map(symptom => symptom.trim())
            .filter(symptom => symptom.length > 0);

        return {
            success: true,
            symptoms: symptoms
        };

    } catch (error) {
        console.error('Error extracting symptoms:', error);
        return {
            success: false,
            symptoms: [],
            error: error.message
        };
    }
};


const analyzeSymptoms = async (selectedSymptoms, modelLangChain) => {
    const chain = medicalAnalysisPrompt.pipe(modelLangChain);
    
    const response = await chain.invoke({
      input: `Based on the following symptoms:
              ${selectedSymptoms.join(', ')}
              
              Please provide:
              1. Potential conditions that might be indicated
              2. Recommended additional medical tests or checkups
              3. General health recommendations
              
              Format the response in clear sections.`
    });
    
    return response.content;
  };


const AnalyzeSelectedSymptoms = async (req, res) => {
    const { selectedSymptoms } = req.body;

    if (!selectedSymptoms || !Array.isArray(selectedSymptoms) || selectedSymptoms.length === 0) {
        return res.status(400).json({ error: 'Please provide a valid array of symptoms' });
    }

    try {
        const analysis = await analyzeSymptoms(selectedSymptoms, modelLangChain);
        
        res.json({
        message: 'Symptoms analyzed successfully',
        analysis: analysis
        });
    } catch (error) {
        console.error('Error analyzing symptoms:', error);
        res.status(500).json({ error: 'Error analyzing symptoms', details: error.message });
    }
};
  



export {AnalyzeSelectedSymptoms, extractSymptoms}
