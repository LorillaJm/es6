// src/lib/services/auditService.js
import { adminDb } from '$lib/server/firebase-admin.js';

const AUDIT_PATH = 'auditLogs';

/**
 * @typedef {Object} AuditLog
 * @property {string} id
 * @property {string} action - Type of action (edit, reset, settings, create, delete, login, etc.)
 * @property {string} message - Human-readable description
 * @property {string} adminId - UID of the admin who performed the action
 * @property {string} adminName - Display name of the admin
 * @property {string} [targetId] - ID of the affected resource
 * @property {string} [targetType] - Type of resource (user, event, settings, etc.)
 * @property {Object} [metadata] - Additional context data
 * @property {string} [ipAddress] - Client IP address
 * @property {Object} [deviceInfo] - Device/browser information
 * @property {string} timestamp - ISO timestamp
 */

/**
 * Create a new audit log entry
 * @param {Object} params
 * @param {string} params.action
 * @param {string} params.message
 * @param {string} params.adminId
 * @param {string} params.adminName
 * @param {string} [params.targetId]
 * @param {string} [params.targetType]
 * @param {Object} [params.metadata]
 * @param {string} [params.ipAddress]
 * @param {Object} [params.deviceInfo]
 * @returns {Promise<string>} The created log ID
 */
export async function createAuditLog({
    action,
    message,
    adminId,
    adminName,
    targetId = null,
    targetType = null,
    metadata = null,
    ipAddress = null,
    deviceInfo = null
}) {
    try {
        const logRef = adminDb.ref(AUDIT_PATH).push();
        const logData = {
            id: logRef.key,
            action,
            message,
            adminId,
            adminName,
            timestamp: new Date().toISOString()
        };

        if (targetId) logData.targetId = targetId;
        if (targetType) logData.targetType = targetType;
        if (metadata) logData.metadata = metadata;
        if (ipAddress) logData.ipAddress = ipAddress;
        if (deviceInfo) logData.deviceInfo = deviceInfo;

        await logRef.set(logData);
        return logRef.key;
    } catch (error) {
        console.error('Error creating audit log:', error);
        throw error;
    }
}

/**
 * Get recent audit logs
 * @param {number} [limit=50] - Maximum number of logs to retrieve
 * @returns {Promise<AuditLog[]>}
 */
export async function getRecentAuditLogs(limit = 50) {
    try {
        const snapshot = await adminDb
            .ref(AUDIT_PATH)
            .orderByChild('timestamp')
            .limitToLast(limit)
            .once('value');

        if (!snapshot.exists()) return [];

        const logs = [];
        snapshot.forEach((child) => {
            logs.push(child.val());
        });

        // Return in reverse chronological order
        return logs.reverse();
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        throw error;
    }
}

/**
 * Get audit logs by admin
 * @param {string} adminId
 * @param {number} [limit=50]
 * @returns {Promise<AuditLog[]>}
 */
export async function getAuditLogsByAdmin(adminId, limit = 50) {
    try {
        const snapshot = await adminDb
            .ref(AUDIT_PATH)
            .orderByChild('adminId')
            .equalTo(adminId)
            .limitToLast(limit)
            .once('value');

        if (!snapshot.exists()) return [];

        const logs = [];
        snapshot.forEach((child) => {
            logs.push(child.val());
        });

        return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
        console.error('Error fetching audit logs by admin:', error);
        throw error;
    }
}

/**
 * Get audit logs by target resource
 * @param {string} targetId
 * @param {number} [limit=50]
 * @returns {Promise<AuditLog[]>}
 */
export async function getAuditLogsByTarget(targetId, limit = 50) {
    try {
        const snapshot = await adminDb
            .ref(AUDIT_PATH)
            .orderByChild('targetId')
            .equalTo(targetId)
            .limitToLast(limit)
            .once('value');

        if (!snapshot.exists()) return [];

        const logs = [];
        snapshot.forEach((child) => {
            logs.push(child.val());
        });

        return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
        console.error('Error fetching audit logs by target:', error);
        throw error;
    }
}

/**
 * Get audit logs within a date range
 * @param {string} startDate - ISO date string
 * @param {string} endDate - ISO date string
 * @returns {Promise<AuditLog[]>}
 */
export async function getAuditLogsByDateRange(startDate, endDate) {
    try {
        const snapshot = await adminDb
            .ref(AUDIT_PATH)
            .orderByChild('timestamp')
            .startAt(startDate)
            .endAt(endDate)
            .once('value');

        if (!snapshot.exists()) return [];

        const logs = [];
        snapshot.forEach((child) => {
            logs.push(child.val());
        });

        return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
        console.error('Error fetching audit logs by date range:', error);
        throw error;
    }
}

/**
 * Delete old audit logs (cleanup utility)
 * @param {number} daysToKeep - Number of days of logs to retain
 * @returns {Promise<number>} Number of deleted logs
 */
export async function cleanupOldAuditLogs(daysToKeep = 90) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const cutoffTimestamp = cutoffDate.toISOString();

        const snapshot = await adminDb
            .ref(AUDIT_PATH)
            .orderByChild('timestamp')
            .endAt(cutoffTimestamp)
            .once('value');

        if (!snapshot.exists()) return 0;

        const updates = {};
        let count = 0;
        snapshot.forEach((child) => {
            updates[child.key] = null;
            count++;
        });

        await adminDb.ref(AUDIT_PATH).update(updates);
        return count;
    } catch (error) {
        console.error('Error cleaning up audit logs:', error);
        throw error;
    }
}
