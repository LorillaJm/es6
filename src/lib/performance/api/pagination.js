// src/lib/performance/api/pagination.js
// Pagination utilities for efficient data loading

import { writable, derived, get } from 'svelte/store';

/**
 * Default pagination config
 */
const DEFAULT_CONFIG = {
	pageSize: 20,
	maxPageSize: 100,
	initialPage: 1
};

/**
 * Create a paginated data store
 */
export function createPaginatedStore(fetcher, config = {}) {
	const { pageSize = DEFAULT_CONFIG.pageSize, initialPage = DEFAULT_CONFIG.initialPage } = config;

	const state = writable({
		data: [],
		page: initialPage,
		pageSize,
		total: 0,
		totalPages: 0,
		hasMore: false,
		isLoading: false,
		isLoadingMore: false,
		error: null
	});

	let currentFetch = null;

	/**
	 * Load a specific page
	 */
	async function loadPage(page = 1, append = false) {
		const currentState = get(state);

		state.update((s) => ({
			...s,
			isLoading: !append,
			isLoadingMore: append,
			error: null
		}));

		try {
			// Cancel previous fetch
			if (currentFetch) {
				currentFetch.abort?.();
			}

			const controller = new AbortController();
			currentFetch = controller;

			const result = await fetcher({
				page,
				limit: pageSize,
				signal: controller.signal
			});

			const { data, total, hasMore } = result;

			state.update((s) => ({
				...s,
				data: append ? [...s.data, ...data] : data,
				page,
				total: total || s.total,
				totalPages: Math.ceil((total || s.total) / pageSize),
				hasMore: hasMore ?? data.length === pageSize,
				isLoading: false,
				isLoadingMore: false
			}));

			return result;
		} catch (error) {
			if (error.name !== 'AbortError') {
				state.update((s) => ({
					...s,
					isLoading: false,
					isLoadingMore: false,
					error: error.message
				}));
			}
			throw error;
		}
	}

	/**
	 * Load next page
	 */
	async function loadMore() {
		const currentState = get(state);
		if (currentState.isLoadingMore || !currentState.hasMore) return;

		return loadPage(currentState.page + 1, true);
	}

	/**
	 * Refresh current data
	 */
	async function refresh() {
		return loadPage(1, false);
	}

	/**
	 * Reset to initial state
	 */
	function reset() {
		state.set({
			data: [],
			page: initialPage,
			pageSize,
			total: 0,
			totalPages: 0,
			hasMore: false,
			isLoading: false,
			isLoadingMore: false,
			error: null
		});
	}

	return {
		subscribe: state.subscribe,
		loadPage,
		loadMore,
		refresh,
		reset
	};
}

/**
 * Create an infinite scroll store with cursor-based pagination
 */
export function createInfiniteStore(fetcher, config = {}) {
	const { pageSize = DEFAULT_CONFIG.pageSize } = config;

	const state = writable({
		data: [],
		cursor: null,
		hasMore: true,
		isLoading: false,
		isLoadingMore: false,
		error: null
	});

	/**
	 * Load more data
	 */
	async function loadMore() {
		const currentState = get(state);
		if (currentState.isLoadingMore || !currentState.hasMore) return;

		state.update((s) => ({
			...s,
			isLoadingMore: true,
			error: null
		}));

		try {
			const result = await fetcher({
				cursor: currentState.cursor,
				limit: pageSize
			});

			const { data, nextCursor, hasMore } = result;

			state.update((s) => ({
				...s,
				data: [...s.data, ...data],
				cursor: nextCursor,
				hasMore: hasMore ?? !!nextCursor,
				isLoadingMore: false
			}));

			return result;
		} catch (error) {
			state.update((s) => ({
				...s,
				isLoadingMore: false,
				error: error.message
			}));
			throw error;
		}
	}

	/**
	 * Initial load
	 */
	async function load() {
		state.update((s) => ({
			...s,
			isLoading: true,
			data: [],
			cursor: null,
			hasMore: true,
			error: null
		}));

		try {
			const result = await fetcher({ cursor: null, limit: pageSize });
			const { data, nextCursor, hasMore } = result;

			state.update((s) => ({
				...s,
				data,
				cursor: nextCursor,
				hasMore: hasMore ?? !!nextCursor,
				isLoading: false
			}));

			return result;
		} catch (error) {
			state.update((s) => ({
				...s,
				isLoading: false,
				error: error.message
			}));
			throw error;
		}
	}

	/**
	 * Refresh data
	 */
	async function refresh() {
		return load();
	}

	return {
		subscribe: state.subscribe,
		load,
		loadMore,
		refresh
	};
}

/**
 * Virtual scroll helper - calculates visible items
 */
export function createVirtualScroller(config = {}) {
	const { itemHeight = 50, overscan = 5, containerHeight = 400 } = config;

	return function getVisibleRange(scrollTop, totalItems) {
		const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
		const visibleCount = Math.ceil(containerHeight / itemHeight) + 2 * overscan;
		const endIndex = Math.min(totalItems - 1, startIndex + visibleCount);

		return {
			startIndex,
			endIndex,
			offsetY: startIndex * itemHeight,
			totalHeight: totalItems * itemHeight
		};
	};
}
