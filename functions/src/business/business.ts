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
        const defaultBusinessData = {
            businessId: '',
            name: data.business_name,
            rnc: '',
            phone: data.phone,
            email: data.user_email,
            photoURL: '',
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
                showProductInfoPanel: false,
                temporalOrder: true,
                orderEmailTemplateID: 4387549,
                paymentEmailTemplateID: 0,
                allowQuote: true,
                trackingLocation: false,
                integrations: [],
                metadata: [],
                showProducInfoPanel: false,
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

            await emailCollection.add({
                to: [data.user_email],
                message: {
                    subject: 'MSeller Verificación de su correo electrónico',
                    html: `<p>Por favor verifique su correo electrónico haciendo click en el siguiente enlace:</p>
                       <a href="${verificationLink}">${verificationLink}</a>`,
                },
            });

            await emailCollection.add({
                to: ['asdominicana@gmail.com', 'ltorres@itsoluclick.com', 'b.torres@itsoluclick.com'],
                message: {
                    subject: 'Nuevo usuario registrado en MSELLER Cloud',
                    html: `<p>Este es un mensaje automático desde cloud.mseller.app nuevo usuario registrado:</p>
                         <p>Nombre de la empresa: ${data.business_name}</p>
                         <p>Teléfono: ${data.phone}</p>
                         <p>País: ${data.country}</p>

                         <h3>Datos del Usuario</h3>
                         <p>Nombre: ${userFullName}</p>
                         <p>Email: ${data.user_email}</p>`,
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
            await deleteUserV2Common({ data: userId });
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
