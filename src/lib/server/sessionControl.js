// src/lib/server/sessionControl.js
// Admin-side Session Control for managing user sessions
import { adminDb } from './firebase-admin.js';
import { logAuditEvent } from './adminAuth.js';

/**
 * @typedef {Object} UserSession
 * @property {string} sessionId
 * @property {string} userId
 * @property {string} deviceFingerprint
 * @property {Object} deviceInfo
 * @property {string} createdAt
 * @property {string} lastActivity
 * @property {string} status
 * @property {Object} [location]
 */

/**
 * Get all active sessions across all users (admin view)
 * @param {number} [limit=100]
 * @returns {Promise<UserSession[]>}
 */
export async function getAllActiveSessions(limit = 100) {
    if (!adminDb) return [];

    const snapshot = await adminDb.ref('sessions').once('value');
    if (!snapshot.exists()) return [];

    const allSessions = [];
    const sessionsData = snapshot.val();

    for (const userId of Object.keys(sessionsData)) {
        const userSessions = sessionsData[userId];
        for (const sessionId of Object.keys(userSessions)) {
            const session = userSessions[sessionId];
            if (session.status === 'active') {
                allSessions.push({
                    ...session,
                    sessionId,
                    userId
                });
            }
        }
    }

    // Sort by last activity, most recent first
    allSessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

    return allSessions.slice(0, limit);
}

/**
 * Get sessions for a specific user
 * @param {string} userId
 * @returns {Promise<UserSession[]>}
 */
export async function getUserSessions(userId) {
    if (!adminDb) return [];

    const snapshot = await adminDb.ref(`sessions/${userId}`).once('value');
    if (!snapshot.exists()) return [];

    const sessions = [];
    snapshot.forEach(child => {
        sessions.push({ ...child.val(), sessionId: child.key });
    });

    return sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
}

/**
 * Force logout a specific session (admin action)
 * @param {string} userId
 * @param {string} sessionId
 * @param {string} adminId - Admin performing the action
 * @param {string} [reason]
 */
export async function forceLogoutSession(userId, sessionId, adminId, reason = 'admin_action') {
    if (!adminDb) throw new Error('Database not available');

    await adminDb.ref(`sessions/${userId}/${sessionId}`).update({
        status: 'revoked',
        revokedAt: new Date().toISOString(),
        revokedBy: adminId,
        revokeReason: reason
    });

    await logAuditEvent({
        action: 'SESSION_FORCE_LOGOUT',
        adminId,
        targetId: userId,
        details: { sessionId, reason }
    });

    return true;
}

/**
 * Force logout all sessions for a user
 * @param {string} userId
 * @param {string} adminId
 * @param {string} [reason]
 */
export async function forceLogoutAllUserSessions(userId, adminId, reason = 'admin_action') {
    if (!adminDb) throw new Error('Database not available');

    const sessions = await getUserSessions(userId);
    const activeSessions = sessions.filter(s => s.status === 'active');

    const updates = {};
    for (const session of activeSessions) {
        updates[`${session.sessionId}/status`] = 'revoked';
        updates[`${session.sessionId}/revokedAt`] = new Date().toISOString();
        updates[`${session.sessionId}/revokedBy`] = adminId;
        updates[`${session.sessionId}/revokeReason`] = reason;
    }

    if (Object.keys(updates).length > 0) {
        await adminDb.ref(`sessions/${userId}`).update(updates);
    }

    await logAuditEvent({
        action: 'USER_ALL_SESSIONS_REVOKED',
        adminId,
        targetId: userId,
        details: { sessionCount: activeSessions.length, reason }
    });

    return { revokedCount: activeSessions.length };
}

/**
 * Get session statistics
 * @returns {Promise<Object>}
 */
export async function getSessionStats() {
    if (!adminDb) return { totalActive: 0, byDevice: {}, byBrowser: {} };

    const sessions = await getAllActiveSessions(1000);

    const stats = {
        totalActive: sessions.length,
        byDevice: { mobile: 0, desktop: 0 },
        byBrowser: {},
        byPlatform: {},
        recentActivity: sessions.slice(0, 10)
    };

    for (const session of sessions) {
        // Count by device type
        if (session.deviceInfo?.isMobile) {
            stats.byDevice.mobile++;
        } else {
            stats.byDevice.desktop++;
        }

        // Count by browser
        const browser = session.deviceInfo?.browser?.name || 'Unknown';
        stats.byBrowser[browser] = (stats.byBrowser[browser] || 0) + 1;

        // Count by platform
        const platform = session.deviceInfo?.platform || 'Unknown';
        stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;
    }

    return stats;
}

/**
 * Clean up expired sessions
 * @param {number} [maxAgeHours=24]
 */
export async function cleanupExpiredSessions(maxAgeHours = 24) {
    if (!adminDb) return 0;

    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
    const snapshot = await adminDb.ref('sessions').once('value');
    
    if (!snapshot.exists()) return 0;

    let cleaned = 0;
    const sessionsData = snapshot.val();

    for (const userId of Object.keys(sessionsData)) {
        const userSessions = sessionsData[userId];
        for (const sessionId of Object.keys(userSessions)) {
            const session = userSessions[sessionId];
            if (session.status === 'active' && session.lastActivity < cutoff) {
                await adminDb.ref(`sessions/${userId}/${sessionId}`).update({
                    status: 'expired',
                    expiredAt: new Date().toISOString()
                });
                cleaned++;
            }
        }
    }

    return cleaned;
}
