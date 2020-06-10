import * as admin from 'firebase-admin';
import * as firebaseAccountCredentials from './serviceAccountKey.json';
export * from './users';

const serviceAccount = firebaseAccountCredentials as admin.ServiceAccount;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://mobile-seller-v3.firebaseio.com',
});
