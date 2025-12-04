// src/lib/firebase.js
import { browser } from '$app/environment';
import { initializeApp, getApps } from 'firebase/app';
import {
  getDatabase,
  ref as dbRef,
  push as dbPush,
  set as dbSet,
  get as dbGet,
  query as dbQuery,
  orderByChild as dbOrderByChild,
  equalTo as dbEqualTo,
  update as dbUpdate,
  limitToLast as dbLimitToLast
} from 'firebase/database';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY || "AIzaSyDv2QU8otJoD5Y34CacDX5YjMuge_lbcts",
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN || "ednelback.firebaseapp.com",
  databaseURL: import.meta.env.PUBLIC_FIREBASE_DATABASE_URL || "https://ednelback-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID || "ednelback",
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET || "ednelback.firebasestorage.app",
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "382560726698",
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID || "1:382560726698:web:86de9c648f53f87c9eead3"
};

if (browser && !firebaseConfig.databaseURL) {
  console.error(' FIREBASE DATABASE URL IS MISSING!');
  console.error('Expected: PUBLIC_FIREBASE_DATABASE_URL');
  console.error('Received:', import.meta.env.PUBLIC_FIREBASE_DATABASE_URL);
}

let app;
let db;
let auth;
let googleProvider;

if (browser) {
  try {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  
    db = getDatabase(app);
    
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}

export { db, auth, googleProvider };

export const loginWithGoogle = () => {
  if (!browser || !auth) throw new Error('Auth not initialized');
  return signInWithPopup(auth, googleProvider);
};

export const logout = () => {
  if (!browser || !auth) throw new Error('Auth not initialized');
  return signOut(auth);
};

export const subscribeToAuth = (callback) => {
  if (!browser || !auth) return () => {};
  return onAuthStateChanged(auth, callback);
};

export const ref = browser ? dbRef : () => { throw new Error('Database not available on server'); };
export const push = browser ? dbPush : () => { throw new Error('Database not available on server'); };
export const set = browser ? dbSet : () => { throw new Error('Database not available on server'); };
export const get = browser ? dbGet : () => { throw new Error('Database not available on server'); };
export const query = browser ? dbQuery : () => { throw new Error('Database not available on server'); };
export const orderByChild = browser ? dbOrderByChild : () => { throw new Error('Database not available on server'); };
export const equalTo = browser ? dbEqualTo : () => { throw new Error('Database not available on server'); };
export const update = browser ? dbUpdate : () => { throw new Error('Database not available on server'); };
export const limitToLast = browser ? dbLimitToLast : () => { throw new Error('Database not available on server'); };

export const USER_PROFILE_PATH = 'users';

/**
 * @param {string} uid 
 */
export async function getUserProfile(uid) {
  if (!browser || !db) throw new Error('Database not available');
  const profileRef = dbRef(db, `${USER_PROFILE_PATH}/${uid}`);
  const snapshot = await dbGet(profileRef);
  return snapshot.exists() ? snapshot.val() : null;
}

/**
 * @param {string} uid 
 * @param {object} profileData 
 */
export async function saveUserProfile(uid, profileData) {
  if (!browser || !db) throw new Error('Database not available');
  const profileRef = dbRef(db, `${USER_PROFILE_PATH}/${uid}`);
  await dbSet(profileRef, {
    ...profileData,
    updatedAt: new Date().toISOString()
  });
  return true;
}