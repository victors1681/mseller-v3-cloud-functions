import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const USER_COLLECTION = 'users';

export enum UserTypeEnum {
    seller = 'seller',
    administrator = 'administrator',
    superuser = 'superuser',
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

    const snapshot = await admin.firestore().collection(USER_COLLECTION).doc(userId).get();
    const userData = snapshot.data();

    if (userData && userData.empty) {
        throw new functions.https.HttpsError('not-found', 'user not found');
    }
    return { ...userData, userId } as any;
};

export const addUser = functions.https.onCall(async (data: IUser, context) => {
    try {
        const { email, password, photoURL, firstName, lastName } = data;
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
            photoURL: photoURL ? photoURL : null,
            disabled: false,
        });

        if (userRecord) {
            delete data.password;

            await admin
                .firestore()
                .collection(USER_COLLECTION)
                .doc(userRecord.uid)
                .set({ ...data, business: data.businessId });

            console.log('Successfully created new user:', userRecord.uid);
        }
        return { result: 'user created', userId: userRecord.uid };
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});

export const updateUser = functions.https.onCall(async (data, context) => {
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

export const updatePassword = functions.https.onCall(async ({ userId, password }, context) => {
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

export const deleteUser = functions.https.onCall(async (userId, context) => {
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

export const userById = functions.https.onCall(async (userId, context) => {
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
