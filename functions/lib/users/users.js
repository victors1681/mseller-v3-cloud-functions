"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsersRelated = exports.userById = exports.deleteUser = exports.updatePassword = exports.updateUser = exports.addUser = exports.getUserById = exports.getCurrentUserInfo = exports.UserTypeEnum = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const index_1 = require("../index");
const REGION = "us-east1";
var UserTypeEnum;
(function (UserTypeEnum) {
    UserTypeEnum["seller"] = "seller";
    UserTypeEnum["administrator"] = "administrator";
    UserTypeEnum["superuser"] = "superuser";
})(UserTypeEnum = exports.UserTypeEnum || (exports.UserTypeEnum = {}));
/**
 * based on the context it will ge the info information coming from the request
 * @param context
 */
exports.getCurrentUserInfo = async (context) => {
    var _a;
    const userId = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'unable to find the user id');
    }
    const userData = await exports.getUserById(userId);
    return userData;
};
/**
 * get user information from the ID
 * @param userId
 */
exports.getUserById = async (userId) => {
    try {
        const snapshot = await admin.firestore().collection(index_1.USER_COLLECTION).doc(userId).get();
        const userData = snapshot.data();
        if (!userData) {
            throw new functions.https.HttpsError('not-found', `user ${userId} not found ${userData}`);
        }
        return Object.assign(Object.assign({}, userData), { userId });
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
};
exports.addUser = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        const { email, password, firstName, lastName } = data;
        const displayName = `${firstName} ${lastName}`;
        if (!email && !password) {
            throw Error('email and password are mandatory');
        }
        const requestedUser = await exports.getCurrentUserInfo(context);
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
        });
        if (userRecord) {
            delete data.password;
            await admin
                .firestore()
                .collection(index_1.USER_COLLECTION)
                .doc(userRecord.uid)
                .set(Object.assign(Object.assign({}, data), { business: data.business }));
            console.log('Successfully created new user:', userRecord.uid);
        }
        return { result: 'user created', userId: userRecord.uid };
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
exports.updateUser = functions.region(REGION).https.onCall(async (data, context) => {
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
            .collection(index_1.USER_COLLECTION)
            .doc(userId)
            .set(Object.assign({}, data));
        return { result: 'user updated', userId };
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
exports.updatePassword = functions.region(REGION).https.onCall(async ({ userId, password }, context) => {
    try {
        if (!userId && !password) {
            throw Error('userId and password are mandatory');
        }
        await admin.auth().updateUser(userId, {
            password,
        });
        console.log('Successfully password updated:', userId);
        return { result: 'password updated' };
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
exports.deleteUser = functions.region(REGION).https.onCall(async (userId, context) => {
    try {
        if (!userId) {
            throw Error('userId is mandatory');
        }
        await admin.auth().deleteUser(userId);
        // remove table..
        await admin.firestore().collection(index_1.USER_COLLECTION).doc(userId).delete();
        console.log('Successfully user removed:', userId);
        return { result: 'user removed' };
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
exports.userById = functions.region(REGION).https.onCall(async (userId, context) => {
    try {
        if (!userId) {
            throw Error('userId is mandatory');
        }
        const { disabled, email, photoURL } = await admin.auth().getUser(userId);
        const snapshot = await admin.firestore().collection(index_1.USER_COLLECTION).doc(userId).get();
        const userData = snapshot.data();
        if (userData && userData.empty) {
            throw new functions.https.HttpsError('not-found', 'user not found');
        }
        return Object.assign(Object.assign({}, userData), { disabled, email, photoURL, userId });
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
/**
 * based on the user request it get the user who is requesting and get the business id associated
 */
exports.getUsersRelated = functions.region(REGION).https.onCall(async (data, context) => {
    try {
        const requestedUser = await exports.getCurrentUserInfo(context);
        if (!requestedUser.business) {
            throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated');
        }
        const userRecords = await admin
            .firestore()
            .collection(index_1.USER_COLLECTION)
            .where('business', '==', requestedUser.business)
            .get();
        const usersWithId = userRecords.docs.map((doc) => (Object.assign({ userId: doc.id }, doc.data())));
        console.log('users: ', usersWithId);
        return usersWithId;
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});
//# sourceMappingURL=users.js.map