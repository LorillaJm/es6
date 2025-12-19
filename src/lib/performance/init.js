// src/lib/performance/init.js
// Performance System Initialization

import { browser } from '$app/environment';
import { writable } from 'svelte/store';

/**
 * Performance system configuration
 */
export const performanceConfig = writable({
	initialized: false,
	metricsEndpoint: null,
	sampleRate: 1.0,
	enableServiceWorker: true,
	enablePrefetch: true,
	debugMode: false
});

/**
 * Initialize the complete performance system
 */
export async function initPerformanceSystem(options = {}) {
	if (!browser) return;

	const config = {
		metricsEndpoint: options.metricsEndpoint || null,
		sampleRate: options.sampleRate || 1.0,
		enableServiceWorker: options.enableServiceWorker !== false,
		enablePrefetch: options.enablePrefetch !== false,
		debugMode: options.debugMode || false
	};

	performanceConfig.set({ ...config, initialized: true });

	// Initialize components
	const { networkMonitor } = await import('./network/networkMonitor.js');
	const { performanceTracker } = await import('./metrics/performanceTracker.js');
	const { loadingStrategy } = await import('./strategy/loadingStrategy.js');

	// Setup performance tracking endpoint
	if (config.metricsEndpoint && performanceTracker) {
		performanceTracker.endpoint = config.metricsEndpoint;
	}

	// Log initialization in debug mode
	if (config.debugMode) {
		console.log('[Performance] System initialized', config);

		// Log metrics periodically
		setInterval(() => {
			if (performanceTracker) {
				console.log('[Performance] Metrics:', performanceTracker.getMetrics());
				console.log('[Performance] Score:', performanceTracker.getScore());
			}
		}, 10000);
	}

	return {
		networkMonitor,
		performanceTracker,
		loadingStrategy
	};
}

/**
 * Create a performance-optimized fetch function
 */
export function createOptimizedFetch() {
	if (!browser) return fetch;

	let deduplicator, tracker;

	return async function optimizedFetch(url, options = {}) {
		// Lazy load dependencies
		if (!deduplicator) {
			const { RequestDeduplicator } = await import('./cache/requestDeduplicator.js');
			deduplicator = new RequestDeduplicator();
		}
		if (!tracker) {
			const { performanceTracker: pt } = await import('./metrics/performanceTracker.js');
			tracker = pt;
		}

		const start = performance.now();
		let success = true;

		try {
			const response = await deduplicator.fetch(url, options);
			success = response.ok;
			return response;
		} catch (error) {
			success = false;
			throw error;
		} finally {
			const duration = Math.round(performance.now() - start);
			if (tracker) {
				tracker.trackApiCall(url, duration, success);
			}
		}
	};
}
