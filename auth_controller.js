// import passport from "passport";
// import express from "express";
// import mongoose from "mongoose";
// import { Strategy as GoogleStrategy } from "passport-google-oauth20";
// import { FederatedCredential, User } from "../models/User.js";
// const authRouter = express.Router();


// import dotenv from 'dotenv';
// dotenv.config();


// authRouter.get('/login/federated/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// authRouter.get('/oauth2/redirect/google', passport.authenticate('google', {
//     failureRedirect: '/login',
//     successRedirect: 'http://localhost:3000'
// }));

// // if (!process.env.GOOGLE_ID || !process.env.GOOGLE_SECRET) {
// //     throw new Error('GOOGLE_ID and GOOGLE_SECRET must be set in environment variables');
// // }

// passport.use(new GoogleStrategy({
//     clientID: process.env.GOOGLE_ID,
//     clientSecret: process.env.GOOGLE_SECRET,
//     callbackURL: 'http://localhost:8080/oauth2/redirect/google',
//     scope: ['profile', 'email']
// }, async function verify(accessToken, refreshToken, profile, done) {
//     try {
//         const profileImage = profile.photos && profile.photos.length ? profile.photos[0].value : null;

//         const federatedCredential = await FederatedCredential.findOne({
//             provider: 'google',
//             subject: profile.id
//         }).populate('user');

//         if (!federatedCredential) {
//             const newUser = new User({
//                 name: profile.displayName,
//                 email: profile.emails[0].value,
//                 profileImage: profileImage, 
//             });

//             const savedUser = await newUser.save();

//             const newFederatedCredential = new FederatedCredential({
//                 provider: 'google',
//                 subject: profile.id,
//                 user: savedUser._id
//             });

//             await newFederatedCredential.save();

//             return done(null, savedUser);
//         } else {
//             // If federated credential exists, return the associated user
//             return done(null, federatedCredential.user);
//         }
//     } catch (error) {
//         return done(error);
//     }
// }));

// passport.serializeUser((user, done) => {
//     done(null, user.id);
// });

// passport.deserializeUser(async (id, done) => {
//     try {
//         const user = await User.findById(id);
//         done(null, user);
//     } catch (err) {
//         done(err);
//     }
// });

// // Logout route for destroying the session and logging out the user
// authRouter.post('/api/auth/logout', (req, res) => {
//     req.logout((err) => {
//         if (err) {
//             return res.status(500).json({ message: 'Error during logout', error: err });
//         }
//         req.session.destroy((err) => {
//             if (err) {
//                 console.error('Error destroying session:', err);
//             }
//             res.clearCookie('connect.sid');
//             return res.status(200).json({ message: 'Logged out successfully' });
//         });
//     });
// });

// export {passport}
// export default authRouter 


import AWS from 'aws-sdk';
import passport from 'passport';
import express from 'express';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';

dotenv.config();

AWS.config.update({
    region: process.env.AWS_REGION, // Set your AWS region
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();

const authRouter = express.Router();

authRouter.get('/login/federated/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

authRouter.get('/oauth2/redirect/google', passport.authenticate('google', {
    failureRedirect: '/login',
    successRedirect: 'http://localhost:3000'
}));

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_ID,
    clientSecret: process.env.GOOGLE_SECRET,
    callbackURL: 'http://localhost:8080/oauth2/redirect/google',
    scope: ['profile', 'email']
}, async function verify(accessToken, refreshToken, profile, done) {
    try {
        const profileImage = profile.photos && profile.photos.length ? profile.photos[0].value : null;

        // Check if federated credential exists
        const params = {
            TableName: 'FederatedCredentials',
            Key: {
                provider: 'google',
                subject: profile.id
            }
        };

        const result = await dynamoDb.get(params).promise();

        if (!result.Item) {
            // Create a new user
            const newUser = {
                userId: `user-${Date.now()}`, // Unique user ID
                name: profile.displayName,
                email: profile.emails[0].value,
                profileImage: profileImage,
                federatedCredentials: []
            };

            // Save the new user to DynamoDB
            await dynamoDb.put({
                TableName: 'Users',
                Item: newUser
            }).promise();

            // Create a new federated credential
            const newFederatedCredential = {
                provider: 'google',
                subject: profile.id,
                userId: newUser.userId
            };

            // Save the federated credential to DynamoDB
            await dynamoDb.put({
                TableName: 'FederatedCredentials',
                Item: newFederatedCredential
            }).promise();

            return done(null, newUser);
        } else {
            // If federated credential exists, retrieve the user
            const userParams = {
                TableName: 'Users',
                Key: {
                    userId: result.Item.userId
                }
            };

            const userResult = await dynamoDb.get(userParams).promise();
            return done(null, userResult.Item);
        }
    } catch (error) {
        return done(error);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.userId);
});

passport.deserializeUser(async (id, done) => {
    try {
        const params = {
            TableName: 'Users',
            Key: {
                userId: id
            }
        };
        const result = await dynamoDb.get(params).promise();
        done(null, result.Item);
    } catch (err) {
        done(err);
    }
});

// Logout route for destroying the session and logging out the user
authRouter.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ message: 'Error during logout', error: err });
        }
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
            }
            res.clearCookie('connect.sid');
            return res.status(200).json({ message: 'Logged out successfully' });
        });
    });
});

export { passport };
export default authRouter;
