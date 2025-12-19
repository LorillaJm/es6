// src/lib/security/incidentResponse.js
// Enterprise Incident Response System - Emergency controls and abuse handling

import { browser } from '$app/environment';
import { db } from '$lib/firebase';
import { ref, set, get, update } from 'firebase/database';

/**
 * Incident severity levels
 */
export const SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

/**
 * Incident types
 */
export const INCIDENT_TYPES = {
    SUSPICIOUS_LOGIN: 'suspicious_login',
    BRUTE_FORCE: 'brute_force',
    LOCATION_SPOOFING: 'location_spoofing',
    PROXY_ATTENDANCE: 'proxy_attendance',
    DEVICE_ANOMALY: 'device_anomaly',
    DATA_BREACH: 'data_breach',
    UNAUTHORIZED_ACCESS: 'unauthorized_access',
    SYSTEM_ABUSE: 'system_abuse'
};

/**
 * Emergency control states
 */
export const EMERGENCY_CONTROLS = {
    ATTENDANCE_PAUSED: 'attendance_paused',
    QR_DISABLED: 'qr_disabled',
    FORCE_LOGOUT_ALL: 'force_logout_all',
    LOCKDOWN: 'lockdown'
};

/**
 * Report a security incident
 * @param {object} incident - Incident details
 * @returns {Promise<string>} Incident ID
 */
