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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConversationById = exports.getConversations = exports.BUSINESS_COLLECTION = exports.CONVERSATION_COLLECTION = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const users_1 = require("../users");
exports.CONVERSATION_COLLECTION = 'conversations';
exports.BUSINESS_COLLECTION = 'business';
/**
 * based on the user request it get the user who is requesting and get the business id associated
 */
exports.getConversations = functions.https.onCall(async (data, context) => {
    var e_1, _a;
    try {
        const requestedUser = await users_1.getCurrentUserInfo(context);
        if (!requestedUser.business) {
            throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated');
        }
        const conversationRecords = await admin
            .firestore()
            .collection(users_1.USER_COLLECTION)
            .doc(requestedUser.userId)
            .collection(exports.CONVERSATION_COLLECTION)
            .get();
        if (!conversationRecords.docs.length) {
            throw new functions.https.HttpsError('invalid-argument', 'There is not available conversations');
        }
        const conversationList = [];
        try {
            for (var _b = __asyncValues(conversationRecords.docs), _c; _c = await _b.next(), !_c.done;) {
                let doc = _c.value;
                const result = await getDocuments(doc);
                if (result) {
                    console.log("resultresultresultresult", result);
                    conversationList.push(result);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) await _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        // await conversationRecords.forEach(async doc => {
        //     const result = await getDocuments(doc)
        //     if(result){
        //         console.log("resultresultresultresult", result)
        //     conversationList.push(result);
        //     }
        // }) 
        console.log(`conversationList: (${conversationList})`);
        return conversationList;
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
const getDocuments = async (doc) => {
    try {
        const userId = doc.id;
        const conversationId = doc.data().conversationId;
        const unseenCount = doc.data().unseenCount;
        const userInfo = await users_1.getUserById(userId);
        const conversationInfo = await exports.getConversationById(conversationId, userInfo.business);
        return ({ userId, conversationId, unseenCount, photoURL: userInfo.photoURL, firstName: userInfo.firstName, lastName: userInfo.lastName, lastMessageTime: conversationInfo === null || conversationInfo === void 0 ? void 0 : conversationInfo.lastMessageTime, displayMessage: conversationInfo === null || conversationInfo === void 0 ? void 0 : conversationInfo.displayMessage });
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
};
/**
 * get user information from the ID
 * @param userId
 */
exports.getConversationById = async (conversationId, businessId) => {
    try {
        const snapshot = await admin.firestore().collection(exports.BUSINESS_COLLECTION).doc(businessId).collection(exports.CONVERSATION_COLLECTION).doc(conversationId).get();
        const conversationRecord = snapshot.data();
        if (conversationRecord) {
            return Object.assign({ conversationId }, conversationRecord);
        }
        return;
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
};
//# sourceMappingURL=chat.js.map