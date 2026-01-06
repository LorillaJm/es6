// src/lib/server/csrfProtection.js
// CSRF Protection Utilities
// Implements double-submit cookie pattern for state-changing operations

import crypto from 'crypto';
import { dev } from '$app/environment';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

/**
 * Generate a cryptographically secure CSRF token
 * @returns {string} CSRF token
 */
export function generateCsrfToken() {
    return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Validate CSRF token using timing-safe comparison
 * @param {string} requestToken - Token from request header
 * @param {string} cookieToken - Token from cookie
 * @returns {boolean} Whether tokens match
 */
export function validateCsrfToken(requestToken, cookieToken) {
    if (!requestToken || !cookieToken) {
        return false;
    }
    
    if (typeof requestToken !== 'string' || typeof cookieToken !== 'string') {
        return false;
    }
    
    if (requestToken.length !== cookieToken.length) {
        return false;
    }
    
    // Use timing-safe comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(
            Buffer.from(requestToken, 'utf8'),
            Buffer.from(cookieToken, 'utf8')
        );
    } catch {
        return false;
    }
}

/**
 * CSRF cookie configuration
 */
export const CSRF_COOKIE_CONFIG = {
    name: 'csrf_token',
    options: {
        httpOnly: false, // Must be readable by JavaScript to include in headers
        secure: !dev,
        sameSite: 'strict',
        path: '/',
        maxAge: CSRF_TOKEN_EXPIRY / 1000 // Convert to seconds
    }
};

/**
 * Set CSRF token cookie
 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies object
 * @returns {string} The generated token
 */
export function setCsrfCookie(cookies) {
    const token = generateCsrfToken();
    cookies.set(CSRF_COOKIE_CONFIG.name, token, CSRF_COOKIE_CONFIG.options);
    return token;
}

/**
 * Validate CSRF for a request
 * @param {Request} request - The incoming request
 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies object
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCsrfRequest(request, cookies) {
    // Skip CSRF validation for safe methods
    const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (safeMethod) {
        return { valid: true };
    }
    
    const headerToken = request.headers.get('X-CSRF-Token');
    const cookieToken = cookies.get(CSRF_COOKIE_CONFIG.name);
    
    if (!headerToken) {
        return { valid: false, error: 'Missing CSRF token in request header' };
    }
    
    if (!cookieToken) {
        return { valid: false, error: 'Missing CSRF cookie' };
    }
    
    if (!validateCsrfToken(headerToken, cookieToken)) {
        return { valid: false, error: 'Invalid CSRF token' };
    }
    
    return { valid: true };
}

/**
 * Middleware helper to validate CSRF and return error response if invalid
 * @param {Request} request
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @returns {Response|null} Returns error response if invalid, null if valid
 */
export function csrfGuard(request, cookies) {
    const { valid, error } = validateCsrfRequest(request, cookies);
    
    if (!valid) {
        console.warn('[CSRF] Validation failed:', error);
        return new Response(JSON.stringify({ 
            success: false, 
            error: 'CSRF validation failed',
            code: 'CSRF_ERROR'
        }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    return null;
}

export default {
    generateCsrfToken,
    validateCsrfToken,
    setCsrfCookie,
    validateCsrfRequest,
    csrfGuard,
    CSRF_COOKIE_CONFIG
};
