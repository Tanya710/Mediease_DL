import dotenv from 'dotenv';
dotenv.config();
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import fetch from 'node-fetch';
import path from 'path';
import { readFile } from 'fs/promises';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { extractSymptoms } from './symptoms_controller.js';
import ChatHistoryManager from '../controllers/ChatHistoryManager.js';
import { generatePresignedUrl } from '../routes/ImageUploadRouter.js';



const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function getFileFromS3(bucket, key) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await s3.send(command);
  return streamToBuffer(response.Body);
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}





const modelLangChain = new ChatGoogleGenerativeAI({
  modelName: "gemini-pro",
  temperature: 0,
  apiKey: process.env.GEMINI_API_KEY_PDF
});

const messageHistories = {};




const analyzeImage = async (imageBase64, sessionId) => {
  const visionModel = new ChatGoogleGenerativeAI({
    modelName: "gemini-1.5-flash",
    temperature: 0,
    apiKey: process.env.GEMINI_API_KEY_IMAGE
  });

  try {
    //
    const result = await visionModel.invoke([
      {
        role: "user",
        content: [
          { type: "text", text: "Analyze this medical image and describe what you see." },
          { type: "image_url", image_url: `data:image/png;base64,${imageBase64}` }
        ]
      }
    ]);
    if (messageHistories[sessionId] === undefined) {
      messageHistories[sessionId] = new InMemoryChatMessageHistory();
    }
    messageHistories[sessionId]["messages"].push(
      new HumanMessage({
        content: "Analyze this medical image and describe what you see.",
        additional_kwargs: {
          image_url: `data:image/png;base64,`
        }
      })
    );

    // Add the AI's response to messageHistories
    messageHistories[sessionId]["messages"].push(
      new AIMessage({
        content: result.content,
        additional_kwargs: result.additional_kwargs
      })
    );

    return result.content;
  } catch (error) {
    console.error("Error in image analysis:", error);
    throw error;
  }
}

const fetchImage = async (imagePath) => {
  try {
    // Resolve the full path to the image
    const fullPath = path.resolve(imagePath);
    // Read the file as a buffer
    const buffer = await readFile(fullPath);
    return buffer;
  } catch (error) {
    console.error("Error reading image:", error);
    throw error;
  }
};

async function processImage(imageInput) {
  if (Buffer.isBuffer(imageInput)) {
    return imageInput.toString('base64');
  } else if (typeof imageInput === 'string') {
    const fullPath = path.resolve(imageInput);
    const buffer = await readFile(fullPath);
    return buffer.toString('base64');
  } else {
    throw new Error('Invalid input type for processImage');
  }
}



const UploadImageController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userId = req.user.userId;


    // Get sessionId from request body instead of creating new
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    console.log("Using existing session:", sessionId);

    let imageBuffer;
    try {
      imageBuffer = await getFileFromS3('thirdyearnlpproject', req.file.key);
    } catch (s3Error) {
      console.error("Error retrieving file from S3:", s3Error);
      return res.status(500).json({ error: 'Error retrieving file from S3', details: s3Error.message });
    }

    


    let extractedText;
    try {
      extractedText = await processImage(imageBuffer);
      console.log("Extracted text:", extractedText);
    } catch (processError) {
      console.error("Error in processImage:", processError);
      return res.status(500).json({ error: 'Error processing image', details: processError.message });
    }

    let summary;
    try {
      summary = await analyzeImage(extractedText, sessionId);
      console.log("Generated summary:", summary);
    } catch (summaryError) {
      console.error("Error in generateSummary:", summaryError);
      return res.status(500).json({ error: 'Error generating summary', details: summaryError.message });
    }

    let symptomsResult;
    try {
      symptomsResult = await extractSymptoms([{ pageContent: summary }], modelLangChain);
      
      // Save symptoms extraction to existing chat history
      await ChatHistoryManager.saveMessage(sessionId, "user", "Extract symptoms from the analysis");
      await ChatHistoryManager.saveMessage(sessionId, "assistant", JSON.stringify(symptomsResult));

      console.log('Extracted symptoms:', symptomsResult);
    } catch (error) {
      console.error("Error extracting symptoms:", error);
      return res.status(500).json({ error: 'Error analyzing symptoms', details: error.message });
    }

    res.json({ 
      message: 'Image processed successfully', 
      sessionId, // Return the same sessionId
      summary: summary,
      symptoms: symptomsResult,
      imageName: req.file.originalname,
      imageUrl: req.file.location
    });
  } catch (error) {
    console.error('Error in upload-image route:', error);
    res.status(500).json({ error: 'Error processing image', details: error.message });
  }
}





