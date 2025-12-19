// src/lib/performance/network/networkMonitor.js
// Network State Monitor - Detects connection quality and adapts loading strategy

import { browser } from '$app/environment';
import { writable, derived, get } from 'svelte/store';

/**
 * Network state store
 */
export const networkState = writable({
	online: browser ? navigator.onLine : true,
	effectiveType: '4g',
	downlink: 10,
	rtt: 50,
	saveData: false,
	type: 'unknown'
});

/**
 * Derived connection quality
 */
export const connectionQuality = derived(networkState, ($state) => {
	if (!$state.online) return 'offline';
	if ($state.saveData) return 'save-data';
	if ($state.effectiveType === 'slow-2g' || $state.effectiveType === '2g') return 'slow';
	if ($state.effectiveType === '3g' || $state.rtt > 300) return 'moderate';
	return 'fast';
});

/**
 * Network Monitor class
 */
export class NetworkMonitor {
	constructor() {
		this.listeners = new Set();
		this._latencyHistory = [];
		this._maxHistorySize = 10;

		if (browser) {
			this._init();
		}
	}

	_init() {
		// Online/offline events
		window.addEventListener('online', () => this._updateOnlineStatus(true));
		window.addEventListener('offline', () => this._updateOnlineStatus(false));

		// Network Information API
		if (navigator.connection) {
			this._updateConnectionInfo();
			navigator.connection.addEventListener('change', () => this._updateConnectionInfo());
		}

		// Initial state
		this._updateOnlineStatus(navigator.onLine);
	}

	_updateOnlineStatus(online) {
		networkState.update((s) => ({ ...s, online }));
		this._notify({ type: online ? 'online' : 'offline' });
	}

	_updateConnectionInfo() {
		const conn = navigator.connection;
		if (!conn) return;

		networkState.update((s) => ({
			...s,
			effectiveType: conn.effectiveType || '4g',
			downlink: conn.downlink || 10,
			rtt: conn.rtt || 50,
			saveData: conn.saveData || false,
			type: conn.type || 'unknown'
		}));

		this._notify({ type: 'connection-change', connection: get(networkState) });
	}

	/**
	 * Check if currently online
	 */
	isOnline() {
		return get(networkState).online;
	}

	/**
	 * Check if connection is slow
	 */
	isSlowConnection() {
		const state = get(networkState);
		return (
			state.effectiveType === 'slow-2g' ||
			state.effectiveType === '2g' ||
			state.rtt > 500 ||
			state.saveData
		);
	}

	/**
	 * Check if data saver is enabled
	 */
	isDataSaverEnabled() {
		return get(networkState).saveData;
	}

	/**
	 * Get current connection quality
	 */
	getQuality() {
		return get(connectionQuality);
	}

	/**
	 * Measure actual latency to an endpoint
	 */
	async measureLatency(url = '/api/health') {
		if (!browser || !this.isOnline()) return null;

		const start = performance.now();
		try {
			await fetch(url, {
				method: 'HEAD',
				cache: 'no-store'
			});
			const latency = Math.round(performance.now() - start);

			this._latencyHistory.push(latency);
			if (this._latencyHistory.length > this._maxHistorySize) {
				this._latencyHistory.shift();
			}

			return latency;
		} catch {
			return null;
		}
	}

	/**
	 * Get average measured latency
	 */
	getAverageLatency() {
		if (this._latencyHistory.length === 0) return null;
		return Math.round(
			this._latencyHistory.reduce((a, b) => a + b, 0) / this._latencyHistory.length
		);
	}

	/**
	 * Subscribe to network changes
	 */
	subscribe(callback) {
		this.listeners.add(callback);
		return () => this.listeners.delete(callback);
	}

	_notify(event) {
		for (const listener of this.listeners) {
			listener(event);
		}
	}

	/**
	 * Get recommended fetch timeout based on connection
	 */
	getRecommendedTimeout() {
		const quality = this.getQuality();
		switch (quality) {
			case 'offline':
				return 0;
			case 'slow':
				return 30000;
			case 'moderate':
				return 15000;
			default:
				return 10000;
		}
	}

	/**
	 * Get recommended batch size for data fetching
	 */
	getRecommendedBatchSize() {
		const quality = this.getQuality();
		switch (quality) {
			case 'offline':
				return 0;
			case 'slow':
				return 10;
			case 'moderate':
				return 20;
			default:
				return 50;
		}
	}
}

// Singleton instance
export const networkMonitor = browser ? new NetworkMonitor() : null;
