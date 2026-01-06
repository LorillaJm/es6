// src/routes/api/session/+server.js
import { json } from '@sveltejs/kit';
import { adminAuth } from '$lib/server/firebase-admin';
import { dev } from '$app/environment';
import { csrfGuard, setCsrfCookie } from '$lib/server/csrfProtection.js';

const SESSION_COOKIE_NAME = '__session';
const expiresIn = 60 * 60 * 24 * 5 * 1000; 

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, cookies }) {
    // Validate CSRF token for state-changing operation
    const csrfError = csrfGuard(request, cookies);
    if (csrfError) {
        return csrfError;
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }

    const { idToken } = body;

    if (!idToken || typeof idToken !== 'string') {
        return json({ success: false, error: 'ID Token required' }, { status: 400 });
    }

    // Check if Firebase Admin is available
    if (!adminAuth) {
        return json({ success: false, error: 'Authentication service unavailable' }, { status: 503 });
    }

    try {
        const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
        
        cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
            maxAge: expiresIn / 1000, // Convert to seconds
            httpOnly: true,
            secure: !dev, 
            path: '/',
            sameSite: 'strict',
        });

        // Refresh CSRF token after successful session creation
        setCsrfCookie(cookies);

        return json({ success: true });
    } catch (error) {
        // Log error internally but don't expose details to client
        console.error('[Session] Error creating session cookie:', error.code || error.message);
        
        // Return generic error to client
        return json({ 
            success: false, 
            error: 'Failed to create session' 
        }, { status: 401 });
    }
}