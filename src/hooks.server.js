// src/hooks.server.js
import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';

const SESSION_COOKIE_NAME = '__session';

// Only import Firebase Admin if credentials are available
let adminAuth = null;
const hasFirebaseCredentials = !!import.meta.env.FIREBASE_SERVICE_ACCOUNT;

if (hasFirebaseCredentials) {
    try {
        const firebaseAdmin = await import('$lib/server/firebase-admin');
        adminAuth = firebaseAdmin.adminAuth;
    } catch (e) {
        if (dev) {
            console.warn('Firebase Admin not available - running in dev mode without server auth');
        }
    }
}

// Initialize MongoDB connection on startup
// ✅ MongoDB Atlas = PRIMARY DATABASE (Single Source of Truth)
let mongoInitialized = false;

async function initMongoDB() {
    if (mongoInitialized) return;
    
    try {
        const { connectMongoDB } = await import('$lib/server/mongodb/connection.js');
        // Don't await - let it connect in background
        connectMongoDB().then(() => {
            mongoInitialized = true;
            if (dev) {
                console.log('[Hooks] ✅ MongoDB connection established');
            }
        }).catch(error => {
            console.error('[Hooks] ❌ MongoDB connection failed:', error.message);
        });
    } catch (error) {
        console.error('[Hooks] ❌ MongoDB import failed:', error.message);
    }
}

// Initialize MongoDB (non-blocking)
initMongoDB();

/**
 * Security headers for all responses
 */
const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(self)'
};

// CSP header - Development is permissive, Production is strict
// Firebase and Google services require multiple domains
const CSP_HEADER = dev 
    // Development: More permissive to allow HMR, debugging, and all Firebase features
    ? [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.firebasedatabase.app https://*.firebaseio.com",
        "script-src-elem 'self' 'unsafe-inline' https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.firebasedatabase.app https://*.firebaseio.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' ws: wss: https://*.firebaseio.com https://*.googleapis.com https://*.firebasedatabase.app https://*.google.com wss://*.firebaseio.com wss://*.firebasedatabase.app",
        "worker-src 'self' blob:",
        "frame-src 'self' https://*.google.com https://*.firebaseapp.com https://*.firebasedatabase.app https://*.firebaseio.com"
      ].join('; ')
    // Production: Stricter but still allows necessary Firebase/Google services
    : [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://*.googleapis.com https://*.gstatic.com https://*.firebasedatabase.app https://*.firebaseio.com",
        "script-src-elem 'self' 'unsafe-inline' https://*.googleapis.com https://*.gstatic.com https://*.firebasedatabase.app https://*.firebaseio.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.firebasedatabase.app wss://*.firebaseio.com wss://*.firebasedatabase.app",
        "worker-src 'self' blob:",
        "frame-src 'self' https://*.firebaseapp.com https://*.firebasedatabase.app https://*.firebaseio.com",
        "frame-ancestors 'none'"
      ].join('; ');

/** @type {import('@sveltejs/kit').Handle} */
export const handle = async ({ event, resolve }) => {
    const sessionCookie = event.cookies.get(SESSION_COOKIE_NAME);
    let userId = null;

    // Only verify session if Firebase Admin is available
    if (sessionCookie && adminAuth) {
        try {
            const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
            userId = decodedClaims.uid;
        } catch (error) {
            // Log only in dev, clear invalid cookie
            if (dev) {
                console.warn("Invalid or expired session cookie:", error.code);
            }
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

    // Resolve the request
    const response = await resolve(event);

    // Add security headers to all responses
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
        response.headers.set(header, value);
    }
    
    // Add CSP header
    response.headers.set('Content-Security-Policy', CSP_HEADER);

    return response;
};