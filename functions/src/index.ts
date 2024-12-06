export const REGION = 'us-east1';
import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: REGION });

import * as admin from 'firebase-admin';
import * as firebaseAccountCredentials from './serviceAccountKey.json';
export * from './users';
export * from './business';
export * from './chat';
export * from './messaging';
export * from './email';
export * from './documents';
export * from './whatsapp/webhook';
export * from './stripe';
export * from './images';

const serviceAccount = firebaseAccountCredentials as admin.ServiceAccount;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://mobile-seller-v3.firebaseio.com',
    storageBucket: 'mobile-seller-v3.appspot.com',
});

export const CONVERSATION_COLLECTION = 'conversations';
export const NOTIFICATION_COLLECTION = 'notifications';
export const BUSINESS_COLLECTION = 'business';
export const MESSAGES_COLLECTION = 'messages';
export const USER_COLLECTION = 'users';
export const FCM_COLLECTION = 'tokens';
export const IMAGES_COLLECTION = 'images';
export const DOCUMENTS_COLLECTION = 'documents';