// Service Worker - Performance Optimized
// Implements stale-while-revalidate, cache-first, and network-first strategies

const CACHE_VERSION = 'v2';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

// Static assets to precache
const PRECACHE_ASSETS = [
	'/',
	'/app/dashboard',
	'/app/attendance',
	'/manifest.json',
	'/logo.png'
];

// Cache TTLs (in milliseconds)
const CACHE_TTL = {
	api: 30 * 1000, // 30 seconds
	static: 7 * 24 * 60 * 60 * 1000, // 7 days
	images: 30 * 24 * 60 * 60 * 1000 // 30 days
};

// Install event - precache static assets
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(STATIC_CACHE)
			.then((cache) => cache.addAll(PRECACHE_ASSETS))
			.then(() => self.skipWaiting())
	);
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => !key.includes(CACHE_VERSION))
						.map((key) => caches.delete(key))
				)
			)
			.then(() => self.clients.claim())
	);
});

// Fetch event - route requests to appropriate strategy
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

	// API requests - stale-while-revalidate
	if (url.pathname.startsWith('/api/')) {
		event.respondWith(staleWhileRevalidate(request, API_CACHE));
		return;
	}

	// Images - cache-first with long TTL
	if (isImageRequest(request)) {
		event.respondWith(cacheFirst(request, IMAGE_CACHE, CACHE_TTL.images));
		return;
	}

	// Static assets (JS, CSS) - cache-first
	if (isStaticAsset(url)) {
		event.respondWith(cacheFirst(request, STATIC_CACHE, CACHE_TTL.static));
		return;
	}

	// HTML pages - network-first
	if (request.headers.get('accept')?.includes('text/html')) {
		event.respondWith(networkFirst(request, STATIC_CACHE));
		return;
	}

	// Default - network-first
	event.respondWith(networkFirst(request, STATIC_CACHE));
});

/**
 * Stale-While-Revalidate Strategy
 * Returns cached response immediately, then updates cache in background
 */
async function staleWhileRevalidate(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cachedResponse = await cache.match(request);

	// Fetch fresh data in background
	const fetchPromise = fetch(request)
		.then((response) => {
			if (response.ok) {
				// Clone and cache the response
				const responseToCache = response.clone();
				cache.put(request, responseToCache);
			}
			return response;
		})
		.catch((error) => {
			console.warn('[SW] Fetch failed:', error);
			return cachedResponse;
		});

	// Return cached response immediately, or wait for network
	return cachedResponse || fetchPromise;
}

/**
 * Cache-First Strategy
 * Returns cached response if available and not expired
 */
async function cacheFirst(request, cacheName, maxAge = CACHE_TTL.static) {
	const cache = await caches.open(cacheName);
	const cachedResponse = await cache.match(request);

	if (cachedResponse) {
		// Check if cache is still fresh
		const cachedDate = cachedResponse.headers.get('sw-cached-date');
		if (cachedDate) {
			const age = Date.now() - parseInt(cachedDate, 10);
			if (age < maxAge) {
				return cachedResponse;
			}
		} else {
			// No date header, return cached
			return cachedResponse;
		}
	}

	// Fetch from network
	try {
		const response = await fetch(request);
		if (response.ok) {
			// Add cache date header
			const headers = new Headers(response.headers);
			headers.set('sw-cached-date', Date.now().toString());

			const responseToCache = new Response(await response.clone().blob(), {
				status: response.status,
				statusText: response.statusText,
				headers
			});

			cache.put(request, responseToCache);
		}
		return response;
	} catch (error) {
		// Return stale cache on network error
		if (cachedResponse) {
			return cachedResponse;
		}
		throw error;
	}
}

/**
 * Network-First Strategy
 * Tries network first, falls back to cache
 */
async function networkFirst(request, cacheName) {
	const cache = await caches.open(cacheName);

	try {
		const response = await fetch(request);
		if (response.ok) {
			cache.put(request, response.clone());
		}
		return response;
	} catch (error) {
		const cachedResponse = await cache.match(request);
		if (cachedResponse) {
			return cachedResponse;
		}

		// Return offline page for navigation requests
		if (request.mode === 'navigate') {
			return cache.match('/') || new Response('Offline', { status: 503 });
		}

		throw error;
	}
}

/**
 * Check if request is for an image
 */
function isImageRequest(request) {
	const url = new URL(request.url);
	return (
		request.destination === 'image' ||
		/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname)
	);
}

/**
 * Check if URL is a static asset
 */
function isStaticAsset(url) {
	return (
		url.pathname.startsWith('/_app/') ||
		/\.(js|css|woff2?|ttf|eot)$/i.test(url.pathname)
	);
}

// Message handling
self.addEventListener('message', (event) => {
	const { type, payload } = event.data || {};

	switch (type) {
		case 'SKIP_WAITING':
			self.skipWaiting();
			break;

		case 'CLEAR_CACHE':
			clearAllCaches().then(() => {
				event.ports[0]?.postMessage({ success: true });
			});
			break;

		case 'GET_CACHE_STATUS':
			getCacheStatus().then((status) => {
				event.ports[0]?.postMessage(status);
			});
			break;

		case 'CACHE_URLS':
			if (payload?.urls) {
				cacheUrls(payload.urls).then(() => {
					event.ports[0]?.postMessage({ success: true });
				});
			}
			break;

		case 'SHOW_NOTIFICATION':
			if (payload) {
				showNotification(payload.title, payload.options);
			}
			break;
	}
});

/**
 * Clear all caches
 */
async function clearAllCaches() {
	const keys = await caches.keys();
	await Promise.all(keys.map((key) => caches.delete(key)));
}

/**
 * Get cache status
 */
async function getCacheStatus() {
	const keys = await caches.keys();
	const status = {};

	for (const key of keys) {
		const cache = await caches.open(key);
		const requests = await cache.keys();
		status[key] = requests.length;
	}

	return status;
}

/**
 * Cache specific URLs
 */
async function cacheUrls(urls) {
	const cache = await caches.open(STATIC_CACHE);
	await cache.addAll(urls);
}

/**
 * Show notification
 */
function showNotification(title, options = {}) {
	if (self.Notification && Notification.permission === 'granted') {
		self.registration.showNotification(title, {
			icon: '/logo.png',
			badge: '/logo.png',
			...options
		});
	}
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
	if (event.tag === 'sync-attendance') {
		event.waitUntil(syncAttendance());
	}
});

/**
 * Sync offline attendance actions
 */
async function syncAttendance() {
	// This will be handled by the main app's offline queue
	// Notify clients that sync is available
	const clients = await self.clients.matchAll();
	clients.forEach((client) => {
		client.postMessage({ type: 'SYNC_AVAILABLE' });
	});
}

// Push notification handling
self.addEventListener('push', (event) => {
	if (!event.data) return;

	try {
		const data = event.data.json();
		const { title, body, icon, data: notificationData } = data;

		event.waitUntil(
			self.registration.showNotification(title || 'Notification', {
				body,
				icon: icon || '/logo.png',
				badge: '/logo.png',
				data: notificationData,
				requireInteraction: true
			})
		);
	} catch (e) {
		console.error('[SW] Push notification error:', e);
	}
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
	event.notification.close();

	const urlToOpen = event.notification.data?.url || '/app/dashboard';

	event.waitUntil(
		self.clients.matchAll({ type: 'window' }).then((clients) => {
			// Focus existing window if available
			for (const client of clients) {
				if (client.url.includes(urlToOpen) && 'focus' in client) {
					return client.focus();
				}
			}
			// Open new window
			return self.clients.openWindow(urlToOpen);
		})
	);
});
