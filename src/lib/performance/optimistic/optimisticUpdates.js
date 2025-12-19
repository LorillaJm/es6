// src/lib/performance/optimistic/optimisticUpdates.js
// Optimistic UI Updates - Update UI immediately, sync in background

import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';

/**
 * Optimistic update manager
 */
export class OptimisticUpdateManager {
	constructor() {
		this.pendingUpdates = new Map();
		this.rollbackHandlers = new Map();
	}

	/**
	 * Execute an optimistic update
	 * @param {string} key - Unique identifier for this update
	 * @param {Function} optimisticUpdate - Function to update UI immediately
	 * @param {Function} serverAction - Async function to perform server action
	 * @param {Function} rollback - Function to rollback on failure
	 */
	async execute(key, optimisticUpdate, serverAction, rollback) {
		// Store rollback handler
		this.rollbackHandlers.set(key, rollback);

		// Apply optimistic update immediately
		const previousState = optimisticUpdate();

		// Track pending update
		this.pendingUpdates.set(key, {
			timestamp: Date.now(),
			previousState
		});

		try {
			// Execute server action
			const result = await serverAction();

			// Success - remove from pending
			this.pendingUpdates.delete(key);
			this.rollbackHandlers.delete(key);

			return { success: true, data: result };
		} catch (error) {
			// Failure - rollback
			this.rollback(key);

			return { success: false, error };
		}
	}

	/**
	 * Rollback a specific update
	 */
	rollback(key) {
		const handler = this.rollbackHandlers.get(key);
		const pending = this.pendingUpdates.get(key);

		if (handler && pending) {
			handler(pending.previousState);
		}

		this.pendingUpdates.delete(key);
		this.rollbackHandlers.delete(key);
	}

	/**
	 * Rollback all pending updates
	 */
	rollbackAll() {
		for (const key of this.pendingUpdates.keys()) {
			this.rollback(key);
		}
	}

	/**
	 * Check if there are pending updates
	 */
	hasPending() {
		return this.pendingUpdates.size > 0;
	}

	/**
	 * Get pending update count
	 */
	getPendingCount() {
		return this.pendingUpdates.size;
	}
}

/**
 * Create an optimistic store wrapper
 */
export function createOptimisticStore(initialValue, options = {}) {
	const { onError = console.error } = options;

	const store = writable(initialValue);
	const pending = writable(false);
	const error = writable(null);

	/**
	 * Update with optimistic behavior
	 */
	async function optimisticUpdate(optimisticValue, serverAction) {
		const previousValue = get(store);

		// Apply optimistic update
		store.set(optimisticValue);
		pending.set(true);
		error.set(null);

		try {
			const result = await serverAction();
			pending.set(false);
			return result;
		} catch (err) {
			// Rollback on error
			store.set(previousValue);
			pending.set(false);
			error.set(err.message);
			onError(err);
			throw err;
		}
	}

	/**
	 * Update a specific field optimistically
	 */
	async function optimisticFieldUpdate(field, value, serverAction) {
		const previousValue = get(store);
		const optimisticValue = { ...previousValue, [field]: value };

		return optimisticUpdate(optimisticValue, serverAction);
	}

	return {
		subscribe: store.subscribe,
		set: store.set,
		update: store.update,
		optimisticUpdate,
		optimisticFieldUpdate,
		pending: { subscribe: pending.subscribe },
		error: { subscribe: error.subscribe }
	};
}

/**
 * Attendance-specific optimistic actions
 */
export const attendanceOptimistic = {
	/**
	 * Optimistic check-in
	 */
	checkIn(store, serverAction) {
		const optimisticState = {
			status: 'checkedIn',
			checkInTime: new Date().toISOString(),
			pending: true
		};

		return store.optimisticUpdate(
			(current) => ({ ...current, ...optimisticState }),
			serverAction
		);
	},

	/**
	 * Optimistic check-out
	 */
	checkOut(store, serverAction) {
		const optimisticState = {
			status: 'checkedOut',
			checkOutTime: new Date().toISOString(),
			pending: true
		};

		return store.optimisticUpdate(
			(current) => ({ ...current, ...optimisticState }),
			serverAction
		);
	},

	/**
	 * Optimistic break start
	 */
	startBreak(store, serverAction) {
		const optimisticState = {
			status: 'onBreak',
			breakStartTime: new Date().toISOString(),
			pending: true
		};

		return store.optimisticUpdate(
			(current) => ({ ...current, ...optimisticState }),
			serverAction
		);
	},

	/**
	 * Optimistic break end
	 */
	endBreak(store, serverAction) {
		const optimisticState = {
			status: 'checkedIn',
			breakEndTime: new Date().toISOString(),
			pending: true
		};

		return store.optimisticUpdate(
			(current) => ({ ...current, ...optimisticState }),
			serverAction
		);
	}
};

// Default manager instance
export const optimisticManager = browser ? new OptimisticUpdateManager() : null;
