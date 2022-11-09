"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappWebhook = void 0;
const functions = __importStar(require("firebase-functions"));
const index_1 = require("../index");
const messageHelper_1 = require("./messageHelper");
exports.whatsappWebhook = functions.region(index_1.REGION).https.onRequest(async (req, res) => {
    if (req.method.toLocaleLowerCase() === 'post') {
        console.log(JSON.stringify(req.body));
        if (req.body.object) {
            if (req.body.entry &&
                req.body.entry[0].changes &&
                req.body.entry[0].changes[0] &&
                req.body.entry[0].changes[0].value.messages &&
                req.body.entry[0].changes[0].value.messages[0]) {
                try {
                    const phoneNumberId = req.body.entry[0].changes[0].value.metadata.phone_number_id;
                    const from = req.body.entry[0].changes[0].value.messages[0].from; // extract the phone number from the webhook payload
                    const msgBody = req.body.entry[0].changes[0].value.messages[0].text.body; // extract the message text from the webhook payload
                    const textMessage = (0, messageHelper_1.getTextMessageInput)({ recipient: from, text: 'Ack: ' + msgBody });
                    // const numberId = process.env.PHONE_NUMBER_ID;
                    const token = process.env.ACCESS_TOKEN || '';
                    await (0, messageHelper_1.sendMessage)(textMessage, token, phoneNumberId);
                }
                catch (err) {
                    functions.logger.error(err);
                    res.sendStatus(500);
                }
            }
            res.sendStatus(200);
        }
        else {
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
            }
            else {
                // Responds with '403 Forbidden' if verify tokens do not match
                res.sendStatus(403);
            }
        }
    }
});
//# sourceMappingURL=webhook.js.map