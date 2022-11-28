type IntegrationProvider = 'whatsapp';

interface IIntegration {
    provider?: IntegrationProvider;
    enabled?: boolean;
    isDevelopment?: boolean;
    token?: string;
    phoneNumberId?: string;
    devToken?: string;
    devPhoneNumberId?: string;
}

interface IMetadata {
    [Key: string]: any;
}

export interface IBusiness {
    businessId: string;
    address: {
        city: string;
        country: string;
        street: string;
    };
    config: {
        sandboxPort: string;
        sandboxUrl: string;
        serverPort: string;
        serverUrl: string;
        testMode: boolean;
        displayPriceWithTax: boolean;
        allowPriceBelowMinimum: boolean;
        orderEmailTemplateID: number;
        paymentEmailTemplateID: number;
        allowQuote: boolean;
        trackingLocation: boolean;
        metadata: Array<IMetadata>;
        integrations?: IIntegration[];
    };
    contact: string;
    contactPhone: string;
    email: string;
    fax: string;
    footerMessage: string;
    footerReceipt: string;
    name: string;
    phone: string;
    rnc: string;
    sellerLicenses: number;
    startingDate: Date;
    status: boolean;
    website: string;
    logoUrl: string;
    sellingPackaging: false;
}
