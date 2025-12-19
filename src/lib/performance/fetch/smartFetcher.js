// src/lib/performance/fetch/smartFetcher.js
// Smart Fetcher - Intelligent data fetching with caching, deduplication, and refetch strategies

import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';
import { DataCache } from '../cache/dataCache.js';
import { RequestDeduplicator } from '../cache/requestDeduplicator.js';

/**
 * Smart data fetcher with built-in caching and refetch strategies
 */
export class SmartFetcher {
	constructor(options = {}) {
		this.cache = options.cache || new DataCache({ defaultTTL: 60000 });
		this.deduplicator = options.deduplicator || new RequestDeduplicator();
		this.defaultStaleTime = options.staleTime || 30000;
		this.defaultCacheTime = options.cacheTime || 300000;
		this.subscribers = new Map();
		this.refetchIntervals = new Map();

		if (browser) {
			this._setupVisibilityRefetch();
			this._setupOnlineRefetch();
		}
	}

	/**
	 * Fetch data with smart caching
	 */
	async query(key, fetcher, options = {}) {
		const {
			staleTime = this.defaultStaleTime,
			cacheTime = this.defaultCacheTime,
			forceRefresh = false
		} = options;

		// Check cache first (unless force refresh)
		if (!forceRefresh) {
			const cached = this.cache.get(key);
			if (cached !== null) {
				// If not stale, return immediately
				if (!this.cache.isStale(key, staleTime)) {
					return { data: cached, isStale: false, fromCache: true };
				}
				// Stale but usable - return and refetch in background
				this._backgroundRefetch(key, fetcher, cacheTime);
				return { data: cached, isStale: true, fromCache: true };
			}
		}

		// Fetch fresh data
		try {
			const data = await fetcher();
			this.cache.set(key, data, cacheTime);
			this._notifySubscribers(key, data);
			return { data, isStale: false, fromCache: false };
		} catch (error) {
			// On error, return stale data if available
			const staleData = this.cache.getEntry(key)?.value;
			if (staleData !== undefined) {
				return { data: staleData, isStale: true, fromCache: true, error };
			}
			throw error;
		}
	}

	/**
	 * Subscribe to data changes with automatic refetching
	 */
	subscribe(key, fetcher, callback, options = {}) {
		const { staleTime = this.defaultStaleTime, refetchInterval = null, refetchOnFocus = true } = options;

		// Store subscriber
		if (!this.subscribers.has(key)) {
			this.subscribers.set(key, new Set());
		}
		this.subscribers.get(key).add({ callback, options });

		// Initial fetch
		this.query(key, fetcher, options).then((result) => {
			callback(result.data, result);
		});

		// Setup refetch interval if specified
		if (refetchInterval && browser) {
			const intervalId = setInterval(async () => {
				try {
					const result = await this.query(key, fetcher, { ...options, forceRefresh: true });
					callback(result.data, result);
				} catch (e) {
					console.warn(`Refetch failed for ${key}:`, e);
				}
			}, refetchInterval);

			this.refetchIntervals.set(key, intervalId);
		}

		// Return unsubscribe function
		return () => {
			const subs = this.subscribers.get(key);
			if (subs) {
				for (const sub of subs) {
					if (sub.callback === callback) {
						subs.delete(sub);
						break;
					}
				}
			}
			const intervalId = this.refetchIntervals.get(key);
			if (intervalId) {
				clearInterval(intervalId);
				this.refetchIntervals.delete(key);
			}
		};
	}

	/**
	 * Prefetch data into cache
	 */
	async prefetch(key, fetcher, options = {}) {
		const { cacheTime = this.defaultCacheTime } = options;

		if (this.cache.has(key)) {
			return; // Already cached
		}

		try {
			const data = await fetcher();
			this.cache.set(key, data, cacheTime);
		} catch (e) {
			console.warn(`Prefetch failed for ${key}:`, e);
		}
	}

	/**
	 * Invalidate cache entries
	 */
	invalidate(pattern) {
		return this.cache.invalidate(pattern);
	}

	/**
	 * Set data directly in cache
	 */
	setQueryData(key, data, options = {}) {
		const { cacheTime = this.defaultCacheTime } = options;
		this.cache.set(key, data, cacheTime);
		this._notifySubscribers(key, data);
	}

	/**
	 * Get cached data without fetching
	 */
	getQueryData(key) {
		return this.cache.get(key);
	}

	// Private methods
	async _backgroundRefetch(key, fetcher, cacheTime) {
		try {
			const data = await fetcher();
			this.cache.set(key, data, cacheTime);
			this._notifySubscribers(key, data);
		} catch (e) {
			console.warn(`Background refetch failed for ${key}:`, e);
		}
	}

	_notifySubscribers(key, data) {
		const subs = this.subscribers.get(key);
		if (subs) {
			for (const { callback } of subs) {
				callback(data, { isStale: false, fromCache: false });
			}
		}
	}

	_setupVisibilityRefetch() {
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') {
				// Refetch stale queries when tab becomes visible
				for (const [key, subs] of this.subscribers) {
					for (const { callback, options } of subs) {
						if (options.refetchOnFocus !== false && this.cache.isStale(key, options.staleTime || this.defaultStaleTime)) {
							// Trigger refetch via subscriber's fetcher
							// Note: This requires storing the fetcher, which we'll handle via options
						}
					}
				}
			}
		});
	}

	_setupOnlineRefetch() {
		window.addEventListener('online', () => {
			// Refetch all subscribed queries when coming back online
			for (const [key, subs] of this.subscribers) {
				for (const { callback } of subs) {
					// Mark all as potentially stale
					const entry = this.cache.getEntry(key);
					if (entry) {
						entry.timestamp = 0; // Force stale
					}
				}
			}
		});
	}
}

/**
 * Create a smart fetcher instance
 */
export function createSmartFetcher(options = {}) {
	return new SmartFetcher(options);
}

// Default instance
export const smartFetcher = browser ? new SmartFetcher() : null;