export async function reportIncident(incident) {
    if (!browser || !db) return null;
    
    const incidentId = `INC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const incidentData = {
        id: incidentId,
        type: incident.type,
        severity: incident.severity || SEVERITY.MEDIUM,
        userId: incident.userId || null,
        description: incident.description,
        evidence: incident.evidence || {},
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        resolvedAt: null,
        resolvedBy: null,
        actions: []
    };
    
    try {
        await set(ref(db, `incidents/${incidentId}`), incidentData);
        
        // Auto-escalate critical incidents
        if (incident.severity === SEVERITY.CRITICAL) {
            await escalateIncident(incidentId, 'Auto-escalated due to critical severity');
        }
        
        // Notify admins
        await notifyAdmins(incidentData);
        
        return incidentId;
    } catch (error) {
        console.error('Error reporting incident:', error);
        return null;
    }
}

/**
 * Escalate an incident
 */
async function escalateIncident(incidentId, reason) {
    if (!browser || !db) return;
    
    await update(ref(db, `incidents/${incidentId}`), {
        escalated: true,
        escalatedAt: new Date().toISOString(),
        escalationReason: reason
    });
}

/**
 * Notify admins of incident
 */
async function notifyAdmins(incident) {
    if (!browser || !db) return;
    
    const notification = {
        type: 'security_incident',
        incidentId: incident.id,
        severity: incident.severity,
        title: `Security Incident: ${incident.type}`,
        message: incident.description,
        timestamp: new Date().toISOString(),
        read: false
    };
    
    await set(ref(db, `admin_notifications/${Date.now()}`), notification);
}

/**
 * Handle detected abuse - automated response
 * @param {string} userId - User ID
 * @param {string} abuseType - Type of abuse detected
 * @param {object} evidence - Supporting evidence
 */
export async function handleDetectedAbuse(userId, abuseType, evidence = {}) {
    if (!browser || !db) return;
    
    const response = {
        actions: [],
        incidentId: null
    };
    
    // Report incident
    response.incidentId = await reportIncident({
        type: abuseType,
        severity: getSeverityForAbuse(abuseType),
        userId,
        description: `Automated detection: ${abuseType}`,
        evidence
    });
    
    // Take automated actions based on abuse type
    switch (abuseType) {
        case INCIDENT_TYPES.BRUTE_FORCE:
            await freezeUserAccount(userId, 'Brute force attack detected');
            response.actions.push('account_frozen');
            break;
            
        case INCIDENT_TYPES.PROXY_ATTENDANCE:
            await flagAttendanceForReview(userId);
            response.actions.push('attendance_flagged');
            break;
            
        case INCIDENT_TYPES.LOCATION_SPOOFING:
            await suspendAttendancePrivileges(userId);
            response.actions.push('attendance_suspended');
            break;
            
        case INCIDENT_TYPES.UNAUTHORIZED_ACCESS:
            await forceLogoutUser(userId);
            await freezeUserAccount(userId, 'Unauthorized access attempt');
            response.actions.push('force_logout', 'account_frozen');
            break;
    }
    
    return response;
}

/**
 * Get severity level for abuse type
 */
function getSeverityForAbuse(abuseType) {
    const severityMap = {
        [INCIDENT_TYPES.BRUTE_FORCE]: SEVERITY.HIGH,
        [INCIDENT_TYPES.DATA_BREACH]: SEVERITY.CRITICAL,
        [INCIDENT_TYPES.UNAUTHORIZED_ACCESS]: SEVERITY.CRITICAL,
        [INCIDENT_TYPES.PROXY_ATTENDANCE]: SEVERITY.MEDIUM,
        [INCIDENT_TYPES.LOCATION_SPOOFING]: SEVERITY.MEDIUM,
        [INCIDENT_TYPES.DEVICE_ANOMALY]: SEVERITY.LOW
    };
    return severityMap[abuseType] || SEVERITY.MEDIUM;
}

/**
 * Freeze user account temporarily
 */
export async function freezeUserAccount(userId, reason) {
    if (!browser || !db) return;
    
    await update(ref(db, `users/${userId}`), {
        accountFrozen: true,
        frozenAt: new Date().toISOString(),
        frozenReason: reason
    });
}

/**
 * Unfreeze user account
 */
export async function unfreezeUserAccount(userId, adminId) {
    if (!browser || !db) return;
    
    await update(ref(db, `users/${userId}`), {
        accountFrozen: false,
        unfrozenAt: new Date().toISOString(),
        unfrozenBy: adminId
    });
}

/**
 * Flag attendance records for review
 */
async function flagAttendanceForReview(userId) {
    if (!browser || !db) return;
    
    await set(ref(db, `flagged_attendance/${userId}`), {
        flaggedAt: new Date().toISOString(),
        status: 'pending_review',
        reason: 'Suspicious activity detected'
    });
}

/**
 * Suspend attendance privileges
 */
async function suspendAttendancePrivileges(userId) {
    if (!browser || !db) return;
    
    await update(ref(db, `users/${userId}`), {
        attendanceSuspended: true,
        suspendedAt: new Date().toISOString()
    });
}

/**
 * Force logout a specific user
 */
export async function forceLogoutUser(userId) {
    if (!browser || !db) return;
    
    // Revoke all sessions
    const sessionsRef = ref(db, `sessions/${userId}`);
    const snapshot = await get(sessionsRef);
    
    if (snapshot.exists()) {
        const updates = {};
        Object.keys(snapshot.val()).forEach(sessionId => {
            updates[`${sessionId}/status`] = 'revoked';
            updates[`${sessionId}/revokedAt`] = new Date().toISOString();
            updates[`${sessionId}/revokeReason`] = 'security_incident';
        });
        await update(sessionsRef, updates);
    }
}

/**
 * Emergency Controls - Global system controls
 */
export class EmergencyControls {
    static SETTINGS_PATH = 'settings/emergency';
    
    /**
     * Pause all attendance globally
     */
    static async pauseAttendance(adminId, reason) {
        if (!browser || !db) return false;
        
        await set(ref(db, `${this.SETTINGS_PATH}/attendancePaused`), {
            active: true,
            activatedAt: new Date().toISOString(),
            activatedBy: adminId,
            reason
        });
        
        await reportIncident({
            type: 'EMERGENCY_CONTROL',
            severity: SEVERITY.HIGH,
            description: `Attendance paused by admin: ${reason}`,
            evidence: { adminId }
        });
        
        return true;
    }
    
    /**
     * Resume attendance
     */
    static async resumeAttendance(adminId) {
        if (!browser || !db) return false;
        
        await set(ref(db, `${this.SETTINGS_PATH}/attendancePaused`), {
            active: false,
            deactivatedAt: new Date().toISOString(),
            deactivatedBy: adminId
        });
        
        return true;
    }
    
    /**
     * Disable QR scanning globally
     */
    static async disableQRScanning(adminId, reason) {
        if (!browser || !db) return false;
        
        await set(ref(db, `${this.SETTINGS_PATH}/qrDisabled`), {
            active: true,
            activatedAt: new Date().toISOString(),
            activatedBy: adminId,
            reason
        });
        
        return true;
    }
    
    /**
     * Enable QR scanning
     */
    static async enableQRScanning(adminId) {
        if (!browser || !db) return false;
        
        await set(ref(db, `${this.SETTINGS_PATH}/qrDisabled`), {
            active: false,
            deactivatedAt: new Date().toISOString(),
            deactivatedBy: adminId
        });
        
        return true;
    }
    
    /**
     * Force logout all users (nuclear option)
     */
    static async forceLogoutAllUsers(adminId, reason) {
        if (!browser || !db) return false;
        
        // Set global logout flag
        await set(ref(db, `${this.SETTINGS_PATH}/forceLogoutAll`), {
            active: true,
            activatedAt: new Date().toISOString(),
            activatedBy: adminId,
            reason
        });
        
        await reportIncident({
            type: 'EMERGENCY_CONTROL',
            severity: SEVERITY.CRITICAL,
            description: `Force logout all users: ${reason}`,
            evidence: { adminId }
        });
        
        return true;
    }
    
    /**
     * Get current emergency status
     */
    static async getStatus() {
        if (!browser || !db) return null;
        
        const snapshot = await get(ref(db, this.SETTINGS_PATH));
        return snapshot.exists() ? snapshot.val() : {
            attendancePaused: { active: false },
            qrDisabled: { active: false },
            forceLogoutAll: { active: false }
        };
    }
    
    /**
     * Check if attendance is paused
     */
    static async isAttendancePaused() {
        const status = await this.getStatus();
        return status?.attendancePaused?.active || false;
    }
    
    /**
     * Check if QR is disabled
     */
    static async isQRDisabled() {
        const status = await this.getStatus();
        return status?.qrDisabled?.active || false;
    }
}

/**
 * Resolve an incident
 * @param {string} incidentId - Incident ID
 * @param {string} adminId - Admin resolving
 * @param {string} resolution - Resolution notes
 */
export async function resolveIncident(incidentId, adminId, resolution) {
    if (!browser || !db) return false;
    
    await update(ref(db, `incidents/${incidentId}`), {
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolvedBy: adminId,
        resolution,
        updatedAt: new Date().toISOString()
    });
    
    return true;
}

/**
 * Get open incidents
 */
export async function getOpenIncidents() {
    if (!browser || !db) return [];
    
    const snapshot = await get(ref(db, 'incidents'));
    if (!snapshot.exists()) return [];
    
    const incidents = [];
    snapshot.forEach(child => {
        const incident = child.val();
        if (incident.status === 'open') {
            incidents.push(incident);
        }
    });
    
    return incidents.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
    });
}

export default {
    reportIncident,
    handleDetectedAbuse,
    freezeUserAccount,
    unfreezeUserAccount,
    forceLogoutUser,
    resolveIncident,
    getOpenIncidents,
    EmergencyControls,
    SEVERITY,
    INCIDENT_TYPES
};
