import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
//import { logger } from 'firebase-functions/v2';
import {
    addUserV2Common,
    BUSINESS_COLLECTION,
    deleteUserV2Common,
    getCurrentUserInfo,
    USER_COLLECTION,
} from '../index';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { IBusiness } from './businessType';

/**
 * get business information from the ID
 * @param businessId
 */

export const getBusinessById = async (businessId: string): Promise<IBusiness> => {
    try {
        const snapshot = await admin.firestore().collection(BUSINESS_COLLECTION).doc(businessId).get();

        if (snapshot.exists) {
            const data = snapshot.data();
            return { ...data, businessId } as any;
        } else {
            throw new functions.https.HttpsError(
                'not-found',
                `user ${businessId} not found on ${BUSINESS_COLLECTION} File: users.ts functions server. Might be because is looking on Emulator DB`,
            );
        }
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
};

const isAccountExist = async (email: string) => {
    try {
        await admin.auth().getUserByEmail(email);
        return true;
    } catch {
        return false;
    }
};

/**
 * This function will create a new business and a default user to onboard a new customer
 */
export const addPortalBusiness = onCall({ cors: '*' }, async ({ data, ...context }) => {
    try {
        const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                secret: process.env.GOOGLE_RE_CAPTCHA || '',
                response: data.reCaptchaToken,
            }),
        });

        const captchaData = await response.json();

        console.log('Response from Re Catcha', captchaData);
        if (!captchaData.success || captchaData.score < 0.5) {
            // Adjust score threshold as needed
            throw new functions.https.HttpsError('failed-precondition', `reCatcha Invalid`);
        }

        if (await isAccountExist(data.user_email)) {
            throw new functions.https.HttpsError('already-exists', `Email ${data.user_email} already exist`);
        }
        const currentDate = new Date().toLocaleDateString();
        const userFullName = `${data.user_first_name} ${data.user_last_name}`;

        //Ensure all the data is consistent with the portal
        const defaultBusinessData: IBusiness = {
            businessId: '',
            name: data.business_name,
            rnc: '',
            phone: data.phone,
            email: data.user_email,
            logoUrl: '',
            footerMessage: '',
            footerReceipt: '',
            sellerLicenses: 1, //default license
            contact: userFullName,
            contactPhone: '',
            fax: '',
            website: '',
            address: {
                street: data.address,
                city: '',
                country: data.country,
            },
            config: {
                serverUrl: process.env.CLOUD_PRODUCTION_API_URL || '',
                serverPort: process.env.CLOUD_PRODUCTION_API_PORT || '',
                sandboxUrl: process.env.CLOUD_TEST_API_URL || '',
                sandboxPort: process.env.CLOUD_TEST_API_PORT || '',
                portalServerUrl: '',
                portalServerPort: '',
                portalSandboxUrl: '',
                portalSandboxPort: '',
                testMode: false,
                displayPriceWithTax: false,
                allowPriceBelowMinimum: false,
                allowOrderAboveCreditLimit: false,
                allowLoadLastOrders: false,
                allowLoadLastPrices: false,
                allowConfirmProductStock: false,
                allowCaptureCustomerGeolocation: true,
                showProducInfoPanel: false,
                temporalOrder: true,
                orderEmailTemplateID: 4387549,
                paymentEmailTemplateID: 0,
                allowQuote: true,
                trackingLocation: false,
                integrations: [],
                metadata: [],
                captureTemporalDoc: true,
                defaultUnitSelectorBox: false,
                v4: true,
                promocion: false,
                proximaOrden: false,
                enableConfirmSelector: false,
            },
            status: true,
            sellingPackaging: false,
            startDate: currentDate,
            fromPortal: true,
            stripeCustomerId: '',
            subscriptionId: '',
            subscriptionStatus: '',
            tier: 'basic',
        };

        const businessData: IBusiness = {
            ...defaultBusinessData,
        };
        //Create the business

        const business = await admin
            .firestore()
            .collection(BUSINESS_COLLECTION)
            .add({ ...businessData });

        //Update businessId
        await admin.firestore().collection(BUSINESS_COLLECTION).doc(business.id).update({ businessId: business.id });

        //Create the new user

        const userData = {
            email: data.user_email,
            password: data.user_password,
            firstName: data.user_first_name,
            lastName: data.user_last_name,
            photoURL: 'https://storage.cloud.google.com/it_soluclick/user-temporal-placeholder.jpeg',
            business: business.id,
            type: 'administrator',
            userLevel: 'level1',
            sellerCode: '1',
            warehouse: '1',
            phone: data.phone,
            disabled: false,
            //Config
            firstTimeLogin: true,
            initialConfig: true,
            onlyMyClients: true,
            createClient: true,
            allowDiscount: true,
            allowBankDeposit: true,
            emailVerified: false, //NO VERIFIED
            creationFromPortal: true, // TEMPORAL FLAG TO ALLOW TO CREATE A NEW USER FROM THE PORTAL
        };
        // Call addUserV2 to create the user
        const addUserResponse = await addUserV2Common({ data: userData, ...context });

        //create user
        if (addUserResponse.userId) {
            const verificationLink = await admin.auth().generateEmailVerificationLink(data.user_email);
            console.log('Verification link generated:', verificationLink);

            // Step 3: Write to Firestore collection to trigger the email
            const emailCollection = admin.firestore().collection('mail');

            // Verification Email to the User
            await emailCollection.add({
                to: [data.user_email],
                message: {
                    subject: 'Verificación de correo electrónico - MSeller Cloud',
                    html: `
                        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                            <h2 style="color: #0056b3;">Verifica tu correo electrónico</h2>
                            <p>Hola,</p>
                            <p>Gracias por registrarte en <strong>MSeller Cloud</strong>. Por favor, verifica tu correo electrónico haciendo clic en el siguiente enlace:</p>
                            <p style="text-align: center; margin: 20px 0;">
                                <a href="${verificationLink}" style="display: inline-block; padding: 10px 20px; background-color: #0056b3; color: #fff; text-decoration: none; border-radius: 5px;">Verificar correo</a>
                            </p>
                            <p>Si el botón anterior no funciona, copia y pega el siguiente enlace en tu navegador:</p>
                            <p style="word-wrap: break-word; color: #555;">${verificationLink}</p>
                            <p>Gracias por usar <strong>MSeller Cloud</strong>.</p>
                            <p style="color: #888; font-size: 12px;">Este es un mensaje automático. Por favor, no respondas a este correo.</p>
                        </div>
                    `,
                },
            });

            // Notification Email to Admins
            await emailCollection.add({
                to: ['asdominicana@gmail.com', 'ltorres@itsoluclick.com', 'b.torres@itsoluclick.com'],
                message: {
                    subject: 'Nuevo Usuario Registrado - MSeller Cloud',
                    html: `
                        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                            <h2 style="color: #0056b3;">Nuevo Usuario Registrado</h2>
                            <p>Este es un mensaje automático desde <strong>cloud.mseller.app</strong>. Un nuevo usuario se ha registrado:</p>
                            <h3>Datos de la Empresa</h3>
                            <ul style="list-style: none; padding: 0; color: #555;">
                                <li><strong>Nombre de la empresa:</strong> ${data.business_name}</li>
                                <li><strong>Teléfono:</strong> ${data.phone}</li>
                                <li><strong>País:</strong> ${data.country}</li>
                            </ul>
                            <h3>Datos del Usuario</h3>
                            <ul style="list-style: none; padding: 0; color: #555;">
                                <li><strong>Nombre:</strong> ${userFullName}</li>
                                <li><strong>Email:</strong> ${data.user_email}</li>
                            </ul>
                            <p style="color: #888; font-size: 12px;">Este es un mensaje automático. Por favor, no respondas a este correo.</p>
                        </div>
                    `,
                },
            });
        }

        functions.logger.info('New business and user created');
        return { result: 'Business and user created', userId: addUserResponse.userId, businessId: business.id };
    } catch (error) {
        throw new HttpsError('invalid-argument', error.message);
    }
});

