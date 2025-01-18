import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import uploadRouter from './routes/ImageUploadRouter.js';
import multer from 'multer';
import authRouter, { passport } from './controllers/auth_controller.js';
import session from 'express-session';
import MongoStore from 'connect-mongo';

import dotenv from 'dotenv';
import connectDB from './database/database.js';
import symptomsRouter from './routes/SymptomsRouter.js';
import recommendationRouter from './routes/RecommondationRouter.js';
import ChatHistoryRouter from './routes/ChatHistoryRoute.js';
import sessionRouter from './routes/SessionRouter.js';
import DynamoDBStore from 'connect-dynamodb';

dotenv.config();



const app = express();
const port = 8080;

const corsOptions = {
  origin: 'http://localhost:3000',  
  credentials: true, 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));


const DynamoDBStoreClass = DynamoDBStore(session);

const dynamoDBOptions = {
  table: 'UserSessions', // Name of the table to store sessions
  AWSConfigJSON: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  readCapacityUnits: 5,
  writeCapacityUnits: 5
};


// Update session configuration
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  },
  store: new DynamoDBStoreClass(dynamoDBOptions)
}));


// app.use(session({
//   secret: 'keyboard cat',
//   resave: false,
//   saveUninitialized: false,
//   cookie: {
//     maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
//   },
//   store: MongoStore.create({
//     mongoUrl: "mongodb+srv://nihalnetha249:G3xPluCK3hJnlF0m@cluster0.h1rxl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
//     ttl: 14 * 24 * 60 * 60, // = 14 days. Default
//     autoRemove: 'native' // Default
//   })
// }));




connectDB();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));




app.use(passport.initialize());
app.use(passport.session());  



app.get('/hello', (req, res) => {
  res.send('Hello, World!');
});



app.use('/', authRouter);

app.use('/', uploadRouter);
app.use('/', symptomsRouter)
app.use('/', recommendationRouter)
app.use("/", ChatHistoryRouter)
app.use("/", sessionRouter)

app.get('/auth/status', (req, res) => {
  if (req.isAuthenticated()) {
    res.status(200).json({ isLoggedIn: true, user: req.user });
  } else {
    res.status(200).json({ isLoggedIn: false });
  }
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
