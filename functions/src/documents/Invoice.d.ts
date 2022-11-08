export interface Whatsapp {
        recipient: string;
        template: "quote" | "order" | "invoice";
        fileName: string;
}
export interface Invoice {
    whatsapp?: Whatsapp,
    company: Company;
    customer: Customer;
    ncf: string;
    ncfDescription: string;
    invoice: string;
    dueDay: string;
    issueDay: string;
    documentType: string;
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
