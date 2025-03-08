import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';
import { createDocument, createReceipt } from 'pdf-documents';
import * as uuid from 'uuid';
import { getBusinessById } from '../business';
import { IIntegration } from '../business/businessType';
import { sendGenericEmail } from '../email/email';
import { BUSINESS_COLLECTION, DOCUMENTS_COLLECTION } from '../index';
import { formatCurrency } from '../util/formats';
import { getDocumentTemplate, IBodyParameter, IInvoiceTemplateProps, sendMessage } from '../whatsapp';
import { Document, Receipt } from './document.d';

const sendWhatsappNotification = async (data: any, url: string, businessId: string): Promise<void> => {
    if (!data.whatsapp?.template || !data.whatsapp?.recipient) {
        functions.logger.warn('User data does not contain template name or recipient undefined');
        return;
    }
    // get business data
    const businessData = await getBusinessById(businessId);
    functions.logger.debug(businessData);
    const whatsappConfig = businessData.config?.integrations?.find((f: IIntegration) => f.provider === 'whatsapp');

    if (!whatsappConfig || whatsappConfig?.enabled === false) {
        functions.logger.warn('whatsappConfig undefined or is not enabled in configuration');
        return;
    }

    const { token, phoneNumberId, devPhoneNumberId, devToken, isDevelopment } = whatsappConfig;

    const currentToken = isDevelopment ? devToken : token;
    const currentPhoneNumberId = isDevelopment ? devPhoneNumberId : phoneNumberId;

    if (!currentToken || !currentPhoneNumberId) {
        functions.logger.warn('currentToken or currentPhoneNumberId undefined', { currentToken, currentPhoneNumberId });
        return;
    }

    const parameters = [
        {
            type: 'text',
            text: data.customer.name.toLowerCase(),
        },
        {
            type: 'text',
            text: data.documentNo,
        },
        data.documentType === 'invoice' && {
            // the the amount variable
            type: 'text',
            text: formatCurrency(data?.total, data),
        },
        data.whatsapp?.template === 'receipt' && {
            type: 'text',
            text: formatCurrency(data?.totalCollected, data),
        },
        {
            type: 'text',
            text: data.customer.seller,
        },
        {
            type: 'text',
            text: data.customer.sellerPhone,
        },
    ].filter((f) => f) as IBodyParameter[];

    const payload: IInvoiceTemplateProps = {
        template: data.whatsapp?.template,
        recipient: data.whatsapp?.recipient,
        pdfUrl: url,
        fileName: data.whatsapp?.fileName,
        parameters,
    };

    const template = getDocumentTemplate(payload);

    try {
        const result = await sendMessage(template, currentToken, currentPhoneNumberId);
        if (result.status === 200) {
            functions.logger.info('Notification sent!', data.customer.name);
        } else {
            functions.logger.error('Whatsapp notification could not be sent', result);
        }
    } catch (err) {
        functions.logger.error('Whatsapp notification could not be sent', err);
        throw new functions.https.HttpsError('cancelled', err.message);
    }
};

/**
 * based on the user request it get the user who is requesting and get the business id associated
 */

export const generatePDF = onCall(
    async (context): Promise<{ url: string }> => {
        try {
            const payload = context.data;

            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'User must be authenticated to create a subscription.',
                );
            }

            functions.logger.info(payload);
            const userRecord = await admin.auth().getUser(context.auth.uid);

            const businessId = userRecord.customClaims?.business;
            if (!businessId) {
                throw new functions.https.HttpsError('invalid-argument', 'Business ID is missing.');
            }

            const data = ['order', 'invoice', 'quote'].includes(payload.documentType)
                ? (payload as Document)
                : (payload as Receipt);

            console.info('Trying to send pdf document to: ', data.customer.name);

            const date = new Date();
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear().toString();
            const fileName = uuid.v4();
            const path = `${businessId}/documents/${year}-${month}/${day}/${fileName}.pdf`;

            const bucket = admin.storage().bucket();
            const file = bucket.file(path);

            if (['order', 'invoice', 'quote'].includes(data.documentType)) {
                await createDocument(data, file);
            } else if (data.documentType === 'receipt') {
                await createReceipt(data, file);
            }

            await file.makePublic();
            const url = file.publicUrl();

            if (data.metadata.sendByWhatsapp && data.whatsapp?.template && data.whatsapp?.recipient) {
                await sendWhatsappNotification(data, url, businessId);
            } else {
                console.log('Wont send whatsapp due to missing parameters', {
                    sendByWhatsapp: data.metadata.sendByWhatsapp,
                    template: data.whatsapp?.template,
                    recipient: data.whatsapp?.recipient,
                });
            }

            if (data.metadata.sendByEmail) {
                await sendGenericEmail(data, url, businessId);
            }

            const firestore = admin.firestore();
            const doc = {
                path,
                fileName,
                data,
            };

            const docsRef = firestore
                .collection(BUSINESS_COLLECTION)
                .doc(businessId)
                .collection(DOCUMENTS_COLLECTION)
                .doc(fileName);

            await docsRef.set(doc);

            return { url };
        } catch (error) {
            throw new functions.https.HttpsError('invalid-argument', error.message);
        }
    },
);
