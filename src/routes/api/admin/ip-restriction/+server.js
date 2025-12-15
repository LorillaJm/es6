// src/routes/api/admin/ip-restriction/+server.js
import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, PERMISSIONS } from '$lib/server/adminAuth.js';
import { 
    getIPRestrictionSettings,
    updateIPRestrictionSettings,
    addAllowedIP,
    removeAllowedIP,
    addAllowedRange,
    validateIPAccess
} from '$lib/server/ipRestriction.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ request, getClientAddress }) {
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

        const settings = await getIPRestrictionSettings();
        const clientIP = getClientAddress();

        return json({ settings, currentIP: clientIP });
    } catch (error) {
        console.error('IP Restriction GET error:', error);
        return json({ error: error.message }, { status: 500 });
    }
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, getClientAddress }) {
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

        const { action, settings, ip, cidr, networkName } = await request.json();

        if (action === 'update') {
            const updated = await updateIPRestrictionSettings(settings, admin.id);
            return json({ success: true, settings: updated });
        }

        if (action === 'addIP') {
            if (!ip) {
                return json({ error: 'IP address required' }, { status: 400 });
            }
            const updated = await addAllowedIP(ip, networkName, admin.id);
            return json({ success: true, settings: updated });
        }

        if (action === 'removeIP') {
            if (!ip) {
                return json({ error: 'IP address required' }, { status: 400 });
            }
            const updated = await removeAllowedIP(ip, admin.id);
            return json({ success: true, settings: updated });
        }

        if (action === 'addRange') {
            if (!cidr) {
                return json({ error: 'CIDR range required' }, { status: 400 });
            }
            const updated = await addAllowedRange(cidr, networkName, admin.id);
            return json({ success: true, settings: updated });
        }

        if (action === 'addCurrentIP') {
            const clientIP = getClientAddress();
            const updated = await addAllowedIP(clientIP, networkName || 'Current Location', admin.id);
            return json({ success: true, settings: updated, addedIP: clientIP });
        }

        if (action === 'validate') {
            const testIP = ip || getClientAddress();
            const result = await validateIPAccess(testIP, 'admin');
            return json({ ...result, testedIP: testIP });
        }

        return json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('IP Restriction POST error:', error);
        return json({ error: error.message }, { status: 500 });
    }
}
