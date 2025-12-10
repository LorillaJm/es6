// Service Worker with Workbox - PWABuilder Compatible
// This service worker uses Workbox for caching strategies

importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

// Check if Workbox loaded
if (workbox) {
	console.log('[SW] Workbox loaded successfully');
} else {
	console.log('[SW] Workbox failed to load');
}

// Configure Workbox
workbox.setConfig({ debug: false });

// Precaching - cache app shell on install
workbox.precaching.precacheAndRoute([
	{ url: '/', revision: '1' },
	{ url: '/offline.html', revision: '1' },
	{ url: '/logo.png', revision: '1' },
	{ url: '/favicon.svg', revision: '1' },
	{ url: '/manifest.json', revision: '1' }
]);

// Cache strategies

// Cache First - for static assets (images, fonts)
workbox.routing.registerRoute(
	({ request }) => request.destination === 'image' || request.destination === 'font',
	new workbox.strategies.CacheFirst({
		cacheName: 'static-assets',
		plugins: [
			new workbox.expiration.ExpirationPlugin({
				maxEntries: 100,
				maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
			})
		]
	})
);

// Stale While Revalidate - for CSS and JS
workbox.routing.registerRoute(
	({ request }) => request.destination === 'style' || request.destination === 'script',
	new workbox.strategies.StaleWhileRevalidate({
		cacheName: 'static-resources',
		plugins: [
			new workbox.expiration.ExpirationPlugin({
				maxEntries: 50,
				maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
			})
		]
	})
);

// Network First - for pages (HTML)
workbox.routing.registerRoute(
	({ request }) => request.mode === 'navigate',
	new workbox.strategies.NetworkFirst({
		cacheName: 'pages',
		plugins: [
			new workbox.expiration.ExpirationPlugin({
				maxEntries: 50,
				maxAgeSeconds: 24 * 60 * 60 // 1 day
			})
		]
	})
);

// Network First - for API calls
workbox.routing.registerRoute(
	({ url }) => url.pathname.startsWith('/api/'),
	new workbox.strategies.NetworkFirst({
		cacheName: 'api-cache',
		plugins: [
			new workbox.expiration.ExpirationPlugin({
				maxEntries: 50,
				maxAgeSeconds: 5 * 60 // 5 minutes
			})
		]
	})
);

// Offline fallback
workbox.routing.setCatchHandler(async ({ event }) => {
	if (event.request.destination === 'document') {
		return workbox.precaching.matchPrecache('/offline.html');
	}
	return Response.error();
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
	// Sync logic here
}

// ============================================
// PERIODIC SYNC
// ============================================
self.addEventListener('periodicsync', (event) => {
	console.log('[SW] Periodic sync:', event.tag);

	if (event.tag === 'update-content') {
		event.waitUntil(updateContent());
	}
});

async function updateContent() {
	console.log('[SW] Updating content...');
	// Update logic here
}

// ============================================
// MESSAGE HANDLING
// ============================================
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});

// Skip waiting on install
self.addEventListener('install', () => {
	self.skipWaiting();
});

// Claim clients on activate
self.addEventListener('activate', (event) => {
	event.waitUntil(clients.claim());
});

console.log('[SW] Service Worker loaded');
