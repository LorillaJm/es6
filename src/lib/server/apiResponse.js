// src/lib/server/apiResponse.js
// Standardized secure API responses
// Prevents sensitive data exposure and provides consistent error handling

import { json } from '@sveltejs/kit';

/**
 * Fields that should never be included in API responses
 */
const SENSITIVE_FIELDS = [
    'password', 'passwordHash', 'passwordSalt',
    'mfaSecret', 'token', 'accessToken', 'refreshToken',
    'apiKey', 'secret', 'privateKey', 'connectionString',
    'emailVerificationToken', 'passwordResetToken',
    'integrityHash', 'tokenHash', 'mfaBackupCodes'
];

/**
 * Safe error messages for different status codes
 * Never expose internal error details to clients
 */
const SAFE_ERROR_MESSAGES = {
    400: 'Invalid request',
    401: 'Authentication required',
    403: 'Access denied',
    404: 'Resource not found',
    409: 'Conflict with existing resource',
    422: 'Invalid data provided',
    429: 'Too many requests. Please try again later.',
    500: 'An internal error occurred',
    503: 'Service temporarily unavailable'
};

/**
 * Standard security headers for API responses
 */
const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
};

/**
 * Remove sensitive fields from response data recursively
 * @param {any} data - Data to sanitize
 * @returns {any} - Sanitized data
 */
export function sanitizeResponseData(data) {
    if (!data) return data;
    
    if (Array.isArray(data)) {
        return data.map(item => sanitizeResponseData(item));
    }
    
    if (typeof data === 'object' && data !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(data)) {
            // Skip sensitive fields
            if (SENSITIVE_FIELDS.includes(key)) continue;
            // Skip fields that look like tokens/secrets
            if (key.toLowerCase().includes('secret') || 
                key.toLowerCase().includes('token') ||
                key.toLowerCase().includes('password')) continue;
            
            sanitized[key] = sanitizeResponseData(value);
        }
        return sanitized;
    }
    
    return data;
}

/**
 * Create a success response
 * @param {any} data - Response data
 * @param {string} message - Success message
 * @param {number} status - HTTP status code
 */
export function successResponse(data, message = 'Success', status = 200) {
    return json({
        success: true,
        message,
        data: sanitizeResponseData(data),
        timestamp: new Date().toISOString()
    }, { 
        status,
        headers: SECURITY_HEADERS
    });
}

/**
 * Create an error response (safe for client)
 * @param {Error|string} error - Error object or message
 * @param {number} status - HTTP status code
 * @param {string} code - Error code for client handling
 */
export function errorResponse(error, status = 500, code = 'UNKNOWN_ERROR') {
    // Log full error internally (server-side only)
    if (error instanceof Error) {
        console.error(`[API Error] ${status}:`, error.message);
    } else {
        console.error(`[API Error] ${status}:`, error);
    }
    
    // Return safe error to client
    const safeMessage = SAFE_ERROR_MESSAGES[status] || SAFE_ERROR_MESSAGES[500];
    
    return json({
        success: false,
        error: safeMessage,
        code: code,
        timestamp: new Date().toISOString()
    }, { 
        status,
        headers: SECURITY_HEADERS
    });
}

/**
 * Create a validation error response
 * @param {Object|string[]} errors - Validation errors by field or array of error messages
 */
export function validationErrorResponse(errors) {
    return json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
        timestamp: new Date().toISOString()
    }, { 
        status: 422,
        headers: SECURITY_HEADERS
    });
}

/**
 * Create an unauthorized response
 * @param {string} reason - Reason for unauthorized (logged, not sent to client)
 */
export function unauthorizedResponse(reason = 'No reason provided') {
    console.warn(`[Auth] Unauthorized access attempt: ${reason}`);
    return errorResponse('Unauthorized', 401, 'UNAUTHORIZED');
}

/**
 * Create a forbidden response
 * @param {string} reason - Reason for forbidden (logged, not sent to client)
 */
export function forbiddenResponse(reason = 'No reason provided') {
    console.warn(`[Auth] Forbidden access attempt: ${reason}`);
    return errorResponse('Forbidden', 403, 'FORBIDDEN');
}

/**
 * Create a rate limit response
 * @param {number} retryAfter - Seconds until retry is allowed
 */
export function rateLimitResponse(retryAfter = 60) {
    return json({
        success: false,
        error: SAFE_ERROR_MESSAGES[429],
        code: 'RATE_LIMITED',
        retryAfter,
        timestamp: new Date().toISOString()
    }, { 
        status: 429,
        headers: {
            ...SECURITY_HEADERS,
            'Retry-After': String(retryAfter)
        }
    });
}

/**
 * Create a not found response
 * @param {string} resource - Resource type that wasn't found (logged only)
 */
export function notFoundResponse(resource = 'Resource') {
    console.warn(`[API] ${resource} not found`);
    return errorResponse('Not found', 404, 'NOT_FOUND');
}
