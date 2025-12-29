// src/lib/realtime/liveSyncEngine.js
// Live Sync Engine: Real-time attendance updates using Firebase
import { browser } from '$app/environment';
import { db } from '$lib/firebase';
import { ref, onValue, off, query, orderByChild, equalTo, limitToLast } from 'firebase/database';
import { writable, derived } from 'svelte/store';

/**
 * Live sync stores for real-time data
 */
export const liveAttendance = writable([]);
export const liveStatus = writable({ connected: false, lastSync: null });
export const liveNotifications = writable([]);

// Active listeners map
const activeListeners = new Map();

/**
 * Subscribe to real-time attendance updates for a user
 * @param {string} userId - User ID
 * @param {Function} callback - Callback for updates
 * @returns {Function} Unsubscribe function
 */
export function subscribeToUserAttendance(userId, callback = null) {
    if (!browser || !db) return () => {};
    
    const listenerKey = `attendance_${userId}`;
    
    // Remove existing listener if any
    if (activeListeners.has(listenerKey)) {
        const existingRef = activeListeners.get(listenerKey);
        off(existingRef);
    }
    
    const attendanceRef = ref(db, `realtime/attendance/live/${userId}`);
    const attendanceQuery = query(attendanceRef, limitToLast(50));
    
    const unsubscribe = onValue(attendanceQuery, (snapshot) => {
        const data = [];
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                data.push({ id: child.key, ...child.val() });
            });
        }
        
        // Sort by date descending
        data.sort((a, b) => new Date(b.checkIn?.timestamp || 0) - new Date(a.checkIn?.timestamp || 0));
        
        liveAttendance.set(data);
        liveStatus.update(s => ({ ...s, lastSync: new Date().toISOString() }));
        
        if (callback) callback(data);
    }, (error) => {
        console.error('Attendance subscription error:', error);
        liveStatus.update(s => ({ ...s, connected: false, error: error.message }));
    });
    
    activeListeners.set(listenerKey, attendanceRef);
    liveStatus.update(s => ({ ...s, connected: true }));
    
    return () => {
        off(attendanceRef);
        activeListeners.delete(listenerKey);
    };
}

/**
 * Subscribe to today's attendance for a user
 * @param {string} userId - User ID
 * @param {Function} callback - Callback for updates
 * @returns {Function} Unsubscribe function
 */
export function subscribeToTodayAttendance(userId, callback = null) {
    if (!browser || !db) return () => {};
    
    const listenerKey = `today_${userId}`;
    const today = new Date().toDateString();
    
    if (activeListeners.has(listenerKey)) {
        const existingRef = activeListeners.get(listenerKey);
        off(existingRef);
    }
    
    const attendanceRef = ref(db, `realtime/attendance/live/${userId}`);
    const todayQuery = query(attendanceRef, orderByChild('date'), equalTo(today));
    
    const unsubscribe = onValue(todayQuery, (snapshot) => {
        let todayData = null;
        
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const shift = child.val();
                if (shift.currentStatus !== 'checkedOut') {
                    todayData = { id: child.key, ...shift };
                }
            });
        }
        
        if (callback) callback(todayData);
    }, (error) => {
        console.error('Today attendance subscription error:', error);
    });
    
    activeListeners.set(listenerKey, attendanceRef);
    
    return () => {
        off(attendanceRef);
        activeListeners.delete(listenerKey);
    };
}

/**
 * Subscribe to real-time notifications
 * @param {string} userId - User ID
 * @param {Function} callback - Callback for new notifications
 * @returns {Function} Unsubscribe function
 */
export function subscribeToNotifications(userId, callback = null) {
    if (!browser || !db) return () => {};
    
    const listenerKey = `notifications_${userId}`;
    
    if (activeListeners.has(listenerKey)) {
        const existingRef = activeListeners.get(listenerKey);
        off(existingRef);
    }
    
    const notifRef = ref(db, `realtime/notifications/${userId}`);
    const notifQuery = query(notifRef, limitToLast(20));
    
    let previousCount = 0;
    
    const unsubscribe = onValue(notifQuery, (snapshot) => {
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
            if (callback) callback(newNotifs);
            
            // Trigger browser notification if permitted
            newNotifs.forEach(notif => {
                showBrowserNotification(notif.title, notif.message);
            });
        }
        
        previousCount = notifications.length;
        liveNotifications.set(notifications);
    });
    
    activeListeners.set(listenerKey, notifRef);
    
    return () => {
        off(notifRef);
        activeListeners.delete(listenerKey);
    };
}

