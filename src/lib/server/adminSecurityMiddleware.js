// src/lib/server/adminSecurityMiddleware.js
// Phase 9.3 - Admin Security Middleware

import { json } from '@sveltejs/kit';
import { verifyAccessToken } from './adminAuth.js';
import { cacheService } from './cacheService.js';

/**
 * Rate limiting configuration
 */
const RATE_LIMIT_CONFIG = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,    // Max requests per window
    blockDuration: 5 * 60 * 1000 // 5 minutes block
};

/**
 * Rate limit store (in-memory, use Redis in production)
 */
const rateLimitStore = new Map();

/**
 * Blocked IPs store
 */
const blockedIPs = new Map();

/**
 * Check rate limit for an IP
 * @param {string} ip 
 * @returns {Object}
 */
export function checkRateLimit(ip) {
    const now = Date.now();
    
    // Check if IP is blocked
    const blockExpiry = blockedIPs.get(ip);
    if (blockExpiry && now < blockExpiry) {
        return {
            allowed: false,
            blocked: true,
            retryAfter: Math.ceil((blockExpiry - now) / 1000)
        };
    } else if (blockExpiry) {
        blockedIPs.delete(ip);
    }

    // Get or create rate limit entry
    let entry = rateLimitStore.get(ip);
    
    if (!entry || now - entry.windowStart > RATE_LIMIT_CONFIG.windowMs) {
        entry = {
            windowStart: now,
            count: 0
        };
    }

    entry.count++;
    rateLimitStore.set(ip, entry);

    // Check if limit exceeded
    if (entry.count > RATE_LIMIT_CONFIG.maxRequests) {
        blockedIPs.set(ip, now + RATE_LIMIT_CONFIG.blockDuration);
        return {
            allowed: false,
            blocked: true,
            retryAfter: Math.ceil(RATE_LIMIT_CONFIG.blockDuration / 1000)
        };
    }

    return {
        allowed: true,
        remaining: RATE_LIMIT_CONFIG.maxRequests - entry.count,
        resetAt: entry.windowStart + RATE_LIMIT_CONFIG.windowMs
    };
}

/**
 * Validate admin request
 * @param {Request} request 
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
export async function validateAdminRequest(request, options = {}) {
    const {
        requireAuth = true,
        requiredRole = null,
        requiredPermissions = [],
        checkRateLimit: shouldCheckRateLimit = true
    } = options;

    const result = {
        valid: false,
        admin: null,
        error: null,
        statusCode: 200
    };

    // Get client IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               'unknown';

    // Check rate limit
    if (shouldCheckRateLimit) {
        const rateLimit = checkRateLimit(ip);
        if (!rateLimit.allowed) {
            result.error = 'Too many requests';
            result.statusCode = 429;
            result.retryAfter = rateLimit.retryAfter;
            return result;
        }
    }

    // Check authentication
    if (requireAuth) {
        const authHeader = request.headers.get('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            result.error = 'Missing or invalid authorization header';
            result.statusCode = 401;
            return result;
        }

        const token = authHeader.substring(7);
        
        try {
            const admin = await verifyAccessToken(token);
            
            if (!admin) {
                result.error = 'Invalid or expired token';
                result.statusCode = 401;
                return result;
            }

            result.admin = admin;

            // Check required role
            if (requiredRole && admin.role !== requiredRole && admin.role !== 'super_admin') {
                result.error = 'Insufficient role permissions';
                result.statusCode = 403;
                return result;
            }

            // Check required permissions
            if (requiredPermissions.length > 0) {
                const adminPermissions = getAdminPermissions(admin.role);
                const hasAllPermissions = requiredPermissions.every(p => adminPermissions.includes(p));
                
                if (!hasAllPermissions) {
                    result.error = 'Insufficient permissions';
                    result.statusCode = 403;
                    return result;
                }
            }
        } catch (error) {
            result.error = 'Authentication failed';
            result.statusCode = 401;
            return result;
        }
    }

    result.valid = true;
    return result;
}

/**
 * Get permissions for admin role
 * @param {string} role 
 * @returns {Array}
 */
