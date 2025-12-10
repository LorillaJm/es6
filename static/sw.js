// Service Worker v2.0 - Full PWA Support
// Features: Caching, Offline Support, Push Notifications, Background Sync, Periodic Sync

const CACHE_VERSION = 'v2.0.0';
const CACHE_NAME = `attendance-app-${CACHE_VERSION}`;
const RUNTIME_CACHE = `attendance-runtime-${CACHE_VERSION}`;

// Assets to cache on install (App Shell)
const PRECACHE_ASSETS = [
	'/',
	'/offline.html',
	'/app/dashboard',
	'/app/attendance',
	'/app/analytics',
	'/app/profile',
	'/logo.png',
	'/favicon.svg',
	'/manifest.json'
];

// Offline fallback page
const OFFLINE_PAGE = '/offline.html';

// Cache strategies
const CACHE_STRATEGIES = {
	// Cache first, then network (for static assets)
	cacheFirst: ['logo.png', 'favicon', '.woff', '.woff2', '.ttf'],
	// Network first, then cache (for API and dynamic content)
	networkFirst: ['/api/', 'firebase'],
	// Stale while revalidate (for pages)
	staleWhileRevalidate: ['/app/']
};

// ============================================
// INSTALL EVENT - Cache App Shell
// ============================================
self.addEventListener('install', (event) => {
	console.log('[SW] Installing Service Worker:', CACHE_VERSION);

	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => {
				console.log('[SW] Caching app shell');
				return cache.addAll(PRECACHE_ASSETS).catch((err) => {
					console.warn('[SW] Some assets failed to cache:', err);
					// Continue even if some assets fail
					return Promise.resolve();
				});
			})
			.then(() => {
				console.log('[SW] App shell cached successfully');
				return self.skipWaiting();
			})
	);
});

// ============================================
// ACTIVATE EVENT - Clean Old Caches
// ============================================
self.addEventListener('activate', (event) => {
	console.log('[SW] Activating Service Worker:', CACHE_VERSION);

	event.waitUntil(
		caches
			.keys()
			.then((cacheNames) => {
				return Promise.all(
					cacheNames
						.filter((cacheName) => {
							// Delete old caches
							return cacheName.startsWith('attendance-') && cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
						})
						.map((cacheName) => {
							console.log('[SW] Deleting old cache:', cacheName);
							return caches.delete(cacheName);
						})
				);
			})
			.then(() => {
				console.log('[SW] Claiming clients');
				return self.clients.claim();
			})
	);
});


// ============================================
// FETCH EVENT - Handle Network Requests
// ============================================
self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Skip non-GET requests
	if (request.method !== 'GET') {
		return;
	}

	// Skip chrome-extension and other non-http(s) requests
	if (!url.protocol.startsWith('http')) {
		return;
	}

	// Skip cross-origin requests (except for specific APIs)
	if (url.origin !== self.location.origin) {
		// Allow Firebase and other trusted origins
		if (!url.hostname.includes('firebase') && !url.hostname.includes('googleapis')) {
			return;
		}
	}

	// Determine cache strategy based on URL
	const strategy = getCacheStrategy(url.pathname);

	event.respondWith(handleFetch(request, strategy));
});

// Get appropriate cache strategy for URL
function getCacheStrategy(pathname) {
	// Cache first for static assets
	if (CACHE_STRATEGIES.cacheFirst.some((pattern) => pathname.includes(pattern))) {
		return 'cacheFirst';
	}

	// Network first for API calls
	if (CACHE_STRATEGIES.networkFirst.some((pattern) => pathname.includes(pattern))) {
		return 'networkFirst';
	}

	// Stale while revalidate for app pages
	if (CACHE_STRATEGIES.staleWhileRevalidate.some((pattern) => pathname.includes(pattern))) {
		return 'staleWhileRevalidate';
	}

	// Default: network first
	return 'networkFirst';
}

// Handle fetch with appropriate strategy
async function handleFetch(request, strategy) {
	switch (strategy) {
		case 'cacheFirst':
			return cacheFirst(request);
		case 'networkFirst':
			return networkFirst(request);
		case 'staleWhileRevalidate':
			return staleWhileRevalidate(request);
		default:
			return networkFirst(request);
	}
}

