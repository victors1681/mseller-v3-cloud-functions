import * as functions from 'firebase-functions';
import * as admin from "firebase-admin";

export const addMessage = functions.https.onRequest(async (req, res) => {
  //res.send("fisrt fun..");
    // Grab the text parameter.
    const original = req.query.text;
    // Push the new message into Cloud Firestore using the Firebase Admin SDK.
    const writeResult = await admin.firestore().collection('messages').add({original: original});
    // Send back a message that we've succesfully written the message
     res.json({result: `Message with ID: ${writeResult.id} added.`});
  });