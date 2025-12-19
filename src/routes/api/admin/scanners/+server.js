// src/routes/api/admin/scanners/+server.js
// Scanner Management API
import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, PERMISSIONS } from '$lib/server/adminAuth.js';
import {
    registerScanner,
    getAllScanners,
    getScanner,
    updateScanner,
    deleteScanner,
    getScannerStats,
    updateHeartbeat,
    recordScan
} from '$lib/server/scannerService.js';

/**
 * GET - Get all scanners or scanner stats
 */
export async function GET({ request, url }) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');
        const admin = await verifyAccessToken(token);

        if (!admin) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const action = url.searchParams.get('action');
        const scannerId = url.searchParams.get('id');

        if (action === 'stats') {
            const stats = await getScannerStats();
            return json({ stats });
        }

        if (scannerId) {
            const scanner = await getScanner(scannerId);
            if (!scanner) {
                return json({ error: 'Scanner not found' }, { status: 404 });
            }
            return json({ scanner });
        }

        const scanners = await getAllScanners();
        return json({ scanners });
    } catch (error) {
        console.error('Scanners GET error:', error);
        return json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST - Register new scanner or handle scanner actions
 */
export async function POST({ request }) {
    try {
        const body = await request.json();
        const { action } = body;

        // Heartbeat and scan recording don't require admin auth
        // They use scanner API keys instead
        if (action === 'heartbeat') {
            const { scannerId, ...heartbeatData } = body;
            if (!scannerId) {
                return json({ error: 'Scanner ID required' }, { status: 400 });
            }
            const result = await updateHeartbeat(scannerId, heartbeatData);
            return json(result);
        }

        if (action === 'scan') {
            const { scannerId, ...scanData } = body;
            if (!scannerId) {
                return json({ error: 'Scanner ID required' }, { status: 400 });
            }
            const result = await recordScan(scannerId, scanData);
            return json(result);
        }

        // Admin actions require authentication
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');
        const admin = await verifyAccessToken(token);

        if (!admin) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!checkPermission(admin, PERMISSIONS.MANAGE_SYSTEM_SETTINGS)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        // Register new scanner
        const result = await registerScanner(body, admin.id);
        
        if (!result.success) {
            return json({ error: result.error }, { status: 400 });
        }

        return json({ success: true, scanner: result.scanner });
    } catch (error) {
        console.error('Scanners POST error:', error);
        return json({ error: error.message }, { status: 500 });
    }
}

/**
 * PUT - Update scanner
 */
export async function PUT({ request, url }) {
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

        const scannerId = url.searchParams.get('id');
        if (!scannerId) {
            return json({ error: 'Scanner ID required' }, { status: 400 });
        }

        const updates = await request.json();
        const result = await updateScanner(scannerId, updates, admin.id);

        if (!result.success) {
            return json({ error: result.error }, { status: 400 });
        }

        return json({ success: true });
    } catch (error) {
        console.error('Scanners PUT error:', error);
        return json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE - Delete scanner
 */
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

        const scannerId = url.searchParams.get('id');
        if (!scannerId) {
            return json({ error: 'Scanner ID required' }, { status: 400 });
        }

        const result = await deleteScanner(scannerId, admin.id);

        if (!result.success) {
            return json({ error: result.error }, { status: 400 });
        }

        return json({ success: true });
    } catch (error) {
        console.error('Scanners DELETE error:', error);
        return json({ error: error.message }, { status: 500 });
    }
}
