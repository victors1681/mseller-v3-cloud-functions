"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmailTemplate = void 0;
const functions = __importStar(require("firebase-functions"));
const index_1 = require("../index");
const Mailjet = require('node-mailjet');
const mailjet = new Mailjet({
    apiKey: 'f2e1937095ccad002389351bffd0533d',
    apiSecret: '0f221d718c2ced5a933d91a89d7f03d6',
});
const payload = {
    Messages: [
        {
            From: {
                Email: 'hello@mseller.app',
                Name: 'Mobile Seller',
            },
            To: [
                {
                    Email: 'victors1681@hotmail.com',
                    Name: 'Victor Santos',
                },
            ],
            TemplateID: 4148643,
            TemplateLanguage: true,
            Subject: 'Pedido No. 20102',
            Variables: {
                image_url: 'https://www.mobile-seller.com/mbs/wp-content/uploads/2015/09/mseller-logo-dark.png',
                order_payment_condition: '30 dias',
                order_type: 'Pedido',
                mseller_customer_name: 'Cervecería Vegana',
                client_name: 'SUPERMERCADO EL NACIONAL',
                client_address: 'Av. Rafael Vidal Residencial Palma linda',
                client_phone: '809-889-9833',
                salesman: '12-PEDRO GOMEZ',
                salesman_phone: '809-334-3344',
                order_date: '02/23/2012 12:44 pm',
                order_no: '1232322',
                order_sub_total: 'RD$2,322.0',
                order_discount: 'RD$12,222.00',
                order_taxes: 'RD$2,322.00',
                order_total: 'RD$10,222.0',
                mail_footer: 'Cerveceria Vegana | Ave. Rafael Vidal, La vega 809-555-53234',
                items: [
                    {
                        quantity: 22.1,
                        unit: 'CJ',
                        code: 'CO-33343',
                        desc: 'DETERGENTE LAVAPLATOS 4.50 FD',
                        price: 'RD$343.03',
                        discount: 'RD$233.0',
                        subTotal: 'RD$223.33',
                    },
                    {
                        quantity: 23.1,
                        unit: 'CJ',
                        code: 'CO-33343',
                        desc: 'DETERGENTE LAVAPLATOS 4.50 FD',
                        price: 'RD$343.03',
                        discount: 'RD$233.0',
                        subTotal: 'RD$223.33',
                    },
                ],
            },
        },
    ],
};
/**
 * based on the user request it get the user who is requesting and get the business id associated
 */
exports.sendEmailTemplate = functions.region(index_1.REGION).https.onCall(async (data, context) => {
    try {
        console.log('datadata:', data);
        return;
        const requestedUser = await (0, index_1.getCurrentUserInfo)(context);
        if (!requestedUser.business) {
            throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated');
        }
        const request = mailjet.post('send', { version: 'v3.1' }).request(payload);
        const result = await request();
        return { result };
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
//# sourceMappingURL=email.js.map