/*
 * Delete all users and the business
 * parameter businessId
 * User need to be logged
 */
export const deleteBusinessById = onCall(async ({ data, ...context }) => {
    try {
        const { businessId } = data;

        if (!businessId) {
            throw new functions.https.HttpsError(
                'not-found',
                `Business id:${businessId} not found on ${BUSINESS_COLLECTION} File: business.ts functions server. Might be because is looking on Emulator DB`,
            );
        }

        const currentUser = await getCurrentUserInfo(context);

        //Only super user can remove a business or administrator from the same business
        if (currentUser.business !== businessId && currentUser.type !== 'superuser') {
            throw new functions.https.HttpsError(
                'permission-denied',
                `You cannot remove a business, only superuser and administrator of the same business can!`,
            );
        }

        if (currentUser.business === businessId && currentUser.type !== 'administrator') {
            throw new functions.https.HttpsError(
                'permission-denied',
                `You have not administrator privileges to remove a business!`,
            );
        }

        const userRecords = await admin
            .firestore()
            .collection(USER_COLLECTION)
            .where('businessId', '==', businessId)
            .get();

        userRecords.forEach(async (doc) => {
            const userId = doc.id;
            await deleteUserV2Common({ data: userId, ...context });
        });

        //remove business
        const businessData = await getBusinessById(businessId);
        await admin.firestore().collection(BUSINESS_COLLECTION).doc(businessId).delete();

        const emailCollection = admin.firestore().collection('mail');
        await emailCollection.add({
            to: ['asdominicana@gmail.com', businessData.email],
            message: {
                subject: `${businessData.name} eliminada de MSELLER Cloud`,
                html: `<p>Este es un mensaje automático desde cloud.mseller.app empresa eliminada:</p>
                     <p>Nombre de la empresa: ${businessData.name}</p>
                     <p>Cantidad Usuarios: ${userRecords.docs.length}</p>`,
            },
        });

        return { result: 'Business removed', businessId: businessId };
    } catch (error) {
        throw new HttpsError('invalid-argument', error.message);
    }
});
