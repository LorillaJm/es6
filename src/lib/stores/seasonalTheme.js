// Seasonal Theme Store - Premium Holiday Dynamic Themes
import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

const SEASONAL_PREFS_KEY = 'seasonal-theme-prefs';

// Holiday definitions with date ranges and theme configurations
export const holidays = {
    christmas: {
        id: 'christmas',
        name: 'Christmas',
        emoji: '🎄',
        startMonth: 12, startDay: 1,
        endMonth: 12, endDay: 31,
        colors: {
            primary: '#C41E3A',      // Christmas red
            secondary: '#228B22',     // Forest green
            accent: '#FFD700',        // Gold
            glow: 'rgba(196, 30, 58, 0.3)'
        },
        effects: ['snowfall', 'santaHat', 'ornaments', 'bells'],
        sounds: { login: 'bells', notification: 'chime' },
        mascot: 'santa'
    },
    halloween: {
        id: 'halloween',
        name: 'Halloween',
        emoji: '🎃',
        startMonth: 10, startDay: 25,
        endMonth: 11, endDay: 1,
        colors: {
            primary: '#FF6600',       // Pumpkin orange
            secondary: '#6B2D8B',     // Purple
            accent: '#1A1A2E',        // Dark blue
            glow: 'rgba(255, 102, 0, 0.3)'
        },
        effects: ['fog', 'ghosts', 'pumpkin', 'cobwebs'],
        sounds: { login: 'spooky', notification: 'boo' },
        mascot: 'ghost'
    },
    newYear: {
        id: 'newYear',
        name: 'New Year',
        emoji: '🎆',
        startMonth: 1, startDay: 1,
        endMonth: 1, endDay: 7,
        colors: {
            primary: '#FFD700',       // Gold
            secondary: '#C0C0C0',     // Silver
            accent: '#1E3A5F',        // Midnight blue
            glow: 'rgba(255, 215, 0, 0.3)'
        },
        effects: ['confetti', 'fireworks', 'sparkles'],
        sounds: { login: 'celebration', notification: 'pop' },
        mascot: 'firework'
    },
    valentine: {
        id: 'valentine',
        name: "Valentine's Day",
        emoji: '❤️',
        startMonth: 2, startDay: 10,
        endMonth: 2, endDay: 14,
        colors: {
            primary: '#E91E63',       // Pink
            secondary: '#F8BBD9',     // Light pink
            accent: '#C2185B',        // Deep pink
            glow: 'rgba(233, 30, 99, 0.3)'
        },
        effects: ['hearts', 'ribbons', 'heartFrame'],
        sounds: { login: 'heartbeat', notification: 'kiss' },
        mascot: 'cupid'
    },
    independence: {
        id: 'independence',
        name: 'Independence Day (PH)',
        emoji: '🇵🇭',
        startMonth: 6, startDay: 12,
        endMonth: 6, endDay: 12,
        colors: {
            primary: '#0038A8',       // Blue
            secondary: '#CE1126',     // Red
            accent: '#FCD116',        // Yellow
            glow: 'rgba(0, 56, 168, 0.3)'
        },
        effects: ['flag', 'stars'],
        sounds: { login: 'fanfare', notification: 'bell' },
        mascot: 'flag'
    },
    eid: {
        id: 'eid',
        name: 'Eid',
        emoji: '🌙',
        // Note: Eid dates vary - this is approximate
        startMonth: 4, startDay: 10,
        endMonth: 4, endDay: 12,
        colors: {
            primary: '#C9A227',       // Gold
            secondary: '#1B4D3E',     // Deep green
            accent: '#FFFFFF',        // White
            glow: 'rgba(201, 162, 39, 0.3)'
        },
        effects: ['crescent', 'geometric', 'lanterns'],
        sounds: { login: 'peaceful', notification: 'soft' },
        mascot: 'moon'
    }
};

// Decoration intensity levels
export const intensityLevels = {
    minimal: { particles: 15, decorations: false, animations: 'subtle' },
    standard: { particles: 30, decorations: true, animations: 'normal' },
    full: { particles: 50, decorations: true, animations: 'full' }
};

// Check if a date falls within a holiday range
function isDateInHoliday(date, holiday) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // Handle year wrap (e.g., Dec 25 - Jan 7)
    if (holiday.startMonth > holiday.endMonth) {
        return (month === holiday.startMonth && day >= holiday.startDay) ||
               (month === holiday.endMonth && day <= holiday.endDay) ||
               (month > holiday.startMonth || month < holiday.endMonth);
    }
    
    // Same month
    if (holiday.startMonth === holiday.endMonth) {
        return month === holiday.startMonth && day >= holiday.startDay && day <= holiday.endDay;
    }
    
    // Different months, same year
    return (month === holiday.startMonth && day >= holiday.startDay) ||
           (month === holiday.endMonth && day <= holiday.endDay) ||
           (month > holiday.startMonth && month < holiday.endMonth);
}

