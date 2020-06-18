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
exports.resetUnseenCounter = exports.saveNewMessage = exports.getConversationById = exports.getMessages = exports.newConversation = exports.getConversations = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const index_1 = require("../index");
const users_1 = require("../users");
const REGION = "us-east1";
/**
 * based on the user request it get the user who is requesting and get the business id associated
 */
exports.getConversations = functions.region(REGION).https.onCall(async (data, context) => {
    var e_1, _a;
    try {
        const requestedUser = await users_1.getCurrentUserInfo(context);
        if (!requestedUser.business) {
            throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated');
        }
        const conversationRecords = await admin
            .firestore()
            .collection(index_1.USER_COLLECTION)
            .doc(requestedUser.userId)
            .collection(index_1.CONVERSATION_COLLECTION)
            .get();
        if (!conversationRecords.docs.length) {
            throw new functions.https.HttpsError('invalid-argument', 'There is not available conversations');
        }
        const conversationList = [];
        try {
            for (var _b = __asyncValues(conversationRecords.docs), _c; _c = await _b.next(), !_c.done;) {
                const doc = _c.value;
                const result = await getConversationInfo(doc);
                if (result) {
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
        console.log(`conversationList: (${conversationList})`);
        return conversationList;
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
/**
 * @param targetUser string This is the user who with going to stablish the conversation
 * Create new Conversation between two party
 */
exports.newConversation = functions.region(REGION).https.onCall(async (targetUser, context) => {
    try {
        const requestedUser = await users_1.getCurrentUserInfo(context);
        const targetUserInfo = await users_1.getUserById(targetUser);
        if (!requestedUser.business) {
            throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated');
        }
        // Create new conversation
        const conversationRef = await admin
            .firestore()
            .collection(index_1.BUSINESS_COLLECTION)
            .doc(requestedUser.business)
            .collection(index_1.CONVERSATION_COLLECTION)
            .add({
            displayMessage: "",
            lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
            members: [{ [requestedUser.userId]: true }, { [targetUser]: true }],
        });
        // create new node in user requested node
        await admin
            .firestore()
            .collection(index_1.USER_COLLECTION)
            .doc(requestedUser.userId)
            .collection(index_1.CONVERSATION_COLLECTION)
            .doc(targetUser)
            .set({
            conversationId: conversationRef.id,
            unseenCount: 0
        });
        // create new node in targetUser
        await admin
            .firestore()
            .collection(index_1.USER_COLLECTION)
            .doc(targetUser)
            .collection(index_1.CONVERSATION_COLLECTION)
            .doc(requestedUser.userId)
            .set({
            conversationId: conversationRef.id,
            unseenCount: 0
        });
        return {
            user: targetUserInfo,
            conversationId: conversationRef.id,
            unseenCount: 0,
            lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
            displayMessage: ""
        };
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
exports.getMessages = functions.region(REGION).https.onCall(async (conversationId, context) => {
    try {
        const requestedUser = await users_1.getCurrentUserInfo(context);
        if (!requestedUser.business) {
            throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated');
        }
        // Create new conversation
        const messages = await admin
            .firestore()
            .collection(index_1.BUSINESS_COLLECTION)
            .doc(requestedUser.business)
            .collection(index_1.CONVERSATION_COLLECTION)
            .doc(conversationId)
            .collection(index_1.MESSAGES_COLLECTION)
            .get();
        if (messages) {
            const messagesRecords = messages.docs.map(d => (Object.assign({ messageId: d.id }, d.data())));
            return messagesRecords;
        }
        return [];
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
const getConversationInfo = async (doc) => {
    try {
        const userId = doc.id;
        const conversationId = doc.data().conversationId;
        const unseenCount = doc.data().unseenCount;
        const userInfo = await users_1.getUserById(userId);
        const conversationInfo = await exports.getConversationById(conversationId, userInfo.business);
        return { user: userInfo, conversationId, unseenCount, lastMessageTime: conversationInfo === null || conversationInfo === void 0 ? void 0 : conversationInfo.lastMessageTime, displayMessage: conversationInfo === null || conversationInfo === void 0 ? void 0 : conversationInfo.displayMessage };
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
        const snapshot = await admin.firestore().collection(index_1.BUSINESS_COLLECTION).doc(businessId).collection(index_1.CONVERSATION_COLLECTION).doc(conversationId).get();
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
exports.saveNewMessage = functions.region(REGION).https.onCall(async (data, context) => {
    var e_2, _a;
    try {
        const requestedUser = await users_1.getCurrentUserInfo(context);
        const { content, conversationId } = data;
        if (!requestedUser.business && content && conversationId) {
            throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated, content, and conversationId');
        }
        const message = {
            content,
            senderId: requestedUser.userId,
            senderName: `${requestedUser.firstName} ${requestedUser.lastName}`,
            sentDate: admin.firestore.FieldValue.serverTimestamp(),
        };
        await admin
            .firestore()
            .collection(index_1.BUSINESS_COLLECTION)
            .doc(requestedUser.business)
            .collection(index_1.CONVERSATION_COLLECTION)
            .doc(conversationId)
            .collection(index_1.MESSAGES_COLLECTION)
            .add(message);
        // update conversation info
        await admin
            .firestore()
            .collection(index_1.BUSINESS_COLLECTION)
            .doc(requestedUser.business)
            .collection(index_1.CONVERSATION_COLLECTION)
            .doc(conversationId)
            .update({
            displayMessage: content,
            lastMessageTime: admin.firestore.FieldValue.serverTimestamp()
        });
        // get User Members
        const records = await admin
            .firestore()
            .collection(index_1.BUSINESS_COLLECTION)
            .doc(requestedUser.business)
            .collection(index_1.CONVERSATION_COLLECTION)
            .doc(conversationId)
            .get();
        if (records.exists) {
            const { members } = records.data();
            const membersIds = Object.keys(members).filter(memberId => memberId !== requestedUser.userId);
            try {
                // update target user conversation unseen Counter
                for (var membersIds_1 = __asyncValues(membersIds), membersIds_1_1; membersIds_1_1 = await membersIds_1.next(), !membersIds_1_1.done;) {
                    const memberId = membersIds_1_1.value;
                    await admin
                        .firestore()
                        .collection(index_1.USER_COLLECTION)
                        .doc(memberId)
                        .collection(index_1.CONVERSATION_COLLECTION)
                        .doc(requestedUser.userId) // user requested
                        .update({
                        unseenCount: admin.firestore.FieldValue.increment(1)
                    });
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (membersIds_1_1 && !membersIds_1_1.done && (_a = membersIds_1.return)) await _a.call(membersIds_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        return true;
    }
    catch (error) {
        console.error(error);
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
exports.resetUnseenCounter = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        const requestedUser = await users_1.getCurrentUserInfo(context);
        const { targetUserId } = data;
        if (!requestedUser.business && targetUserId) {
            throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated or targetUserId');
        }
        // update conversation info
        await admin
            .firestore()
            .collection(index_1.USER_COLLECTION)
            .doc(requestedUser.userId)
            .collection(index_1.CONVERSATION_COLLECTION)
            .doc(targetUserId)
            .update({
            unseenCount: 0,
        });
        return true;
    }
    catch (error) {
        console.error(error);
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
//# sourceMappingURL=chat.js.map