"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotificationToUserById = exports.registerFCMToken = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const index_1 = require("../index");
// import { getCurrentUserInfo, getUserById } from "../users";
const helpers_1 = require("./helpers");
const REGION = 'us-east1';
/**
 * Firebase cloud messaging registration
 */
exports.registerFCMToken = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        const uid = context && context.auth && context.auth.uid;
        if (!data && !uid) {
            throw new functions.https.HttpsError('invalid-argument', 'fcmToken needed');
        }
        if (uid) {
            await admin.firestore().collection(index_1.FCM_COLLECTION).doc(uid).set({
                fcmToken: data,
            });
        }
        return true;
    }
    catch (error) {
        console.error(error.message);
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
/**
 * send notification message based only on userId
 */
exports.sendNotificationToUserById = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        const { targetUserId, payload } = data;
        if (!targetUserId && !payload) {
            console.error('target userId is missing or payload');
            throw new functions.https.HttpsError('invalid-argument', 'target userId is missing or payload');
        }
        const userToken = await helpers_1.getTokenByUserId(targetUserId);
        if (!userToken) {
            console.error('user FCM token not found');
            return false;
        }
        return await helpers_1.sendUserNotification(targetUserId, payload);
    }
    catch (error) {
        console.error(error.message);
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
//# sourceMappingURL=messaging.js.map