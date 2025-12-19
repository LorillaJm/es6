// src/lib/services/dashboardDataService.js
// Optimized Dashboard Data Service with smart loading and caching

import { browser } from '$app/environment';
import { writable, derived, get } from 'svelte/store';
import { db } from '$lib/firebase';
import { ref, get as firebaseGet, query, orderByChild, limitToLast } from 'firebase/database';
import {
	format,
	startOfWeek,
	endOfWeek,
	startOfMonth,
	endOfMonth,
	differenceInMinutes,
	subDays,
	eachDayOfInterval
} from 'date-fns';

/**
 * Dashboard data store with loading states
 */
export const dashboardData = writable({
	// Critical data (loads first)
	user: null,
	todayStatus: 'not_checked_in',
	todayCheckIn: null,
	todayHours: 0,

	// Secondary data (loads after)
	weekHours: 0,
	monthDays: 0,
	monthHours: 0,
	streak: 0,
	onTimeRate: 0,
	avgCheckIn: null,
	weeklyData: [],
	recentActivity: [],

	// Loading states
	isLoadingCritical: true,
	isLoadingSecondary: true,
	lastUpdated: null,
	error: null
});

/**
 * Cache for dashboard data
 */
const cache = {
	data: null,
	timestamp: null,
	ttl: 30000 // 30 seconds
};

/**
 * Check if cache is valid
 */
function isCacheValid() {
	return cache.data && cache.timestamp && Date.now() - cache.timestamp < cache.ttl;
}

/**
 * Load critical dashboard data (fast path)
 * This loads only what's needed for initial render
 */
export async function loadCriticalData(userId) {
	if (!browser || !db || !userId) return null;

	dashboardData.update((d) => ({ ...d, isLoadingCritical: true, error: null }));

	try {
		const today = new Date();
		const todayStr = today.toDateString();

		// Single query for today's record
		const todaySnapshot = await firebaseGet(ref(db, `attendance/${userId}`));

		let todayRecord = null;
		if (todaySnapshot.exists()) {
			todaySnapshot.forEach((child) => {
				const record = child.val();
				if (record.date === todayStr) {
					todayRecord = { id: child.key, ...record };
				}
			});
		}

		const criticalData = {
			todayStatus: todayRecord?.currentStatus || 'not_checked_in',
			todayCheckIn: todayRecord?.checkIn?.timestamp || null,
			todayHours: todayRecord ? calculateWorkMinutes(todayRecord, true) / 60 : 0,
			isLoadingCritical: false
		};

		dashboardData.update((d) => ({ ...d, ...criticalData }));

		return criticalData;
	} catch (error) {
		console.error('Error loading critical data:', error);
		dashboardData.update((d) => ({
			...d,
			isLoadingCritical: false,
			error: error.message
		}));
		return null;
	}
}

/**
 * Load secondary dashboard data (deferred)
 * This loads analytics and history data
 */
