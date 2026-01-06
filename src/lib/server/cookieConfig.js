// src/lib/server/cookieConfig.js
// Secure cookie configuration for admin sessions
// Implements security best practices for cookie handling

import { dev } from '$app/environment';

/**
 * Base secure cookie options
 * These settings prevent common cookie-based attacks
 */
const BASE_SECURE_OPTIONS = {
    httpOnly: true,           // Prevents JavaScript access (XSS protection)
    secure: !dev,             // HTTPS only in production
    sameSite: 'lax',          // CSRF protection while allowing navigation
    path: '/'                 // Cookie available site-wide
};

/**
 * Admin access token cookie configuration
 * Short-lived token for API authentication
 */
export const ADMIN_ACCESS_TOKEN_COOKIE = {
    name: 'admin_access_token',
    options: {
        ...BASE_SECURE_OPTIONS,
        maxAge: 60 * 60 * 8    // 8 hours (matches session timeout)
    }
};

/**
 * Admin refresh token cookie configuration
 * Longer-lived token for session renewal
 */
export const ADMIN_REFRESH_TOKEN_COOKIE = {
    name: 'admin_refresh_token',
    options: {
        ...BASE_SECURE_OPTIONS,
        maxAge: 60 * 60 * 24 * 7  // 7 days
    }
};

/**
 * User session cookie configuration
 */
export const USER_SESSION_COOKIE = {
    name: '__session',
    options: {
        ...BASE_SECURE_OPTIONS,
        maxAge: 60 * 60 * 24 * 5  // 5 days
    }
};

/**
 * CSRF token cookie configuration
 * Used for state-changing operations
 */
export const CSRF_TOKEN_COOKIE = {
    name: 'csrf_token',
    options: {
        ...BASE_SECURE_OPTIONS,
        httpOnly: false,        // Must be readable by JavaScript
        maxAge: 60 * 60         // 1 hour
    }
};

/**
 * Set admin authentication cookies
 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies object
 * @param {string} accessToken - Access token value
 * @param {string} refreshToken - Refresh token value (optional)
 */
export function setAdminAuthCookies(cookies, accessToken, refreshToken = null) {
    cookies.set(
        ADMIN_ACCESS_TOKEN_COOKIE.name,
        accessToken,
        ADMIN_ACCESS_TOKEN_COOKIE.options
    );
    
    if (refreshToken) {
        cookies.set(
            ADMIN_REFRESH_TOKEN_COOKIE.name,
            refreshToken,
            ADMIN_REFRESH_TOKEN_COOKIE.options
        );
    }
}

/**
 * Clear admin authentication cookies
 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies object
 */
export function clearAdminAuthCookies(cookies) {
    cookies.delete(ADMIN_ACCESS_TOKEN_COOKIE.name, { path: '/' });
    cookies.delete(ADMIN_REFRESH_TOKEN_COOKIE.name, { path: '/' });
}

/**
 * Get admin access token from cookies
 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies object
 * @returns {string|undefined} - Access token or undefined
 */
export function getAdminAccessToken(cookies) {
    return cookies.get(ADMIN_ACCESS_TOKEN_COOKIE.name);
}

/**
 * Get admin refresh token from cookies
 * @param {import('@sveltejs/kit').Cookies} cookies - SvelteKit cookies object
 * @returns {string|undefined} - Refresh token or undefined
 */
export function getAdminRefreshToken(cookies) {
    return cookies.get(ADMIN_REFRESH_TOKEN_COOKIE.name);
}
