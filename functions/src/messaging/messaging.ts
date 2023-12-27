import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { FCM_COLLECTION } from '../index';
import { findUserByInternalCodeAndBusinessId, getCurrentUserInfo, getUserById } from '../users';
import {
    getTokenByUserId,
    IMessagePayload,
    ISendNotificationToUserById,
    sendNotificationToUserByIdLocal,
    sendUserNotification,
} from './helpers';
import { storeNotification } from './notifications';
const REGION = 'us-east1';

/**
 * Firebase cloud messaging registration
 */

export const registerFCMToken = functions.region(REGION).https.onCall(
    async (data: string, context): Promise<boolean> => {
        try {
            const uid = context && context.auth && context.auth.uid;

            if (!data && !uid) {
                throw new functions.https.HttpsError('invalid-argument', 'fcmToken needed');
            }

            if (uid) {
                await admin.firestore().collection(FCM_COLLECTION).doc(uid).set({
                    fcmToken: data,
                });
            }
            return true;
        } catch (error) {
            console.error(error.message);
            throw new functions.https.HttpsError('invalid-argument', error.message);
        }
    },
);

/**
 * send notification message based only on userId
 */
export const sendNotificationToUserById = functions.region(REGION).https.onCall(
    async (data: ISendNotificationToUserById, context): Promise<boolean> => {
        try {
            const { targetUserId, payload } = data;

            if (!targetUserId && !payload) {
                console.error('target userId is missing or payload');
                throw new functions.https.HttpsError('invalid-argument', 'target userId is missing or payload');
            }

            const userToken = await getTokenByUserId(targetUserId);
            if (!userToken) {
                console.error('user FCM token not found');
                return false;
            }

            return await sendUserNotification(targetUserId, payload);
        } catch (error) {
            console.error(error.message);
            throw new functions.https.HttpsError('invalid-argument', error.message);
        }
    },
);

interface ISimpleNotification {
    targetUserId?: string;
    title: string;
    body: string;
    imageUrl?: string;
    senderImageUrl?: string;
    type: string;
    urgent: string;
}

interface INotificationByInternalCode extends ISimpleNotification {
    code: string;
    businessId: string;
}

export const sendSimpleNotificationByInternalCode = functions
    .region(REGION)
    .https.onCall(async (data: INotificationByInternalCode, context) => {
        try {
            const internalUser = await findUserByInternalCodeAndBusinessId(data.code, data.businessId);

            if (internalUser) {
                console.log(`Internal User: ${data.code} business ${data.businessId}, data: ${internalUser}`);

                const payload: IMessagePayload = {
                    notification: {
                        title: data.title,
                        body: data.body,
                    },
                    data: {
                        senderId: internalUser.userId,
                        senderImageUrl: '',
                        type: 'info',
                        urgent: data.urgent ? '1' : '0',
                        senderName: `Mobile Seller`,
                        time: new Date().toISOString(),
                    },
                    apns: {
                        payload: {
                            aps: {
                                badge: 1,
                                'content-available': 1,
                            },
                        },
                    },
                };

                await sendNotificationToUserByIdLocal({ targetUserId: internalUser.userId, payload });
            }
        } catch (error) {
            console.error(error.message);
            throw new functions.https.HttpsError('invalid-argument', error.message);
        }
    });

export const sendSimpleNotificationToUserById = functions.region(REGION).https.onCall(
    async (data: ISimpleNotification, context): Promise<boolean> => {
        try {
            if (data.targetUserId) {
                const requestedUser = await getCurrentUserInfo(context);
                const payload: IMessagePayload = {
                    notification: {
                        title: data.title,
                        body: data.body,
                    },
                    data: {
                        senderId: requestedUser.userId,
                        senderImageUrl: requestedUser.photoURL ? requestedUser.photoURL : '',
                        type: 'info',
                        urgent: data.urgent ? '1' : '0',
                        senderName: `${requestedUser.firstName} ${requestedUser.lastName}`,
                        time: new Date().toISOString(),
                    },
                    apns: {
                        payload: {
                            aps: {
                                badge: 1,
                                'content-available': 1,
                            },
                        },
                    },
                };
                await sendNotificationToUserByIdLocal({ targetUserId: data.targetUserId, payload });

                // save notification if successfully sent
                const targetUser = await getUserById(data.targetUserId);
                await storeNotification(requestedUser, payload, targetUser);

                return true;
            } else {
                throw new functions.https.HttpsError('invalid-argument', `invalid targetUserId: ${data} messaging.ts`);
            }
        } catch (error) {
            console.error(error.message);
            throw new functions.https.HttpsError('invalid-argument', error.message);
        }
    },
);

/**
 * Notify all users of the same company
 * data: {title: @string, body: @string, imageUrl?: string}
 */

export const notifyAllUsers = functions.region(REGION).https.onCall(
    async (data: ISimpleNotification, context): Promise<boolean> => {
        try {
            const requestedUser = await getCurrentUserInfo(context);

            // use topic as business id to notify all subscribers
            const topic = requestedUser.business;

            const message = {
                notification: {
                    ...data,
                },
                data: {
                    senderId: requestedUser.userId,
                    senderImageUrl: requestedUser.photoURL ? requestedUser.photoURL : '',
                    type: 'info',
                    urgent: data.urgent ? data.urgent : '0',
                    senderName: `${requestedUser.firstName} ${requestedUser.lastName}`,
                    time: new Date().toISOString(),
                },
                apns: {
                    payload: {
                        aps: {
                            badge: 1,
                            'content-available': 1,
                        },
                    },
                },
                topic,
            } as any;

            // Send a message to devices subscribed to the provided topic.
            const response = await admin.messaging().send(message);

            // save notification if successfully sent

            await storeNotification(requestedUser, message, undefined, true); // broadcast

            console.log('Successfully sent message:', response);

            return true;
        } catch (error) {
            throw new functions.https.HttpsError('invalid-argument', error.message);
        }
    },
);
