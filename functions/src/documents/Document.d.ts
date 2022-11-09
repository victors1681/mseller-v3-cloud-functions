export type DocumentType = 'quote' | 'order' | 'invoice' | 'receipt';

export interface Whatsapp {
    recipient: string;
    template: DocumentType;
    fileName: string;
}
export interface Invoice {
    whatsapp?: Whatsapp;
    company: Company;
    customer: Customer;
    ncf: string;
    ncfDescription: string;
    invoice: string;
    dueDay: string;
    issueDay: string;
    documentType: DocumentType;
    footerMsg: string;
    items: Item[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
}

export interface Company {
    name: string;
    address: string;
    city: string;
    logo: string;
    rnc: string;
    phone: string;
    branch: string;
}

export interface Customer {
    name: string;
    rnc: string;
    phone: string;
    address: string;
    seller: string;
    email: string;
    whatsapp: string;
}

export interface Item {
    quantity: number;
    item: string;
    description: string;
    unit: string;
    amount: number;
    discount: number;
    tax: number;
    subtotal: number;
}


export interface Receipt{
    whatsapp?: Whatsapp;
        company: Company
        customer: Customer
        documentNo: string
        dueDay: string
        issueDay: string
        documentType: DocumentType
        paymentType: string
        isFutureCheck: boolean
        futureDate: string
        bankName: string
        referenceNo: string
        footerMsg: string
        items: ReceiptItem[]
        note: string
        documentTotal: number
        discountTotal: number
        totalCollected: number  
}

export interface ReceiptItem {
    document: string
    node: string
    discount: number
    tax: number
    subtotal: number
    total: number
    date: string
    collected: number
}