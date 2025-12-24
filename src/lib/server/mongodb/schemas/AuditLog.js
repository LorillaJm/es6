// src/lib/server/mongodb/schemas/AuditLog.js
// Audit Log Schema - MongoDB Atlas (PRIMARY)
// ✅ All audit logs stored in MongoDB for compliance
// ❌ Firebase NEVER stores audit data

import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
    // Event Info
    eventType: {
        type: String,
        required: true,
        enum: [
            // Auth Events
            'auth.login', 'auth.logout', 'auth.failed_login', 'auth.password_reset',
            'auth.session_expired', 'auth.token_refresh',
            
            // User Events
            'user.created', 'user.updated', 'user.deleted', 'user.status_changed',
            'user.role_changed', 'user.profile_updated', 'user.synced',
            
            // Attendance Events
            'attendance.check_in', 'attendance.check_out', 'attendance.break_start',
            'attendance.break_end', 'attendance.manual_entry', 'attendance.edited',
            'attendance.deleted', 'attendance.flagged',
            
            // Admin Events
            'admin.created', 'admin.updated', 'admin.deleted', 'admin.permission_changed',
            'admin.impersonation_start', 'admin.impersonation_end',
            
            // System Events
            'system.settings_changed', 'system.backup_created', 'system.backup_restored',
            'system.data_export', 'system.data_import',
            
            // Security Events
            'security.ip_blocked', 'security.suspicious_activity', 'security.rate_limited',
            'security.geofence_violation', 'security.device_blocked',
            
            // Announcement Events
            'announcement.created', 'announcement.updated', 'announcement.deleted',
            
            // E-Pass Events
            'epass.generated', 'epass.verified', 'epass.revoked'
        ],
        index: true
    },
    
    // Actor (who performed the action)
    actorId: {
        type: String,
        index: true
    },
    actorType: {
        type: String,
        enum: ['user', 'admin', 'system', 'api'],
        default: 'user'
    },
    actorEmail: String,
    actorName: String,
    actorIp: String,
    actorUserAgent: String,
    
    // Target (what was affected)
    targetId: String,
    targetType: {
        type: String,
        enum: ['user', 'attendance', 'admin', 'announcement', 'settings', 'system', 'epass']
    },
    targetEmail: String,
    
    // Organization
    orgId: {
        type: String,
        index: true
    },
    
    // Event Details
    action: {
        type: String,
        required: true
    },
    description: String,
    
    // Data Changes
    previousData: mongoose.Schema.Types.Mixed,
    newData: mongoose.Schema.Types.Mixed,
    changedFields: [String],
    
    // Context
    requestId: String,
    sessionId: String,
    endpoint: String,
    method: String,
    
    // Location
    location: {
        latitude: Number,
        longitude: Number,
        address: String
    },
    
    // Result
    status: {
        type: String,
        enum: ['success', 'failure', 'warning'],
        default: 'success'
    },
    errorMessage: String,
    errorCode: String,
    
    // Severity
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low',
        index: true
    },
    
    // Metadata
    metadata: mongoose.Schema.Types.Mixed,
    
    // Timestamp
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: false,
    collection: 'audit_logs'
});

// Indexes for efficient querying
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ actorId: 1, timestamp: -1 });
auditLogSchema.index({ targetId: 1, timestamp: -1 });
auditLogSchema.index({ orgId: 1, timestamp: -1 });
auditLogSchema.index({ eventType: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });
auditLogSchema.index({ orgId: 1, eventType: 1, timestamp: -1 });

// TTL index - auto-delete logs older than 2 years (optional)
// auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 });

// Static methods
auditLogSchema.statics.logEvent = async function(eventData) {
    const log = new this({
        ...eventData,
        timestamp: new Date()
    });
    return log.save();
};

auditLogSchema.statics.findByActor = function(actorId, options = {}) {
    const query = { actorId };
    if (options.startDate) query.timestamp = { $gte: options.startDate };
    if (options.endDate) query.timestamp = { ...query.timestamp, $lte: options.endDate };
    
    return this.find(query)
        .sort({ timestamp: -1 })
        .limit(options.limit || 100);
};

auditLogSchema.statics.findByTarget = function(targetId, options = {}) {
    const query = { targetId };
    if (options.startDate) query.timestamp = { $gte: options.startDate };
    if (options.endDate) query.timestamp = { ...query.timestamp, $lte: options.endDate };
    
    return this.find(query)
        .sort({ timestamp: -1 })
        .limit(options.limit || 100);
};

auditLogSchema.statics.getSecurityEvents = function(orgId, hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.find({
        orgId,
        eventType: { $regex: /^security\./ },
        timestamp: { $gte: since }
    }).sort({ timestamp: -1 });
};

auditLogSchema.statics.getRecentActivity = function(orgId, limit = 50) {
    return this.find({ orgId })
        .sort({ timestamp: -1 })
        .limit(limit);
};

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
