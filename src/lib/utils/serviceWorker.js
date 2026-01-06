// Service Worker Registration & Management Utility
import { browser } from '$app/environment';
import { writable } from 'svelte/store';

// Store for SW status
export const swStatus = writable({
	supported: false,
	registered: false,
	ready: false,
	updateAvailable: false,
	offline: false
});

// Store for SW registration
let swRegistration = null;

/**
 * Register the service worker
 * Skips registration in development with self-signed SSL certificates
 */
export async function registerServiceWorker() {
	if (!browser || !('serviceWorker' in navigator)) {
		console.log('[SW] Service workers not supported');
		return null;
	}

	// Skip SW registration in development with HTTPS (self-signed cert issues)
	// Service workers require valid SSL certificates
	const isDev = import.meta.env.DEV;
	const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
	const isHttps = window.location.protocol === 'https:';
	
	if (isDev && isLocalhost && isHttps) {
		console.log('[SW] Skipping registration in dev mode with self-signed SSL');
		swStatus.update((s) => ({ ...s, supported: true, registered: false }));
		return null;
	}

	swStatus.update((s) => ({ ...s, supported: true }));

	try {
		// Register the service worker
		const registration = await navigator.serviceWorker.register('/sw.js', {
			scope: '/',
			updateViaCache: 'none'
		});

		swRegistration = registration;
		swStatus.update((s) => ({ ...s, registered: true }));

		console.log('[SW] Registered with scope:', registration.scope);

		// Check for updates
		registration.addEventListener('updatefound', () => {
			const newWorker = registration.installing;

			newWorker?.addEventListener('statechange', () => {
				if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
					// New version available
					swStatus.update((s) => ({ ...s, updateAvailable: true }));
					console.log('[SW] New version available');
				}
			});
		});

		// Wait for the service worker to be ready
		const ready = await navigator.serviceWorker.ready;
		swStatus.update((s) => ({ ...s, ready: true }));
		console.log('[SW] Ready');

		// Setup periodic sync if supported
		await setupPeriodicSync(registration);

		// Setup background sync if supported
		await setupBackgroundSync(registration);

		return registration;
	} catch (error) {
		console.warn('[SW] Registration failed:', error.message);
		return null;
	}
}

/**
 * Setup periodic background sync
 */
async function setupPeriodicSync(registration) {
	if (!('periodicSync' in registration)) {
		console.log('[SW] Periodic sync not supported');
		return;
	}

	try {
		const status = await navigator.permissions.query({
			name: 'periodic-background-sync'
		});

		if (status.state === 'granted') {
			// Register periodic sync for attendance reminders (every 12 hours)
			await registration.periodicSync.register('check-attendance-reminder', {
				minInterval: 12 * 60 * 60 * 1000 // 12 hours
			});

			// Register periodic sync for cache updates (every 24 hours)
			await registration.periodicSync.register('update-cache', {
				minInterval: 24 * 60 * 60 * 1000 // 24 hours
			});

			console.log('[SW] Periodic sync registered');
		}
	} catch (error) {
		console.log('[SW] Periodic sync setup failed:', error);
	}
}

/**
 * Setup background sync
 */
async function setupBackgroundSync(registration) {
	if (!('sync' in registration)) {
		console.log('[SW] Background sync not supported');
		return;
	}

	// Listen for online/offline events
	window.addEventListener('online', async () => {
		swStatus.update((s) => ({ ...s, offline: false }));
		console.log('[SW] Back online, triggering sync');

		try {
			await registration.sync.register('sync-attendance');
			await registration.sync.register('sync-offline-actions');
		} catch (error) {
			console.log('[SW] Sync registration failed:', error);
		}
	});

	window.addEventListener('offline', () => {
		swStatus.update((s) => ({ ...s, offline: true }));
		console.log('[SW] Gone offline');
	});

	// Set initial offline status
	swStatus.update((s) => ({ ...s, offline: !navigator.onLine }));
}


