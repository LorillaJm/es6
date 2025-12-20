// src/lib/services/holidayService.js
// Holiday Management Service - Phase 8.2
// Handles holiday UI automation and attendance freeze

import { browser } from '$app/environment';
import { db } from '$lib/firebase';
import { ref, get, set, update, onValue } from 'firebase/database';
import { writable, derived } from 'svelte/store';

/**
 * Holiday store for real-time updates
 */
function createHolidayStore() {
    const { subscribe, set: setStore, update: updateStore } = writable({
        holidays: [],
        todayHoliday: null,
        upcomingHolidays: [],
        isLoading: true
    });

    let unsubscribe = null;

    return {
        subscribe,

        /**
         * Initialize real-time listener
         */
        init: () => {
            if (!browser || !db) return;

            const holidaysRef = ref(db, 'settings/holidays');
            unsubscribe = onValue(holidaysRef, (snapshot) => {
                const holidays = [];
                if (snapshot.exists()) {
                    snapshot.forEach(child => {
                        holidays.push({ id: child.key, ...child.val() });
                    });
                }

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const todayStr = today.toISOString().split('T')[0];

                // Find today's holiday
                const todayHoliday = holidays.find(h => {
                    const holidayDate = new Date(h.date);
                    holidayDate.setHours(0, 0, 0, 0);
                    return holidayDate.toISOString().split('T')[0] === todayStr;
                });

                // Find upcoming holidays (next 30 days)
                const thirtyDaysLater = new Date(today);
                thirtyDaysLater.setDate(today.getDate() + 30);

                const upcomingHolidays = holidays
                    .filter(h => {
                        const holidayDate = new Date(h.date);
                        return holidayDate > today && holidayDate <= thirtyDaysLater;
                    })
                    .sort((a, b) => new Date(a.date) - new Date(b.date));

                setStore({
                    holidays,
                    todayHoliday,
                    upcomingHolidays,
                    isLoading: false
                });
            });
        },

        /**
         * Cleanup listener
         */
        destroy: () => {
            if (unsubscribe) {
                unsubscribe();
                unsubscribe = null;
            }
        }
    };
}

export const holidayStore = createHolidayStore();

/**
 * Check if attendance is frozen for a date
 */
export async function isAttendanceFrozen(date = new Date()) {
    if (!browser || !db) return { frozen: false, reason: null };

    try {
        const dateStr = date.toISOString().split('T')[0];
        
        // Check holidays from systemSettings
        const holidaysRef = ref(db, 'systemSettings/holidays');
        const holidaysSnapshot = await get(holidaysRef);
        
        if (holidaysSnapshot.exists()) {
            const holidaysData = holidaysSnapshot.val();
            // Handle both array and object formats
            const holidays = Array.isArray(holidaysData) ? holidaysData : Object.values(holidaysData);
            
            for (const holiday of holidays) {
                if (holiday && holiday.date === dateStr) {
                    return {
                        frozen: true,
                        reason: 'holiday',
                        holiday: holiday,
                        message: `Attendance frozen: ${holiday.name}`
                    };
                }
            }
        }
        
        // Fallback: Check legacy holidays location
        const legacyHolidaysRef = ref(db, 'settings/holidays');
        const legacySnapshot = await get(legacyHolidaysRef);
        
        if (legacySnapshot.exists()) {
            let foundHoliday = null;
            legacySnapshot.forEach(child => {
                const holiday = child.val();
                if (holiday.date === dateStr && holiday.freezeAttendance !== false) {
                    foundHoliday = holiday;
                }
            });

            if (foundHoliday) {
                return {
                    frozen: true,
                    reason: 'holiday',
                    holiday: foundHoliday,
                    message: `Attendance frozen: ${foundHoliday.name}`
                };
            }
        }

        // Check weekend settings from systemSettings
        const settingsRef = ref(db, 'systemSettings/attendance');
        const settingsSnapshot = await get(settingsRef);
        
        if (settingsSnapshot.exists()) {
            const settings = settingsSnapshot.val();
            const dayOfWeek = date.getDay();
            
            // Check if weekend auto-mark is enabled and today is not a work day
            if (settings.weekendAutoMark !== false) {
                const workDays = settings.workDays || [1, 2, 3, 4, 5];
                if (!workDays.includes(dayOfWeek)) {
                    return {
                        frozen: true,
                        reason: 'weekend',
                        message: 'Attendance frozen: Non-work day'
                    };
                }
            }
        } else {
            // Fallback to legacy settings location
            const legacySettingsRef = ref(db, 'settings/attendance');
            const legacySettingsSnapshot = await get(legacySettingsRef);
            
            if (legacySettingsSnapshot.exists()) {
                const settings = legacySettingsSnapshot.val();
                const dayOfWeek = date.getDay();
                
                if (settings.weekendAutoMark && (dayOfWeek === 0 || dayOfWeek === 6)) {
                    const workDays = settings.workDays || [1, 2, 3, 4, 5];
                    if (!workDays.includes(dayOfWeek)) {
                        return {
                            frozen: true,
                            reason: 'weekend',
                            message: 'Attendance frozen: Weekend'
                        };
                    }
                }
            }
        }

        return { frozen: false, reason: null };
    } catch (error) {
        console.error('Error checking attendance freeze:', error);
        return { frozen: false, reason: null, error: error.message };
    }
}

