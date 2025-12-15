// src/routes/api/admin/backup/+server.js
import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, PERMISSIONS } from '$lib/server/adminAuth.js';
import { 
    createManualBackup, 
    getBackupList, 
    getLatestBackup,
    restoreFromBackup,
    deleteBackup 
} from '$lib/server/backupService.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ request }) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');
        const admin = await verifyAccessToken(token);

        if (!admin) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!checkPermission(admin, PERMISSIONS.MANAGE_SYSTEM_SETTINGS)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        const url = new URL(request.url);
        const action = url.searchParams.get('action');

        if (action === 'latest') {
            const latest = await getLatestBackup();
            return json({ backup: latest });
        }

        const limit = parseInt(url.searchParams.get('limit') || '20');
        const backups = await getBackupList(limit);

        return json({ backups });
    } catch (error) {
        console.error('Backup GET error:', error);
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

        if (!checkPermission(admin, PERMISSIONS.MANAGE_SYSTEM_SETTINGS)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        const { action, backupId, description, collections } = await request.json();

        if (action === 'create') {
            const backup = await createManualBackup(admin.id, description || '');
            return json({ success: true, backup });
        }

        if (action === 'restore') {
            if (!backupId) {
                return json({ error: 'Backup ID required' }, { status: 400 });
            }
            const result = await restoreFromBackup(backupId, admin.id, collections || []);
            return json({ success: true, ...result });
        }

        return json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Backup POST error:', error);
        return json({ error: error.message }, { status: 500 });
    }
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ request, url }) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');
        const admin = await verifyAccessToken(token);

        if (!admin) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!checkPermission(admin, PERMISSIONS.MANAGE_SYSTEM_SETTINGS)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        const backupId = url.searchParams.get('id');
        if (!backupId) {
            return json({ error: 'Backup ID required' }, { status: 400 });
        }

        await deleteBackup(backupId, admin.id);
        return json({ success: true });
    } catch (error) {
        console.error('Backup DELETE error:', error);
        return json({ error: error.message }, { status: 500 });
    }
}
