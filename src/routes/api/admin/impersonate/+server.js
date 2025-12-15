// src/routes/api/admin/impersonate/+server.js
// Admin Impersonation API - Phase 8.3

import { json } from '@sveltejs/kit';
import { adminDb, adminAuth } from '$lib/server/firebase-admin.js';

/**
 * POST - Start impersonation session
 */
export async function POST({ request }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const { targetUserId, reason } = await request.json();

        if (!targetUserId) {
            return json({ error: 'Target user ID required' }, { status: 400 });
        }

        // Verify admin token and get admin info
        const adminSnapshot = await adminDb.ref('admins').once('value');
        let adminUser = null;
        let adminId = null;

        if (adminSnapshot.exists()) {
            adminSnapshot.forEach(child => {
                const admin = child.val();
                if (admin.accessToken === token || admin.refreshToken) {
                    adminUser = admin;
                    adminId = child.key;
                }
            });
        }

        if (!adminUser) {
            return json({ error: 'Admin not found' }, { status: 403 });
        }

        // Only super_admin and admin can impersonate
        if (adminUser.role !== 'super_admin' && adminUser.role !== 'admin') {
            return json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        // Get target user
        const userSnapshot = await adminDb.ref(`users/${targetUserId}`).once('value');
        
        if (!userSnapshot.exists()) {
            return json({ error: 'Target user not found' }, { status: 404 });
        }

        const targetUser = userSnapshot.val();

        // Log impersonation start
        await adminDb.ref(`audit_logs/${Date.now()}`).set({
            action: 'impersonation_start',
            adminId,
            adminName: adminUser.name,
            targetUserId,
            targetUserName: targetUser.name || targetUser.displayName,
            reason: reason || 'Troubleshooting',
            timestamp: new Date().toISOString(),
            ip: request.headers.get('x-forwarded-for') || 'unknown'
        });

        return json({
            success: true,
            targetUser: {
                id: targetUserId,
                name: targetUser.name || targetUser.displayName,
                email: targetUser.email,
                role: targetUser.role,
                department: targetUser.department,
                year: targetUser.year,
                section: targetUser.section,
                profilePhoto: targetUser.profilePhoto
            },
            admin: {
                id: adminId,
                name: adminUser.name
            }
        });

    } catch (error) {
        console.error('Impersonation start error:', error);
        return json({ error: 'Failed to start impersonation' }, { status: 500 });
    }
}

/**
 * DELETE - End impersonation session
 */
export async function DELETE({ request }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { adminId, targetUserId, actions } = await request.json();

        // Log impersonation end
        await adminDb.ref(`audit_logs/${Date.now()}`).set({
            action: 'impersonation_end',
            adminId,
            targetUserId,
            actionsPerformed: actions?.length || 0,
            timestamp: new Date().toISOString()
        });

        return json({ success: true });

    } catch (error) {
        console.error('Impersonation end error:', error);
        return json({ error: 'Failed to end impersonation' }, { status: 500 });
    }
}
