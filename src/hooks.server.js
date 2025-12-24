// src/hooks.server.js
import { redirect } from '@sveltejs/kit';

const SESSION_COOKIE_NAME = '__session';

// Only import Firebase Admin if credentials are available
let adminAuth = null;
const hasFirebaseCredentials = !!import.meta.env.FIREBASE_SERVICE_ACCOUNT;

if (hasFirebaseCredentials) {
    try {
        const firebaseAdmin = await import('$lib/server/firebase-admin');
        adminAuth = firebaseAdmin.adminAuth;
    } catch (e) {
        console.warn('Firebase Admin not available - running in dev mode without server auth');
    }
}

// Initialize MongoDB connection on startup
// ✅ MongoDB Atlas = PRIMARY DATABASE (Single Source of Truth)
let mongoInitialized = false;

async function initMongoDB() {
    if (mongoInitialized) return;
    
    try {
        const { connectMongoDB } = await import('$lib/server/mongodb/connection.js');
        await connectMongoDB();
        mongoInitialized = true;
        console.log('[Hooks] ✅ MongoDB connection established');
    } catch (error) {
        console.error('[Hooks] ❌ MongoDB connection failed:', error.message);
        // Don't throw - allow app to start, but log the error
        // API routes will fail gracefully if MongoDB is unavailable
    }
}

// Initialize MongoDB (non-blocking)
initMongoDB();

/** @type {Handle} */
export const handle = async ({ event, resolve }) => {
    const sessionCookie = event.cookies.get(SESSION_COOKIE_NAME);
    let userId = null;

    // Only verify session if Firebase Admin is available
    if (sessionCookie && adminAuth) {
        try {
            const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
            userId = decodedClaims.uid;
        } catch (error) {
            console.warn("Invalid or expired session cookie:", error.code);
            event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
        }
    }

    event.locals.userId = userId;

    // Authentication Guard for Protected Routes (only if Firebase Admin is available)
    const protectedRoutes = ['/app/dashboard'];

    if (adminAuth && protectedRoutes.some(route => event.url.pathname.startsWith(route))) {
        if (!userId) {
            throw redirect(302, '/');
        }
    }

    return resolve(event);
};