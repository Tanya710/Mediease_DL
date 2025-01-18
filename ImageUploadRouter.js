import express from "express";
import multer from 'multer';
import multerS3 from 'multer-s3';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
const uploadRouter = express.Router();
import dotenv from 'dotenv';
import UploadImageController, { AskLlm, UploadPdfController } from "../controllers/pdfRandom.js";
import { isAuthenticated } from "../middleware/AuthMiddleware.js";
dotenv.config();



const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Configure multer to use S3
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: "thirdyearnlpproject",
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, Date.now().toString() + '-' + file.originalname);
    }
  })
});


async function generatePresignedUrl(bucket, key, expirationSeconds = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });
    
    const url = await getSignedUrl(s3, command, {
      expiresIn: expirationSeconds
    });
    
    return url;
  } catch (error) {
    console.error('Error generating pre-signed URL:', error);
    throw error;
  }
}

uploadRouter.post('/upload-image', upload.single('image'), isAuthenticated,  UploadImageController);
uploadRouter.post("/upload-pdf", upload.single('pdf'),isAuthenticated,  UploadPdfController )
uploadRouter.post('/ask-llm', isAuthenticated, AskLlm);

export default uploadRouter;


export {generatePresignedUrl}
