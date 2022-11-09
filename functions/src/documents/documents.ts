import { getStorage } from 'firebase-admin/storage';
import * as functions from 'firebase-functions';
import { createDocument, createReceipt } from 'pdf-documents';
import * as uuid from 'uuid';
import { getBusinessById } from '../business';
import { getCurrentUserInfo, REGION } from '../index';
import { getInvoiceTemplate, IInvoiceTemplateProps, sendMessage } from '../whatsapp';
import { Invoice, Receipt } from './Document.d';

const BUCKET_NAME = 'mobile-seller-documents';
const LINK_DAYS_SIGNED = 604800;

const sendWhatsappNotification = async (data: Invoice | Receipt, url: string, businessId: string): Promise<void> => {
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

    const payload: IInvoiceTemplateProps = {
        template: data.whatsapp?.template,
        recipient: data.whatsapp?.recipient,
        pdfUrl: url,
        fileName: data.whatsapp?.fileName,
        sellerName: data.customer.seller,
    };

    const template = getInvoiceTemplate(payload);

    const result = await sendMessage(template, currentToken, currentPhoneNumberId);
    if (result.status === 200) {
        functions.logger.info('Notification sent!', data.customer.name);
    } else {
        functions.logger.error('Whatsapp notification could not be sent', result);
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

            const data = ["order", "invoice", "quote"].includes(payload.documentType) ?  payload as Invoice : payload  as Receipt
            
            console.info('data', data.customer.name);

            const date = new Date();
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear().toString();
            const fileName = uuid.v4();
            const path = `${requestedUser.business}/${year}-${month}/${day}/${fileName}.pdf`;

            const file = getStorage().bucket(BUCKET_NAME).file(path);
            
            if(["order", "invoice", "quote"].includes(data.documentType)){
                await createDocument(data, file);
            }else if (data.documentType === "receipt"){
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

            if (data.whatsapp?.template && data.whatsapp?.recipient) {
                await sendWhatsappNotification(data, url[0], requestedUser.business);
            }

            return { url: url[0] };
        } catch (error) {
            throw new functions.https.HttpsError('invalid-argument', error.message);
        }
    },
);