/**
 * Get holiday theme configuration
 */
export function getHolidayTheme(holiday) {
    if (!holiday) return null;

    const themes = {
        christmas: {
            emoji: '🎄',
            colors: { primary: '#C41E3A', secondary: '#228B22', accent: '#FFD700' },
            effects: ['snowfall', 'ornaments'],
            banner: { title: 'Merry Christmas!', subtitle: 'Enjoy the holiday season' }
        },
        'new-year': {
            emoji: '🎆',
            colors: { primary: '#FFD700', secondary: '#C0C0C0', accent: '#1E3A5F' },
            effects: ['fireworks', 'confetti'],
            banner: { title: 'Happy New Year!', subtitle: 'Wishing you a great year ahead' }
        },
        independence: {
            emoji: '🇵🇭',
            colors: { primary: '#0038A8', secondary: '#CE1126', accent: '#FCD116' },
            effects: ['flag'],
            banner: { title: 'Happy Independence Day!', subtitle: 'Celebrating freedom' }
        },
        halloween: {
            emoji: '🎃',
            colors: { primary: '#FF6600', secondary: '#6B2D8B', accent: '#1A1A2E' },
            effects: ['ghosts', 'fog'],
            banner: { title: 'Happy Halloween!', subtitle: 'Have a spooky day' }
        },
        valentine: {
            emoji: '❤️',
            colors: { primary: '#E91E63', secondary: '#F8BBD9', accent: '#C2185B' },
            effects: ['hearts'],
            banner: { title: "Happy Valentine's Day!", subtitle: 'Spread the love' }
        }
    };

    // Try to match holiday type
    const holidayName = (holiday.name || '').toLowerCase();
    for (const [key, theme] of Object.entries(themes)) {
        if (holidayName.includes(key.replace('-', ' ')) || holidayName.includes(key)) {
            return { ...theme, holiday };
        }
    }

    // Default theme
    return {
        emoji: '🎉',
        colors: { primary: '#007AFF', secondary: '#5856D6', accent: '#34C759' },
        effects: [],
        banner: { title: holiday.name, subtitle: 'Enjoy your day off!' },
        holiday
    };
}

/**
 * Add a new holiday
 */
export async function addHoliday(holiday) {
    if (!browser || !db) return false;

    try {
        const holidayId = `holiday_${Date.now()}`;
        const holidayRef = ref(db, `settings/holidays/${holidayId}`);
        
        await set(holidayRef, {
            ...holiday,
            id: holidayId,
            freezeAttendance: holiday.freezeAttendance !== false,
            showBanner: holiday.showBanner !== false,
            enableEffects: holiday.enableEffects !== false,
            createdAt: new Date().toISOString()
        });

        return true;
    } catch (error) {
        console.error('Error adding holiday:', error);
        return false;
    }
}

/**
 * Update holiday settings
 */
export async function updateHoliday(holidayId, updates) {
    if (!browser || !db) return false;

    try {
        const holidayRef = ref(db, `settings/holidays/${holidayId}`);
        await update(holidayRef, {
            ...updates,
            updatedAt: new Date().toISOString()
        });
        return true;
    } catch (error) {
        console.error('Error updating holiday:', error);
        return false;
    }
}

/**
 * Delete a holiday
 */
export async function deleteHoliday(holidayId) {
    if (!browser || !db) return false;

    try {
        const holidayRef = ref(db, `settings/holidays/${holidayId}`);
        await set(holidayRef, null);
        return true;
    } catch (error) {
        console.error('Error deleting holiday:', error);
        return false;
    }
}

/**
 * Get attendance freeze status for date range
 */
export async function getFreezeDatesInRange(startDate, endDate) {
    if (!browser || !db) return [];

    try {
        const frozenDates = [];
        const current = new Date(startDate);
        
        while (current <= endDate) {
            const status = await isAttendanceFrozen(current);
            if (status.frozen) {
                frozenDates.push({
                    date: current.toISOString().split('T')[0],
                    ...status
                });
            }
            current.setDate(current.getDate() + 1);
        }

        return frozenDates;
    } catch (error) {
        console.error('Error getting freeze dates:', error);
        return [];
    }
}
