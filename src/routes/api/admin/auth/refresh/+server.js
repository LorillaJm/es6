// src/routes/api/admin/auth/refresh/+server.js
// ✅ UPDATED: Now uses MongoDB-based admin authentication
import { json } from '@sveltejs/kit';
import { refreshAccessToken } from '$lib/server/mongodb/services/adminAuthService.js';

/**
 * Extract device info from request headers
 */
function extractDeviceInfo(request) {
    const userAgent = request.headers.get('user-agent') || '';
    
    let browser = 'Unknown';
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) browser = 'Safari';
    else if (userAgent.includes('Edg')) browser = 'Edge';
    
    let platform = 'Unknown';
    if (userAgent.includes('Windows')) platform = 'Windows';
    else if (userAgent.includes('Mac')) platform = 'macOS';
    else if (userAgent.includes('Linux')) platform = 'Linux';
    
    return { browser, platform, userAgent: userAgent.substring(0, 200) };
}

export async function POST({ request, getClientAddress }) {
    try {
        const { refreshToken } = await request.json();
        
        if (!refreshToken) {
            return json({ error: 'Refresh token is required' }, { status: 400 });
        }
        
        const deviceInfo = {
            ...extractDeviceInfo(request),
            ipAddress: getClientAddress()
        };
        
        const tokens = await refreshAccessToken(refreshToken, deviceInfo);
        return json(tokens);
    } catch (error) {
        console.error('Token refresh error:', error);
        return json({ error: error.message || 'Token refresh failed' }, { status: 401 });
    }
}
