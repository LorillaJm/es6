// src/routes/api/leave-requests/+server.js
// Leave Request API Endpoint
import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, PERMISSIONS } from '$lib/server/adminAuth.js';
import {
    submitLeaveRequest,
    getUserLeaveRequests,
    getPendingLeaveRequests,
    reviewLeaveRequest,
    cancelLeaveRequest,
    getUserLeaveStats,
    LeaveTypes,
    LeaveStatus
} from '$lib/server/leaveRequestService.js';

/**
 * GET - Get leave requests
 */
export async function GET({ request, url }) {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');
        
        const action = url.searchParams.get('action');
        const userId = url.searchParams.get('userId');

        // Admin actions
        if (action === 'pending') {
            const admin = await verifyAccessToken(token);
            if (!admin) {
                return json({ error: 'Unauthorized' }, { status: 401 });
            }

            const limit = parseInt(url.searchParams.get('limit') || '50');
            const requests = await getPendingLeaveRequests(limit);
            return json({ requests });
        }

        // User actions - require userId
        if (!userId) {
            return json({ error: 'User ID required' }, { status: 400 });
        }

        if (action === 'stats') {
            const year = parseInt(url.searchParams.get('year') || new Date().getFullYear());
            const stats = await getUserLeaveStats(userId, year);
            return json({ stats });
        }

        const requests = await getUserLeaveRequests(userId);
        return json({ requests });
    } catch (error) {
        console.error('Leave requests GET error:', error);
        return json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST - Submit or review leave request
 */
export async function POST({ request }) {
    try {
        const body = await request.json();
        const { action, userId, requestId, status, notes, ...requestData } = body;

        // Admin review action
        if (action === 'review') {
            const authHeader = request.headers.get('Authorization');
            const token = authHeader?.replace('Bearer ', '');
            const admin = await verifyAccessToken(token);

            if (!admin) {
                return json({ error: 'Unauthorized' }, { status: 401 });
            }

            if (!checkPermission(admin, PERMISSIONS.MANAGE_USERS)) {
                return json({ error: 'Forbidden' }, { status: 403 });
            }

            if (!userId || !requestId || !status) {
                return json({ error: 'Missing required fields' }, { status: 400 });
            }

            const result = await reviewLeaveRequest(userId, requestId, status, admin.id, notes);
            
            if (!result.success) {
                return json({ error: result.error }, { status: 400 });
            }

            return json({ success: true });
        }

        // User submit action
        if (!userId) {
            return json({ error: 'User ID required' }, { status: 400 });
        }

        if (!requestData.startDate || !requestData.endDate) {
            return json({ error: 'Start and end dates required' }, { status: 400 });
        }

        const result = await submitLeaveRequest(userId, requestData);

        if (!result.success) {
            return json({ error: result.error }, { status: 400 });
        }

        return json({ success: true, request: result.request });
    } catch (error) {
        console.error('Leave requests POST error:', error);
        return json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE - Cancel leave request
 */
export async function DELETE({ url }) {
    try {
        const userId = url.searchParams.get('userId');
        const requestId = url.searchParams.get('requestId');

        if (!userId || !requestId) {
            return json({ error: 'User ID and request ID required' }, { status: 400 });
        }

        const result = await cancelLeaveRequest(userId, requestId);

        if (!result.success) {
            return json({ error: result.error }, { status: 400 });
        }

        return json({ success: true });
    } catch (error) {
        console.error('Leave requests DELETE error:', error);
        return json({ error: error.message }, { status: 500 });
    }
}
