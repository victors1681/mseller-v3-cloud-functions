import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { BUSINESS_COLLECTION } from '../index';
import { IBusiness } from './business.d';

/**
 * get business information from the ID
 * @param businessId
 */

export const getBusinessById = async (businessId: string): Promise<IBusiness> => {
    try {
        const snapshot = await admin.firestore().collection(BUSINESS_COLLECTION).doc(businessId).get();

        if (snapshot.exists) {
            const data = snapshot.data();
            return { ...data, businessId } as any;
        } else {
            throw new functions.https.HttpsError(
                'not-found',
                `user ${businessId} not found on ${BUSINESS_COLLECTION} File: users.ts functions server. Might be because is looking on Emulator DB`,
            );
        }
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
};
