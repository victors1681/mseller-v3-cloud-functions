import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {  BUSINESS_COLLECTION, CONVERSATION_COLLECTION, MESSAGES_COLLECTION, USER_COLLECTION} from "../index";
import { getCurrentUserInfo, getUserById } from "../users";

const REGION = "us-east1"

interface IMessage {
    createdAt: string;
    senderId: string;
    text: string;
}

interface IConversation {
    conversationId?: string;
    messages?: IMessage[]
    displayMessage: string;
    lastMessageTime:  FirebaseFirestore.FieldValue;
    members: any[] // userId: Boolean

}

interface IConversationResponse {
    
    conversationId: string;
    
    displayMessage?: string;
    lastMessageTime?:  FirebaseFirestore.FieldValue;
    unseenCount: number;
}

/**
 * based on the user request it get the user who is requesting and get the business id associated
 */
export const getConversations = functions.region(REGION).https.onCall(async (data, context): Promise<IConversationResponse[]> => {
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

             for await (const doc of conversationRecords.docs){
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


/**
 * @param targetUser string This is the user who with going to stablish the conversation
 * Create new Conversation between two party
 */


export const newConversation = functions.region(REGION).https.onCall(async (targetUser, context): Promise<IConversationResponse> => {
    try {
        const requestedUser = await getCurrentUserInfo(context);
        const targetUserInfo = await getUserById(targetUser)

        if (!requestedUser.business) {
            throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated');
        }

        // Create new conversation
        const conversationRef = await admin
            .firestore()
            .collection(BUSINESS_COLLECTION)
            .doc(requestedUser.business)
            .collection(CONVERSATION_COLLECTION)
            .add({
                displayMessage:"",
                lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
                members: [{[requestedUser.userId]: true}, {[targetUser]: true}],
            })


        // create new node in user requested node
        
        await admin
        .firestore()
        .collection(USER_COLLECTION)
        .doc(requestedUser.userId)
        .collection(CONVERSATION_COLLECTION)
        .doc(targetUser)
        .set({
            conversationId: conversationRef.id,
            unseenCount: 0
        });

        // create new node in targetUser

        await admin
        .firestore()
        .collection(USER_COLLECTION)
        .doc(targetUser)
        .collection(CONVERSATION_COLLECTION)
        .doc(requestedUser.userId)
        .set({
            conversationId: conversationRef.id,
            unseenCount: 0
        });
 
        return { 
            user: targetUserInfo, 
            conversationId: conversationRef.id, 
            unseenCount: 0, 
            lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
            displayMessage: ""
        } as IConversationResponse;
        
    } catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});

interface IMessagesResponse {
    messageId: string
    senderId: string
    senderName: string
    sentDate: string 
    content: string
    url: string
}

export const getMessages = functions.region(REGION).https.onCall(async (conversationId, context): Promise<IMessagesResponse[]> => {
    try {
        const requestedUser = await getCurrentUserInfo(context);

        if (!requestedUser.business) {
            throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated');
        }

        // Create new conversation
        const messages = await admin
            .firestore()
            .collection(BUSINESS_COLLECTION)
            .doc(requestedUser.business)
            .collection(CONVERSATION_COLLECTION)
            .doc(conversationId)
            .collection(MESSAGES_COLLECTION)
            .get()
               
            if(messages){
                const messagesRecords = messages.docs.map(d => ({messageId: d.id, ...d.data()}))
                return messagesRecords as IMessagesResponse[]
            }
            
        return [] as IMessagesResponse[]
        
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


   return { user: userInfo, conversationId, unseenCount, lastMessageTime: conversationInfo?.lastMessageTime, displayMessage: conversationInfo?.displayMessage } as IConversationResponse;

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
 

/**
 * add new Text
 */

interface ISaveNewMessageProps {
    content: string,
    conversationId: string
 }

export const saveNewMessage = functions.region(REGION).https.onCall(async (data: ISaveNewMessageProps, context): Promise<boolean> => {
    try {
        const requestedUser = await getCurrentUserInfo(context);
        const { content, conversationId } = data;
        
        if (!requestedUser.business && content && conversationId) {
            throw new functions.https.HttpsError('invalid-argument', 'User does not have business associated, content, and conversationId');
        }

        const message =  {
            content,
            senderId: requestedUser.userId,
            senderName: `${requestedUser.firstName} ${requestedUser.lastName}`,
            sentDate: admin.firestore.FieldValue.serverTimestamp(),
        }

        await admin
            .firestore()
            .collection(BUSINESS_COLLECTION)
            .doc(requestedUser.business)
            .collection(CONVERSATION_COLLECTION)
            .doc(conversationId)
            .collection(MESSAGES_COLLECTION)
            .add(message)

            // update conversation info
            await admin
            .firestore()
            .collection(BUSINESS_COLLECTION)
            .doc(requestedUser.business)
            .collection(CONVERSATION_COLLECTION)
            .doc(conversationId)
            .update({
                displayMessage: content,
                lastMessageTime: admin.firestore.FieldValue.serverTimestamp()
            })
    
            // get User Members
            const records = await admin
            .firestore()
            .collection(BUSINESS_COLLECTION)
            .doc(requestedUser.business)
            .collection(CONVERSATION_COLLECTION)
            .doc(conversationId)
            .get()

            if(records.exists){
                const { members }  = records.data() as {[key:string]: boolean};
                const membersIds = Object.keys(members).filter(memberId => memberId !== requestedUser.userId);
                // update target user conversation unseen Counter
                for await ( const memberId of membersIds){ 
                    await admin
                    .firestore()
                    .collection(USER_COLLECTION)
                    .doc(memberId)
                    .collection(CONVERSATION_COLLECTION)
                    .doc(requestedUser.userId) // user requested
                    .update({
                        unseenCount: admin.firestore.FieldValue.increment(1)
                    });
                }
            }
            
          return true;
        
    } catch (error) {
        console.error(error)
        throw new functions.https.HttpsError('invalid-argument', error.message);
    }
});