// src/lib/stores/systemSettings.js
// Client-side store for system settings (theme, attendance rules, etc.)

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

const DEFAULT_SETTINGS = {
    general: { siteName: 'Student Attendance', timezone: 'Asia/Manila', dateFormat: 'MM/DD/YYYY' },
    attendance: {
        startTime: '08:00', endTime: '17:00', autoCheckout: true, autoCheckoutTime: '18:00',
        lateThreshold: 15, gracePeriod: 15, geofenceEnabled: true, workDays: [1, 2, 3, 4, 5],
        holidayAutoMark: true, weekendAutoMark: true
    },
    epass: { qrExpiration: 30, animatedHologram: true, antiScreenshot: true, watermarkEnabled: true },
    theme: {
        accentColor: '#007AFF', themeMode: 'light', logoUrl: '', seasonalTheme: 'none',
        welcomeBanner: { enabled: false, title: '', message: '', imageUrl: '' }
    },
    departments: [], years: [], sections: [], holidays: []
};

function createSystemSettingsStore() {
    const { subscribe, set, update } = writable(DEFAULT_SETTINGS);
    
    return {
        subscribe,
        set,
        update,
        
        async load() {
            if (!browser) return;
            try {
                // Try to load from localStorage first for instant UI
                const cached = localStorage.getItem('systemSettings');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    set({ ...DEFAULT_SETTINGS, ...parsed });
                }
                
                // Then fetch fresh from server
                const response = await fetch('/api/settings');
                if (response.ok) {
                    const data = await response.json();
                    if (data.settings) {
                        set({ ...DEFAULT_SETTINGS, ...data.settings });
                        localStorage.setItem('systemSettings', JSON.stringify(data.settings));
                    }
                }
            } catch (error) {
                console.error('Failed to load system settings:', error);
            }
        },
        
        applyTheme(settings) {
            if (!browser) return;
            const root = document.documentElement;
            
            // Apply accent color
            if (settings.theme?.accentColor) {
                root.style.setProperty('--apple-accent', settings.theme.accentColor);
                root.style.setProperty('--apple-accent-hover', adjustColor(settings.theme.accentColor, -20));
            }
            
            // Apply theme mode
            if (settings.theme?.themeMode) {
                const themeColors = {
                    light: { bg: '#F5F5F7', cardBg: '#FFFFFF', text: '#0A0A0A', textSecondary: '#8E8E93', border: '#D1D1D6', borderLight: '#E5E5EA' },
                    dark: { bg: '#1C1C1E', cardBg: '#2C2C2E', text: '#FFFFFF', textSecondary: '#8E8E93', border: '#3A3A3C', borderLight: '#48484A' },
                    amethyst: { bg: '#1A1625', cardBg: '#252033', text: '#FFFFFF', textSecondary: '#9D8EC9', border: '#3D3456', borderLight: '#4A4066' },
                    oled: { bg: '#000000', cardBg: '#0A0A0A', text: '#FFFFFF', textSecondary: '#8E8E93', border: '#1C1C1E', borderLight: '#2C2C2E' },
                    midnight: { bg: '#0D1B2A', cardBg: '#1B263B', text: '#E0E1DD', textSecondary: '#778DA9', border: '#415A77', borderLight: '#1B263B' },
                    forest: { bg: '#1A2F1A', cardBg: '#243524', text: '#E8F5E9', textSecondary: '#81C784', border: '#2E7D32', borderLight: '#1B5E20' },
                    sunset: { bg: '#2D1B1B', cardBg: '#3D2525', text: '#FFE0B2', textSecondary: '#FFAB91', border: '#5D4037', borderLight: '#4E342E' },
                    ocean: { bg: '#0A1929', cardBg: '#132F4C', text: '#B2BAC2', textSecondary: '#5090D3', border: '#1E4976', borderLight: '#173A5E' }
                };
                
                const theme = themeColors[settings.theme.themeMode] || themeColors.light;
                root.style.setProperty('--theme-bg', theme.bg);
                root.style.setProperty('--theme-card-bg', theme.cardBg);
                root.style.setProperty('--theme-text', theme.text);
                root.style.setProperty('--theme-text-secondary', theme.textSecondary);
                root.style.setProperty('--theme-border', theme.border);
                root.style.setProperty('--theme-border-light', theme.borderLight);
                root.setAttribute('data-theme', settings.theme.themeMode);
            }
            
            // Apply seasonal theme
            if (settings.theme?.seasonalTheme && settings.theme.seasonalTheme !== 'none') {
                document.body.setAttribute('data-seasonal-theme', settings.theme.seasonalTheme);
            } else {
                document.body.removeAttribute('data-seasonal-theme');
            }
        }
    };
}

function adjustColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export const systemSettings = createSystemSettingsStore();

// Derived stores for specific settings
export const attendanceSettings = derived(systemSettings, $s => $s.attendance);
export const epassSettings = derived(systemSettings, $s => $s.epass);
export const themeSettings = derived(systemSettings, $s => $s.theme);
export const departments = derived(systemSettings, $s => $s.departments || []);
export const yearLevels = derived(systemSettings, $s => $s.years || []);
export const sectionsList = derived(systemSettings, $s => $s.sections || []);
export const holidays = derived(systemSettings, $s => $s.holidays || []);
