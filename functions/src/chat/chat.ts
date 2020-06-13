import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { getCurrentUserInfo, USER_COLLECTION , getUserById} from "../users";
 
export const CONVERSATION_COLLECTION = 'conversations';
export const BUSINESS_COLLECTION = 'business'
 
interface IMessage {
    createdAt: string;
    senderId: string;
    text: string;
}

interface IConversation {
    conversationId?: string;
    messages?: IMessage[]
    displayMessage: string;
    lastMessageTime: string;
    members: any[] //userId: Boolean

}

interface IConversationResponse {
    userId: string;
    conversationId: string;
    photoURL?: string;
    firstName: string;
    lastName: string;
    displayMessage?: string;
    lastMessageTime?: string;
    unseenCount: number;
}

/**
 * based on the user request it get the user who is requesting and get the business id associated
 */
export const getConversations = functions.https.onCall(async (data, context): Promise<IConversationResponse[]> => {
    try {
        const requestedUser = await getCurrentUserInfo(context);

        if (!requestedUser.business) {
            throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated');
        }

        const conversationRecords = await admin
            .firestore()
            .collection(USER_COLLECTION)
            .doc(requestedUser.userId)
            .collection(CONVERSATION_COLLECTION)
            .get();

            if(!conversationRecords.docs.length){
                
                throw new functions.https.HttpsError('invalid-argument', 'There is not available conversations');
             
            }
 
            const conversationList = [] as IConversationResponse[]

             for await (let doc of conversationRecords.docs){
                const result = await getConversationInfo(doc)
                if(result){
                  conversationList.push(result);
                }
            }

            console.log(`conversationList: (${conversationList})`)
          return conversationList ;
        
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});


const getConversationInfo = async (doc: any): Promise<IConversationResponse | undefined> =>{
   try{
    const userId = doc.id;
    const conversationId = doc.data().conversationId;
    const unseenCount = doc.data().unseenCount;
    const userInfo = await getUserById(userId);
    const conversationInfo = await getConversationById(conversationId, userInfo.business)

   return ({userId, conversationId, unseenCount, photoURL: userInfo.photoURL, firstName: userInfo.firstName, lastName: userInfo.lastName, lastMessageTime: conversationInfo?.lastMessageTime, displayMessage: conversationInfo?.displayMessage }) as IConversationResponse;

   }catch(error){ 
    throw new functions.https.HttpsError('invalid-argument', error.message);
   }
}

/**
 * get user information from the ID
 * @param userId 
 */

export const getConversationById = async (conversationId: string, businessId: string): Promise<IConversation | undefined> => {

    try{
    const snapshot = await admin.firestore().collection(BUSINESS_COLLECTION).doc(businessId).collection(CONVERSATION_COLLECTION).doc(conversationId).get();
    const conversationRecord = snapshot.data();
    
    if(conversationRecord){
       
        return { conversationId, ...conversationRecord } as IConversation
    }

    return

}catch(error){
    throw new functions.https.HttpsError('invalid-argument', error.message);
}
}
