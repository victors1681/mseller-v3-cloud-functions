import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { logger } from 'firebase-functions/v2';
import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';
import { BUSINESS_COLLECTION, USER_COLLECTION } from '../index';

export enum UserTypeEnum {
    seller = 'seller',
    administrator = 'administrator',
    superuser = 'superuser',
    driver = 'driver',
    office = 'office',
}

/**
 * based on the context it will ge the info information coming from the request
 * @param context
 */
export const getCurrentUserInfo = async (context: functions.https.CallableContext): Promise<IUser> => {
    const userId = context.auth?.uid;

    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'unable to find the user id');
    }

    const userData = await getUserById(userId);

    return userData;
};

/**
 * find the user by internal code
 * @param userId
 * @returns
 */
export const findUserByInternalCodeAndBusinessId = async (
    internalUserCode: string,
    businessId: string,
): Promise<IUser | null> => {
    try {
        // Query the users collection
        const querySnapshot = await admin
            .firestore()
            .collection(USER_COLLECTION)
            .where('sellerCode', '==', internalUserCode)
            .where('businessId', '==', businessId)
            .get();

        // Check if a matching user was found
        if (querySnapshot.size > 0) {
            // Return the user data (assuming there's only one matching user)
            const user = querySnapshot.docs[0].data();
            return user as IUser;
        } else {
            // No matching user found
            return null;
        }
    } catch (error) {
        console.error('Error finding user:', error);
        throw error;
    }
};
/**
 * get user information from the ID
 * @param userId
 */

export const getUserById = async (userId: string, withBusinessData: boolean = false): Promise<IUser> => {
    try {
        const snapshot = await admin.firestore().collection(USER_COLLECTION).doc(userId).get();

        if (snapshot.exists) {
            const userData = snapshot.data();
            if (withBusinessData && userData) {
                const businessSnapshot = await admin
                    .firestore()
                    .collection(BUSINESS_COLLECTION)
                    .doc(userData.businessId)
                    .get();
                if (businessSnapshot.exists) {
                    userData.business = businessSnapshot.data();
                }
            }
            return { ...userData, userId } as any;
        } else {
            throw new functions.https.HttpsError(
                'not-found',
                `user ${userId} not found on ${USER_COLLECTION} File: users.ts functions server. Might be because is looking on Emulator DB`,
            );
        }
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
};
export const validTiers = ['free', 'pro', 'enterprise'];

export const addUserV2Common = async ({ data, ...context }: any) => {
    try {
        const { email, password, firstName, lastName, photoURL } = data;
        const displayName = `${firstName} ${lastName}`;
        if (!email || !password) {
            throw Error('email and password are mandatory');
        }
        const tier = data.userTier ? data.userTier : 'free';

        // bypass validation if the user is created from the portal
        if (!data.creationFromPortal) {
            const requestedUser = await getCurrentUserInfo(context);
            if (!requestedUser) {
                throw Error('email and password are mandatory');
            }
            if (data.type === UserTypeEnum.superuser && requestedUser.type !== UserTypeEnum.superuser) {
                throw Error('you do not have the role to create a power user');
            }
        } else {
            data.type = UserTypeEnum.administrator;
            delete data.creationFromPortal;
        }

        const userRecord = await admin.auth().createUser({
            email,
            emailVerified: data.emailVerified !== undefined ? data.emailVerified : true, // default verified
            password,
            displayName,
            disabled: false,
            photoURL,
        });

        if (userRecord) {
            delete data.password;
            delete data.emailVerified;

            await admin.auth().setCustomUserClaims(userRecord.uid, {
                business: data.business,
                type: data.type,
                userLevel: data.userLevel,
                sellerCode: data.sellerCode,
                warehouse: data.warehouse,
                tier,
            });
            await admin
                .firestore()
                .collection(USER_COLLECTION)
                .doc(userRecord.uid)
                .set({ ...data, userId: userRecord.uid, business: data.business, businessId: data.business });

            logger.log('Successfully created new user:', userRecord.uid);
        }
        return { result: 'user created', userId: userRecord.uid };
    } catch (error) {
        throw new HttpsError('invalid-argument', error.message);
    }
};

export const addUserV2 = onCall(addUserV2Common);

export const updateUserV2 = onCall(async ({ data, auth }) => {
    try {
        const { userId, email, photoURL, firstName, lastName, disabled } = data;
        const displayName = `${firstName} ${lastName}`;

        if (!userId) {
            throw new HttpsError('invalid-argument', 'userId is mandatory userId: ' + userId);
        }

        await admin.auth().updateUser(userId, {
            email,
            emailVerified: true,
            displayName,
            photoURL: photoURL ? photoURL : null,
            disabled: !!disabled,
        });

        delete data.password;

        const tier = data.userTier ? data.userTier : 'free';

        await admin.auth().setCustomUserClaims(userId, {
            business: data.business,
            type: data.type,
            userLevel: data.userLevel,
            sellerCode: data.sellerCode,
            warehouse: data.warehouse,
            tier,
        });

        await admin
            .firestore()
            .collection(USER_COLLECTION)
            .doc(userId)
            .set({ ...data });

        return { result: 'user updated', userId };
    } catch (error) {
        throw new HttpsError('invalid-argument', error.message);
    }
});

/**
 * Transfer seller code between sellers
 */
export const transferUserV2 = onCall(async ({ data, auth }) => {
    try {
        const { sellerSource, sellerTarget } = data;

        if (!sellerSource || !sellerTarget) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'seller Source and target needed to transfer code ' + sellerSource + ' ' + sellerTarget,
            );
        }

        const sellerSourceData = await getUserById(sellerSource);
        const sellerTargetData = await getUserById(sellerTarget);

        await admin.firestore().collection(USER_COLLECTION).doc(sellerSource).update({
            sellerCode: sellerTargetData.sellerCode,
        });

        await admin.firestore().collection(USER_COLLECTION).doc(sellerTarget).update({
            sellerCode: sellerSourceData.sellerCode,
        });

        return { result: 'Seller Transferer' };
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});

