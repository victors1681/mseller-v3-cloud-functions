import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { BUSINESS_COLLECTION, CONVERSATION_COLLECTION, MESSAGES_COLLECTION, USER_COLLECTION } from '../index';
import { sendNotificationToUserByIdLocal } from '../messaging';
import { getCurrentUserInfo, getUserById } from '../users';

const REGION = 'us-east1';

interface IMessage {
    createdAt: string;
    senderId: string;
    text: string;
}

interface IConversation {
    conversationId?: string;
    messages?: IMessage[];
    displayMessage: string;
    lastMessageTime: FirebaseFirestore.FieldValue;
    members: any[]; // userId: Boolean
}

interface IConversationResponse {
    conversationId: string;

    displayMessage?: string;
    lastMessageTime?: FirebaseFirestore.FieldValue;
    unseenCount: number;
}

/**
 * based on the user request it get the user who is requesting and get the business id associated
 */
export const getConversations = functions.region(REGION).https.onCall(
    async (data, context): Promise<IConversationResponse[]> => {
        try {
            const requestedUser = await getCurrentUserInfo(context);

            if (!requestedUser.business) {
                throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated');
            }

            const conversationRecords = await admin
                .firestore()
                .collection(USER_COLLECTION)
                .doc(requestedUser.userId)
                .collection(CONVERSATION_COLLECTION)
                .get();

            if (!conversationRecords.docs.length) {
                throw new functions.https.HttpsError('invalid-argument', 'There is not available conversations');
            }

            const conversationList = [] as IConversationResponse[];

            for await (const doc of conversationRecords.docs) {
                const result = await getConversationInfo(doc);
                if (result) {
                    conversationList.push(result);
                }
            }

            console.log(`conversationList: (${conversationList})`);
            return conversationList;
        } catch (error) {
            throw new functions.https.HttpsError('invalid-argument', error.message);
        }
    },
);

/**
 * @param targetUser string This is the user who with going to stablish the conversation
 * Create new Conversation between two party
 */

export const newConversation = functions.region(REGION).https.onCall(
    async (targetUser, context): Promise<IConversationResponse> => {
        try {
            const requestedUser = await getCurrentUserInfo(context);
            const targetUserInfo = await getUserById(targetUser);

            if (!requestedUser.business) {
                throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated');
            }

            // Check if conversation exist
            const conversationExist = await admin
                .firestore()
                .collection(USER_COLLECTION)
                .doc(requestedUser.userId)
                .collection(CONVERSATION_COLLECTION)
                .doc(targetUserInfo.userId)
                .get();

            if (conversationExist.exists) {
                const cExistData: any = conversationExist.data();
                const conversationFound = await admin
                    .firestore()
                    .collection(BUSINESS_COLLECTION)
                    .doc(requestedUser.business)
                    .collection(CONVERSATION_COLLECTION)
                    .doc(cExistData.conversationId)
                    .get();

                if (conversationFound.exists) {
                    console.log('CONVERSATION EXIST ++');
                    const currentConversationId = conversationFound.id;
                    const currentConversation = conversationFound.data() as IConversation;

                    return {
                        user: targetUserInfo,
                        conversationId: currentConversationId,
                        unseenCount: cExistData.unseenCount,
                        lastMessageTime: currentConversation.lastMessageTime,
                        displayMessage: currentConversation.displayMessage,
                    } as IConversationResponse;
                }
            }

            // Create new conversation
            const conversationRef = await admin
                .firestore()
                .collection(BUSINESS_COLLECTION)
                .doc(requestedUser.business)
                .collection(CONVERSATION_COLLECTION)
                .add({
                    displayMessage: '',
                    lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
                    members: {
                        [requestedUser.userId]: true,
                        [targetUser]: true,
                    },
                });

            // create new node in user requested node

            await admin
                .firestore()
                .collection(USER_COLLECTION)
                .doc(requestedUser.userId)
                .collection(CONVERSATION_COLLECTION)
                .doc(targetUser)
                .set({
                    conversationId: conversationRef.id,
                    unseenCount: 0,
                });

            // create new node in targetUser

            await admin
                .firestore()
                .collection(USER_COLLECTION)
                .doc(targetUser)
                .collection(CONVERSATION_COLLECTION)
                .doc(requestedUser.userId)
                .set({
                    conversationId: conversationRef.id,
                    unseenCount: 0,
                });

            return {
                user: targetUserInfo,
                conversationId: conversationRef.id,
                unseenCount: 0,
                lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
                displayMessage: '',
            } as IConversationResponse;
        } catch (error) {
            console.error(error);
            throw new functions.https.HttpsError('invalid-argument', error.message);
        }
    },
);

