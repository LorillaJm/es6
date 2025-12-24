// src/routes/api/admin/audit-logs/+server.js
// Admin Audit Logs API
// ✅ All audit logs stored in MongoDB
// ❌ Firebase NEVER stores audit data

import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, PERMISSIONS } from '$lib/server/adminAuth.js';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import { getAuditLogs } from '$lib/server/mongodb/services/auditService.js';

export async function GET({ request, url }) {
    try {
        // Validate admin authentication using admin access token
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];

        // Use verifyAccessToken (admin's custom token system)
        const admin = await verifyAccessToken(token);
        if (!admin) {
            return json({ success: false, error: 'Invalid token' }, { status: 401 });
        }

        // Check permission
        if (!checkPermission(admin, PERMISSIONS.VIEW_AUDIT_LOGS)) {
            return json({ success: false, error: 'Permission denied' }, { status: 403 });
        }

        await connectMongoDB();

        // Parse query parameters
        const filters = {
            orgId: url.searchParams.get('orgId') || 'org_default',
            eventType: url.searchParams.get('eventType'),
            actorId: url.searchParams.get('actorId'),
            targetId: url.searchParams.get('targetId'),
            severity: url.searchParams.get('severity'),
            status: url.searchParams.get('status'),
            startDate: url.searchParams.get('startDate'),
            endDate: url.searchParams.get('endDate'),
            search: url.searchParams.get('search')
        };

        // Remove null values
        Object.keys(filters).forEach(key => {
            if (filters[key] === null) delete filters[key];
        });

        const options = {
            limit: parseInt(url.searchParams.get('limit') || '50'),
            skip: parseInt(url.searchParams.get('skip') || '0')
        };

        // Get audit logs from MongoDB
        const { logs, total } = await getAuditLogs(filters, options);

        return json({
            success: true,
            data: {
                logs: logs.map(log => ({
                    id: log._id.toString(),
                    eventType: log.eventType,
                    action: log.action,
                    description: log.description,
                    actorId: log.actorId,
                    actorEmail: log.actorEmail,
                    actorName: log.actorName,
                    actorType: log.actorType,
                    targetId: log.targetId,
                    targetEmail: log.targetEmail,
                    targetType: log.targetType,
                    status: log.status,
                    severity: log.severity,
                    timestamp: log.timestamp?.toISOString(),
                    changedFields: log.changedFields,
                    metadata: log.metadata
                })),
                pagination: {
                    total,
                    limit: options.limit,
                    skip: options.skip,
                    hasMore: options.skip + logs.length < total
                }
            }
        });

    } catch (error) {
        console.error('[API] Audit logs error:', error);
        return json({
            success: false,
            error: 'Failed to get audit logs'
        }, { status: 500 });
    }
}