// Get current active holiday
function getCurrentHoliday(date = new Date()) {
    for (const [key, holiday] of Object.entries(holidays)) {
        if (isDateInHoliday(date, holiday)) {
            return holiday;
        }
    }
    return null;
}

// Create the seasonal theme store
function createSeasonalStore() {
    const defaultPrefs = {
        enabled: false,           // Disabled by default for new users
        intensity: 'standard',
        soundEnabled: false,
        manualOverride: null,     // null = auto, or holiday id
        hasSeenIntro: false,      // Track if user has seen the introduction
        introDismissedAt: null    // When user dismissed the intro
    };
    
    const stored = browser ? JSON.parse(localStorage.getItem(SEASONAL_PREFS_KEY) || 'null') : null;
    const initialPrefs = { ...defaultPrefs, ...stored };
    
    const { subscribe, set, update } = writable(initialPrefs);
    
    return {
        subscribe,
        
        // Toggle seasonal themes on/off
        toggle: () => {
            update(state => {
                const newState = { ...state, enabled: !state.enabled };
                if (browser) localStorage.setItem(SEASONAL_PREFS_KEY, JSON.stringify(newState));
                return newState;
            });
        },
        
        // Set decoration intensity
        setIntensity: (intensity) => {
            update(state => {
                const newState = { ...state, intensity };
                if (browser) localStorage.setItem(SEASONAL_PREFS_KEY, JSON.stringify(newState));
                return newState;
            });
        },
        
        // Toggle sound effects
        toggleSound: () => {
            update(state => {
                const newState = { ...state, soundEnabled: !state.soundEnabled };
                if (browser) localStorage.setItem(SEASONAL_PREFS_KEY, JSON.stringify(newState));
                return newState;
            });
        },
        
        // Manual override (for admin or preview)
        setManualOverride: (holidayId) => {
            update(state => {
                const newState = { ...state, manualOverride: holidayId };
                if (browser) localStorage.setItem(SEASONAL_PREFS_KEY, JSON.stringify(newState));
                return newState;
            });
        },
        
        // Clear manual override (return to auto)
        clearOverride: () => {
            update(state => {
                const newState = { ...state, manualOverride: null };
                if (browser) localStorage.setItem(SEASONAL_PREFS_KEY, JSON.stringify(newState));
                return newState;
            });
        },
        
        // Mark intro as seen
        markIntroSeen: () => {
            update(state => {
                const newState = { ...state, hasSeenIntro: true };
                if (browser) localStorage.setItem(SEASONAL_PREFS_KEY, JSON.stringify(newState));
                return newState;
            });
        },
        
        // Dismiss intro (with timestamp)
        dismissIntro: () => {
            update(state => {
                const newState = { ...state, hasSeenIntro: true, introDismissedAt: Date.now() };
                if (browser) localStorage.setItem(SEASONAL_PREFS_KEY, JSON.stringify(newState));
                return newState;
            });
        },
        
        // Enable and mark intro as seen (when user enables from intro)
        enableFromIntro: () => {
            update(state => {
                const newState = { ...state, enabled: true, hasSeenIntro: true };
                if (browser) localStorage.setItem(SEASONAL_PREFS_KEY, JSON.stringify(newState));
                return newState;
            });
        },
        
        // Reset to defaults
        reset: () => {
            if (browser) localStorage.removeItem(SEASONAL_PREFS_KEY);
            set(defaultPrefs);
        }
    };
}

export const seasonalPrefs = createSeasonalStore();

// Derived store for current active holiday theme
export const activeHoliday = derived(
    seasonalPrefs,
    ($prefs) => {
        if (!$prefs.enabled) return null;
        
        // Manual override takes priority
        if ($prefs.manualOverride) {
            return holidays[$prefs.manualOverride] || null;
        }
        
        // Auto-detect based on date
        return getCurrentHoliday();
    }
);

// Derived store for current theme configuration
export const seasonalConfig = derived(
    [seasonalPrefs, activeHoliday],
    ([$prefs, $holiday]) => {
        if (!$holiday) return null;
        
        const intensity = intensityLevels[$prefs.intensity];
        
        return {
            holiday: $holiday,
            intensity,
            soundEnabled: $prefs.soundEnabled,
            cssVars: {
                '--seasonal-primary': $holiday.colors.primary,
                '--seasonal-secondary': $holiday.colors.secondary,
                '--seasonal-accent': $holiday.colors.accent,
                '--seasonal-glow': $holiday.colors.glow
            }
        };
    }
);

// Utility to get days until next holiday
export function getDaysUntilNextHoliday() {
    const now = new Date();
    let nearestDays = Infinity;
    let nearestHoliday = null;
    
    for (const holiday of Object.values(holidays)) {
        const targetDate = new Date(now.getFullYear(), holiday.startMonth - 1, holiday.startDay);
        if (targetDate < now) {
            targetDate.setFullYear(targetDate.getFullYear() + 1);
        }
        const days = Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24));
        if (days < nearestDays) {
            nearestDays = days;
            nearestHoliday = holiday;
        }
    }
    
    return { holiday: nearestHoliday, days: nearestDays };
}
