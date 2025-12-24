// src/routes/api/admin/auth/verify/+server.js
// ✅ UPDATED: Now uses MongoDB-based admin authentication
import { json } from '@sveltejs/kit';
import { verifyAccessToken } from '$lib/server/mongodb/services/adminAuthService.js';

export async function GET({ request }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return json({ error: 'No token provided' }, { status: 401 });
        }
        
        const token = authHeader.substring(7);
        const admin = await verifyAccessToken(token);
        
        if (!admin) {
            return json({ error: 'Invalid or expired token' }, { status: 401 });
        }
        
        return json({ admin });
    } catch (error) {
        console.error('Token verification error:', error);
        return json({ error: 'Verification failed' }, { status: 401 });
    }
}
