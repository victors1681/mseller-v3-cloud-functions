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
exports.getBusinessById = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const index_1 = require("../index");
/**
 * get business information from the ID
 * @param businessId
 */
const getBusinessById = async (businessId) => {
    try {
        const snapshot = await admin.firestore().collection(index_1.BUSINESS_COLLECTION).doc(businessId).get();
        if (snapshot.exists) {
            const data = snapshot.data();
            return Object.assign(Object.assign({}, data), { businessId });
        }
        else {
            throw new functions.https.HttpsError('not-found', `user ${businessId} not found on ${index_1.BUSINESS_COLLECTION} File: users.ts functions server. Might be because is looking on Emulator DB`);
        }
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
};
exports.getBusinessById = getBusinessById;
//# sourceMappingURL=business.js.map