export async function loadSecondaryData(userId) {
	if (!browser || !db || !userId) return null;

	// Check cache first
	if (isCacheValid()) {
		dashboardData.update((d) => ({
			...d,
			...cache.data,
			isLoadingSecondary: false
		}));
		return cache.data;
	}

	dashboardData.update((d) => ({ ...d, isLoadingSecondary: true }));

	try {
		const snapshot = await firebaseGet(ref(db, `attendance/${userId}`));

		if (!snapshot.exists()) {
			dashboardData.update((d) => ({ ...d, isLoadingSecondary: false }));
			return null;
		}

		const records = [];
		snapshot.forEach((child) => {
			records.push({ id: child.key, ...child.val() });
		});

		const today = new Date();
		const todayStr = today.toDateString();
		const weekStart = startOfWeek(today, { weekStartsOn: 1 });
		const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
		const monthStart = startOfMonth(today);
		const monthEnd = endOfMonth(today);
		const lastWeekStart = subDays(weekStart, 7);
		const lastWeekEnd = subDays(weekStart, 1);

		// Calculate all stats in one pass
		let weekMinutes = 0;
		let lastWeekMinutes = 0;
		let monthMinutes = 0;
		let monthDays = 0;
		const checkInTimes = [];

		records.forEach((r) => {
			const recordDate = new Date(r.date);
			const isToday = r.date === todayStr;

			if (r.checkIn?.timestamp) {
				// Week hours
				if (recordDate >= weekStart && recordDate <= weekEnd) {
					weekMinutes += calculateWorkMinutes(r, isToday);
				}

				// Last week hours
				if (recordDate >= lastWeekStart && recordDate <= lastWeekEnd) {
					lastWeekMinutes += calculateWorkMinutes(r, false);
				}

				// Month stats
				if (recordDate >= monthStart && recordDate <= monthEnd) {
					monthDays++;
					monthMinutes += calculateWorkMinutes(r, isToday);
				}

				// Check-in times for average
				const checkInDate = new Date(r.checkIn.timestamp);
				checkInTimes.push(checkInDate.getHours() * 60 + checkInDate.getMinutes());
			}
		});

		// Weekly chart data
		const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
		const weeklyData = weekDays.map((day) => {
			const dayRecord = records.find((r) => r.date === day.toDateString());
			const hours = dayRecord ? calculateWorkMinutes(dayRecord, day.toDateString() === todayStr) / 60 : 0;
			return {
				day: format(day, 'EEE'),
				date: format(day, 'MMM d'),
				hours: Math.round(hours * 10) / 10,
				isToday: day.toDateString() === todayStr,
				hasRecord: !!dayRecord
			};
		});

		// Calculate streak
		const sortedRecords = records.sort((a, b) => new Date(b.date) - new Date(a.date));
		let streak = 0;
		for (let i = 0; i < sortedRecords.length; i++) {
			const expectedDate = new Date();
			expectedDate.setDate(expectedDate.getDate() - i);
			if (sortedRecords[i]?.date === expectedDate.toDateString()) {
				streak++;
			} else break;
		}

		// On-time rate (before 9 AM)
		const onTimeRecords = records.filter((r) => {
			if (!r.checkIn?.timestamp) return false;
			const checkInTime = new Date(r.checkIn.timestamp);
			return checkInTime.getHours() < 9 || (checkInTime.getHours() === 9 && checkInTime.getMinutes() === 0);
		});
		const onTimeRate = records.length > 0 ? Math.round((onTimeRecords.length / records.length) * 100) : 0;

		// Average check-in time
		let avgCheckIn = null;
		if (checkInTimes.length > 0) {
			const avgMinutes = checkInTimes.reduce((a, b) => a + b, 0) / checkInTimes.length;
			avgCheckIn = `${Math.floor(avgMinutes / 60)}:${Math.round(avgMinutes % 60)
				.toString()
				.padStart(2, '0')}`;
		}

		// Recent activity (last 5)
		const recentActivity = sortedRecords.slice(0, 5).map((r) => ({
			date: r.date,
			status: r.currentStatus,
			checkIn: r.checkIn?.timestamp,
			checkOut: r.checkOut?.timestamp,
			hours: calculateWorkMinutes(r, r.date === todayStr) / 60
		}));

		const secondaryData = {
			weekHours: Math.round((weekMinutes / 60) * 10) / 10,
			lastWeekHours: Math.round((lastWeekMinutes / 60) * 10) / 10,
			monthDays,
			monthHours: Math.round((monthMinutes / 60) * 10) / 10,
			streak,
			onTimeRate,
			avgCheckIn,
			avgDailyHours: monthDays > 0 ? Math.round((monthMinutes / 60 / monthDays) * 10) / 10 : 0,
			weeklyData,
			recentActivity,
			totalRecords: records.length,
			isLoadingSecondary: false,
			lastUpdated: Date.now()
		};

		// Update cache
		cache.data = secondaryData;
		cache.timestamp = Date.now();

		dashboardData.update((d) => ({ ...d, ...secondaryData }));

		return secondaryData;
	} catch (error) {
		console.error('Error loading secondary data:', error);
		dashboardData.update((d) => ({
			...d,
			isLoadingSecondary: false,
			error: error.message
		}));
		return null;
	}
}

/**
 * Load all dashboard data with priority loading
 */
export async function loadDashboardData(userId) {
	// Load critical data first (fast)
	await loadCriticalData(userId);

	// Then load secondary data (can be slower)
	await loadSecondaryData(userId);
}

/**
 * Refresh dashboard data
 */
export async function refreshDashboard(userId) {
	// Invalidate cache
	cache.data = null;
	cache.timestamp = null;

	return loadDashboardData(userId);
}

/**
 * Calculate work minutes for a record
 */
function calculateWorkMinutes(record, isToday = false) {
	if (!record.checkIn?.timestamp) return 0;

	const checkIn = new Date(record.checkIn.timestamp);
	let endTime;

	if (record.checkOut?.timestamp) {
		endTime = new Date(record.checkOut.timestamp);
	} else if (isToday) {
		if (record.currentStatus === 'onBreak') {
			const breakStart = record.breakIn?.timestamp || record.breakStart?.timestamp;
			endTime = breakStart ? new Date(breakStart) : new Date();
		} else {
			endTime = new Date();
		}
	} else {
		return 0;
	}

	const totalMinutes = differenceInMinutes(endTime, checkIn);
	const breakMinutes = calculateBreakMinutes(record, isToday);

	if (record.currentStatus !== 'onBreak') {
		return Math.max(0, totalMinutes - breakMinutes);
	}

	return Math.max(0, totalMinutes);
}

/**
 * Calculate break minutes for a record
 */
function calculateBreakMinutes(record, isToday = false) {
	const breakStart = record.breakIn?.timestamp || record.breakStart?.timestamp;
	const breakEnd = record.breakOut?.timestamp || record.breakEnd?.timestamp;

	if (!breakStart) return 0;

	const breakStartTime = new Date(breakStart);

	if (isToday && record.currentStatus === 'onBreak') {
		return differenceInMinutes(new Date(), breakStartTime);
	}

	if (breakEnd) {
		return differenceInMinutes(new Date(breakEnd), breakStartTime);
	}

	return 0;
}

/**
 * Subscribe to real-time updates for today's record
 */
export function subscribeToTodayUpdates(userId, callback) {
	// This integrates with your existing liveSyncEngine
	// Import and use subscribeToTodayAttendance from there
	return () => {}; // Return unsubscribe function
}

/**
 * Invalidate dashboard cache
 */
export function invalidateCache() {
	cache.data = null;
	cache.timestamp = null;
}
