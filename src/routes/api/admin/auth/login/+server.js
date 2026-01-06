// src/routes/api/admin/auth/login/+server.js
// ✅ UPDATED: Now uses MongoDB-based admin authentication
import { json } from '@sveltejs/kit';
import { adminLogin } from '$lib/server/mongodb/services/adminAuthService.js';
import { validateIPAccess, logBlockedAccess } from '$lib/server/ipRestriction.js';
import { checkRateLimit } from '$lib/server/adminSecurityMiddleware.js';
import { setCsrfCookie } from '$lib/server/csrfProtection.js';
import { dev } from '$app/environment';

/**
 * Extract device info from request headers
 */
function extractDeviceInfo(request) {
    const userAgent = request.headers.get('user-agent') || '';
    const acceptLanguage = request.headers.get('accept-language') || '';
    
    // Parse browser
    let browser = 'Unknown';
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
    else if (userAgent.includes('Edg')) browser = 'Edge';
    
    // Parse platform
    let platform = 'Unknown';
    if (userAgent.includes('Windows')) platform = 'Windows';
    else if (userAgent.includes('Mac')) platform = 'macOS';
    else if (userAgent.includes('Linux')) platform = 'Linux';
    else if (userAgent.includes('Android')) platform = 'Android';
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) platform = 'iOS';
    
    // Check if mobile
    const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(userAgent);
    
    return {
        browser,
        platform,
        isMobile,
        userAgent: userAgent.substring(0, 200), // Truncate for storage
        language: acceptLanguage.split(',')[0] || 'en'
    };
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
}

export async function POST({ request, getClientAddress, cookies }) {
    const ipAddress = getClientAddress();
    
    // Apply stricter rate limiting for login attempts
    const rateLimit = checkRateLimit(ipAddress, 'login');
    if (!rateLimit.allowed) {
        return json({ 
            error: 'Too many login attempts. Please try again later.',
            code: 'RATE_LIMITED',
            retryAfter: rateLimit.retryAfter
        }, { 
            status: 429,
            headers: {
                'Retry-After': String(rateLimit.retryAfter)
            }
        });
    }

    try {
        let body;
        try {
            body = await request.json();
        } catch {
            return json({ error: 'Invalid request body' }, { status: 400 });
        }

        const { email, password } = body;
        
        // Input validation
        if (!email || !password) {
            return json({ error: 'Email and password are required' }, { status: 400 });
        }

        if (!isValidEmail(email)) {
            return json({ error: 'Invalid email format' }, { status: 400 });
        }

        if (typeof password !== 'string' || password.length < 1 || password.length > 128) {
            return json({ error: 'Invalid password' }, { status: 400 });
        }
        
        const deviceInfo = extractDeviceInfo(request);

        // Check IP restriction before login
        const ipCheck = await validateIPAccess(ipAddress, 'admin');
        if (!ipCheck.allowed) {
            await logBlockedAccess(ipAddress, 'admin_login', email);
            return json({ 
                error: 'Access denied from this network location',
                code: 'IP_RESTRICTED'
            }, { status: 403 });
        }

        const result = await adminLogin(email, password, ipAddress, deviceInfo);
        
        // If login successful and we have tokens, set secure cookies
        if (result.accessToken) {
            cookies.set('admin_access_token', result.accessToken, {
                path: '/',
                httpOnly: true,
                secure: !dev,
                sameSite: 'lax',
                maxAge: 60 * 60 * 8 // 8 hours
            });
            
            if (result.refreshToken) {
                cookies.set('admin_refresh_token', result.refreshToken, {
                    path: '/',
                    httpOnly: true,
                    secure: !dev,
                    sameSite: 'lax',
                    maxAge: 60 * 60 * 24 * 7 // 7 days
                });
            }

            // Set CSRF token for subsequent requests
            setCsrfCookie(cookies);
        }
        
        return json(result);
    } catch (error) {
        // Log error internally but return generic message to client
        console.error('[Admin Login] Error:', error.message);
        
        // Return generic error to prevent user enumeration
        return json({ error: 'Invalid credentials' }, { status: 401 });
    }
}
