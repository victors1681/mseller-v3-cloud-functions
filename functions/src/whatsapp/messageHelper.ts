import axios, { AxiosRequestConfig } from 'axios';

export const sendMessage = async (data: any, token: string, phoneNumberId: string) => {
    const config: AxiosRequestConfig<any> = {
        method: 'post',
        url: `https://graph.facebook.com/${process.env.VERSION}/${phoneNumberId}/messages`,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        data,
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

export interface IInvoiceTemplateProps {
    template: string;
    recipient: string;
    pdfUrl: string;
    fileName: string;
    sellerName: string;
}
export const getInvoiceTemplate = ({ template, recipient, pdfUrl, fileName, sellerName }: IInvoiceTemplateProps) => {
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