/**
 * Update the service worker (skip waiting)
 */
export async function updateServiceWorker() {
	if (!swRegistration?.waiting) {
		return false;
	}

	// Tell the waiting service worker to skip waiting
	swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });

	// Reload the page to use the new service worker
	window.location.reload();
	return true;
}

/**
 * Check for service worker updates
 */
export async function checkForUpdates() {
	if (!swRegistration) {
		return false;
	}

	try {
		await swRegistration.update();
		return true;
	} catch (error) {
		console.error('[SW] Update check failed:', error);
		return false;
	}
}

/**
 * Send message to service worker
 */
export function sendMessageToSW(message) {
	if (!navigator.serviceWorker.controller) {
		console.warn('[SW] No active service worker');
		return Promise.resolve(null);
	}

	return new Promise((resolve) => {
		const messageChannel = new MessageChannel();

		messageChannel.port1.onmessage = (event) => {
			resolve(event.data);
		};

		navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);

		// Timeout after 5 seconds
		setTimeout(() => resolve(null), 5000);
	});
}

/**
 * Show notification via service worker
 */
export async function showNotification(title, options = {}) {
	if (!browser) return false;

	// Check permission
	if (Notification.permission !== 'granted') {
		const permission = await Notification.requestPermission();
		if (permission !== 'granted') {
			return false;
		}
	}

	// Send to service worker
	sendMessageToSW({
		type: 'SHOW_NOTIFICATION',
		payload: { title, options }
	});

	return true;
}

/**
 * Cache specific URLs
 */
export function cacheUrls(urls) {
	sendMessageToSW({
		type: 'CACHE_URLS',
		payload: { urls }
	});
}

/**
 * Clear all caches
 */
export function clearCache() {
	sendMessageToSW({ type: 'CLEAR_CACHE' });
}

/**
 * Get cache status
 */
export async function getCacheStatus() {
	return sendMessageToSW({ type: 'GET_CACHE_STATUS' });
}

/**
 * Queue an action for offline sync
 */
export function queueOfflineAction(action) {
	sendMessageToSW({
		type: 'QUEUE_OFFLINE_ACTION',
		payload: action
	});
}

/**
 * Request push notification permission
 */
export async function requestNotificationPermission() {
	if (!browser || !('Notification' in window)) {
		return 'unsupported';
	}

	if (Notification.permission === 'granted') {
		return 'granted';
	}

	if (Notification.permission === 'denied') {
		return 'denied';
	}

	return await Notification.requestPermission();
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(vapidPublicKey) {
	if (!swRegistration) {
		throw new Error('Service worker not registered');
	}

	const permission = await requestNotificationPermission();
	if (permission !== 'granted') {
		throw new Error('Notification permission denied');
	}

	try {
		const subscription = await swRegistration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
		});

		console.log('[SW] Push subscription:', subscription);
		return subscription;
	} catch (error) {
		console.error('[SW] Push subscription failed:', error);
		throw error;
	}
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush() {
	if (!swRegistration) {
		return false;
	}

	try {
		const subscription = await swRegistration.pushManager.getSubscription();
		if (subscription) {
			await subscription.unsubscribe();
			return true;
		}
		return false;
	} catch (error) {
		console.error('[SW] Unsubscribe failed:', error);
		return false;
	}
}

/**
 * Get current push subscription
 */
export async function getPushSubscription() {
	if (!swRegistration) {
		return null;
	}

	return await swRegistration.pushManager.getSubscription();
}

/**
 * Convert VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);

	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}

	return outputArray;
}

/**
 * Check if app is installed (standalone mode)
 */
export function isAppInstalled() {
	if (!browser) return false;

	return (
		window.matchMedia('(display-mode: standalone)').matches ||
		window.navigator.standalone === true ||
		document.referrer.includes('android-app://')
	);
}

/**
 * Get service worker registration
 */
export function getRegistration() {
	return swRegistration;
}
