// src/lib/performance/offline/offlineActions.js
// Offline-aware action handler with queue and sync

import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';
import { networkState } from '../network/networkMonitor.js';

/**
 * Offline action queue store
 */
export const offlineQueue = writable([]);

/**
 * Sync status store
 */
export const syncStatus = writable({
	isSyncing: false,
	lastSync: null,
	pendingCount: 0,
	failedCount: 0
});

/**
 * Offline Action Handler
 */
export class OfflineActionHandler {
	constructor(options = {}) {
		this.storageKey = options.storageKey || 'offline_actions';
		this.maxRetries = options.maxRetries || 3;
		this.retryDelay = options.retryDelay || 5000;
		this.onSync = options.onSync || (() => {});
		this.onError = options.onError || console.error;

		if (browser) {
			this._loadQueue();
			this._setupListeners();
		}
	}

	/**
	 * Execute action with offline support
	 */
	async execute(action, onlineHandler, offlineHandler = null) {
		const isOnline = get(networkState).online;

		if (isOnline) {
			try {
				return await onlineHandler();
			} catch (error) {
				// If network error, queue for later
				if (this._isNetworkError(error)) {
					return this._queueAction(action, offlineHandler);
				}
				throw error;
			}
		} else {
			return this._queueAction(action, offlineHandler);
		}
	}

	/**
	 * Queue action for later sync
	 */
	_queueAction(action, offlineHandler) {
		const queuedAction = {
			id: crypto.randomUUID(),
			action,
			timestamp: Date.now(),
			retries: 0,
			status: 'pending'
		};

		offlineQueue.update((q) => [...q, queuedAction]);
		this._saveQueue();

		syncStatus.update((s) => ({
			...s,
			pendingCount: s.pendingCount + 1
		}));

		// Execute offline handler if provided
		if (offlineHandler) {
			offlineHandler(queuedAction);
		}

		return { queued: true, id: queuedAction.id };
	}

	/**
	 * Sync all pending actions
	 */
	async syncAll(actionHandler) {
		if (!get(networkState).online) {
			return { synced: 0, failed: 0, pending: get(offlineQueue).length };
		}

		syncStatus.update((s) => ({ ...s, isSyncing: true }));

		const queue = get(offlineQueue);
		let synced = 0;
		let failed = 0;

		for (const item of queue) {
			if (item.status === 'synced') continue;

			try {
				await actionHandler(item.action);

				// Mark as synced
				offlineQueue.update((q) =>
					q.map((i) => (i.id === item.id ? { ...i, status: 'synced' } : i))
				);

				synced++;
			} catch (error) {
				item.retries++;

				if (item.retries >= this.maxRetries) {
					// Mark as failed
					offlineQueue.update((q) =>
						q.map((i) =>
							i.id === item.id ? { ...i, status: 'failed', error: error.message } : i
						)
					);
					failed++;
				}

				this.onError(error);
			}
		}

		// Clean up synced items
		offlineQueue.update((q) => q.filter((i) => i.status !== 'synced'));
		this._saveQueue();

		const result = {
			synced,
			failed,
			pending: get(offlineQueue).filter((i) => i.status === 'pending').length
		};

		syncStatus.update((s) => ({
			...s,
			isSyncing: false,
			lastSync: Date.now(),
			pendingCount: result.pending,
			failedCount: result.failed
		}));

		this.onSync(result);

		return result;
	}

	/**
	 * Retry failed actions
	 */
	async retryFailed(actionHandler) {
		offlineQueue.update((q) =>
			q.map((i) => (i.status === 'failed' ? { ...i, status: 'pending', retries: 0 } : i))
		);

		return this.syncAll(actionHandler);
	}

	/**
	 * Clear all queued actions
	 */
	clearQueue() {
		offlineQueue.set([]);
		this._saveQueue();

		syncStatus.update((s) => ({
			...s,
			pendingCount: 0,
			failedCount: 0
		}));
	}

	/**
	 * Get queue status
	 */
	getStatus() {
		const queue = get(offlineQueue);
		return {
			total: queue.length,
			pending: queue.filter((i) => i.status === 'pending').length,
			failed: queue.filter((i) => i.status === 'failed').length,
			synced: queue.filter((i) => i.status === 'synced').length
		};
	}

	// Private methods
	_isNetworkError(error) {
		return (
			error.name === 'TypeError' ||
			error.message?.includes('network') ||
			error.message?.includes('fetch')
		);
	}

	_loadQueue() {
		try {
			const stored = localStorage.getItem(this.storageKey);
			if (stored) {
				offlineQueue.set(JSON.parse(stored));
			}
		} catch (e) {
			console.warn('Failed to load offline queue:', e);
		}
	}

	_saveQueue() {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(get(offlineQueue)));
		} catch (e) {
			console.warn('Failed to save offline queue:', e);
		}
	}

	_setupListeners() {
		// Auto-sync when coming online
		window.addEventListener('online', () => {
			// Delay to ensure connection is stable
			setTimeout(() => {
				if (get(offlineQueue).length > 0) {
					window.dispatchEvent(new CustomEvent('offline-sync-ready'));
				}
			}, 2000);
		});
	}
}

/**
 * Create an offline-aware action
 */
export function createOfflineAction(config) {
	const { name, onlineHandler, offlineHandler, optimisticUpdate } = config;

	const handler = new OfflineActionHandler();

	return async function executeAction(params) {
		// Apply optimistic update if provided
		let rollback = null;
		if (optimisticUpdate) {
			rollback = optimisticUpdate(params);
		}

		try {
			const result = await handler.execute(
				{ name, params, timestamp: Date.now() },
				() => onlineHandler(params),
				offlineHandler ? () => offlineHandler(params) : null
			);

			return result;
		} catch (error) {
			// Rollback optimistic update on error
			if (rollback) {
				rollback();
			}
			throw error;
		}
	};
}

// Default handler instance
export const offlineHandler = browser ? new OfflineActionHandler() : null;
