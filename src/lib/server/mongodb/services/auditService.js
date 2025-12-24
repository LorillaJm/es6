// src/lib/server/mongodb/services/auditService.js
// Audit Service - MongoDB Atlas (PRIMARY)
// ✅ All audit logs stored in MongoDB for compliance
// ❌ Firebase NEVER stores audit data

import { connectMongoDB } from '../connection.js';
import { AuditLog } from '../schemas/AuditLog.js';

/**
 * Log an audit event
 */
export async function logAuditEvent(eventData) {
    await connectMongoDB();
    return AuditLog.logEvent(eventData);
}

/**
 * Get audit logs with filters
 */
export async function getAuditLogs(filters = {}, options = {}) {
    await connectMongoDB();
    
    const query = {};
    
    if (filters.orgId) query.orgId = filters.orgId;
    if (filters.actorId) query.actorId = filters.actorId;
    if (filters.targetId) query.targetId = filters.targetId;
    if (filters.eventType) query.eventType = filters.eventType;
    if (filters.severity) query.severity = filters.severity;
    if (filters.status) query.status = filters.status;
    
    if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
        if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
    }
    
    if (filters.search) {
        query.$or = [
            { description: { $regex: filters.search, $options: 'i' } },
            { actorEmail: { $regex: filters.search, $options: 'i' } },
            { targetEmail: { $regex: filters.search, $options: 'i' } }
        ];
    }
    
    let queryBuilder = AuditLog.find(query).sort({ timestamp: -1 });
    
    if (options.limit) {
        queryBuilder = queryBuilder.limit(options.limit);
    }
    
    if (options.skip) {
        queryBuilder = queryBuilder.skip(options.skip);
    }
    
    const [logs, total] = await Promise.all([
        queryBuilder.exec(),
        AuditLog.countDocuments(query)
    ]);
    
    return { logs, total };
}

/**
 * Get audit logs by actor
 */
export async function getAuditLogsByActor(actorId, options = {}) {
    await connectMongoDB();
    return AuditLog.findByActor(actorId, options);
}

/**
 * Get audit logs by target
 */
export async function getAuditLogsByTarget(targetId, options = {}) {
    await connectMongoDB();
    return AuditLog.findByTarget(targetId, options);
}

/**
 * Get security events
 */
export async function getSecurityEvents(orgId, hours = 24) {
    await connectMongoDB();
    return AuditLog.getSecurityEvents(orgId, hours);
}

/**
 * Get recent activity
 */
export async function getRecentActivity(orgId, limit = 50) {
    await connectMongoDB();
    return AuditLog.getRecentActivity(orgId, limit);
}

/**
 * Get audit statistics
 */
export async function getAuditStats(orgId, startDate, endDate) {
    await connectMongoDB();
    
    const match = { orgId };
    if (startDate || endDate) {
        match.timestamp = {};
        if (startDate) match.timestamp.$gte = new Date(startDate);
        if (endDate) match.timestamp.$lte = new Date(endDate);
    }
    
    const stats = await AuditLog.aggregate([
        { $match: match },
        {
            $group: {
                _id: {
                    eventType: '$eventType',
                    status: '$status'
                },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: '$_id.eventType',
                total: { $sum: '$count' },
                byStatus: {
                    $push: {
                        status: '$_id.status',
                        count: '$count'
                    }
                }
            }
        },
        { $sort: { total: -1 } }
    ]);
    
    return stats;
}

/**
 * Get login activity
 */
export async function getLoginActivity(orgId, days = 7) {
    await connectMongoDB();
    
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    return AuditLog.aggregate([
        {
            $match: {
                orgId,
                eventType: { $in: ['auth.login', 'auth.failed_login', 'auth.logout'] },
                timestamp: { $gte: since }
            }
        },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                    eventType: '$eventType'
                },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: '$_id.date',
                events: {
                    $push: {
                        type: '$_id.eventType',
                        count: '$count'
                    }
                }
            }
        },
        { $sort: { _id: 1 } }
    ]);
}

/**
 * Export audit logs
 */
export async function exportAuditLogs(orgId, startDate, endDate, format = 'json') {
    await connectMongoDB();
    
    const logs = await AuditLog.find({
        orgId,
        timestamp: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        }
    }).sort({ timestamp: -1 }).lean();
    
    // Log the export action
    await logAuditEvent({
        eventType: 'system.data_export',
        actorType: 'admin',
        action: 'export_audit_logs',
        description: `Exported ${logs.length} audit logs`,
        metadata: { startDate, endDate, format, count: logs.length },
        orgId
    });
    
    return logs;
}

export default {
    logAuditEvent,
    getAuditLogs,
    getAuditLogsByActor,
    getAuditLogsByTarget,
    getSecurityEvents,
    getRecentActivity,
    getAuditStats,
    getLoginActivity,
    exportAuditLogs
};
