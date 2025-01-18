import { GoogleGenerativeAI } from '@google/generative-ai';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from 'dotenv';
dotenv.config();



const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });


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

async function processImage(imageBuffer) {
  const imageParts = [
    {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: 'image/png',
      },
    },
  ];

  const extractPrompt = "Extract all the text visible in this image. Include all details, numbers, and any other relevant information. Provide the extracted text in a clear, structured format.";
  const result = await model.generateContent([extractPrompt, ...imageParts]);
  const extractedText = result.response.text();
  return extractedText;
}

async function generateSummary(extractedText) {
  const summaryPrompt = `Given the following extracted text from an image:
${extractedText}

Please provide a comprehensive summary of the information, including:
1. The main topic or purpose of the document/image
2. Key details or data points
3. Any notable patterns or trends
4. Overall interpretation of what this information represents

Please keep the summary concise yet informative, highlighting the most important aspects of the extracted text.`;

  const result = await model.generateContent(summaryPrompt);
  return result.response.text();
}

const UploadImageController = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log("File received:", req.file);

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
      summary = await generateSummary(extractedText);
      console.log("Generated summary:", summary);
    } catch (summaryError) {
      console.error("Error in generateSummary:", summaryError);
      return res.status(500).json({ error: 'Error generating summary', details: summaryError.message });
    }

    res.json({ 
      message: 'Image processed successfully', 
      extractedText: extractedText,
      summary: summary,
      imageName: req.file.originalname,
      imageUrl: req.file.location
    });
  } catch (error) {
    console.error('Error in upload-image route:', error);
    res.status(500).json({ error: 'Error processing image', details: error.message });
  }
}



// export default UploadImageController;