/**
 * Subscribe to department/team attendance (for admins)
 * @param {string} departmentId - Department ID
 * @param {Function} callback - Callback for updates
 * @returns {Function} Unsubscribe function
 */
export function subscribeToDepartmentAttendance(departmentId, callback = null) {
    if (!browser || !db) return () => {};
    
    const listenerKey = `department_${departmentId}`;
    
    if (activeListeners.has(listenerKey)) {
        const existingRef = activeListeners.get(listenerKey);
        off(existingRef);
    }
    
    const deptRef = ref(db, `department_attendance/${departmentId}`);
    
    const unsubscribe = onValue(deptRef, (snapshot) => {
        const data = snapshot.exists() ? snapshot.val() : {};
        if (callback) callback(data);
    });
    
    activeListeners.set(listenerKey, deptRef);
    
    return () => {
        off(deptRef);
        activeListeners.delete(listenerKey);
    };
}

/**
 * Subscribe to gamification updates
 * @param {string} userId - User ID
 * @param {Function} callback - Callback for updates
 * @returns {Function} Unsubscribe function
 */
export function subscribeToGamification(userId, callback = null) {
    if (!browser || !db) return () => {};
    
    const listenerKey = `gamification_${userId}`;
    
    if (activeListeners.has(listenerKey)) {
        const existingRef = activeListeners.get(listenerKey);
        off(existingRef);
    }
    
    const gamifRef = ref(db, `realtime/gamification/leaderboard/${userId}`);
    
    const unsubscribe = onValue(gamifRef, (snapshot) => {
        const data = snapshot.exists() ? snapshot.val() : null;
        if (callback) callback(data);
    });
    
    activeListeners.set(listenerKey, gamifRef);
    
    return () => {
        off(gamifRef);
        activeListeners.delete(listenerKey);
    };
}

/**
 * Subscribe to leaderboard updates
 * @param {number} limit - Number of top users
 * @param {Function} callback - Callback for updates
 * @returns {Function} Unsubscribe function
 */
export function subscribeToLeaderboard(limit = 10, callback = null) {
    if (!browser || !db) return () => {};
    
    const listenerKey = 'leaderboard';
    
    if (activeListeners.has(listenerKey)) {
        const existingRef = activeListeners.get(listenerKey);
        off(existingRef);
    }
    
    const gamifRef = ref(db, `realtime/gamification/leaderboard`);
    
    const unsubscribe = onValue(gamifRef, async (snapshot) => {
        if (!snapshot.exists()) {
            if (callback) callback([]);
            return;
        }
        
        const gamification = snapshot.val();
        
        // Get user data for names
        const usersRef = ref(db, 'users');
        const usersSnapshot = await new Promise(resolve => {
            onValue(usersRef, resolve, { onlyOnce: true });
        });
        
        const users = usersSnapshot.exists() ? usersSnapshot.val() : {};
        
        const leaderboard = Object.keys(gamification)
            .map(userId => ({
                id: userId,
                name: users[userId]?.name || 'Unknown',
                profilePhoto: users[userId]?.profilePhoto || null,
                points: gamification[userId]?.points || 0,
                currentStreak: gamification[userId]?.currentStreak || 0,
                badges: gamification[userId]?.badges || []
            }))
            .sort((a, b) => b.points - a.points)
            .slice(0, limit);
        
        if (callback) callback(leaderboard);
    });
    
    activeListeners.set(listenerKey, gamifRef);
    
    return () => {
        off(gamifRef);
        activeListeners.delete(listenerKey);
    };
}

/**
 * Show browser notification
 * @param {string} title - Notification title
 * @param {string} body - Notification body
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
 * Unsubscribe from all active listeners
 */
export function unsubscribeAll() {
    activeListeners.forEach((refObj, key) => {
        off(refObj);
    });
    activeListeners.clear();
    liveStatus.set({ connected: false, lastSync: null });
}

/**
 * Get connection status
 * @returns {boolean} Whether connected to Firebase
 */
export function isConnected() {
    let connected = false;
    liveStatus.subscribe(s => connected = s.connected)();
    return connected;
}

/**
 * Derived store for unread notification count
 */
export const unreadNotificationCount = derived(
    liveNotifications,
    $notifications => $notifications.filter(n => !n.read).length
);

/**
 * Derived store for today's status
 */
export const todayStatus = derived(
    liveAttendance,
    $attendance => {
        const today = new Date().toDateString();
        const todayRecord = $attendance.find(a => a.date === today);
        return todayRecord?.currentStatus || 'none';
    }
);
