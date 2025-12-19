// src/lib/performance/cache/dataCache.js
// In-Memory Cache with TTL and LRU eviction

import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';

/**
 * High-performance in-memory cache with TTL and size limits
 */
export class DataCache {
	constructor(options = {}) {
		this.defaultTTL = options.defaultTTL || 60000; // 1 minute default
		this.maxSize = options.maxSize || 100;
		this.cache = new Map();
		this.accessOrder = [];
		this.stats = writable({ hits: 0, misses: 0, evictions: 0 });
	}

	/**
	 * Set a value in cache with optional TTL
	 */
	set(key, value, ttl = this.defaultTTL) {
		// Evict if at capacity
		if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
			this._evictLRU();
		}

		const entry = {
			value,
			expiry: Date.now() + ttl,
			timestamp: Date.now(),
			ttl
		};

		this.cache.set(key, entry);
		this._updateAccessOrder(key);

		return this;
	}

	/**
	 * Get a value from cache
	 */
	get(key) {
		const entry = this.cache.get(key);

		if (!entry) {
			this.stats.update((s) => ({ ...s, misses: s.misses + 1 }));
			return null;
		}

		// Check expiry
		if (Date.now() > entry.expiry) {
			this.cache.delete(key);
			this._removeFromAccessOrder(key);
			this.stats.update((s) => ({ ...s, misses: s.misses + 1 }));
			return null;
		}

		this._updateAccessOrder(key);
		this.stats.update((s) => ({ ...s, hits: s.hits + 1 }));

		return entry.value;
	}

	/**
	 * Check if key exists and is not expired
	 */
	has(key) {
		const entry = this.cache.get(key);
		if (!entry) return false;
		if (Date.now() > entry.expiry) {
			this.cache.delete(key);
			return false;
		}
		return true;
	}

	/**
	 * Get entry metadata (for stale-while-revalidate)
	 */
	getEntry(key) {
		return this.cache.get(key) || null;
	}

	/**
	 * Check if entry is stale but still usable
	 */
	isStale(key, staleTime) {
		const entry = this.cache.get(key);
		if (!entry) return true;
		return Date.now() - entry.timestamp > staleTime;
	}

	/**
	 * Invalidate entries matching pattern
	 */
	invalidate(pattern) {
		let count = 0;
		for (const key of this.cache.keys()) {
			if (typeof pattern === 'string' && key.includes(pattern)) {
				this.cache.delete(key);
				this._removeFromAccessOrder(key);
				count++;
			} else if (pattern instanceof RegExp && pattern.test(key)) {
				this.cache.delete(key);
				this._removeFromAccessOrder(key);
				count++;
			}
		}
		return count;
	}

	/**
	 * Clear all cache entries
	 */
	clear() {
		this.cache.clear();
		this.accessOrder = [];
	}

	/**
	 * Get cache statistics
	 */
	getStats() {
		const stats = get(this.stats);
		const total = stats.hits + stats.misses;
		return {
			...stats,
			size: this.cache.size,
			hitRate: total > 0 ? Math.round((stats.hits / total) * 100) : 0
		};
	}

	// Private methods
	_updateAccessOrder(key) {
		this._removeFromAccessOrder(key);
		this.accessOrder.push(key);
	}

	_removeFromAccessOrder(key) {
		const index = this.accessOrder.indexOf(key);
		if (index > -1) {
			this.accessOrder.splice(index, 1);
		}
	}

	_evictLRU() {
		if (this.accessOrder.length > 0) {
			const lruKey = this.accessOrder.shift();
			this.cache.delete(lruKey);
			this.stats.update((s) => ({ ...s, evictions: s.evictions + 1 }));
		}
	}
}

/**
 * Create a pre-configured cache instance
 */
export function createCache(name, options = {}) {
	return new DataCache({
		defaultTTL: options.ttl || 60000,
		maxSize: options.maxSize || 100,
		...options
	});
}

// Default cache instances
export const apiCache = browser ? new DataCache({ defaultTTL: 30000, maxSize: 50 }) : null;
export const userCache = browser ? new DataCache({ defaultTTL: 300000, maxSize: 20 }) : null;
export const staticCache = browser ? new DataCache({ defaultTTL: 3600000, maxSize: 100 }) : null;
