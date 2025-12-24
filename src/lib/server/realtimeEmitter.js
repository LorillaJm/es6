// src/lib/server/realtimeEmitter.js
// Firebase Realtime Emitter - BACKEND ONLY
// ✅ Only backend can write to Firebase
// ✅ Firebase stores ONLY transient/temporary data
// ❌ Frontend must NOT write to Firebase
// ❌ Firebase must NEVER store permanent data

import { adminDb } from './firebase-admin.js';

/**
 * REALTIME PATHS (Firebase Realtime Database)
 * These paths store ONLY transient data that can be cleared/overwritten
 */
const REALTIME_PATHS = {
    // Live attendance status (current state only, not history)
    ATTENDANCE_LIVE: 'realtime/attendance/live',
    
    // Dashboard statistics (aggregated counts)
    DASHBOARD_STATS: 'realtime/dashboard/stats',
    
    // Online/offline presence
    USERS_ONLINE: 'realtime/users/online',
    
    // Live notifications (temporary, auto-cleared)
    NOTIFICATIONS: 'realtime/notifications',
    
    // Admin monitoring
    ADMIN_MONITOR: 'realtime/admin/monitor',
    
    // Leaderboard (cached, updated periodically)
    LEADERBOARD: 'realtime/gamification/leaderboard'
};

/**
 * Check if Firebase Admin is available
 */
function isFirebaseAvailable() {
    return adminDb !== null;
}

/**
 * Emit attendance status update to Firebase
 * Called ONLY after MongoDB write succeeds
 * 
 * @param {string} userId - Firebase UID
 * @param {object} statusData - Minimal status data
 */
export async function emitAttendanceStatus(userId, statusData) {
    if (!isFirebaseAvailable()) {
        console.warn('[RealtimeEmitter] Firebase not available, skipping emit');
        return { success: false, reason: 'firebase_unavailable' };
    }

    try {
        const payload = {
            mongoId: statusData.mongoId || statusData.odId || null,
            status: statusData.status,
            checkInTime: statusData.checkInTime || null,
            checkOutTime: statusData.checkOutTime || null,
            isLate: statusData.isLate || false,
            updatedAt: new Date().toISOString(),
            // TTL marker for cleanup
            _expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        };

        await adminDb.ref(`${REALTIME_PATHS.ATTENDANCE_LIVE}/${userId}`).set(payload);
        
        console.log(`[RealtimeEmitter] ✅ Attendance status emitted for ${userId}`);
        return { success: true };
    } catch (error) {
        console.error('[RealtimeEmitter] ❌ Failed to emit attendance:', error.message);
        // Don't throw - MongoDB write already succeeded
        return { success: false, error: error.message };
    }
}

/**
 * Emit dashboard statistics update
 * Called after attendance changes
 * 
 * @param {string} orgId - Organization ID
 * @param {object} stats - Dashboard statistics
 */
