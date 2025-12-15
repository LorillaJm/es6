// src/routes/api/admin/sessions/+server.js
import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, PERMISSIONS } from '$lib/server/adminAuth.js';
import { 
    getAllActiveSessions,
    getUserSessions,
    forceLogoutSession,
    forceLogoutAllUserSessions,
    getSessionStats
} from '$lib/server/sessionControl.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ request, url }) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');
        const admin = await verifyAccessToken(token);

        if (!admin) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!checkPermission(admin, PERMISSIONS.MANAGE_SECURITY)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        const action = url.searchParams.get('action');
        const userId = url.searchParams.get('userId');

        if (action === 'stats') {
            const stats = await getSessionStats();
            return json({ stats });
        }

        if (userId) {
            const sessions = await getUserSessions(userId);
            return json({ sessions });
        }

        const limit = parseInt(url.searchParams.get('limit') || '100');
        const sessions = await getAllActiveSessions(limit);

        return json({ sessions });
    } catch (error) {
        console.error('Sessions GET error:', error);
        return json({ error: error.message }, { status: 500 });
    }
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');
        const admin = await verifyAccessToken(token);

        if (!admin) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!checkPermission(admin, PERMISSIONS.MANAGE_SECURITY)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        const { action, userId, sessionId, reason } = await request.json();

        if (action === 'forceLogout') {
            if (!userId || !sessionId) {
                return json({ error: 'userId and sessionId required' }, { status: 400 });
            }
            await forceLogoutSession(userId, sessionId, admin.id, reason || 'admin_action');
            return json({ success: true });
        }

        if (action === 'forceLogoutAll') {
            if (!userId) {
                return json({ error: 'userId required' }, { status: 400 });
            }
            const result = await forceLogoutAllUserSessions(userId, admin.id, reason || 'admin_action');
            return json({ success: true, ...result });
        }

        return json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Sessions POST error:', error);
        return json({ error: error.message }, { status: 500 });
    }
}
