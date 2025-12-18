// Firebase Cloud Messaging Service Worker
// This file MUST be named firebase-messaging-sw.js and be in the root
// Handles BACKGROUND push notifications when app is closed

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize Firebase
firebase.initializeApp({
    apiKey: "AIzaSyDv2QU8otJoD5Y34CacDX5YjMuge_lbcts",
    authDomain: "ednelback.firebaseapp.com",
    projectId: "ednelback",
    storageBucket: "ednelback.firebasestorage.app",
    messagingSenderId: "382560726698",
    appId: "1:382560726698:web:86de9c648f53f87c9eead3"
});

const messaging = firebase.messaging();

// Sound file paths (relative to static folder)
const NOTIFICATION_SOUNDS = {
    default: '/sounds/notification.mp3',
    urgent: '/sounds/notification-urgent.mp3'
};

// Vibration patterns for different priorities
const VIBRATION_PATTERNS = {
    default: [200, 100, 200],
    urgent: [300, 100, 300, 100, 300, 100, 300],
    gentle: [100, 50, 100]
};

/**
 * Play notification sound in service worker context
 * Note: Service workers can't directly play audio, but we can use the Clients API
 * to communicate with any open windows to play sound
 */
async function playNotificationSound(soundType = 'default') {
    try {
        const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        
        // If app is open in any window, tell it to play sound
        if (allClients.length > 0) {
            allClients.forEach(client => {
                client.postMessage({
                    type: 'PLAY_NOTIFICATION_SOUND',
                    soundType: soundType,
                    soundUrl: NOTIFICATION_SOUNDS[soundType] || NOTIFICATION_SOUNDS.default
                });
            });
        }
        // If no windows open, the notification itself will alert the user
        // The OS handles the default notification sound
    } catch (error) {
        console.warn('[FCM SW] Could not play sound:', error);
    }
}

// Handle background messages (when app is closed or in background)
messaging.onBackgroundMessage(async (payload) => {
    console.log('[FCM SW] Background message received:', payload);

    const data = payload.data || {};
    const notification = payload.notification || {};
    
    // Determine if this is urgent/emergency
    const isUrgent = data.priority === 'urgent' || 
                     data.type === 'emergency_alert' || 
                     data.priority === 'high';
    
    const notificationTitle = notification.title || data.title || 'New Notification';
    const notificationBody = notification.body || data.body || 'You have a new notification';
    
    // Select vibration pattern based on priority
    const vibrationPattern = isUrgent ? VIBRATION_PATTERNS.urgent : VIBRATION_PATTERNS.default;
    
    const notificationOptions = {
        body: notificationBody,
        icon: '/logo.png',
        badge: '/logo.png',
        vibrate: vibrationPattern,
        tag: data.type || 'fcm-notification',
        renotify: true,
        requireInteraction: isUrgent, // Keep urgent notifications visible until user interacts
        silent: false, // Allow system sound
        data: {
            url: data.url || '/app/announcements',
            soundType: isUrgent ? 'urgent' : 'default',
            priority: data.priority || 'normal',
            ...data
        },
        actions: [
            { action: 'open', title: '📖 View' },
            { action: 'dismiss', title: '✕ Dismiss' }
        ]
    };

    // Play custom sound via client windows (if any are open)
    await playNotificationSound(isUrgent ? 'urgent' : 'default');

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[FCM SW] Notification clicked:', event);
    event.notification.close();

    if (event.action === 'dismiss') return;

    const urlToOpen = event.notification.data?.url || '/app/announcements';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if app is already open
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    return client.navigate(urlToOpen);
                }
            }
            // Open new window if app not open
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Handle messages from main app (for sound coordination)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('[FCM SW] Firebase Messaging Service Worker loaded with sound support');
