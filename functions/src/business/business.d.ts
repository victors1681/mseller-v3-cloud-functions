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

interface IBusiness {
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

        portalSandboxPort: string;
        portalSandboxUrl: string;
        portalServerPort: string;
        portalServerUrl: string;

        testMode: boolean;
        displayPriceWithTax: boolean;
        allowPriceBelowMinimum: boolean;
        allowOrderAboveCreditLimit: boolean;
        allowLoadLastOrders: boolean;
        allowLoadLastPrices: boolean;
        allowConfirmProductStock: boolean;
        allowCaptureCustomerGeolocation: boolean;
        showProducInfoPanel: boolean;
        captureTemporalDoc: boolean;
        orderEmailTemplateID: number;
        paymentEmailTemplateID: number;
        defaultUnitSelectorBox: boolean;
        allowQuote: boolean;
        v4: boolean;
        promocion: boolean;
        proximaOrden: boolean;
        trackingLocation: boolean;
        enableConfirmSelector: boolean;
        metadata: Array<{ [key: string]: any }>;
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
