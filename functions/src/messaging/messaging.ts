import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { FCM_COLLECTION } from '../index';
// import { getCurrentUserInfo, getUserById } from "../users";
import { getTokenByUserId, ISendNotificationToUserById, sendUserNotification } from './helpers';
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
