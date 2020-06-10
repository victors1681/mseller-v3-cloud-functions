import * as functions from 'firebase-functions';
import * as admin from "firebase-admin";


const USER_COLLECTION = 'users';

  export const addUser = functions.https.onCall(async (data, context) => {

    try{
       
      const { email, password, photoURL, firstName, lastName} = data;
      const displayName = `${firstName} ${lastName}`;

      if(!email && !password){
        throw Error('email and password are mandatory');
      }

    const userRecord = await admin.auth().createUser({
      email,
      emailVerified: true,
      password,
      displayName,
      photoURL: photoURL? photoURL : null,
      disabled: false
    });

    if(userRecord){
      delete data.password; 
     
        await admin.firestore()
        .collection(USER_COLLECTION)
        .doc(userRecord.uid)
        .set({ ...data, business: data.businessId });

        console.log('Successfully created new user:', userRecord.uid); 
    }
    return ({ result: 'user created', userId: userRecord.uid});
  }catch(error){ 
    throw new functions.https.HttpsError(  "invalid-argument", error.message)
    }
  });


  export const updateUser = functions.https.onCall(async (data, context) => {
  
    try{
  
      const {userId, email, photoURL, firstName, lastName, disabled} = data;
      const displayName = `${firstName} ${lastName}`;

      if(!userId){
        throw new functions.https.HttpsError('invalid-argument', 'userId is mandatory userId: ' + userId);
      }
 

    await admin.auth().updateUser(userId, {
      email,
      emailVerified: true,
      displayName,
      photoURL: photoURL? photoURL : null,
      disabled: !!disabled
    });

      delete data.password; 
     
        await admin.firestore()
        .collection(USER_COLLECTION)
        .doc(userId)
        .set({ ...data });
         
     return { result: 'user updated', userId: userId};
 
  }catch(error){
   throw new functions.https.HttpsError(  "invalid-argument", error.message)
  }
});

  export const updateUserPassword = functions.https.onCall(async (data, context) => {

    try{ 
      const {userId, password} = data; 

      if(!userId && !password){
        throw Error('userId is mandatory');
      }

    await admin.auth().updateUser(userId, {
      password
    }); 
    
    console.log('Successfully password updated:', userId); 
        return { result: 'password updated'};
        
  }catch(error){
    throw new functions.https.HttpsError(  "invalid-argument", error.message)
    }
  });

  export const removeUser = functions.https.onCall(async (data, context) => {

    try{ 
      const {userId, password} = data; 

      if(!userId && !password){
        throw Error('userId is mandatory');
      }

      await admin.auth().deleteUser(userId);
      console.log('Successfully user removed:', userId); 
         return ({ result: 'user removed'});
     
  }catch(error){
    throw new functions.https.HttpsError(  "invalid-argument", error.message)
    }
  });

  export const userById = functions.https.onCall(async (data, context) => {

    try{ 
      const {userId} = data; 

      if(!userId){
        throw Error('userId is mandatory');
      }

      const userRecord = await admin.auth().getUser(userId);

      const moreUserInfo = await admin.firestore().collection(USER_COLLECTION).doc(userId);
      
      return {...moreUserInfo, ...userRecord.toJSON()}
 
     
  }catch(error){
    throw new functions.https.HttpsError(  "invalid-argument", error.message)
    }
  });