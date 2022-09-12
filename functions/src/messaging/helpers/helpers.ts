import * as admin from 'firebase-admin';
import { FCM_COLLECTION } from '../../index';

export interface IMessagePayload {
    notification: {
        title: string;
        body: string;
    };
    data?: {};
    apns?: {
        payload: {
            aps: {
                badge: number;
                "content-available"?: number // wake up the app in background
            };
        };
    };
}

export const sendUserNotification = async (registrationToken: string, payload: IMessagePayload): Promise<boolean> => {
    try {
        await admin.messaging().send({ token: registrationToken, ...payload });

        console.log('message sent');
        return true;
    } catch (error) {
        console.log('Error sending message:', error);
        return false;
    }
};

export const getTokenByUserId = async (userId: string): Promise<string | undefined> => {
    try {
        const result = await admin.firestore().collection(FCM_COLLECTION).doc(userId).get();

        if (result.exists) {
            const { fcmToken } = result.data() as any;
            return fcmToken;
        }
        return undefined;
    } catch (error) {
        console.error('Unable to get user token');
        return undefined;
    }
};

export interface ISendNotificationToUserById {
    targetUserId: string;
    payload: IMessagePayload;
}

export const sendNotificationToUserByIdLocal = async (data: ISendNotificationToUserById): Promise<boolean> => {
    try {
        const { targetUserId, payload } = data;

        if (!targetUserId && !payload) {
            console.error('target userId is missing or payload');
        }

        const userToken = await getTokenByUserId(targetUserId);

        if (!userToken) {
            console.error('user FCM token not found');
            return false;
        }

        return await sendUserNotification(userToken, payload);
    } catch (error) {
        console.error(error.message);
        return false;
    }
};
