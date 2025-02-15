import * as functions from 'firebase-functions';
import { onRequest } from 'firebase-functions/v2/https';
import { getTextMessageInput, sendMessage } from './messageHelper';

// export const whatsappWebhook = functions.region(REGION).https.onRequest(async (req, res) => {
export const whatsappWebhook = onRequest(async (req, res) => {
    if (req.method.toLocaleLowerCase() === 'post') {
        console.log(JSON.stringify(req.body));

        if (req.body.object) {
            if (
                req.body.entry &&
                req.body.entry[0].changes &&
                req.body.entry[0].changes[0] &&
                req.body.entry[0].changes[0].value.messages &&
                req.body.entry[0].changes[0].value.messages[0]
            ) {
                try {
                    const phoneNumberId = req.body.entry[0].changes[0].value.metadata.phone_number_id;
                    const from = req.body.entry[0].changes[0].value.messages[0].from; // extract the phone number from the webhook payload
                    const msgBody = req.body.entry[0].changes[0].value.messages[0].text.body; // extract the message text from the webhook payload

                    const textMessage = getTextMessageInput({ recipient: from, text: 'Ack: ' + msgBody });
                    // const numberId = process.env.PHONE_NUMBER_ID;
                    const token = process.env.ACCESS_TOKEN || '';

                    await sendMessage(textMessage, token, phoneNumberId);
                } catch (err) {
                    functions.logger.error(err);
                    res.sendStatus(500);
                }
            }
            res.sendStatus(200);
        } else {
            // Return a '404 Not Found' if event is not from a WhatsApp API
            res.sendStatus(404);
        }
    }

    if (req.method.toLocaleLowerCase() === 'get') {
        const verifyToken = process.env.VERIFY_TOKEN;

        // Parse params from the webhook verification request
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        // Check if a token and mode were sent
        if (mode && token) {
            // Check the mode and token sent are correct
            if (mode === 'subscribe' && token === verifyToken) {
                // Respond with 200 OK and challenge token from the request
                console.log('WEBHOOK_VERIFIED');
                res.status(200).send(challenge);
            } else {
                // Responds with '403 Forbidden' if verify tokens do not match
                res.sendStatus(403);
            }
        }
    }
});