// Cache First Strategy
async function cacheFirst(request) {
	const cachedResponse = await caches.match(request);
	if (cachedResponse) {
		return cachedResponse;
	}

	try {
		const networkResponse = await fetch(request);
		if (networkResponse.ok) {
			const cache = await caches.open(RUNTIME_CACHE);
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch (error) {
		return getOfflineFallback(request);
	}
}

// Network First Strategy
async function networkFirst(request) {
	try {
		const networkResponse = await fetch(request);
		if (networkResponse.ok) {
			const cache = await caches.open(RUNTIME_CACHE);
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch (error) {
		const cachedResponse = await caches.match(request);
		if (cachedResponse) {
			return cachedResponse;
		}
		return getOfflineFallback(request);
	}
}

// Stale While Revalidate Strategy
async function staleWhileRevalidate(request) {
	const cache = await caches.open(RUNTIME_CACHE);
	const cachedResponse = await caches.match(request);

	const fetchPromise = fetch(request)
		.then((networkResponse) => {
			if (networkResponse.ok) {
				cache.put(request, networkResponse.clone());
			}
			return networkResponse;
		})
		.catch(() => cachedResponse);

	return cachedResponse || fetchPromise;
}

// Offline fallback
async function getOfflineFallback(request) {
	const url = new URL(request.url);

	// For navigation requests, return offline page
	if (request.mode === 'navigate') {
		const offlinePage = await caches.match(OFFLINE_PAGE);
		if (offlinePage) {
			return offlinePage;
		}
		// Fallback to cached index
		const cachedIndex = await caches.match('/');
		if (cachedIndex) {
			return cachedIndex;
		}
	}

	// Return offline page or error response
	return new Response(
		JSON.stringify({
			error: 'offline',
			message: 'You are currently offline. Please check your connection.'
		}),
		{
			status: 503,
			statusText: 'Service Unavailable',
			headers: { 'Content-Type': 'application/json' }
		}
	);
}


// ============================================
// PUSH NOTIFICATIONS
// ============================================
self.addEventListener('push', (event) => {
	console.log('[SW] Push received:', event);

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
		vibrate: data.vibrate || [200, 100, 200],
		tag: data.tag || 'default',
		renotify: true,
		requireInteraction: data.requireInteraction || false,
		data: {
			url: data.url || '/',
			...data.data
		},
		actions: data.actions || [
			{ action: 'open', title: 'Open App' },
			{ action: 'dismiss', title: 'Dismiss' }
		]
	};

	event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
	console.log('[SW] Notification clicked:', event.action);
	event.notification.close();

	if (event.action === 'dismiss') {
		return;
	}

	const urlToOpen = event.notification.data?.url || '/app/dashboard';

	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			// Focus existing window if available
			for (const client of clientList) {
				if (client.url.includes(self.location.origin) && 'focus' in client) {
					client.focus();
					if (urlToOpen !== '/') {
						client.navigate(urlToOpen);
					}
					return;
				}
			}
			// Open new window
			if (clients.openWindow) {
				return clients.openWindow(urlToOpen);
			}
		})
	);
});

// Notification close handler
self.addEventListener('notificationclose', (event) => {
	console.log('[SW] Notification closed');
});

// ============================================
// BACKGROUND SYNC
// ============================================
self.addEventListener('sync', (event) => {
	console.log('[SW] Background sync:', event.tag);

	if (event.tag === 'sync-attendance') {
		event.waitUntil(syncAttendanceData());
	}

	if (event.tag === 'sync-offline-actions') {
		event.waitUntil(syncOfflineActions());
	}
});

// Sync attendance data when back online
async function syncAttendanceData() {
	try {
		// Get pending attendance records from IndexedDB
		const pendingRecords = await getPendingRecords();

		for (const record of pendingRecords) {
			try {
				const response = await fetch('/api/attendance/sync', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(record)
				});

				if (response.ok) {
					await removePendingRecord(record.id);
				}
			} catch (error) {
				console.error('[SW] Failed to sync record:', error);
			}
		}

		// Notify user
		await self.registration.showNotification('Sync Complete', {
			body: 'Your attendance data has been synced.',
			icon: '/logo.png',
			badge: '/logo.png',
			tag: 'sync-complete'
		});
	} catch (error) {
		console.error('[SW] Sync failed:', error);
	}
}

// Sync offline actions
async function syncOfflineActions() {
	try {
		const actions = await getOfflineActions();

		for (const action of actions) {
			try {
				await fetch(action.url, {
					method: action.method,
					headers: action.headers,
					body: action.body
				});
				await removeOfflineAction(action.id);
			} catch (error) {
				console.error('[SW] Failed to sync action:', error);
			}
		}
	} catch (error) {
		console.error('[SW] Offline sync failed:', error);
	}
}

// IndexedDB helpers (simplified)
async function getPendingRecords() {
	// This would connect to IndexedDB in a real implementation
	return [];
}

async function removePendingRecord(id) {
	// Remove from IndexedDB
}

