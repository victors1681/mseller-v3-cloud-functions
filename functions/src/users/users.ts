import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { USER_COLLECTION } from '../index';

const REGION = 'us-east1';

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

export const getUserById = async (userId: string): Promise<IUser> => {
    try {
        const snapshot = await admin.firestore().collection(USER_COLLECTION).doc(userId).get();

        if (snapshot.exists) {
            const userData = snapshot.data();
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

export const addUser = functions.region(REGION).https.onCall(async (data: IUser, context) => {
    try {
        const { email, password, firstName, lastName, photoURL } = data;
        const displayName = `${firstName} ${lastName}`;

        if (!email && !password) {
            throw Error('email and password are mandatory');
        }

        const requestedUser = await getCurrentUserInfo(context);
        if (!requestedUser) {
            throw Error('email and password are mandatory');
        }
        if (data.type === UserTypeEnum.superuser && requestedUser.type !== UserTypeEnum.superuser) {
            throw Error('you do not have the role to create a power user');
        }

        const userRecord = await admin.auth().createUser({
            email,
            emailVerified: true,
            password,
            displayName,
            disabled: false,
            photoURL,
        });

        if (userRecord) {
            delete data.password;
            await admin.auth().setCustomUserClaims(userRecord.uid, {
                business: data.business,
                type: data.type,
                userLevel: data.userLevel, 
                sellerCode: data.sellerCode,
                warehouse: data.warehouse
            });
            await admin
                .firestore()
                .collection(USER_COLLECTION)
                .doc(userRecord.uid)
                .set({ ...data, userId: userRecord.uid, business: data.business });

            console.log('Successfully created new user:', userRecord.uid);
        }
        return { result: 'user created', userId: userRecord.uid };
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});

export const updateUser = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        const { userId, email, photoURL, firstName, lastName, disabled } = data;
        const displayName = `${firstName} ${lastName}`;

        if (!userId) {
            throw new functions.https.HttpsError('invalid-argument', 'userId is mandatory userId: ' + userId);
        }

        await admin.auth().updateUser(userId, {
            email,
            emailVerified: true,
            displayName,
            photoURL: photoURL ? photoURL : null,
            disabled: !!disabled,
        });

        delete data.password;

        await admin.auth().setCustomUserClaims(userId, {
            business: data.business,
            type: data.type,
            userLevel: data.userLevel,
            sellerCode: data.sellerCode,
            warehouse: data.warehouse
        });

        await admin
            .firestore()
            .collection(USER_COLLECTION)
            .doc(userId)
            .set({ ...data });

        return { result: 'user updated', userId };
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});

/**
 * Transfer seller code between sellers
 */
export const transferUser = functions.region(REGION).https.onCall(async (data, context) => {
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

export const updatePassword = functions.region(REGION).https.onCall(async ({ userId, password }, context) => {
    try {
        if (!userId && !password) {
            throw Error('userId and password are mandatory');
        }

        await admin.auth().updateUser(userId, {
            password,
        });

        console.log('Successfully password updated:', userId);
        return { result: 'password updated' };
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});

export const deleteUser = functions.region(REGION).https.onCall(async (userId, context) => {
    try {
        if (!userId) {
            throw Error('userId is mandatory');
        }

        await admin.auth().deleteUser(userId);
        // remove table..
        await admin.firestore().collection(USER_COLLECTION).doc(userId).delete();

        console.log('Successfully user removed:', userId);
        return { result: 'user removed' };
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});

export const userById = functions.region(REGION).https.onCall(async (userId, context) => {
    try {
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

/**
 * based on the user request it get the user who is requesting and get the business id associated
 */
export const getUsersRelated = functions.region(REGION).https.onCall(async (data, context) => {
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
