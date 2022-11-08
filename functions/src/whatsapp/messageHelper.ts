import axios, { AxiosRequestConfig } from 'axios';

export const sendMessage = async (data: any) => {
    var config: AxiosRequestConfig<any> = {
        method: 'post',
        url: `https://graph.facebook.com/${process.env.VERSION}/${process.env.PHONE_NUMBER_ID}/messages`,
        headers: {
            Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
        },
        data: data,
    };

    return axios(config);
};

export const getTextMessageInput = ({ recipient, text }: any) => {
    return JSON.stringify({
        messaging_product: 'whatsapp',
        preview_url: false,
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: {
            body: text,
        },
    });
};

export interface InvoiceTemplateProps {
    template: string;
    recipient: string;
    pdfUrl: string;
    fileName: string;
    sellerName: string;
}
export const getInvoiceTemplate = ({ template, recipient, pdfUrl, fileName, sellerName }: InvoiceTemplateProps) => {
    return JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
            name: template,
            language: {
                code: 'es',
            },
            components: [
                {
                    type: 'header',
                    parameters: [
                        {
                            type: 'document',
                            document: {
                                link: pdfUrl,
                                filename: fileName,
                            },
                        },
                    ],
                },
                {
                    type: 'body',
                    parameters: [
                        {
                            type: 'text',
                            text: sellerName,
                        },
                    ],
                },
            ],
        },
    });
};
