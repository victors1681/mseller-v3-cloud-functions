declare module '*.json' {
    const value: any;
    export default value;
}

interface IContext {
    auth: {
        uid: string;
        token: {
            name: string;
            picture: string;
            email: string;
        };
    };
}

declare module 'pdf-documents' {
    const createDocument: (data: Invoice, file: any) => Promise<string>;
    const createReceipt: (data: Invoice, file: any) => Promise<string>;
}
