// Notifications utility for managing user alerts
import { browser } from '$app/environment';

/**
 * Notification types
 */
export const NotificationType = {
    ABSENCE: 'absence',
    LATE: 'late',
    SCHEDULE: 'schedule',
    DEVICE: 'device',
    GENERAL: 'general'
};

/**
 * Send a notification to a user (via API)
 * @param {string} userId - User ID to send notification to
 * @param {object} notification - Notification data
 */
export async function sendNotification(userId, { type, title, message }) {
    if (!browser) return null;
    
    try {
        const response = await fetch(`/api/notifications/${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: type || NotificationType.GENERAL,
                title,
                message
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.id || null;
        }
        return null;
    } catch (error) {
        console.warn('Error sending notification:', error.message);
        return null;
    }
}

/**
 * Get user's notifications (via API)
 * @param {string} userId - User ID
 * @param {number} limit - Max notifications to fetch
 */
export async function getNotifications(userId, limit = 20) {
    if (!browser) return [];
    
    try {
        const response = await fetch(`/api/notifications/${userId}?limit=${limit}`);
        if (response.ok) {
            const data = await response.json();
            return data.notifications || [];
        }
        return [];
    } catch (error) {
        console.warn('Error fetching notifications:', error.message);
        return [];
    }
}

/**
 * Mark notification as read (via API)
 * @param {string} userId - User ID
 * @param {string} notificationId - Notification ID
 */
export async function markAsRead(userId, notificationId) {
    if (!browser) return false;
    
    try {
        const response = await fetch(`/api/notifications/${userId}/${notificationId}/read`, {
            method: 'POST'
        });
        return response.ok;
    } catch (error) {
        console.warn('Error marking notification as read:', error.message);
        return false;
    }
}

/**
 * Mark all notifications as read (via API)
 * @param {string} userId - User ID
 */
export async function markAllAsRead(userId) {
    if (!browser) return false;
    
    try {
        const response = await fetch(`/api/notifications/${userId}/read-all`, {
            method: 'POST'
        });
        return response.ok;
    } catch (error) {
        console.warn('Error marking all as read:', error.message);
        return false;
    }
}

/**
 * Get unread notification count (via API)
 * @param {string} userId - User ID
 */
export async function getUnreadCount(userId) {
    if (!browser) return 0;
    
    try {
        const response = await fetch(`/api/notifications/${userId}/unread-count`);
        if (response.ok) {
            const data = await response.json();
            return data.count || 0;
        }
        return 0;
    } catch (error) {
        console.warn('Error getting unread count:', error.message);
        return 0;
    }
}

/**
 * Delete a notification (via API)
 * @param {string} userId - User ID
 * @param {string} notificationId - Notification ID
 */
export async function deleteNotification(userId, notificationId) {
    if (!browser) return false;
    
    try {
        const response = await fetch(`/api/notifications/${userId}/${notificationId}`, {
            method: 'DELETE'
        });
        return response.ok;
    } catch (error) {
        console.warn('Error deleting notification:', error.message);
        return false;
    }
}

/**
 * Clear all notifications for a user (via API)
 * @param {string} userId - User ID
 */
export async function clearAllNotifications(userId) {
    if (!browser) return false;
    
    try {
        const response = await fetch(`/api/notifications/${userId}`, {
            method: 'DELETE'
        });
        return response.ok;
    } catch (error) {
        console.warn('Error clearing notifications:', error.message);
        return false;
    }
}

// Pre-defined notification templates
export const NotificationTemplates = {
    absence: (date) => ({
        type: NotificationType.ABSENCE,
        title: 'Absence Recorded',
        message: `You were marked absent on ${date}. Contact your instructor if this is incorrect.`
    }),
    late: (minutes) => ({
        type: NotificationType.LATE,
        title: 'Late Check-in',
        message: `You checked in ${minutes} minutes late today. Try to arrive on time.`
    }),
    scheduleChange: (details) => ({
        type: NotificationType.SCHEDULE,
        title: 'Schedule Update',
        message: details
    }),
    newDevice: (deviceInfo) => ({
        type: NotificationType.DEVICE,
        title: 'New Device Login',
        message: `Your account was accessed from a new device: ${deviceInfo}`
    })
};
