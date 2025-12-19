// src/lib/performance/cache/requestDeduplicator.js
// Request Deduplication - Prevents duplicate concurrent requests

import { browser } from '$app/environment';

/**
 * Deduplicates concurrent requests to the same endpoint
 */
export class RequestDeduplicator {
	constructor() {
		this.pending = new Map();
		this.stats = { deduplicated: 0, total: 0 };
	}

	/**
	 * Generate cache key from request
	 */
	_getKey(url, options = {}) {
		const method = options.method || 'GET';
		const body = options.body ? JSON.stringify(options.body) : '';
		return `${method}:${url}:${body}`;
	}

	/**
	 * Fetch with deduplication
	 */
	async fetch(url, options = {}) {
		if (!browser) {
			return fetch(url, options);
		}

		const key = this._getKey(url, options);
		this.stats.total++;

		// Return existing promise if request is in-flight
		if (this.pending.has(key)) {
			this.stats.deduplicated++;
			return this.pending.get(key);
		}

		// Create new request
		const promise = fetch(url, options)
			.then(async (response) => {
				// Clone response for multiple consumers
				const clone = response.clone();
				return clone;
			})
			.finally(() => {
				this.pending.delete(key);
			});

		this.pending.set(key, promise);
		return promise;
	}

	/**
	 * Fetch and parse JSON with deduplication
	 */
	async fetchJSON(url, options = {}) {
		const response = await this.fetch(url, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			}
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		return response.json();
	}

	/**
	 * Check if request is pending
	 */
	isPending(url, options = {}) {
		return this.pending.has(this._getKey(url, options));
	}

	/**
	 * Get deduplication stats
	 */
	getStats() {
		return {
			...this.stats,
			pending: this.pending.size,
			deduplicationRate:
				this.stats.total > 0
					? Math.round((this.stats.deduplicated / this.stats.total) * 100)
					: 0
		};
	}

	/**
	 * Clear all pending requests (for cleanup)
	 */
	clear() {
		this.pending.clear();
	}
}

/**
 * Create a deduplicator instance
 */
export function createDeduplicator() {
	return new RequestDeduplicator();
}

// Default instance
export const deduplicator = browser ? new RequestDeduplicator() : null;
