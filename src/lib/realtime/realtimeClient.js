// src/lib/realtime/realtimeClient.js
// Firebase Realtime Client - READ ONLY
// ✅ Frontend can ONLY READ from Firebase
// ❌ Frontend must NOT write to Firebase
// ❌ Frontend must NOT write to MongoDB
// ✅ All writes go through Backend API

import { browser } from '$app/environment';
import { db } from '$lib/firebase';
import { ref, onValue, off } from 'firebase/database';
import { writable, derived } from 'svelte/store';

/**
 * REALTIME PATHS (must match server realtimeEmitter.js)
 */
const REALTIME_PATHS = {
    ATTENDANCE_LIVE: 'realtime/attendance/live',
    DASHBOARD_STATS: 'realtime/dashboard/stats',
    USERS_ONLINE: 'realtime/users/online',
    NOTIFICATIONS: 'realtime/notifications',
    ANNOUNCEMENTS: 'realtime/announcements',
    LEADERBOARD: 'realtime/gamification/leaderboard'
};

// Stores for realtime data
export const liveAttendanceStatus = writable(null);
export const liveDashboardStats = writable(null);
export const liveNotifications = writable([]);
export const liveAnnouncement = writable(null);
export const liveLeaderboard = writable([]);
export const connectionStatus = writable({ connected: false, lastSync: null });

// Active listeners
const activeListeners = new Map();

/**
 * Subscribe to user's live attendance status
 * READ ONLY - No writes allowed
 */
export function subscribeToAttendanceStatus(userId, callback = null) {
    if (!browser || !db) return () => {};
    
    const listenerKey = `attendance_${userId}`;
    unsubscribeListener(listenerKey);
    
    const statusRef = ref(db, `${REALTIME_PATHS.ATTENDANCE_LIVE}/${userId}`);
    
    const unsubscribe = onValue(statusRef, (snapshot) => {
        const data = snapshot.exists() ? snapshot.val() : null;
        
        liveAttendanceStatus.set(data);
        connectionStatus.update(s => ({ ...s, connected: true, lastSync: new Date().toISOString() }));
        
        if (callback) callback(data);
    }, (error) => {
        console.error('[RealtimeClient] Attendance subscription error:', error);
        connectionStatus.update(s => ({ ...s, connected: false, error: error.message }));
    });
    
    activeListeners.set(listenerKey, statusRef);
    
    return () => unsubscribeListener(listenerKey);
}

/**
 * Subscribe to organization dashboard stats
 * READ ONLY - No writes allowed
 */
export function subscribeToDashboardStats(orgId, callback = null) {
    if (!browser || !db) return () => {};
    
    const listenerKey = `dashboard_${orgId}`;
    unsubscribeListener(listenerKey);
    
    const statsRef = ref(db, `${REALTIME_PATHS.DASHBOARD_STATS}/${orgId}`);
    
    const unsubscribe = onValue(statsRef, (snapshot) => {
        const data = snapshot.exists() ? snapshot.val() : {
            totalPresent: 0,
            totalAbsent: 0,
            totalLate: 0,
            totalOnLeave: 0,
            totalOnBreak: 0
        };
        
        liveDashboardStats.set(data);
        
        if (callback) callback(data);
    }, (error) => {
        console.error('[RealtimeClient] Dashboard stats subscription error:', error);
    });
    
    activeListeners.set(listenerKey, statsRef);
    
    return () => unsubscribeListener(listenerKey);
}

/**
 * Subscribe to user notifications
 * READ ONLY - No writes allowed
 */
export function subscribeToNotifications(userId, callback = null) {
    if (!browser || !db) return () => {};
    
    const listenerKey = `notifications_${userId}`;
    unsubscribeListener(listenerKey);
    
    const notifRef = ref(db, `${REALTIME_PATHS.NOTIFICATIONS}/${userId}`);
    
    let previousCount = 0;
    
    const unsubscribe = onValue(notifRef, (snapshot) => {
        const notifications = [];
        
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                notifications.push({ id: child.key, ...child.val() });
            });
        }
        
        // Sort by timestamp descending
        notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Check for new notifications
        if (notifications.length > previousCount && previousCount > 0) {
            const newNotifs = notifications.slice(0, notifications.length - previousCount);
            
            // Show browser notification for new items
            newNotifs.forEach(notif => {
                showBrowserNotification(notif.title, notif.message);
            });
            
            if (callback) callback(newNotifs);
        }
        
        previousCount = notifications.length;
        liveNotifications.set(notifications);
    }, (error) => {
        console.error('[RealtimeClient] Notifications subscription error:', error);
    });
    
    activeListeners.set(listenerKey, notifRef);
    
    return () => unsubscribeListener(listenerKey);
}

