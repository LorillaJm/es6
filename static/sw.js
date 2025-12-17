// Service Worker - PWABuilder + Custom Features
// Offline page + Offline copy of pages + Push Notifications + Background Sync + FCM

const CACHE = "pwabuilder-offline-page";

importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

// Import Firebase messaging for background push
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize Firebase in service worker (for background messages)
firebase.initializeApp({
	apiKey: "AIzaSyDv2QU8otJoD5Y34CacDX5YjMuge_lbcts",
	authDomain: "ednelback.firebaseapp.com",
	projectId: "ednelback",
	storageBucket: "ednelback.firebasestorage.app",
	messagingSenderId: "382560726698",
	appId: "1:382560726698:web:86de9c648f53f87c9eead3"
});

const messaging = firebase.messaging();

// Handle background FCM messages (when app is closed)
messaging.onBackgroundMessage((payload) => {
	console.log('[SW] Background FCM message received:', payload);

	const notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
	const notificationOptions = {
		body: payload.notification?.body || payload.data?.body || 'You have a new notification',
		icon: payload.notification?.icon || '/logo.png',
		badge: '/logo.png',
		vibrate: [200, 100, 200],
		tag: payload.data?.type || 'fcm-notification',
		renotify: true,
		data: {
			url: payload.data?.url || '/app/dashboard',
			...payload.data
		},
		actions: [
			{ action: 'open', title: 'Open' },
			{ action: 'dismiss', title: 'Dismiss' }
		]
	};

	return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Offline fallback page
const offlineFallbackPage = "offline.html";

self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "SKIP_WAITING") {
		self.skipWaiting();
	}
});

self.addEventListener('install', async (event) => {
	event.waitUntil(
		caches.open(CACHE)
			.then((cache) => cache.add(offlineFallbackPage))
	);
});

if (workbox.navigationPreload.isSupported()) {
	workbox.navigationPreload.enable();
}

workbox.routing.registerRoute(
	new RegExp('/*'),
	new workbox.strategies.StaleWhileRevalidate({
		cacheName: CACHE
	})
);

self.addEventListener('fetch', (event) => {
	if (event.request.mode === 'navigate') {
		event.respondWith((async () => {
			try {
				const preloadResp = await event.preloadResponse;

				if (preloadResp) {
					return preloadResp;
				}

				const networkResp = await fetch(event.request);
				return networkResp;
			} catch (error) {
				const cache = await caches.open(CACHE);
				const cachedResp = await cache.match(offlineFallbackPage);
				return cachedResp;
			}
		})());
	}
});

// ============================================
// PUSH NOTIFICATIONS
// ============================================
self.addEventListener('push', (event) => {
	console.log('[SW] Push received');

	let data = {
		title: 'Attendance System',
		body: 'You have a new notification',
		icon: '/logo.png',
		badge: '/logo.png',
		tag: 'default'
	};

	if (event.data) {
		try {
			data = { ...data, ...event.data.json() };
		} catch (e) {
			data.body = event.data.text();
		}
	}

	const options = {
		body: data.body,
		icon: data.icon || '/logo.png',
		badge: data.badge || '/logo.png',
		vibrate: [200, 100, 200],
		tag: data.tag || 'default',
		renotify: true,
		data: {
			url: data.url || '/app/dashboard'
		},
		actions: [
			{ action: 'open', title: 'Open App' },
			{ action: 'dismiss', title: 'Dismiss' }
		]
	};

	event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
	event.notification.close();

	if (event.action === 'dismiss') return;

	const urlToOpen = event.notification.data?.url || '/app/dashboard';

	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			for (const client of clientList) {
				if (client.url.includes(self.location.origin) && 'focus' in client) {
					client.focus();
					client.navigate(urlToOpen);
					return;
				}
			}
			if (clients.openWindow) {
				return clients.openWindow(urlToOpen);
			}
		})
	);
});

// ============================================
// BACKGROUND SYNC
// ============================================
self.addEventListener('sync', (event) => {
	console.log('[SW] Background sync:', event.tag);
	if (event.tag === 'sync-attendance') {
		event.waitUntil(syncData());
	}
});

async function syncData() {
	console.log('[SW] Syncing data...');
}

// ============================================
// PERIODIC SYNC
// ============================================
self.addEventListener('periodicsync', (event) => {
	console.log('[SW] Periodic sync:', event.tag);
});

// Activate - claim clients
self.addEventListener('activate', (event) => {
	event.waitUntil(clients.claim());
});

console.log('[SW] Service Worker loaded');
