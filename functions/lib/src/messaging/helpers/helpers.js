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
exports.sendNotificationToUserByIdLocal = exports.getTokenByUserId = exports.sendUserNotification = void 0;
const admin = __importStar(require("firebase-admin"));
const index_1 = require("../../index");
const sendUserNotification = async (registrationToken, payload) => {
    try {
        await admin.messaging().send(Object.assign({ token: registrationToken }, payload));
        console.log('message sent');
        return true;
    }
    catch (error) {
        console.log('Error sending message:', error);
        return false;
    }
};
exports.sendUserNotification = sendUserNotification;
const getTokenByUserId = async (userId) => {
    try {
        const result = await admin.firestore().collection(index_1.FCM_COLLECTION).doc(userId).get();
        if (result.exists) {
            const { fcmToken } = result.data();
            return fcmToken;
        }
        return undefined;
    }
    catch (error) {
        console.error('Unable to get user token');
        return undefined;
    }
};
exports.getTokenByUserId = getTokenByUserId;
const sendNotificationToUserByIdLocal = async (data) => {
    try {
        const { targetUserId, payload } = data;
        if (!targetUserId && !payload) {
            console.error('target userId is missing or payload');
        }
        const userToken = await (0, exports.getTokenByUserId)(targetUserId);
        if (!userToken) {
            console.error('user FCM token not found');
            return false;
        }
        return await (0, exports.sendUserNotification)(userToken, payload);
    }
    catch (error) {
        console.error(error.message);
        return false;
    }
};
exports.sendNotificationToUserByIdLocal = sendNotificationToUserByIdLocal;
//# sourceMappingURL=helpers.js.map