/**
 * Subscribe to latest announcement
 * READ ONLY - No writes allowed
 */
export function subscribeToAnnouncements(orgId, callback = null) {
    if (!browser || !db) return () => {};
    
    const listenerKey = `announcements_${orgId}`;
    unsubscribeListener(listenerKey);
    
    const announcementRef = ref(db, `${REALTIME_PATHS.ANNOUNCEMENTS}/${orgId}/latest`);
    
    const unsubscribe = onValue(announcementRef, (snapshot) => {
        const data = snapshot.exists() ? snapshot.val() : null;
        
        liveAnnouncement.set(data);
        
        if (callback && data) callback(data);
    }, (error) => {
        console.error('[RealtimeClient] Announcements subscription error:', error);
    });
    
    activeListeners.set(listenerKey, announcementRef);
    
    return () => unsubscribeListener(listenerKey);
}

/**
 * Subscribe to leaderboard
 * READ ONLY - No writes allowed
 */
export function subscribeToLeaderboard(orgId, callback = null) {
    if (!browser || !db) return () => {};
    
    const listenerKey = `leaderboard_${orgId}`;
    unsubscribeListener(listenerKey);
    
    const leaderboardRef = ref(db, `${REALTIME_PATHS.LEADERBOARD}/${orgId}`);
    
    const unsubscribe = onValue(leaderboardRef, (snapshot) => {
        const data = snapshot.exists() ? snapshot.val() : { entries: [] };
        
        liveLeaderboard.set(data.entries || []);
        
        if (callback) callback(data.entries || []);
    }, (error) => {
        console.error('[RealtimeClient] Leaderboard subscription error:', error);
    });
    
    activeListeners.set(listenerKey, leaderboardRef);
    
    return () => unsubscribeListener(listenerKey);
}

/**
 * Subscribe to online users count
 * READ ONLY - No writes allowed
 */
export function subscribeToOnlineUsers(orgId, callback = null) {
    if (!browser || !db) return () => {};
    
    const listenerKey = `online_${orgId}`;
    unsubscribeListener(listenerKey);
    
    const onlineRef = ref(db, REALTIME_PATHS.USERS_ONLINE);
    
    const unsubscribe = onValue(onlineRef, (snapshot) => {
        let onlineCount = 0;
        
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const userData = child.val();
                if (userData.online) onlineCount++;
            });
        }
        
        if (callback) callback(onlineCount);
    }, (error) => {
        console.error('[RealtimeClient] Online users subscription error:', error);
    });
    
    activeListeners.set(listenerKey, onlineRef);
    
    return () => unsubscribeListener(listenerKey);
}

/**
 * Unsubscribe from a specific listener
 */
function unsubscribeListener(listenerKey) {
    if (activeListeners.has(listenerKey)) {
        const refObj = activeListeners.get(listenerKey);
        off(refObj);
        activeListeners.delete(listenerKey);
    }
}

/**
 * Unsubscribe from all listeners
 */
export function unsubscribeAll() {
    activeListeners.forEach((refObj, key) => {
        off(refObj);
    });
    activeListeners.clear();
    
    // Reset stores
    liveAttendanceStatus.set(null);
    liveDashboardStats.set(null);
    liveNotifications.set([]);
    liveAnnouncement.set(null);
    liveLeaderboard.set([]);
    connectionStatus.set({ connected: false, lastSync: null });
}

/**
 * Show browser notification
 */
async function showBrowserNotification(title, body) {
    if (!browser || !('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.svg' });
    } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.svg' });
        }
    }
}

/**
 * Derived store for unread notification count
 */
export const unreadNotificationCount = derived(
    liveNotifications,
    $notifications => $notifications.filter(n => !n.read).length
);

/**
 * Derived store for current attendance status text
 */
export const attendanceStatusText = derived(
    liveAttendanceStatus,
    $status => {
        if (!$status) return 'Not checked in';
        
        switch ($status.status) {
            case 'checkedIn': return 'Checked In';
            case 'onBreak': return 'On Break';
            case 'checkedOut': return 'Checked Out';
            default: return 'Unknown';
        }
    }
);

export default {
    subscribeToAttendanceStatus,
    subscribeToDashboardStats,
    subscribeToNotifications,
    subscribeToAnnouncements,
    subscribeToLeaderboard,
    subscribeToOnlineUsers,
    unsubscribeAll,
    // Stores
    liveAttendanceStatus,
    liveDashboardStats,
    liveNotifications,
    liveAnnouncement,
    liveLeaderboard,
    connectionStatus,
    unreadNotificationCount,
    attendanceStatusText
};
