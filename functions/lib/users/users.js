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
exports.userById = exports.removeUser = exports.updateUserPassword = exports.updateUser = exports.addUser = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const USER_COLLECTION = 'users';
exports.addUser = functions.https.onCall(async (data, context) => {
    try {
        const { email, password, photoURL, firstName, lastName } = data;
        const displayName = `${firstName} ${lastName}`;
        if (!email && !password) {
            throw Error('email and password are mandatory');
        }
        const userRecord = await admin.auth().createUser({
            email,
            emailVerified: true,
            password,
            displayName,
            photoURL: photoURL ? photoURL : null,
            disabled: false
        });
        if (userRecord) {
            delete data.password;
            await admin.firestore()
                .collection(USER_COLLECTION)
                .doc(userRecord.uid)
                .set(Object.assign(Object.assign({}, data), { business: data.businessId }));
            console.log('Successfully created new user:', userRecord.uid);
        }
        return ({ result: 'user created', userId: userRecord.uid });
    }
    catch (error) {
        throw new functions.https.HttpsError("invalid-argument", error.message);
    }
});
exports.updateUser = functions.https.onCall(async (data, context) => {
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
            disabled: !!disabled
        });
        delete data.password;
        console.log("datadata", data);
        await admin.firestore()
            .collection(USER_COLLECTION)
            .doc(userId)
            .set(Object.assign({}, data));
        return { result: 'user updated', userId: userId };
    }
    catch (error) {
        throw new functions.https.HttpsError("invalid-argument", error.message);
    }
});
exports.updateUserPassword = functions.https.onCall(async (data, context) => {
    try {
        const { userId, password } = data;
        if (!userId && !password) {
            throw Error('userId is mandatory');
        }
        await admin.auth().updateUser(userId, {
            password
        });
        console.log('Successfully password updated:', userId);
        return { result: 'password updated' };
    }
    catch (error) {
        throw new functions.https.HttpsError("invalid-argument", error.message);
    }
});
exports.removeUser = functions.https.onCall(async (data, context) => {
    try {
        const { userId, password } = data;
        if (!userId && !password) {
            throw Error('userId is mandatory');
        }
        await admin.auth().deleteUser(userId);
        console.log('Successfully user removed:', userId);
        return ({ result: 'user removed' });
    }
    catch (error) {
        throw new functions.https.HttpsError("invalid-argument", error.message);
    }
});
exports.userById = functions.https.onCall(async (userId, context) => {
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
        return Object.assign(Object.assign({}, userData), { disabled, email, photoURL, userId });
    }
    catch (error) {
        throw new functions.https.HttpsError("invalid-argument", error.message);
    }
});
//# sourceMappingURL=users.js.map