async function getOfflineActions() {
	return [];
}

async function removeOfflineAction(id) {
	// Remove from IndexedDB
}


// ============================================
// PERIODIC BACKGROUND SYNC
// ============================================
self.addEventListener('periodicsync', (event) => {
	console.log('[SW] Periodic sync:', event.tag);

	if (event.tag === 'check-attendance-reminder') {
		event.waitUntil(checkAttendanceReminder());
	}

	if (event.tag === 'update-cache') {
		event.waitUntil(updateCache());
	}
});

// Check if user needs attendance reminder
async function checkAttendanceReminder() {
	try {
		const now = new Date();
		const hour = now.getHours();
		const day = now.getDay();

		// Only remind on weekdays between 7-9 AM
		if (day >= 1 && day <= 5 && hour >= 7 && hour <= 9) {
			await self.registration.showNotification('Attendance Reminder', {
				body: "Don't forget to check in today!",
				icon: '/logo.png',
				badge: '/logo.png',
				tag: 'attendance-reminder',
				requireInteraction: false,
				data: { url: '/app/attendance' }
			});
		}
	} catch (error) {
		console.error('[SW] Reminder check failed:', error);
	}
}

// Update cache periodically
async function updateCache() {
	try {
		const cache = await caches.open(CACHE_NAME);
		await cache.addAll(PRECACHE_ASSETS);
		console.log('[SW] Cache updated');
	} catch (error) {
		console.error('[SW] Cache update failed:', error);
	}
}

// ============================================
// MESSAGE HANDLING
// ============================================
self.addEventListener('message', (event) => {
	console.log('[SW] Message received:', event.data);

	const { type, payload } = event.data || {};

	switch (type) {
		case 'SKIP_WAITING':
			self.skipWaiting();
			break;

		case 'SHOW_NOTIFICATION':
			const { title, options } = payload || {};
			if (title) {
				self.registration.showNotification(title, options);
			}
			break;

		case 'CACHE_URLS':
			if (payload?.urls) {
				cacheUrls(payload.urls);
			}
			break;

		case 'CLEAR_CACHE':
			clearAllCaches();
			break;

		case 'GET_CACHE_STATUS':
			getCacheStatus().then((status) => {
				event.ports[0]?.postMessage(status);
			});
			break;

		case 'QUEUE_OFFLINE_ACTION':
			queueOfflineAction(payload);
			break;
	}
});

// Cache specific URLs
async function cacheUrls(urls) {
	try {
		const cache = await caches.open(RUNTIME_CACHE);
		await cache.addAll(urls);
		console.log('[SW] URLs cached:', urls);
	} catch (error) {
		console.error('[SW] Failed to cache URLs:', error);
	}
}

// Clear all caches
async function clearAllCaches() {
	try {
		const cacheNames = await caches.keys();
		await Promise.all(cacheNames.map((name) => caches.delete(name)));
		console.log('[SW] All caches cleared');
	} catch (error) {
		console.error('[SW] Failed to clear caches:', error);
	}
}

// Get cache status
async function getCacheStatus() {
	try {
		const cacheNames = await caches.keys();
		const status = {
			version: CACHE_VERSION,
			caches: []
		};

		for (const name of cacheNames) {
			const cache = await caches.open(name);
			const keys = await cache.keys();
			status.caches.push({
				name,
				count: keys.length
			});
		}

		return status;
	} catch (error) {
		return { error: error.message };
	}
}

// Queue offline action for later sync
async function queueOfflineAction(action) {
	// In a real implementation, store in IndexedDB
	console.log('[SW] Queued offline action:', action);

	// Request background sync when online
	if ('sync' in self.registration) {
		try {
			await self.registration.sync.register('sync-offline-actions');
		} catch (error) {
			console.error('[SW] Failed to register sync:', error);
		}
	}
}

// ============================================
// SHARE TARGET (for receiving shared content)
// ============================================
self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Handle share target
	if (url.pathname === '/share-target' && event.request.method === 'POST') {
		event.respondWith(handleShareTarget(event.request));
	}
});

async function handleShareTarget(request) {
	try {
		const formData = await request.formData();
		const title = formData.get('title') || '';
		const text = formData.get('text') || '';
		const url = formData.get('url') || '';

		// Redirect to app with shared data
		const redirectUrl = `/app/dashboard?shared=true&title=${encodeURIComponent(title)}&text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

		return Response.redirect(redirectUrl, 303);
	} catch (error) {
		console.error('[SW] Share target error:', error);
		return Response.redirect('/app/dashboard', 303);
	}
}

console.log('[SW] Service Worker loaded:', CACHE_VERSION);
