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
  limitToLast as dbLimitToLast,
  onValue as dbOnValue,
  onChildAdded as dbOnChildAdded,
  off as dbOff
} from 'firebase/database';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

// Firebase configuration - use SvelteKit's env system
// In SvelteKit, PUBLIC_ prefixed vars are accessed via $env/static/public
import {
  PUBLIC_FIREBASE_API_KEY,
  PUBLIC_FIREBASE_AUTH_DOMAIN,
  PUBLIC_FIREBASE_DATABASE_URL,
  PUBLIC_FIREBASE_PROJECT_ID,
  PUBLIC_FIREBASE_STORAGE_BUCKET,
  PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  PUBLIC_FIREBASE_APP_ID
} from '$env/static/public';

const firebaseConfig = {
  apiKey: PUBLIC_FIREBASE_API_KEY,
  authDomain: PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: PUBLIC_FIREBASE_DATABASE_URL,
  projectId: PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: PUBLIC_FIREBASE_APP_ID
};

// Validate required configuration in browser
const REQUIRED_CONFIG_KEYS = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
const missingKeys = REQUIRED_CONFIG_KEYS.filter(key => !firebaseConfig[key]);

let app;
let db;
let auth;
let googleProvider;
let firebaseInitialized = false;

if (browser) {
  // Validate configuration before initialization
  if (missingKeys.length > 0) {
    // In development, warn but allow app to continue (for UI-only work)
    if (import.meta.env.DEV) {
      console.warn('[Firebase] Missing environment variables:', missingKeys.join(', '));
      console.warn('[Firebase] Some features will be unavailable. Set PUBLIC_FIREBASE_* in .env');
    } else {
      // In production, this is a critical error
      console.error('[Firebase] Missing required environment variables:', missingKeys.join(', '));
      console.error('[Firebase] Please ensure all PUBLIC_FIREBASE_* variables are set');
    }
  } else {
    try {
      app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      db = getDatabase(app);
      auth = getAuth(app);
      googleProvider = new GoogleAuthProvider();
      firebaseInitialized = true;
      
      if (import.meta.env.DEV) {
        console.log('[Firebase] Initialized successfully');
      }
    } catch (error) {
      console.error('[Firebase] Initialization error:', error.message);
    }
  }
}

export { db, auth, googleProvider, firebaseInitialized };

/**
 * Check if Firebase is ready to use
 * @returns {boolean}
 */
export function isFirebaseReady() {
  return browser && firebaseInitialized && !!db && !!auth;
}

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
export const onValue = browser ? dbOnValue : () => { throw new Error('Database not available on server'); };
export const onChildAdded = browser ? dbOnChildAdded : () => { throw new Error('Database not available on server'); };
export const off = browser ? dbOff : () => { throw new Error('Database not available on server'); };

export const USER_PROFILE_PATH = 'users';

/**
 * @param {string} uid 
 */
export async function getUserProfile(uid) {
  if (!browser || !db) {
    console.warn('Database not available for getUserProfile');
    return null;
  }
  
  try {
    const profileRef = dbRef(db, `${USER_PROFILE_PATH}/${uid}`);
    const snapshot = await dbGet(profileRef);
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error('Error fetching user profile:', error.message);
    return null;
  }
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