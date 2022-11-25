"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendGenericEmail = void 0;
const node_mailjet_1 = __importDefault(require("node-mailjet"));
const business_1 = require("../business");
const mailjet = new node_mailjet_1.default({
    apiKey: process.env.MAILJET_API_KEY,
    apiSecret: process.env.MAILJET_API_SECRET,
});
const sendGenericEmail = async (data, url, businessId) => {
    const businessData = await (0, business_1.getBusinessById)(businessId);
    const TemplateID = businessData.config.orderEmailTemplateID;
    const fromEmail = businessData.email;
    const company_name = businessData.name;
    const customerName = data.customer.name;
    const customerEmail = data.customer.email;
    const values = {
        "invoice": "Factura",
        "order": "Pedido",
        "receipt": "Recibo",
        "quote": "Cotización"
    };
    const document_type = values[data.documentType];
    const documentNo = data.documentNo;
    const logo = businessData.logoUrl;
    const subject = `${document_type} No.${documentNo} ha sido generada`;
    const payload = {
        Messages: [
            {
                From: {
                    Email: fromEmail,
                    Name: company_name,
                },
                To: [
                    {
                        Email: customerEmail,
                        Name: customerName,
                    },
                ],
                TemplateID,
                TemplateLanguage: true,
                Subject: subject,
                Variables: {
                    image_url: logo,
                    "document_type": document_type,
                    "document_number": documentNo,
                    "company_name": company_name,
                    "customer_name": customerName,
                    "document_link": url
                },
            },
        ],
    };
    try {
        const result = await mailjet.post('send', { version: 'v3.1' }).request(payload);
        console.info(result);
    }
    catch (err) {
        console.error(err);
    }
};
exports.sendGenericEmail = sendGenericEmail;
/**
 * based on the user request it get the user who is requesting and get the business id associated
 */
//Temporary disable function
// export const sendEmailTemplate = functions.region(REGION).https.onCall(async (data, context) => {
//     try {
//         console.log('datadata:', data);
//         const requestedUser = await getCurrentUserInfo(context);
//         if (!requestedUser.business) {
//             throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated');
//         }
//         const result = await mailjet.post('send', { version: 'v3.1' }).request(payload);
//         return { result };
//     } catch (error) {
//         throw new functions.https.HttpsError('invalid-argument', error.message);
//     }
// });
//# sourceMappingURL=email.js.map