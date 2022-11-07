import * as functions from 'firebase-functions';
import { getCurrentUserInfo, REGION } from '../index';
import { getStorage } from 'firebase-admin/storage';
import * as uuid from 'uuid';
import { createInvoice } from 'pdf-documents';
import { Invoice } from './Invoice';

const BUCKET_NAME = 'mobile-seller-documents';
const LINK_DAYS_SIGNED = 15 //days
/**
 * based on the user request it get the user who is requesting and get the business id associated
 */
export const generatePDF = functions.region(REGION).https.onCall(async (data: Invoice, context) => {
    try {
        functions.logger.info(data);
        const requestedUser = await getCurrentUserInfo(context);

        if (!requestedUser.business) {
            throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated');
        }

        const date = new Date();
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear().toString();
        const fileName = uuid.v4();
        const path = `${requestedUser.business}/${year}-${month}/${day}/${fileName}.pdf`;

        const file = getStorage().bucket(BUCKET_NAME).file(path);

        await createInvoice(data, file);
        //Create the invoice
        const url = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now()  + 1000 * 86400 * LINK_DAYS_SIGNED, 
        });

        return { url };
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