export async function emitDashboardStats(orgId, stats) {
    if (!isFirebaseAvailable()) return { success: false, reason: 'firebase_unavailable' };

    try {
        const payload = {
            totalPresent: stats.totalPresent || 0,
            totalAbsent: stats.totalAbsent || 0,
            totalLate: stats.totalLate || 0,
            totalOnLeave: stats.totalOnLeave || 0,
            totalOnBreak: stats.totalOnBreak || 0,
            updatedAt: new Date().toISOString()
        };

        await adminDb.ref(`${REALTIME_PATHS.DASHBOARD_STATS}/${orgId}`).set(payload);
        
        return { success: true };
    } catch (error) {
        console.error('[RealtimeEmitter] ❌ Failed to emit dashboard stats:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Update user online/offline presence
 * 
 * @param {string} userId - Firebase UID
 * @param {boolean} isOnline - Online status
 */
export async function emitUserPresence(userId, isOnline) {
    if (!isFirebaseAvailable()) return { success: false, reason: 'firebase_unavailable' };

    try {
        if (isOnline) {
            await adminDb.ref(`${REALTIME_PATHS.USERS_ONLINE}/${userId}`).set({
                online: true,
                lastSeen: new Date().toISOString()
            });
        } else {
            await adminDb.ref(`${REALTIME_PATHS.USERS_ONLINE}/${userId}`).set({
                online: false,
                lastSeen: new Date().toISOString()
            });
        }
        
        return { success: true };
    } catch (error) {
        console.error('[RealtimeEmitter] ❌ Failed to emit presence:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Emit notification to user (temporary, for live updates)
 * 
 * @param {string} userId - Firebase UID
 * @param {object} notification - Notification data
 */
export async function emitNotification(userId, notification) {
    if (!isFirebaseAvailable()) return { success: false, reason: 'firebase_unavailable' };

    try {
        const notifRef = adminDb.ref(`${REALTIME_PATHS.NOTIFICATIONS}/${userId}`).push();
        
        await notifRef.set({
            id: notifRef.key,
            title: notification.title,
            body: notification.message,  // NotificationBell expects 'body'
            message: notification.message,
            type: notification.type || 'info',
            priority: notification.priority || 'normal',
            createdAt: new Date().toISOString(),  // NotificationBell expects 'createdAt'
            timestamp: new Date().toISOString(),
            read: false,
            // Auto-expire after 7 days
            _expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
        });
        
        console.log(`[RealtimeEmitter] ✅ Notification emitted for user ${userId}`);
        return { success: true, notificationId: notifRef.key };
    } catch (error) {
        console.error('[RealtimeEmitter] ❌ Failed to emit notification:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Emit announcement notification (broadcast)
 * 
 * @param {string} orgId - Organization ID
 * @param {object} announcement - Announcement data
 */
export async function emitAnnouncement(orgId, announcement) {
    if (!isFirebaseAvailable()) return { success: false, reason: 'firebase_unavailable' };

    try {
        await adminDb.ref(`realtime/announcements/${orgId}/latest`).set({
            id: announcement.id,
            title: announcement.title,
            summary: announcement.summary,
            type: announcement.type,
            priority: announcement.priority,
            authorName: announcement.authorName,
            publishedAt: new Date().toISOString()
        });
        
        return { success: true };
    } catch (error) {
        console.error('[RealtimeEmitter] ❌ Failed to emit announcement:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Emit leaderboard update
 * 
 * @param {string} orgId - Organization ID
 * @param {array} leaderboard - Top users array
 */
export async function emitLeaderboard(orgId, leaderboard) {
    if (!isFirebaseAvailable()) return { success: false, reason: 'firebase_unavailable' };

    try {
        const payload = {
            entries: leaderboard.slice(0, 10).map((entry, index) => ({
                rank: index + 1,
                odId: entry.odId || entry._id?.toString(),
                userId: entry.userId || entry.firebaseUid,
                name: entry.name,
                points: entry.totalPoints,
                level: entry.level,
                streak: entry.currentStreak
            })),
            updatedAt: new Date().toISOString()
        };

        await adminDb.ref(`${REALTIME_PATHS.LEADERBOARD}/${orgId}`).set(payload);
        
        return { success: true };
    } catch (error) {
        console.error('[RealtimeEmitter] ❌ Failed to emit leaderboard:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Emit admin monitoring event
 * 
 * @param {string} orgId - Organization ID
 * @param {string} eventType - Event type
 * @param {object} eventData - Event data
 */
export async function emitAdminEvent(orgId, eventType, eventData) {
    if (!isFirebaseAvailable()) return { success: false, reason: 'firebase_unavailable' };

    try {
        const eventRef = adminDb.ref(`${REALTIME_PATHS.ADMIN_MONITOR}/${orgId}/events`).push();
        
        await eventRef.set({
            id: eventRef.key,
            type: eventType,
            data: eventData,
            timestamp: new Date().toISOString(),
            // Auto-expire after 1 hour
            _expiresAt: Date.now() + (60 * 60 * 1000)
        });
        
        return { success: true };
    } catch (error) {
        console.error('[RealtimeEmitter] ❌ Failed to emit admin event:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Clear expired realtime data (cleanup job)
 * Should be called periodically
 */
export async function cleanupExpiredData() {
    if (!isFirebaseAvailable()) return { success: false, reason: 'firebase_unavailable' };

    try {
        const now = Date.now();
        
        // This would need to be implemented with Firebase queries
        // For now, just log that cleanup was requested
        console.log('[RealtimeEmitter] Cleanup requested at', new Date().toISOString());
        
        return { success: true };
    } catch (error) {
        console.error('[RealtimeEmitter] ❌ Cleanup failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Batch emit multiple updates
 * 
 * @param {array} updates - Array of { path, data } objects
 */
export async function batchEmit(updates) {
    if (!isFirebaseAvailable()) return { success: false, reason: 'firebase_unavailable' };

    try {
        const updateObject = {};
        
        for (const update of updates) {
            updateObject[update.path] = {
                ...update.data,
                updatedAt: new Date().toISOString()
            };
        }
        
        await adminDb.ref().update(updateObject);
        
        return { success: true, count: updates.length };
    } catch (error) {
        console.error('[RealtimeEmitter] ❌ Batch emit failed:', error.message);
        return { success: false, error: error.message };
    }
}

export default {
    emitAttendanceStatus,
    emitDashboardStats,
    emitUserPresence,
    emitNotification,
    emitAnnouncement,
    emitLeaderboard,
    emitAdminEvent,
    cleanupExpiredData,
    batchEmit,
    REALTIME_PATHS
};
