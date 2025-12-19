// src/lib/performance/hooks/usePerformance.js
// Performance hooks for Svelte components

import { browser } from '$app/environment';
import { onMount, onDestroy } from 'svelte';
import { writable, get } from 'svelte/store';

/**
 * Initialize performance monitoring in a component
 */
export function usePerformanceMonitor(options = {}) {
	const { trackRender = true, componentName = 'Unknown' } = options;

	let renderStart;
	let mounted = false;

	if (browser && trackRender) {
		renderStart = performance.now();
	}

	onMount(() => {
		if (browser && trackRender) {
			const renderTime = Math.round(performance.now() - renderStart);
			performance.measure(`render:${componentName}`, {
				start: renderStart,
				duration: renderTime
			});

			if (renderTime > 100) {
				console.warn(`[Performance] Slow render: ${componentName} took ${renderTime}ms`);
			}
		}
		mounted = true;
	});

	return {
		isMounted: () => mounted
	};
}

/**
 * Lazy load data when component becomes visible
 */
export function useLazyData(fetcher, options = {}) {
	const { immediate = false, threshold = 0.1, rootMargin = '100px' } = options;

	const data = writable(null);
	const loading = writable(false);
	const error = writable(null);

	let observer;
	let element;
	let loaded = false;

	async function load() {
		if (loaded || get(loading)) return;

		loading.set(true);
		error.set(null);

		try {
			const result = await fetcher();
			data.set(result);
			loaded = true;
		} catch (e) {
			error.set(e.message);
		} finally {
			loading.set(false);
		}
	}

	function observe(node) {
		element = node;

		if (!browser) {
			load();
			return;
		}

		if (immediate) {
			load();
			return;
		}

		observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && !loaded) {
					load();
					observer.unobserve(element);
				}
			},
			{ threshold, rootMargin }
		);

		observer.observe(element);
	}

	onDestroy(() => {
		if (observer && element) {
			observer.unobserve(element);
		}
	});

	return {
		data,
		loading,
		error,
		observe,
		reload: () => {
			loaded = false;
			return load();
		}
	};
}

/**
 * Debounced value for performance
 */
export function useDebounce(initialValue, delay = 300) {
	const value = writable(initialValue);
	const debouncedValue = writable(initialValue);

	let timeout;

	value.subscribe((v) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => {
			debouncedValue.set(v);
		}, delay);
	});

	onDestroy(() => {
		clearTimeout(timeout);
	});

	return {
		value,
		debouncedValue,
		set: (v) => value.set(v)
	};
}

/**
 * Throttled callback for performance
 */
export function useThrottle(callback, delay = 100) {
	let lastCall = 0;
	let timeout;

	function throttled(...args) {
		const now = Date.now();

		if (now - lastCall >= delay) {
			lastCall = now;
			callback(...args);
		} else {
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				lastCall = Date.now();
				callback(...args);
			}, delay - (now - lastCall));
		}
	}

	onDestroy(() => {
		clearTimeout(timeout);
	});

	return throttled;
}

/**
 * Virtual scroll helper
 */
export function useVirtualScroll(options = {}) {
	const { itemHeight = 50, overscan = 5 } = options;

	const scrollTop = writable(0);
	const containerHeight = writable(0);

	function getVisibleRange(totalItems) {
		const top = get(scrollTop);
		const height = get(containerHeight);

		const startIndex = Math.max(0, Math.floor(top / itemHeight) - overscan);
		const visibleCount = Math.ceil(height / itemHeight) + 2 * overscan;
		const endIndex = Math.min(totalItems - 1, startIndex + visibleCount);

		return {
			startIndex,
			endIndex,
			offsetY: startIndex * itemHeight,
			totalHeight: totalItems * itemHeight
		};
	}

	function handleScroll(event) {
		scrollTop.set(event.target.scrollTop);
	}

	function setContainerHeight(height) {
		containerHeight.set(height);
	}

	return {
		scrollTop,
		containerHeight,
		getVisibleRange,
		handleScroll,
		setContainerHeight
	};
}

/**
 * Prefetch data on hover/focus
 */
export function usePrefetch(fetcher, options = {}) {
	const { delay = 100 } = options;

	let timeout;
	let prefetched = false;
	let prefetchPromise = null;

	function prefetch() {
		if (prefetched || prefetchPromise) return;

		timeout = setTimeout(() => {
			prefetchPromise = fetcher().then((result) => {
				prefetched = true;
				return result;
			});
		}, delay);
	}

	function cancel() {
		clearTimeout(timeout);
	}

	function getPrefetched() {
		return prefetchPromise;
	}

	onDestroy(() => {
		clearTimeout(timeout);
	});

	return {
		prefetch,
		cancel,
		getPrefetched,
		isPrefetched: () => prefetched
	};
}
