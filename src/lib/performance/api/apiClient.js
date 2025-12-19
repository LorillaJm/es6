// src/lib/performance/api/apiClient.js
// Optimized API Client with caching, deduplication, and performance tracking

import { browser } from '$app/environment';
import { DataCache } from '../cache/dataCache.js';
import { RequestDeduplicator } from '../cache/requestDeduplicator.js';
import { networkMonitor } from '../network/networkMonitor.js';
import { performanceTracker } from '../metrics/performanceTracker.js';

/**
 * API Client Configuration
 */
const DEFAULT_CONFIG = {
	baseUrl: '',
	timeout: 10000,
	retries: 2,
	retryDelay: 1000,
	cacheTime: 60000,
	headers: {
		'Content-Type': 'application/json'
	}
};

/**
 * Optimized API Client
 */
export class ApiClient {
	constructor(config = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.cache = new DataCache({ defaultTTL: this.config.cacheTime, maxSize: 100 });
		this.deduplicator = new RequestDeduplicator();
		this.abortControllers = new Map();
	}

	/**
	 * Build full URL
	 */
	_buildUrl(endpoint, params = {}) {
		const url = new URL(endpoint, this.config.baseUrl || window.location.origin);
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				url.searchParams.append(key, value);
			}
		});
		return url.toString();
	}

	/**
	 * Generate cache key
	 */
	_getCacheKey(method, url, body = null) {
		return `${method}:${url}:${body ? JSON.stringify(body) : ''}`;
	}

	/**
	 * Execute request with retries
	 */
	async _executeWithRetry(url, options, retries = this.config.retries) {
		let lastError;

		for (let attempt = 0; attempt <= retries; attempt++) {
			try {
				// Create abort controller for timeout
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

				this.abortControllers.set(url, controller);

				const response = await fetch(url, {
					...options,
					signal: controller.signal
				});

				clearTimeout(timeoutId);
				this.abortControllers.delete(url);

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				return response;
			} catch (error) {
				lastError = error;

				// Don't retry on abort or client errors
				if (error.name === 'AbortError' || (error.message && error.message.includes('4'))) {
					throw error;
				}

				// Wait before retry
				if (attempt < retries) {
					await new Promise((r) => setTimeout(r, this.config.retryDelay * (attempt + 1)));
				}
			}
		}

		throw lastError;
	}

	/**
	 * GET request with caching
	 */
	async get(endpoint, options = {}) {
		const { params = {}, cache = true, cacheTime = this.config.cacheTime, forceRefresh = false } = options;

		const url = this._buildUrl(endpoint, params);
		const cacheKey = this._getCacheKey('GET', url);

		// Check cache first
		if (cache && !forceRefresh) {
			const cached = this.cache.get(cacheKey);
			if (cached !== null) {
				return { data: cached, fromCache: true };
			}
		}

		const start = performance.now();

		try {
			const response = await this.deduplicator.fetch(url, {
				method: 'GET',
				headers: this.config.headers
			});

			const data = await response.json();

			// Cache successful response
			if (cache) {
				this.cache.set(cacheKey, data, cacheTime);
			}

			// Track performance
			if (performanceTracker) {
				performanceTracker.trackApiCall(endpoint, Math.round(performance.now() - start), true);
			}

			return { data, fromCache: false };
		} catch (error) {
			// Track failed request
			if (performanceTracker) {
				performanceTracker.trackApiCall(endpoint, Math.round(performance.now() - start), false);
			}

			// Return stale cache on error if available
			if (cache) {
				const stale = this.cache.getEntry(cacheKey)?.value;
				if (stale !== undefined) {
					return { data: stale, fromCache: true, stale: true, error };
				}
			}

			throw error;
		}
	}

	/**
	 * POST request
	 */
	async post(endpoint, body, options = {}) {
		const url = this._buildUrl(endpoint, options.params);
		const start = performance.now();

		try {
			const response = await this._executeWithRetry(url, {
				method: 'POST',
				headers: this.config.headers,
				body: JSON.stringify(body)
			});

			const data = await response.json();

			if (performanceTracker) {
				performanceTracker.trackApiCall(endpoint, Math.round(performance.now() - start), true);
			}

			// Invalidate related cache entries
			if (options.invalidate) {
				this.cache.invalidate(options.invalidate);
			}

			return { data };
		} catch (error) {
			if (performanceTracker) {
				performanceTracker.trackApiCall(endpoint, Math.round(performance.now() - start), false);
			}
			throw error;
		}
	}

	/**
	 * PUT request
	 */
	async put(endpoint, body, options = {}) {
		const url = this._buildUrl(endpoint, options.params);
		const start = performance.now();

		try {
			const response = await this._executeWithRetry(url, {
				method: 'PUT',
				headers: this.config.headers,
				body: JSON.stringify(body)
			});

			const data = await response.json();

			if (performanceTracker) {
				performanceTracker.trackApiCall(endpoint, Math.round(performance.now() - start), true);
			}

			if (options.invalidate) {
				this.cache.invalidate(options.invalidate);
			}

			return { data };
		} catch (error) {
			if (performanceTracker) {
				performanceTracker.trackApiCall(endpoint, Math.round(performance.now() - start), false);
			}
			throw error;
		}
	}

	/**
	 * DELETE request
	 */
	async delete(endpoint, options = {}) {
		const url = this._buildUrl(endpoint, options.params);
		const start = performance.now();

		try {
			const response = await this._executeWithRetry(url, {
				method: 'DELETE',
				headers: this.config.headers
			});

			const data = await response.json();

			if (performanceTracker) {
				performanceTracker.trackApiCall(endpoint, Math.round(performance.now() - start), true);
			}

			if (options.invalidate) {
				this.cache.invalidate(options.invalidate);
			}

			return { data };
		} catch (error) {
			if (performanceTracker) {
				performanceTracker.trackApiCall(endpoint, Math.round(performance.now() - start), false);
			}
			throw error;
		}
	}

	/**
	 * Batch multiple requests
	 */
	async batch(requests) {
		const results = await Promise.allSettled(
			requests.map((req) => {
				switch (req.method?.toUpperCase()) {
					case 'POST':
						return this.post(req.endpoint, req.body, req.options);
					case 'PUT':
						return this.put(req.endpoint, req.body, req.options);
					case 'DELETE':
						return this.delete(req.endpoint, req.options);
					default:
						return this.get(req.endpoint, req.options);
				}
			})
		);

		return results.map((result, index) => ({
			...requests[index],
			success: result.status === 'fulfilled',
			data: result.status === 'fulfilled' ? result.value.data : null,
			error: result.status === 'rejected' ? result.reason : null
		}));
	}

	/**
	 * Prefetch data into cache
	 */
	async prefetch(endpoint, options = {}) {
		const { params = {}, cacheTime = this.config.cacheTime } = options;
		const url = this._buildUrl(endpoint, params);
		const cacheKey = this._getCacheKey('GET', url);

		// Skip if already cached
		if (this.cache.has(cacheKey)) {
			return;
		}

		try {
			const response = await fetch(url, {
				method: 'GET',
				headers: this.config.headers,
				priority: 'low'
			});

			if (response.ok) {
				const data = await response.json();
				this.cache.set(cacheKey, data, cacheTime);
			}
		} catch (e) {
			// Silently fail prefetch
		}
	}

	/**
	 * Cancel pending request
	 */
	cancel(endpoint) {
		const controller = this.abortControllers.get(endpoint);
		if (controller) {
			controller.abort();
			this.abortControllers.delete(endpoint);
		}
	}

	/**
	 * Cancel all pending requests
	 */
	cancelAll() {
		for (const controller of this.abortControllers.values()) {
			controller.abort();
		}
		this.abortControllers.clear();
	}

	/**
	 * Clear cache
	 */
	clearCache(pattern = null) {
		if (pattern) {
			this.cache.invalidate(pattern);
		} else {
			this.cache.clear();
		}
	}

	/**
	 * Get cache stats
	 */
	getCacheStats() {
		return this.cache.getStats();
	}
}

// Default instance
export const apiClient = browser ? new ApiClient() : null;
