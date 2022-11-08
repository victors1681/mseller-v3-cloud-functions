"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInvoiceTemplate = exports.getTextMessageInput = exports.sendMessage = void 0;
const axios_1 = __importDefault(require("axios"));
const sendMessage = async (data) => {
    var config = {
        method: 'post',
        url: `https://graph.facebook.com/${process.env.VERSION}/${process.env.PHONE_NUMBER_ID}/messages`,
        headers: {
            Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
        },
        data: data,
    };
    return (0, axios_1.default)(config);
};
exports.sendMessage = sendMessage;
const getTextMessageInput = ({ recipient, text }) => {
    return JSON.stringify({
        messaging_product: 'whatsapp',
        preview_url: false,
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: {
            body: text,
        },
    });
};
exports.getTextMessageInput = getTextMessageInput;
const getInvoiceTemplate = ({ template, recipient, pdfUrl, fileName, sellerName }) => {
    return JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
            name: template,
            language: {
                code: 'es',
            },
            components: [
                {
                    type: 'header',
                    parameters: [
                        {
                            type: 'document',
                            document: {
                                link: pdfUrl,
                                filename: fileName,
                            },
                        },
                    ],
                },
                {
                    type: 'body',
                    parameters: [
                        {
                            type: 'text',
                            text: sellerName,
                        },
                    ],
                },
            ],
        },
    });
};
exports.getInvoiceTemplate = getInvoiceTemplate;
//# sourceMappingURL=messageHelper.js.map