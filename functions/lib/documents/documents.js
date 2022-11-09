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
exports.generatePDF = void 0;
const storage_1 = require("firebase-admin/storage");
const functions = __importStar(require("firebase-functions"));
const pdf_documents_1 = require("pdf-documents");
const uuid = __importStar(require("uuid"));
const business_1 = require("../business");
const index_1 = require("../index");
const whatsapp_1 = require("../whatsapp");
const BUCKET_NAME = 'mobile-seller-documents';
const LINK_DAYS_SIGNED = 604800;
const sendWhatsappNotification = async (data, url, businessId) => {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!((_a = data.whatsapp) === null || _a === void 0 ? void 0 : _a.template) || !((_b = data.whatsapp) === null || _b === void 0 ? void 0 : _b.recipient)) {
        functions.logger.warn('User data does not contain template name or recipient undefined');
        return;
    }
    // get business data
    const businessData = await (0, business_1.getBusinessById)(businessId);
    functions.logger.debug(businessData);
    const whatsappConfig = (_d = (_c = businessData.config) === null || _c === void 0 ? void 0 : _c.integrations) === null || _d === void 0 ? void 0 : _d.find((f) => f.provider === 'whatsapp');
    if (!whatsappConfig || (whatsappConfig === null || whatsappConfig === void 0 ? void 0 : whatsappConfig.enabled) === false) {
        functions.logger.warn('whatsappConfig undefined or is not enabled in configuration');
        return;
    }
    const { token, phoneNumberId, devPhoneNumberId, devToken, isDevelopment } = whatsappConfig;
    const currentToken = isDevelopment ? devToken : token;
    const currentPhoneNumberId = isDevelopment ? devPhoneNumberId : phoneNumberId;
    if (!currentToken || !currentPhoneNumberId) {
        functions.logger.warn('currentToken or currentPhoneNumberId undefined', { currentToken, currentPhoneNumberId });
        return;
    }
    const payload = {
        template: (_e = data.whatsapp) === null || _e === void 0 ? void 0 : _e.template,
        recipient: (_f = data.whatsapp) === null || _f === void 0 ? void 0 : _f.recipient,
        pdfUrl: url,
        fileName: (_g = data.whatsapp) === null || _g === void 0 ? void 0 : _g.fileName,
        sellerName: data.customer.seller,
    };
    const template = (0, whatsapp_1.getInvoiceTemplate)(payload);
    const result = await (0, whatsapp_1.sendMessage)(template, currentToken, currentPhoneNumberId);
    if (result.status === 200) {
        functions.logger.info('Notification sent!', data.customer.name);
    }
    else {
        functions.logger.error('Whatsapp notification could not be sent', result);
    }
};
/**
 * based on the user request it get the user who is requesting and get the business id associated
 */
exports.generatePDF = functions.region(index_1.REGION).https.onCall(async (data, context) => {
    var _a, _b;
    try {
        functions.logger.info(data);
        const requestedUser = await (0, index_1.getCurrentUserInfo)(context);
        if (!requestedUser.business) {
            throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated');
        }
        console.info('data', data.customer.name);
        const date = new Date();
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear().toString();
        const fileName = uuid.v4();
        const path = `${requestedUser.business}/${year}-${month}/${day}/${fileName}.pdf`;
        const file = (0, storage_1.getStorage)().bucket(BUCKET_NAME).file(path);
        await (0, pdf_documents_1.createInvoice)(data, file);
        // Create the invoice
        const url = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + LINK_DAYS_SIGNED,
        });
        /**
         * Send whatsapp notification only if whatsapp exist
         */
        if (((_a = data.whatsapp) === null || _a === void 0 ? void 0 : _a.template) && ((_b = data.whatsapp) === null || _b === void 0 ? void 0 : _b.recipient)) {
            await sendWhatsappNotification(data, url[0], requestedUser.business);
        }
        return { url: url[0] };
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
//# sourceMappingURL=documents.js.map