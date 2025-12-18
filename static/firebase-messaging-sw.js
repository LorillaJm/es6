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

// Handle background messages via FCM SDK
// This is called by FCM SDK for data-only messages when using firebase-messaging
messaging.onBackgroundMessage(async (payload) => {
    console.log('[FCM SW] onBackgroundMessage received:', JSON.stringify(payload));

    // Extract data from payload
    const data = payload.data || {};
    const notification = payload.notification || {};
    
    const isUrgent = data.priority === 'urgent' || 
                     data.type === 'emergency_alert' || 
                     data.priority === 'high';
    
    // Use data fields first, fall back to notification fields
    const notificationTitle = data.title || notification.title || 'New Notification';
    const notificationBody = data.body || notification.body || 'You have a new notification';
    
    const vibrationPattern = isUrgent ? VIBRATION_PATTERNS.urgent : VIBRATION_PATTERNS.default;
    
    console.log('[FCM SW] Creating notification:', notificationTitle);
    
    const notificationOptions = {
        body: notificationBody,
        icon: data.icon || '/logo.png',
        badge: data.badge || '/logo.png',
        vibrate: vibrationPattern,
        tag: `fcm-${data.timestamp || Date.now()}`,
        renotify: true,
        requireInteraction: isUrgent,
        silent: false,
        data: {
            url: data.url || data.click_action || '/app/announcements',
            soundType: isUrgent ? 'urgent' : 'default',
            priority: data.priority || 'normal',
            ...data
        },
        actions: [
            { action: 'open', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    // Show notification
    try {
        await self.registration.showNotification(notificationTitle, notificationOptions);
        console.log('[FCM SW] Notification shown via onBackgroundMessage');
        await playNotificationSound(isUrgent ? 'urgent' : 'default');
    } catch (err) {
        console.error('[FCM SW] Error showing notification:', err);
    }
});

// IMPORTANT: Handle raw push events for Android PWA background notifications
// This is the PRIMARY handler for data-only FCM messages
self.addEventListener('push', (event) => {
    console.log('[FCM SW] Push event received');
    
    if (!event.data) {
        console.log('[FCM SW] No data in push event');
        return;
    }

    let payload;
    try {
        payload = event.data.json();
        console.log('[FCM SW] Push payload:', JSON.stringify(payload));
    } catch (e) {
        console.log('[FCM SW] Could not parse push data as JSON:', e);
        return;
    }

    // Check if this is a data-only message (our format for background notifications)
    // Data-only messages have 'data' field but no 'notification' field at top level
    const data = payload.data || payload;
    
    // If there's a top-level notification field, FCM SDK handles it
    // But we still want to ensure it shows, so we'll handle it anyway
    if (payload.notification && !data.showNotification) {
        console.log('[FCM SW] Has notification payload, FCM SDK should handle');
        // Don't return - let's show it anyway as backup
    }

    // Extract notification data
    const title = data.title || payload.notification?.title || 'New Notification';
    const body = data.body || payload.notification?.body || 'You have a new notification';
    const isUrgent = data.priority === 'urgent' || data.priority === 'high';
    
    console.log('[FCM SW] Showing notification:', title, body);
    
    const notificationOptions = {
        body: body,
        icon: data.icon || '/logo.png',
        badge: data.badge || '/logo.png',
        vibrate: isUrgent ? VIBRATION_PATTERNS.urgent : VIBRATION_PATTERNS.default,
        tag: `push-${data.timestamp || Date.now()}`,
        renotify: true,
        requireInteraction: isUrgent,
        silent: false,
        data: {
            url: data.url || data.click_action || '/app/announcements',
            type: data.type || 'general',
            priority: data.priority || 'normal',
            ...data
        },
        actions: [
            { action: 'open', title: 'View' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(title, notificationOptions)
            .then(() => {
                console.log('[FCM SW] Notification shown successfully');
                return playNotificationSound(isUrgent ? 'urgent' : 'default');
            })
            .catch(err => {
                console.error('[FCM SW] Failed to show notification:', err);
            })
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
