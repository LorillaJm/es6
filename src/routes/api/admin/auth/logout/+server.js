// src/routes/api/admin/auth/logout/+server.js
// ✅ UPDATED: Now uses MongoDB-based admin authentication
import { json } from '@sveltejs/kit';
import { adminLogout, verifyAccessToken } from '$lib/server/mongodb/services/adminAuthService.js';
import { AuditLog } from '$lib/server/mongodb/schemas/AuditLog.js';

export async function POST({ request }) {
    try {
        const authHeader = request.headers.get('Authorization');
        const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        
        const { refreshToken } = await request.json();
        
        // Get admin info for audit log
        if (accessToken) {
            const admin = await verifyAccessToken(accessToken);
            if (admin) {
                await AuditLog.logEvent({
                    eventType: 'auth.logout',
                    actorId: admin.id,
                    actorType: 'admin',
                    actorEmail: admin.email,
                    action: 'logout',
                    description: `Admin ${admin.email} logged out`,
                    status: 'success'
                });
            }
        }
        
        await adminLogout(accessToken, refreshToken);
        
        return json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        return json({ success: true }); // Always return success for logout
    }
}
