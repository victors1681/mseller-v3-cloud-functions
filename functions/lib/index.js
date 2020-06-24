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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FCM_COLLECTION = exports.USER_COLLECTION = exports.MESSAGES_COLLECTION = exports.BUSINESS_COLLECTION = exports.CONVERSATION_COLLECTION = exports.REGION = void 0;
const admin = __importStar(require("firebase-admin"));
const firebaseAccountCredentials = __importStar(require("./serviceAccountKey.json"));
__exportStar(require("./users"), exports);
__exportStar(require("./chat"), exports);
__exportStar(require("./messaging"), exports);
const serviceAccount = firebaseAccountCredentials;
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://mobile-seller-v3.firebaseio.com',
});
exports.REGION = 'us-east1';
exports.CONVERSATION_COLLECTION = 'conversations';
exports.BUSINESS_COLLECTION = 'business';
exports.MESSAGES_COLLECTION = 'messages';
exports.USER_COLLECTION = 'users';
exports.FCM_COLLECTION = 'tokens';
//# sourceMappingURL=index.js.map