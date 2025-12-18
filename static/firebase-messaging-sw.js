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
// This is called by FCM SDK when a data-only message is received
messaging.onBackgroundMessage(async (payload) => {
    console.log('[FCM SW] onBackgroundMessage received:', payload);

    // If notification payload exists, FCM SDK will auto-show it
    // We only need to handle data-only messages here
    if (payload.notification) {
        console.log('[FCM SW] Notification payload present, FCM will auto-display');
        // Play sound for any open windows
        const isUrgent = payload.data?.priority === 'urgent' || payload.data?.priority === 'high';
        await playNotificationSound(isUrgent ? 'urgent' : 'default');
        return;
    }

    // Handle data-only messages
    const data = payload.data || {};
    
    const isUrgent = data.priority === 'urgent' || 
                     data.type === 'emergency_alert' || 
                     data.priority === 'high';
    
    const notificationTitle = data.title || 'New Notification';
    const notificationBody = data.body || 'You have a new notification';
    
    const vibrationPattern = isUrgent ? VIBRATION_PATTERNS.urgent : VIBRATION_PATTERNS.default;
    
    const notificationOptions = {
        body: notificationBody,
        icon: '/logo.png',
        badge: '/logo.png',
        vibrate: vibrationPattern,
        tag: `fcm-${Date.now()}`,
        renotify: true,
        requireInteraction: isUrgent,
        silent: false,
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

    await playNotificationSound(isUrgent ? 'urgent' : 'default');
    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// IMPORTANT: Also handle raw push events for maximum compatibility
// This catches notifications that might not go through FCM's onBackgroundMessage
self.addEventListener('push', (event) => {
    console.log('[FCM SW] Push event received:', event);
    
    if (!event.data) {
        console.log('[FCM SW] No data in push event');
        return;
    }

    let payload;
    try {
        payload = event.data.json();
    } catch (e) {
        console.log('[FCM SW] Could not parse push data as JSON');
        return;
    }

    console.log('[FCM SW] Push payload:', payload);

    // If this is an FCM message with notification, let FCM handle it
    // FCM messages have a specific structure
    if (payload.notification || payload.fcmMessageId) {
        console.log('[FCM SW] FCM message detected, letting FCM SDK handle it');
        return;
    }

    // Handle non-FCM push messages (e.g., from Web Push directly)
    const data = payload.data || payload;
    const isUrgent = data.priority === 'urgent' || data.priority === 'high';
    
    const notificationOptions = {
        body: data.body || 'You have a new notification',
        icon: '/logo.png',
        badge: '/logo.png',
        vibrate: isUrgent ? VIBRATION_PATTERNS.urgent : VIBRATION_PATTERNS.default,
        tag: `push-${Date.now()}`,
        renotify: true,
        data: {
            url: data.url || '/app/announcements',
            ...data
        }
    };

    event.waitUntil(
        Promise.all([
            playNotificationSound(isUrgent ? 'urgent' : 'default'),
            self.registration.showNotification(data.title || 'New Notification', notificationOptions)
        ])
    );
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

// Service worker install event
self.addEventListener('install', (event) => {
    console.log('[FCM SW] Installing...');
    self.skipWaiting(); // Activate immediately
});

// Service worker activate event
self.addEventListener('activate', (event) => {
    console.log('[FCM SW] Activated');
    event.waitUntil(clients.claim()); // Take control of all pages immediately
});

console.log('[FCM SW] Firebase Messaging Service Worker loaded with sound support');