const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are an expert medical diagnostician who specializes in explaining medical reports in simple, clear language that patients can understand. When analyzing medical reports:

    1. Start with a clear, simple overview of what this report is measuring and why it's important.
    
    2. For each test result:
        - Explain what the test measures in simple terms
        - State the actual number and the normal range
        - Clearly indicate if this is NORMAL, LOW, or HIGH
        - Explain what this number means for the patient's health
        - Use everyday analogies where helpful
        - Explain potential implications
    
    3. Group related tests together and explain their relationship.
    
    4. Highlight any concerning or abnormal values and explain:
        - Why they might be abnormal
        - What symptoms might be related
        - What follow-up might be needed
    
    5. Use conversational language and avoid medical jargon. When medical terms must be used, explain them immediately.
    
    6. End with:
        - A clear summary of the key findings
        - What these results suggest about the patient's health
        - Any patterns or relationships between different test results
        - What the patient should pay attention to
    
    7. You should not only say if it normal or not, your value to help patients understand each and very term, before giving normal and abornal range, explain what the term is
    what does it do in your body, why does doctors measure it.
        
    Remember: Your goal is to help patients truly understand their test results, not just list numbers. Make it conversational, clear, and actionable.
    and also don't hold back on the length of the conversation, it's ok if it's really big`
  ],
  ["placeholder", "{chat_history}"],
  ["human", "{input}"]
]);
const chain = prompt.pipe(modelLangChain);

const withMessageHistory = new RunnableWithMessageHistory({
  runnable: chain,
  getMessageHistory: async (sessionId) => {
    if (messageHistories[sessionId] === undefined) {
      messageHistories[sessionId] = new InMemoryChatMessageHistory();
    }
    return messageHistories[sessionId];
  },
  inputMessagesKey: "input",
  historyMessagesKey: "chat_history"
});


const UploadPdfController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const userId = req.user.userId;

    // Pass userId to createNewSession
    const sessionId = await ChatHistoryManager.createNewSession(userId);
    console.log("New session created:", sessionId);

    console.log("File received:", req.file);

    const presignedUrl = await generatePresignedUrl(
      'thirdyearnlpproject', 
      req.file.key
    );

    await ChatHistoryManager.saveMessage(sessionId, "user", JSON.stringify({
      type: "file",
      filename: req.file.originalname,
      fileUrl: presignedUrl
    }), userId);

    let pdfBuffer;
    try {
      pdfBuffer = await getFileFromS3('thirdyearnlpproject', req.file.key);
    } catch (s3Error) {
      console.error("Error retrieving PDF from S3:", s3Error);
      return res.status(500).json({ error: 'Error retrieving PDF from S3', details: s3Error.message });
    }
    const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

    let extractedText;
    try {
      const loader = new PDFLoader(pdfBlob);
      const docs = await loader.load();
      extractedText = docs.map(doc => doc.pageContent).join('\n');
    } catch (extractError) {
      console.error("Error extracting text from PDF:", extractError);
      return res.status(500).json({ error: 'Error processing PDF', details: extractError.message });
    }

    const config = {
      configurable: {
        sessionId
      }
    };

    let formattedExtractedText = {
      input: {
        type: "text",
        text: extractedText
      }
    };

    let summary;
    try {
      summary = await withMessageHistory.invoke(
        formattedExtractedText,
        config
      );

      // Save the interaction to chat history
      await ChatHistoryManager.saveMessage(sessionId,userId, "assistant", summary.content);
    } catch (summaryError) {
      console.error("Error in generateSummary:", summaryError);
      return res.status(500).json({ error: 'Error generating summary', details: summaryError.message });
    }

    let symptomsResult;
    try {
      symptomsResult = await extractSymptoms([{ pageContent: extractedText }], modelLangChain);
      
      if (!symptomsResult.success) {
        return res.status(500).json({
          success: false,
          error: 'Failed to extract symptoms',
          details: symptomsResult.error
        });
      }


      console.log('Extracted symptoms:', symptomsResult);
    } catch (error) {
      console.error("Error extracting symptoms:", error);
      return res.status(500).json({ 
        error: 'Error analyzing symptoms', 
        details: error.message,
        extractedTextSample: extractedText ? 
          `First 100 chars: ${extractedText.substring(0, 100)}` : 
          'No extracted text'
      });
    }

    res.json({ 
      message: 'PDF processed successfully', 
      sessionId, // Include sessionId in response
      summary: summary.content,
      pdfName: req.file.originalname,
      pdfUrl: presignedUrl,
      symptoms: symptomsResult,
    });
  } catch (error) {
    console.error('Error in upload-pdf route:', error);
    res.status(500).json({ error: 'Error processing PDF', details: error.message });
  }
};

const AskLlm = async (req, res) => {
  const { question, sessionId } = req.body;

  if (!req.user || !req.user.userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  const userId = req.user.userId;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  const config = {
    configurable: {
      sessionId
    }
  };

  try {
    const response = await withMessageHistory.invoke(
      {
        input: question
      },
      config
    );
    await ChatHistoryManager.saveMessage(sessionId, userId, "user", question);

    await ChatHistoryManager.saveMessage(sessionId, userId, "assistant", response.content);

    res.json({ content: response.content, yourQuestion: question });
  } catch (error) {
    console.error("Error in AskLlm:", error);
    res.status(500).json({ error: 'Error processing question', details: error.message });
  }
}




export { AskLlm, UploadPdfController };








export default UploadImageController;