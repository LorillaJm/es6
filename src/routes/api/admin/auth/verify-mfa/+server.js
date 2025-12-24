// src/routes/api/admin/auth/verify-mfa/+server.js
// ✅ UPDATED: Now uses MongoDB-based admin authentication
import { json } from '@sveltejs/kit';
import { verifyMfaCode } from '$lib/server/mongodb/services/adminAuthService.js';

export async function POST({ request, getClientAddress }) {
    try {
        const { mfaSessionToken, code } = await request.json();
        
        if (!mfaSessionToken || !code) {
            return json({ error: 'MFA session token and code are required' }, { status: 400 });
        }
        
        const ipAddress = getClientAddress();
        const userAgent = request.headers.get('user-agent') || '';
        
        const deviceInfo = {
            ipAddress,
            userAgent: userAgent.substring(0, 200)
        };
        
        const result = await verifyMfaCode(mfaSessionToken, code, deviceInfo);
        
        return json(result);
    } catch (error) {
        console.error('MFA verification error:', error);
        return json({ error: error.message || 'MFA verification failed' }, { status: 401 });
    }
}
