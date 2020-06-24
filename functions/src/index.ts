import * as admin from 'firebase-admin';
import * as firebaseAccountCredentials from './serviceAccountKey.json';
export * from './users';
export * from './chat';
export * from './messaging';

const serviceAccount = firebaseAccountCredentials as admin.ServiceAccount;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://mobile-seller-v3.firebaseio.com',
});

export const REGION = 'us-east1';

export const CONVERSATION_COLLECTION = 'conversations';
export const BUSINESS_COLLECTION = 'business';
export const MESSAGES_COLLECTION = 'messages';
export const USER_COLLECTION = 'users';
export const FCM_COLLECTION = 'tokens';
