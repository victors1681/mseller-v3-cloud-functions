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
const functions = __importStar(require("firebase-functions"));
const index_1 = require("../index");
const storage_1 = require("firebase-admin/storage");
const uuid = __importStar(require("uuid"));
const pdf_documents_1 = require("pdf-documents");
const BUCKET_NAME = 'mobile-seller-documents';
/**
 * based on the user request it get the user who is requesting and get the business id associated
 */
exports.generatePDF = functions.region(index_1.REGION).https.onCall(async (data, context) => {
    try {
        console.log('contextcontextcontext', context);
        functions.logger.info(data);
        const requestedUser = await (0, index_1.getCurrentUserInfo)(context);
        if (!requestedUser.business) {
            throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated');
        }
        const date = new Date();
        const day = date.getDay().toString().padStart(2, '0');
        const month = date.getMonth().toString().padStart(2, '0');
        const year = date.getFullYear().toString();
        const fileName = uuid.v4();
        const path = `${requestedUser.business}/${year}-${month}/${day}/${fileName}.pdf`;
        const file = (0, storage_1.getStorage)().bucket(BUCKET_NAME).file(path);
        await (0, pdf_documents_1.createInvoice)(data, file);
        //Create the invoice
        const url = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 1000 * 60 * 60,
        });
        return { url };
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
//# sourceMappingURL=documents.js.map