interface IMessagesResponse {
    messageId: string;
    senderId: string;
    senderName: string;
    sentDate: string;
    content: string;
    url: string;
}

export const getMessages = functions.region(REGION).https.onCall(
    async (conversationId, context): Promise<IMessagesResponse[]> => {
        try {
            const requestedUser = await getCurrentUserInfo(context);

            if (!requestedUser.business) {
                throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated');
            }

            // Create new conversation
            const messages = await admin
                .firestore()
                .collection(BUSINESS_COLLECTION)
                .doc(requestedUser.business)
                .collection(CONVERSATION_COLLECTION)
                .doc(conversationId)
                .collection(MESSAGES_COLLECTION)
                .get();

            if (messages) {
                const messagesRecords = messages.docs.map((d) => ({ messageId: d.id, ...d.data() }));
                return messagesRecords as IMessagesResponse[];
            }

            return [] as IMessagesResponse[];
        } catch (error) {
            throw new functions.https.HttpsError('invalid-argument', error.message);
        }
    },
);

const getConversationInfo = async (doc: any): Promise<IConversationResponse | undefined> => {
    try {
        const userId = doc.id;
        const conversationId = doc.data().conversationId;
        const unseenCount = doc.data().unseenCount;
        const userInfo = await getUserById(userId);
        const conversationInfo = await getConversationById(conversationId, userInfo.business);

        return {
            user: userInfo,
            conversationId,
            unseenCount,
            lastMessageTime: conversationInfo?.lastMessageTime,
            displayMessage: conversationInfo?.displayMessage,
        } as IConversationResponse;
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
};

/**
 * get user information from the ID
 * @param userId
 */

export const getConversationById = async (
    conversationId: string,
    businessId: string,
): Promise<IConversation | undefined> => {
    try {
        const snapshot = await admin
            .firestore()
            .collection(BUSINESS_COLLECTION)
            .doc(businessId)
            .collection(CONVERSATION_COLLECTION)
            .doc(conversationId)
            .get();
        const conversationRecord = snapshot.data();

        if (conversationRecord) {
            return { conversationId, ...conversationRecord } as IConversation;
        }

        return;
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
};

/**
 * add new Text
 */

interface ISaveNewMessageProps {
    content: string;
    conversationId: string;
    url?: string;
    targetUser?: {
        userId: string;
        firstName: string;
        lastName: string;
    };
}

enum MessageStatus {
    sent = 'sent',
    read = 'read',
}

export const saveNewMessage = functions.region(REGION).https.onCall(
    async (data: ISaveNewMessageProps, context): Promise<boolean> => {
        try {
            const requestedUser = await getCurrentUserInfo(context);
            const { content, conversationId, url, targetUser } = data;

            if (!requestedUser.business && conversationId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'User does not have business associated, content, and conversationId',
                );
            }

            const message: any = {
                content,
                senderId: requestedUser.userId,
                senderName: `${requestedUser.firstName} ${requestedUser.lastName}`,
                sentDate: admin.firestore.FieldValue.serverTimestamp(),
                status: MessageStatus.sent,
                readDate: admin.firestore.FieldValue.serverTimestamp(),
            };

            if (url) {
                message.url = url;
            }

            await admin
                .firestore()
                .collection(BUSINESS_COLLECTION)
                .doc(requestedUser.business)
                .collection(CONVERSATION_COLLECTION)
                .doc(conversationId)
                .collection(MESSAGES_COLLECTION)
                .add(message);

            // get User Members
            const records = await admin
                .firestore()
                .collection(BUSINESS_COLLECTION)
                .doc(requestedUser.business)
                .collection(CONVERSATION_COLLECTION)
                .doc(conversationId)
                .get();

            if (records.exists) {
                const { members } = records.data() as { [key: string]: boolean };
                const membersIds = Object.keys(members).filter((memberId) => memberId !== requestedUser.userId);
                // update target user conversation unseen Counter
                for await (const memberId of membersIds) {
                    await admin
                        .firestore()
                        .collection(USER_COLLECTION)
                        .doc(memberId)
                        .collection(CONVERSATION_COLLECTION)
                        .doc(requestedUser.userId) // user requested
                        .update({
                            unseenCount: admin.firestore.FieldValue.increment(1),
                        });
                }
            }

            // update conversation info
            await admin
                .firestore()
                .collection(BUSINESS_COLLECTION)
                .doc(requestedUser.business)
                .collection(CONVERSATION_COLLECTION)
                .doc(conversationId)
                .update({
                    displayMessage: content,
                    lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
                });

            // Notify only one user. Currently support chat one to one
            // Future update it should notify all user in the group

            if (targetUser) {
                const { userId, firstName, lastName } = targetUser;

                // get all unseen notifications
                const unseenRecords = await admin
                    .firestore()
                    .collection(USER_COLLECTION)
                    .doc(targetUser.userId)
                    .collection(CONVERSATION_COLLECTION)
                    .where('unseenCount', '>', 0)
                    .get();

                let badgeTotal = 1;

                if (!unseenRecords.empty) {
                    badgeTotal = unseenRecords.docs
                        .map((userConversation) => {
                            const currentData = userConversation.data();
                            return currentData.unseenCount;
                        })
                        .reduce((acc, current) => {
                            return acc + current;
                        }, 0);
                }

                const notificationData = {
                    targetUserId: userId,
                    payload: {
                        notification: {
                            title: `${firstName} ${lastName}`,
                            body: content,
                        },
                        data: {
                            conversationId,
                        },
                        apns: {
                            payload: {
                                aps: {
                                    badge: badgeTotal,
                                },
                            },
                        },
                    },
                };
                // Notify target user
                await sendNotificationToUserByIdLocal(notificationData);
            }

            return true;
        } catch (error) {
            console.error(error);
            throw new functions.https.HttpsError('invalid-argument', error.message);
        }
    },
);

interface IResetUnseenCounter {
    targetUserId: string;
}

export const resetUnseenCounter = functions.region(REGION).https.onCall(
    async (data: IResetUnseenCounter, context): Promise<boolean> => {
        try {
            const requestedUser = await getCurrentUserInfo(context);
            const { targetUserId } = data;

            if (!requestedUser.business && targetUserId) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'User does not have business associated or targetUserId',
                );
            }

            // update conversation info
            await admin
                .firestore()
                .collection(USER_COLLECTION)
                .doc(requestedUser.userId)
                .collection(CONVERSATION_COLLECTION)
                .doc(targetUserId)
                .update({
                    unseenCount: 0,
                });

            return true;
        } catch (error) {
            console.error(error);
            throw new functions.https.HttpsError('invalid-argument', error.message);
        }
    },
);

interface ISetMessageStatus {
    messageId: string;
    status: MessageStatus;
    conversationId: string;
}
export const setMessageStatus = functions.region(REGION).https.onCall(
    async (data: ISetMessageStatus, context): Promise<boolean> => {
        try {
            const requestedUser = await getCurrentUserInfo(context);
            const { messageId, status, conversationId } = data;

            if (!requestedUser.business && messageId && status && conversationId) {
                console.error(
                    `Invalid parameters conversationId: ${conversationId} messageId: ${messageId} status: ${status}`,
                );
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'User does not have business associated or targetUserId',
                );
            }

            // update conversation info
            await admin
                .firestore()
                .collection(BUSINESS_COLLECTION)
                .doc(requestedUser.business)
                .collection(CONVERSATION_COLLECTION)
                .doc(conversationId)
                .collection(MESSAGES_COLLECTION)
                .doc(messageId)
                .update({
                    status,
                    readDate: status === 'read' ? admin.firestore.FieldValue.serverTimestamp() : null,
                });

            return true;
        } catch (error) {
            console.error(error);
            throw new functions.https.HttpsError('invalid-argument', error.message);
        }
    },
);
