// src/routes/api/admin/auth/login/+server.js
import { json } from '@sveltejs/kit';
import { adminLogin } from '$lib/server/adminAuth.js';
import { validateIPAccess, logBlockedAccess } from '$lib/server/ipRestriction.js';

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

export async function POST({ request, getClientAddress }) {
    try {
        const { email, password } = await request.json();
        
        if (!email || !password) {
            return json({ error: 'Email and password are required' }, { status: 400 });
        }
        
        const ipAddress = getClientAddress();
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
        
        return json(result);
    } catch (error) {
        console.error('Admin login error:', error);
        return json({ error: error.message || 'Login failed' }, { status: 401 });
    }
}