function getAdminPermissions(role) {
    const PERMISSIONS = {
        super_admin: [
            'manage_users',
            'view_attendance',
            'edit_logs',
            'access_reports',
            'manage_system_settings',
            'view_audit_logs',
            'manage_announcements',
            'manage_feedback',
            'manage_security'
        ],
        admin: [
            'manage_users',
            'view_attendance',
            'access_reports',
            'manage_announcements',
            'manage_feedback'
        ]
    };

    return PERMISSIONS[role] || [];
}

/**
 * Sanitize input to prevent XSS and injection
 * @param {any} input 
 * @returns {any}
 */
export function sanitizeInput(input) {
    if (typeof input === 'string') {
        return input
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .replace(/\\/g, '&#x5C;')
            .replace(/`/g, '&#x60;');
    }
    
    if (Array.isArray(input)) {
        return input.map(sanitizeInput);
    }
    
    if (typeof input === 'object' && input !== null) {
        const sanitized = {};
        for (const [key, value] of Object.entries(input)) {
            sanitized[sanitizeInput(key)] = sanitizeInput(value);
        }
        return sanitized;
    }
    
    return input;
}

/**
 * Validate request body against schema
 * @param {Object} body 
 * @param {Object} schema 
 * @returns {Object}
 */
export function validateRequestBody(body, schema) {
    const errors = [];
    const validated = {};

    for (const [field, rules] of Object.entries(schema)) {
        const value = body[field];

        // Required check
        if (rules.required && (value === undefined || value === null || value === '')) {
            errors.push(`${field} is required`);
            continue;
        }

        if (value === undefined || value === null) {
            if (rules.default !== undefined) {
                validated[field] = rules.default;
            }
            continue;
        }

        // Type check
        if (rules.type) {
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            if (actualType !== rules.type) {
                errors.push(`${field} must be of type ${rules.type}`);
                continue;
            }
        }

        // Min/Max length for strings
        if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
            errors.push(`${field} must be at least ${rules.minLength} characters`);
            continue;
        }

        if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
            errors.push(`${field} must be at most ${rules.maxLength} characters`);
            continue;
        }

        // Min/Max for numbers
        if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
            errors.push(`${field} must be at least ${rules.min}`);
            continue;
        }

        if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
            errors.push(`${field} must be at most ${rules.max}`);
            continue;
        }

        // Pattern check
        if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
            errors.push(`${field} has invalid format`);
            continue;
        }

        // Enum check
        if (rules.enum && !rules.enum.includes(value)) {
            errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
            continue;
        }

        validated[field] = sanitizeInput(value);
    }

    return {
        valid: errors.length === 0,
        errors,
        data: validated
    };
}

/**
 * Log security event
 * @param {string} event 
 * @param {Object} details 
 */
export function logSecurityEvent(event, details = {}) {
    const logEntry = {
        event,
        timestamp: new Date().toISOString(),
        ...details
    };

    // In production, send to security logging service
    console.log('[SECURITY]', JSON.stringify(logEntry));

    // Cache recent security events
    const cacheKey = 'security:events';
    const events = cacheService.get(cacheKey) || [];
    events.unshift(logEntry);
    cacheService.set(cacheKey, events.slice(0, 100), 3600); // Keep last 100 events for 1 hour
}

/**
 * Get recent security events
 * @returns {Array}
 */
export function getSecurityEvents() {
    return cacheService.get('security:events') || [];
}

/**
 * Create secure response with security headers
 * @param {Object} data 
 * @param {number} status 
 * @returns {Response}
 */
export function secureResponse(data, status = 200) {
    return json(data, {
        status,
        headers: {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    });
}

export default {
    checkRateLimit,
    validateAdminRequest,
    sanitizeInput,
    validateRequestBody,
    logSecurityEvent,
    getSecurityEvents,
    secureResponse
};
