interface IUser {
    userId: string;
    password?: string;
    email: string;
    photoURL: string;
    business: string;
    editPrice: boolean;
    filterClients: boolean;
    firstName: string;
    firstTimeLogin: boolean;
    forceUpdatePassword: boolean;
    initialConfig: boolean;
    lastName: string;
    onlyMyClients: boolean;
    onlyProductsSelected: boolean;
    phone: string;
    priceCondition: boolean;
    resetIpad: boolean;
    restoreIpad: boolean;
    sellerCode: string;
    testMode: boolean;
    type: 'seller' | 'administrator' | 'superuser';
    userLevel: string;
    defaultClientByRoute: boolean;
    updateBankList: boolean;
    warehouse: string;
    disabled: boolean;
    fcmToken: string;
}
