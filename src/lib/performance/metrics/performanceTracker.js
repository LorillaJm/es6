// src/lib/performance/metrics/performanceTracker.js
// Performance Metrics Tracker - Core Web Vitals and custom metrics

import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';

/**
 * Performance metrics store
 */
export const performanceMetrics = writable({
	// Core Web Vitals
	fcp: null, // First Contentful Paint
	lcp: null, // Largest Contentful Paint
	fid: null, // First Input Delay
	cls: 0, // Cumulative Layout Shift
	ttfb: null, // Time to First Byte
	inp: null, // Interaction to Next Paint

	// Custom metrics
	tti: null, // Time to Interactive
	tbt: null, // Total Blocking Time
	pageLoadTime: null,

	// API metrics
	apiCalls: [],
	avgApiLatency: 0,

	// Resource metrics
	resourceCount: 0,
	totalTransferSize: 0
});

/**
 * Performance budgets
 */
export const PERFORMANCE_BUDGETS = {
	fcp: { target: 1000, max: 1800 },
	lcp: { target: 1500, max: 2500 },
	fid: { target: 50, max: 100 },
	cls: { target: 0.05, max: 0.1 },
	ttfb: { target: 200, max: 600 },
	tbt: { target: 150, max: 300 },
	apiLatency: { target: 200, max: 500 }
};

/**
 * Performance Tracker class
 */
export class PerformanceTracker {
	constructor(options = {}) {
		this.endpoint = options.endpoint || null;
		this.sampleRate = options.sampleRate || 1.0;
		this._clsValue = 0;
		this._observers = [];

		if (browser && Math.random() < this.sampleRate) {
			this._init();
		}
	}

	_init() {
		this._observeFCP();
		this._observeLCP();
		this._observeFID();
		this._observeCLS();
		this._observeTTFB();
		this._observeINP();
		this._observeResources();
		this._setupUnloadReporting();
	}

	_observeFCP() {
		try {
			const observer = new PerformanceObserver((list) => {
				const entries = list.getEntries();
				const fcp = entries.find((e) => e.name === 'first-contentful-paint');
				if (fcp) {
					performanceMetrics.update((m) => ({ ...m, fcp: Math.round(fcp.startTime) }));
				}
			});
			observer.observe({ type: 'paint', buffered: true });
			this._observers.push(observer);
		} catch (e) {
			// Not supported
		}
	}

	_observeLCP() {
		try {
			const observer = new PerformanceObserver((list) => {
				const entries = list.getEntries();
				const lastEntry = entries[entries.length - 1];
				if (lastEntry) {
					performanceMetrics.update((m) => ({ ...m, lcp: Math.round(lastEntry.startTime) }));
				}
			});
			observer.observe({ type: 'largest-contentful-paint', buffered: true });
			this._observers.push(observer);
		} catch (e) {
			// Not supported
		}
	}

	_observeFID() {
		try {
			const observer = new PerformanceObserver((list) => {
				const firstInput = list.getEntries()[0];
				if (firstInput) {
					const fid = firstInput.processingStart - firstInput.startTime;
					performanceMetrics.update((m) => ({ ...m, fid: Math.round(fid) }));
				}
			});
			observer.observe({ type: 'first-input', buffered: true });
			this._observers.push(observer);
		} catch (e) {
			// Not supported
		}
	}

