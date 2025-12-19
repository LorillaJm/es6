// src/lib/performance/strategy/loadingStrategy.js
// Adaptive Loading Strategy - Adjusts loading behavior based on network and device

import { browser } from '$app/environment';
import { writable, derived, get } from 'svelte/store';
import { networkState, connectionQuality } from '../network/networkMonitor.js';

/**
 * Loading strategy configuration
 */
export const loadingConfig = writable({
	strategy: 'full', // 'full' | 'minimal' | 'offline'
	imageQuality: 'high', // 'high' | 'medium' | 'low' | 'none'
	prefetchEnabled: true,
	animationsEnabled: true,
	lazyLoadThreshold: '100px',
	batchSize: 50
});

/**
 * Strategy presets
 */
const STRATEGY_PRESETS = {
	full: {
		imageQuality: 'high',
		prefetchEnabled: true,
		animationsEnabled: true,
		lazyLoadThreshold: '200px',
		batchSize: 50,
		features: ['charts', 'analytics', 'animations', 'prefetch', 'realtime']
	},
	moderate: {
		imageQuality: 'medium',
		prefetchEnabled: true,
		animationsEnabled: true,
		lazyLoadThreshold: '100px',
		batchSize: 30,
		features: ['charts', 'analytics', 'realtime']
	},
	minimal: {
		imageQuality: 'low',
		prefetchEnabled: false,
		animationsEnabled: false,
		lazyLoadThreshold: '50px',
		batchSize: 15,
		features: ['core']
	},
	offline: {
		imageQuality: 'cached-only',
		prefetchEnabled: false,
		animationsEnabled: false,
		lazyLoadThreshold: '0px',
		batchSize: 10,
		features: ['core', 'cached']
	}
};

/**
 * Data priority levels
 */
export const DATA_PRIORITY = {
	CRITICAL: 1, // Must load immediately (auth, today's status)
	HIGH: 2, // Should load quickly (dashboard stats)
	MEDIUM: 3, // Can be deferred (history, charts)
	LOW: 4 // Load on demand (analytics, reports)
};

/**
 * Loading Strategy Manager
 */
export class LoadingStrategy {
	constructor() {
		this._unsubscribe = null;

		if (browser) {
			this._init();
		}
	}

	_init() {
		// Auto-adjust strategy based on connection
		this._unsubscribe = connectionQuality.subscribe((quality) => {
			this._updateStrategy(quality);
		});

		// Check for reduced motion preference
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			loadingConfig.update((c) => ({ ...c, animationsEnabled: false }));
		}

		// Check for data saver
		if (navigator.connection?.saveData) {
			this._updateStrategy('save-data');
		}
	}

	_updateStrategy(quality) {
		let preset;
		switch (quality) {
			case 'offline':
				preset = STRATEGY_PRESETS.offline;
				break;
			case 'slow':
			case 'save-data':
				preset = STRATEGY_PRESETS.minimal;
				break;
			case 'moderate':
				preset = STRATEGY_PRESETS.moderate;
				break;
			default:
				preset = STRATEGY_PRESETS.full;
		}

		loadingConfig.update((c) => ({
			...c,
			strategy: quality === 'offline' ? 'offline' : quality === 'slow' ? 'minimal' : 'full',
			...preset
		}));
	}

	/**
	 * Get current strategy
	 */
	getStrategy() {
		return get(loadingConfig).strategy;
	}

	/**
	 * Check if feature should be loaded
	 */
	shouldLoadFeature(feature) {
		const config = get(loadingConfig);
		const preset = STRATEGY_PRESETS[config.strategy] || STRATEGY_PRESETS.full;
		return preset.features.includes(feature);
	}

	/**
	 * Get image URL based on quality setting
	 */
	getImageUrl(baseUrl, options = {}) {
		const config = get(loadingConfig);
		const { width, height } = options;

		switch (config.imageQuality) {
			case 'none':
				return null;
			case 'cached-only':
				// Return placeholder or cached version
				return baseUrl;
			case 'low':
				return this._resizeUrl(baseUrl, Math.min(width || 200, 200));
			case 'medium':
				return this._resizeUrl(baseUrl, Math.min(width || 400, 400));
			default:
				return baseUrl;
		}
	}

	_resizeUrl(url, maxWidth) {
		// If using a CDN with resize params, modify URL
		// This is a placeholder - implement based on your CDN
		return url;
	}

	/**
	 * Get recommended batch size for lists
	 */
	getBatchSize() {
		return get(loadingConfig).batchSize;
	}

	/**
	 * Check if prefetching is enabled
	 */
	canPrefetch() {
		return get(loadingConfig).prefetchEnabled;
	}

	/**
	 * Check if animations are enabled
	 */
	canAnimate() {
		return get(loadingConfig).animationsEnabled;
	}

	/**
	 * Get lazy load threshold
	 */
	getLazyLoadThreshold() {
		return get(loadingConfig).lazyLoadThreshold;
	}

	/**
	 * Prioritize data loading
	 */
	prioritizeLoads(loads) {
		return loads.sort((a, b) => (a.priority || DATA_PRIORITY.MEDIUM) - (b.priority || DATA_PRIORITY.MEDIUM));
	}

	/**
	 * Create intersection observer for lazy loading
	 */
	createLazyObserver(callback, options = {}) {
		if (!browser) return null;

		const threshold = this.getLazyLoadThreshold();
		return new IntersectionObserver(callback, {
			rootMargin: threshold,
			threshold: 0,
			...options
		});
	}

	/**
	 * Cleanup
	 */
	destroy() {
		if (this._unsubscribe) {
			this._unsubscribe();
		}
	}
}

/**
 * Get current loading strategy
 */
export function getLoadingStrategy() {
	return get(loadingConfig).strategy;
}

// Singleton instance
export const loadingStrategy = browser ? new LoadingStrategy() : null;
