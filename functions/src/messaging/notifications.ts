import * as admin from 'firebase-admin';
import { BUSINESS_COLLECTION, IMessagePayload, NOTIFICATION_COLLECTION, USER_COLLECTION } from '../index';

export interface INotification {
    isBroadcast: boolean,
    notificationType: 'sending' | 'receiving'
    title: string
    message: string
    sender: ISender
    recepient: IRecepient
    type: string
    urgent: boolean
    sentDate: string
    readDate: string
    received: boolean,
    read: boolean
}

export interface ISender {
    userId: string
    imageUrl: string
    name: string
}

export interface IRecepient {
    userId: string
    imageUrl: string
    name: string
}



export const storeNotification = async (senderUser: IUser, payload: IMessagePayload, targetUser?: IUser, isBroadcast = false) => {
    // save notification for user
    const notiPayload = {
        isBroadcast,
        notificationType: 'receiving',
        title: payload.notification.title,
        message: payload.notification.body,
        sender: {
            userId: senderUser.userId,
            imageUrl: senderUser.photoURL,
            name: `${senderUser.firstName} ${senderUser.lastName}`
        },
        recepient: {
            userId: targetUser?.userId,
            imageUrl: targetUser?.photoURL,
            name: `${targetUser?.firstName} ${targetUser?.lastName}`
        },
        type: payload.data?.type,
        urgent: payload.data?.urgent,
        sentDate: admin.firestore.FieldValue.serverTimestamp(),
        readDate: "",
        received: false,
        read: false,
    }

    try {
        if (!isBroadcast && targetUser) { // only save notification on the user if use simple notification
            await admin
                .firestore()
                .collection(USER_COLLECTION)
                .doc(targetUser.userId)
                .collection(NOTIFICATION_COLLECTION)
                .add(notiPayload);

                const incrementValue = admin.firestore.FieldValue.increment(1);
                await admin
                .firestore()
                .collection(USER_COLLECTION)
                .doc(targetUser.userId)
                .update({
                    notifications: incrementValue
                })
        }
        // Save notification on the business level

        await admin
            .firestore()
            .collection(BUSINESS_COLLECTION)
            .doc(senderUser.businessId)
            .collection(NOTIFICATION_COLLECTION)
            .add(notiPayload);
    } catch (err) {
        console.error("error saving the notification ", err)
    }

}
