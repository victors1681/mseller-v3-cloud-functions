import { getStorage } from 'firebase-admin/storage';
import * as functions from 'firebase-functions';
import { createDocument, createReceipt } from 'pdf-documents';
import * as uuid from 'uuid';
import { getBusinessById } from '../business';
import {sendGenericEmail} from "../email/email";
import { getCurrentUserInfo, REGION } from '../index';
import { formatCurrency } from '../util/formats';
import { getDocumentTemplate, IBodyParameter, IInvoiceTemplateProps, sendMessage } from '../whatsapp';
import { Document, Receipt } from './document.d';

const BUCKET_NAME = 'mobile-seller-documents';
const LINK_DAYS_SIGNED = 604800;

const sendWhatsappNotification = async (data: any, url: string, businessId: string): Promise<void> => {
    if (!data.whatsapp?.template || !data.whatsapp?.recipient) {
        functions.logger.warn('User data does not contain template name or recipient undefined');
        return;
    }
    // get business data
    const businessData = await getBusinessById(businessId);
    functions.logger.debug(businessData);
    const whatsappConfig = businessData.config?.integrations?.find((f) => f.provider === 'whatsapp');

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

export const generatePDF = functions.region(REGION).https.onCall(
    async (payload: any, context): Promise<{ url: string }> => {
        try {
            functions.logger.info(payload);
            const requestedUser = await getCurrentUserInfo(context);

            if (!requestedUser.business) {
                throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated');
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
            const path = `${requestedUser.business}/${year}-${month}/${day}/${fileName}.pdf`;

            const file = getStorage().bucket(BUCKET_NAME).file(path);

            if (['order', 'invoice', 'quote'].includes(data.documentType)) {
                await createDocument(data, file);
            } else if (data.documentType === 'receipt') {
                await createReceipt(data, file);
            }
            // Create the invoice
            const url = await file.getSignedUrl({
                version: 'v4',
                action: 'read',
                expires: Date.now() + LINK_DAYS_SIGNED,
            });

            /**
             * Send whatsapp notification only if whatsapp exist
             */

            if (data.metadata.sendByWhatsapp && data.whatsapp?.template && data.whatsapp?.recipient) {
                await sendWhatsappNotification(data, url[0], requestedUser.business);
            }else {
                console.log("Wont send whatsapp due to missing parameters", {sendByWhatsapp: data.metadata.sendByWhatsapp, template: data.whatsapp?.template, recipient: data.whatsapp?.recipient})
            }

            // Send document by email
            if(data.metadata.sendByEmail){
                await sendGenericEmail(data, url[0], requestedUser.business)
            }

            return { url: url[0] };
        } catch (error) {
            throw new functions.https.HttpsError('invalid-argument', error.message);
        }
    },
);