/**
 * User need to bypass the security to be able to remove, update password
 * @param request
 * @param userId
 * @returns
 */
const isValidPoweredUser = async <T>(request: CallableRequest<T>, userId: string) => {
    if (!request?.auth?.uid) {
        throw new functions.https.HttpsError('invalid-argument', `Request is not valid`);
    }

    const userRecord = await admin.auth().getUser(request.auth.uid);
    const userRecordToUpdate = await admin.auth().getUser(userId);

    const { business, type } = userRecord?.customClaims || {};

    // Only super users can change password to any business account
    if (business !== userRecordToUpdate?.customClaims?.business && type !== UserTypeEnum.superuser) {
        throw new functions.https.HttpsError(
            'permission-denied',
            `Only super user can change password between business accounts. ${type}`,
        );
    }

    if (type === undefined) {
        throw new functions.https.HttpsError('permission-denied', `User Type is not defined ${type}`);
    }

    // Only Admin or super password can change password for another account
    if (userId !== request?.auth?.uid && type !== UserTypeEnum.administrator && type !== UserTypeEnum.superuser) {
        throw new functions.https.HttpsError(
            'permission-denied',
            `Only admin and super users can change password for another account. Type ${type}`,
        );
    }

    return true;
};

interface IUpdatePasswordV2Props {
    userId: string;
    password: string;
}
export const updatePasswordV2 = onCall(async (request: CallableRequest<IUpdatePasswordV2Props>) => {
    try {
        const data = request.data;
        const { userId, password } = data;

        if (!request.auth) {
            throw new functions.https.HttpsError('unauthenticated', `unauthenticated}`);
        }

        if (!userId && !password) {
            throw new functions.https.HttpsError('failed-precondition', `userId and password are mandatory`);
        }

        await isValidPoweredUser(request, userId);

        await admin.auth().updateUser(userId, {
            password,
        });

        console.log('Successfully password updated:', userId);
        return { result: 'password updated' };
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});

export const deleteUserV2Common = async (request: CallableRequest<string>) => {
    try {
        if (!request.auth) {
            throw new functions.https.HttpsError('unauthenticated', `unauthenticated}`);
        }

        const userId = request.data;
        if (!userId) {
            throw Error('userId is mandatory');
        }

        await isValidPoweredUser(request, userId);

        await admin.auth().deleteUser(userId);
        // remove table..
        await admin.firestore().collection(USER_COLLECTION).doc(userId).delete();

        console.log('Successfully user removed:', userId);
        return { result: 'user removed' };
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
};

export const deleteUserV2 = onCall(deleteUserV2Common);

// export const userById = functions.region(REGION).https.onCall(async (userId, context) => {
export const userById = onCall(async (context) => {
    try {
        const userId = context.data.userId;
        logger.warn('DEPRECATED userById function, use userByIdV2, migrated due to there still have traffic');

        if (!userId) {
            throw Error('userId is mandatory');
        }

        const { disabled, email, photoURL } = await admin.auth().getUser(userId);
        const snapshot = await admin.firestore().collection(USER_COLLECTION).doc(userId).get();
        const userData = snapshot.data();

        if (userData && userData.empty) {
            throw new functions.https.HttpsError('not-found', 'user not found');
        }
        return { ...userData, disabled, email, photoURL, userId };
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});

export const userByIdV2 = onCall(async ({ data, auth }) => {
    try {
        const userId = data;
        if (!userId) {
            throw new HttpsError('invalid-argument', 'User is is not defined in the request');
        }

        const { disabled, email, photoURL } = await admin.auth().getUser(userId);
        const snapshot = await admin.firestore().collection(USER_COLLECTION).doc(userId).get();
        const userData = snapshot.data();

        if (userData && userData.empty) {
            throw new HttpsError('not-found', 'user not found');
        }
        return { ...userData, disabled, email, photoURL, userId };
    } catch (error) {
        throw new HttpsError('invalid-argument', error.message);
    }
});

/**
 * based on the user request it get the user who is requesting and get the business id associated
 */
// export const getUsersRelated = functions.region(REGION).https.onCall(async (data, context) => {
export const getUsersRelated = onCall(async (context) => {
    try {
        const requestedUser = await getCurrentUserInfo(context);

        if (!requestedUser.business) {
            throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated');
        }

        const userRecords = await admin
            .firestore()
            .collection(USER_COLLECTION)
            .where('business', '==', requestedUser.business)
            .get();
        const usersWithId = userRecords.docs
            .filter((f) => f.id !== requestedUser.userId)
            .map((doc) => ({ userId: doc.id, ...doc.data() }));

        return usersWithId;
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});

/**
 * Get user information by Access token, public resource
 */
// export const getUserByAccessToken = functions.region(REGION).https.onCall(async (data, context) => {
export const getUserByAccessToken = onCall(async (context) => {
    try {
        const data = context.data;
        const user = await admin.auth().verifyIdToken(data.accessToken, true);
        const userInfo = await getUserById(user.uid, true);
        return userInfo;
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});

/**
 * get current user profile including business data
 */

export const getUserProfileV2 = onCall({ cors: '*' }, async ({ data, auth }) => {
    try {
        const userId = auth?.uid;

        if (!userId) {
            throw new HttpsError('failed-precondition', 'unable to find the user id, or not authenticated');
        }

        const userInfo = await getUserById(userId, true);
        // logger.info("userInfo", userInfo);

        return userInfo;
    } catch (error) {
        throw new HttpsError('invalid-argument', error.message);
    }
});

interface ITriggerForgotPasswordProps {
    email: string;
}
export const triggerForgotPassword = onCall(async (request: CallableRequest<ITriggerForgotPasswordProps>) => {
    const { email } = request.data;

    // Validate input
    if (!email || typeof email !== 'string') {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Email address is required and must be a valid string.',
        );
    }

    try {
        // Check if user exists
        const user = await admin.auth().getUserByEmail(email);

        // Generate password reset link if user exists
        if (user) {
            const resetLink = await admin.auth().generatePasswordResetLink(email);
            console.log(`Password reset link generated for ${email}: ${resetLink}`);

            const emailCollection = admin.firestore().collection('mail');
            await emailCollection.add({
                to: [email],
                message: {
                    subject: 'Restaurar contraseña - MSeller Cloud',
                    html: `
                        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                            <h2 style="color: #0056b3;">Restaurar contraseña</h2>
                            <p>Hola,</p>
                            <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>MSeller Cloud</strong>. Si no realizaste esta solicitud, puedes ignorar este correo.</p>
                            <p>Para restablecer tu contraseña, haz clic en el siguiente enlace:</p>
                            <p style="text-align: center; margin: 20px 0;">
                                <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #0056b3; color: #fff; text-decoration: none; border-radius: 5px;">Restablecer contraseña</a>
                            </p>
                            <p>Si tienes problemas con el botón anterior, copia y pega el siguiente enlace en tu navegador:</p>
                            <p style="word-wrap: break-word;">${resetLink}</p>
                            <p>Gracias por usar <strong>MSeller Cloud</strong>.</p>
                            <p style="color: #888; font-size: 12px;">Este es un mensaje automático. Por favor, no respondas a este correo.</p>
                        </div>
                    `,
                },
            });

            return { success: true, message: 'Password reset link sent.' };
        } else {
            throw new functions.https.HttpsError('not-found', 'Email address not found. Please check and try again.');
        }
    } catch (error) {
        console.error('Error generating password reset link:', error.message);

        // Handle specific errors
        if (error.code === 'auth/user-not-found') {
            throw new functions.https.HttpsError('not-found', 'Email address not found. Please check and try again.');
        } else {
            throw new functions.https.HttpsError('internal', 'Failed to send password reset email. Please try again.');
        }
    }
});
