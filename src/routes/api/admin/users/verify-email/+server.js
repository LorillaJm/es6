// src/routes/api/admin/users/verify-email/+server.js
// Admin API to manually verify user emails (for migration/support purposes)

import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin.js';
import { verifyAccessToken, logAuditEvent, checkPermission, PERMISSIONS } from '$lib/server/adminAuth.js';

/**
 * POST - Manually verify a user's email (admin only)
 */
export async function POST({ request }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.substring(7);
        const admin = await verifyAccessToken(token);
        
        if (!admin) {
            return json({ success: false, error: 'Invalid or expired token' }, { status: 401 });
        }

        // Check permission
        if (!checkPermission(admin, PERMISSIONS.MANAGE_USERS)) {
            return json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
        }

        const { userId, action } = await request.json();

        if (!userId) {
            return json({ success: false, error: 'User ID is required' }, { status: 400 });
        }

        if (!adminDb) {
            return json({ success: false, error: 'Database not available' }, { status: 500 });
        }

        // Check if user exists
        const userSnapshot = await adminDb.ref(`users/${userId}`).once('value');
        if (!userSnapshot.exists()) {
            return json({ success: false, error: 'User not found' }, { status: 404 });
        }

        const user = userSnapshot.val();

        if (action === 'verify') {
            // Mark email as verified
            await adminDb.ref(`users/${userId}`).update({
                emailVerified: true,
                emailVerifiedAt: new Date().toISOString(),
                emailVerifiedBy: admin.id
            });

            await logAuditEvent({
                action: 'USER_EMAIL_MANUALLY_VERIFIED',
                adminId: admin.id,
                targetId: userId,
                details: { email: user.email }
            });

            return json({
                success: true,
                message: 'User email verified successfully'
            });
        } else if (action === 'unverify') {
            // Mark email as unverified (for testing/support)
            await adminDb.ref(`users/${userId}`).update({
                emailVerified: false,
                emailVerifiedAt: null,
                emailVerifiedBy: null
            });

            await logAuditEvent({
                action: 'USER_EMAIL_UNVERIFIED',
                adminId: admin.id,
                targetId: userId,
                details: { email: user.email }
            });

            return json({
                success: true,
                message: 'User email verification removed'
            });
        } else {
            return json({ success: false, error: 'Invalid action. Use "verify" or "unverify"' }, { status: 400 });
        }
    } catch (error) {
        console.error('Error in manual email verification:', error);
        return json({ success: false, error: 'Operation failed' }, { status: 500 });
    }
}

/**
 * GET - Get email verification status for a user
 */
export async function GET({ url, request }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.substring(7);
        const admin = await verifyAccessToken(token);
        
        if (!admin) {
            return json({ success: false, error: 'Invalid or expired token' }, { status: 401 });
        }

        const userId = url.searchParams.get('userId');

        if (!userId) {
            return json({ success: false, error: 'User ID is required' }, { status: 400 });
        }

        if (!adminDb) {
            return json({ success: false, error: 'Database not available' }, { status: 500 });
        }

        const userSnapshot = await adminDb.ref(`users/${userId}`).once('value');
        if (!userSnapshot.exists()) {
            return json({ success: false, error: 'User not found' }, { status: 404 });
        }

        const user = userSnapshot.val();

        return json({
            success: true,
            userId,
            email: user.email,
            emailVerified: user.emailVerified === true,
            emailVerifiedAt: user.emailVerifiedAt || null
        });
    } catch (error) {
        console.error('Error getting email verification status:', error);
        return json({ success: false, error: 'Operation failed' }, { status: 500 });
    }
}
