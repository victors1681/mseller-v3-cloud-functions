import * as functions from 'firebase-functions';
import { getCurrentUserInfo, REGION } from '../index';
import { getStorage } from 'firebase-admin/storage';
import * as uuid from 'uuid';
import { createInvoice } from 'pdf-documents';
import { Invoice } from './Invoice';
import { sendMessage, getInvoiceTemplate, InvoiceTemplateProps } from '../whatsapp';
const BUCKET_NAME = 'mobile-seller-documents';
const LINK_DAYS_SIGNED = 604800;


const sendWhatsappNotification = async (data: Invoice, url: string): Promise<void> => {

    if(!data.whatsapp?.template && !data.whatsapp?.recipient){
        return ;
    }
    
        const payload: InvoiceTemplateProps = {
            template: data.whatsapp?.template,
            recipient: data.whatsapp?.recipient,
            pdfUrl: url,
            fileName: 'Factura.pdf',
            sellerName: data.customer.seller,
        };

        const template = getInvoiceTemplate(payload);

        const result = await sendMessage(template);
        if(result.status === 200){
            functions.logger.info("Notification sent!", data.customer.name);
        }else{
            functions.logger.error("Whatsapp notification could not be sent", result);
        }
}


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

        console.info('data', data.customer.name);

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
            expires: Date.now() + LINK_DAYS_SIGNED,
        });

        /**
         * Send whatsapp notification only if whatsapp exist
         */

         if(data.whatsapp?.template && data.whatsapp?.recipient){
            await sendWhatsappNotification(data, url.toString());
        }

        return { url };
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