	_observeCLS() {
		try {
			const observer = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					if (!entry.hadRecentInput) {
						this._clsValue += entry.value;
					}
				}
				performanceMetrics.update((m) => ({
					...m,
					cls: Math.round(this._clsValue * 1000) / 1000
				}));
			});
			observer.observe({ type: 'layout-shift', buffered: true });
			this._observers.push(observer);
		} catch (e) {
			// Not supported
		}
	}

	_observeTTFB() {
		try {
			const navEntry = performance.getEntriesByType('navigation')[0];
			if (navEntry) {
				const ttfb = navEntry.responseStart - navEntry.requestStart;
				performanceMetrics.update((m) => ({ ...m, ttfb: Math.round(ttfb) }));
			}
		} catch (e) {
			// Not supported
		}
	}

	_observeINP() {
		try {
			let maxINP = 0;
			const observer = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					if (entry.interactionId) {
						const duration = entry.duration;
						if (duration > maxINP) {
							maxINP = duration;
							performanceMetrics.update((m) => ({ ...m, inp: Math.round(maxINP) }));
						}
					}
				}
			});
			observer.observe({ type: 'event', buffered: true, durationThreshold: 16 });
			this._observers.push(observer);
		} catch (e) {
			// Not supported
		}
	}

	_observeResources() {
		try {
			const resources = performance.getEntriesByType('resource');
			let totalSize = 0;
			resources.forEach((r) => {
				totalSize += r.transferSize || 0;
			});
			performanceMetrics.update((m) => ({
				...m,
				resourceCount: resources.length,
				totalTransferSize: totalSize
			}));
		} catch (e) {
			// Not supported
		}
	}

	_setupUnloadReporting() {
		if (this.endpoint) {
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'hidden') {
					this._sendMetrics();
				}
			});
		}
	}

	/**
	 * Track API call performance
	 */
	trackApiCall(endpoint, duration, success = true) {
		performanceMetrics.update((m) => {
			const calls = [...m.apiCalls, { endpoint, duration, success, timestamp: Date.now() }].slice(
				-100
			);
			const avgLatency = Math.round(calls.reduce((sum, c) => sum + c.duration, 0) / calls.length);
			return { ...m, apiCalls: calls, avgApiLatency: avgLatency };
		});
	}

	/**
	 * Create a tracked fetch wrapper
	 */
	createTrackedFetch() {
		const tracker = this;
		return async function trackedFetch(url, options = {}) {
			const start = performance.now();
			let success = true;

			try {
				const response = await fetch(url, options);
				success = response.ok;
				return response;
			} catch (error) {
				success = false;
				throw error;
			} finally {
				const duration = Math.round(performance.now() - start);
				tracker.trackApiCall(url, duration, success);
			}
		};
	}

	/**
	 * Mark a custom timing
	 */
	mark(name) {
		if (browser) {
			performance.mark(name);
		}
	}

	/**
	 * Measure between two marks
	 */
	measure(name, startMark, endMark) {
		if (browser) {
			try {
				performance.measure(name, startMark, endMark);
				const measure = performance.getEntriesByName(name, 'measure')[0];
				return measure ? Math.round(measure.duration) : null;
			} catch (e) {
				return null;
			}
		}
		return null;
	}

	/**
	 * Get current metrics
	 */
	getMetrics() {
		return get(performanceMetrics);
	}

	/**
	 * Get performance score (0-100)
	 */
	getScore() {
		const metrics = get(performanceMetrics);
		let score = 100;

		// Deduct points based on budgets
		if (metrics.lcp > PERFORMANCE_BUDGETS.lcp.max) score -= 25;
		else if (metrics.lcp > PERFORMANCE_BUDGETS.lcp.target) score -= 10;

		if (metrics.fid > PERFORMANCE_BUDGETS.fid.max) score -= 20;
		else if (metrics.fid > PERFORMANCE_BUDGETS.fid.target) score -= 8;

		if (metrics.cls > PERFORMANCE_BUDGETS.cls.max) score -= 20;
		else if (metrics.cls > PERFORMANCE_BUDGETS.cls.target) score -= 8;

		if (metrics.avgApiLatency > PERFORMANCE_BUDGETS.apiLatency.max) score -= 15;
		else if (metrics.avgApiLatency > PERFORMANCE_BUDGETS.apiLatency.target) score -= 5;

		return Math.max(0, score);
	}

	/**
	 * Get performance grade
	 */
	getGrade() {
		const score = this.getScore();
		if (score >= 90) return 'A';
		if (score >= 80) return 'B';
		if (score >= 70) return 'C';
		if (score >= 60) return 'D';
		return 'F';
	}

	/**
	 * Check if metrics meet budgets
	 */
	checkBudgets() {
		const metrics = get(performanceMetrics);
		const violations = [];

		for (const [metric, budget] of Object.entries(PERFORMANCE_BUDGETS)) {
			const value = metrics[metric];
			if (value !== null && value > budget.max) {
				violations.push({ metric, value, budget: budget.max, severity: 'critical' });
			} else if (value !== null && value > budget.target) {
				violations.push({ metric, value, budget: budget.target, severity: 'warning' });
			}
		}

		return violations;
	}

	/**
	 * Send metrics to endpoint
	 */
	_sendMetrics() {
		if (!this.endpoint) return;

		const metrics = get(performanceMetrics);
		const payload = {
			...metrics,
			url: location.href,
			userAgent: navigator.userAgent,
			connection: navigator.connection?.effectiveType,
			timestamp: Date.now(),
			score: this.getScore()
		};

		// Use sendBeacon for reliability
		navigator.sendBeacon(this.endpoint, JSON.stringify(payload));
	}

	/**
	 * Cleanup observers
	 */
	destroy() {
		this._observers.forEach((o) => o.disconnect());
		this._observers = [];
	}
}

// Singleton instance
export const performanceTracker = browser ? new PerformanceTracker() : null;
