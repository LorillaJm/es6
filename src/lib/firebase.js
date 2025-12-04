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

// Firebase configuration using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY || "AIzaSyDv2QU8otJoD5Y34CacDX5YjMuge_lbcts",
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN || "ednelback.firebaseapp.com",
  databaseURL: import.meta.env.PUBLIC_FIREBASE_DATABASE_URL || "https://ednelback-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID || "ednelback",
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET || "ednelback.firebasestorage.app",
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "382560726698",
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID || "1:382560726698:web:86de9c648f53f87c9eead3"
};

// Log config for debugging (remove in production)
if (browser) {
  console.log('Firebase Config:', {
    ...firebaseConfig,
    apiKey: firebaseConfig.apiKey ? '***' : 'MISSING'
  });
}

// Validate required fields
if (browser && !firebaseConfig.databaseURL) {
  console.error('❌ FIREBASE DATABASE URL IS MISSING!');
  console.error('Expected: PUBLIC_FIREBASE_DATABASE_URL');
  console.error('Received:', import.meta.env.PUBLIC_FIREBASE_DATABASE_URL);
}

// Initialize Firebase only in browser
let app;
let db;
let auth;
let googleProvider;

if (browser) {
  try {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    
    // Initialize database with explicit URL if needed
    db = getDatabase(app);
    
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    
    console.log('✅ Firebase initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
  }
}

// Export with safe defaults for SSR
export { db, auth, googleProvider };

// Login / Logout helpers
export const loginWithGoogle = () => {
  if (!browser || !auth) throw new Error('Auth not initialized');
  return signInWithPopup(auth, googleProvider);
};

export const logout = () => {
  if (!browser || !auth) throw new Error('Auth not initialized');
  return signOut(auth);
};

// Auth state listener
export const subscribeToAuth = (callback) => {
  if (!browser || !auth) return () => {};
  return onAuthStateChanged(auth, callback);
};

// Database helpers - only export if in browser
export const ref = browser ? dbRef : () => { throw new Error('Database not available on server'); };
export const push = browser ? dbPush : () => { throw new Error('Database not available on server'); };
export const set = browser ? dbSet : () => { throw new Error('Database not available on server'); };
export const get = browser ? dbGet : () => { throw new Error('Database not available on server'); };
export const query = browser ? dbQuery : () => { throw new Error('Database not available on server'); };
export const orderByChild = browser ? dbOrderByChild : () => { throw new Error('Database not available on server'); };
export const equalTo = browser ? dbEqualTo : () => { throw new Error('Database not available on server'); };
export const update = browser ? dbUpdate : () => { throw new Error('Database not available on server'); };
export const limitToLast = browser ? dbLimitToLast : () => { throw new Error('Database not available on server'); };

// User profile path
export const USER_PROFILE_PATH = 'users';

/**
 * Get a user's profile
 * @param {string} uid - Firebase User ID
 */
export async function getUserProfile(uid) {
  if (!browser || !db) throw new Error('Database not available');
  const profileRef = dbRef(db, `${USER_PROFILE_PATH}/${uid}`);
  const snapshot = await dbGet(profileRef);
  return snapshot.exists() ? snapshot.val() : null;
}

/**
 * Save or update a user's profile
 * @param {string} uid - Firebase User ID
 * @param {object} profileData - Data to save
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