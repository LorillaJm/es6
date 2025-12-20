// Theme store for managing user preferences
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const THEME_KEY = 'app-theme';
const ACCENT_KEY = 'app-accent';

// Theme definitions - expanded with more options
export const themes = {
    light: {
        name: 'Light',
        bg: '#F5F5F7',
        cardBg: '#FFFFFF',
        text: '#0A0A0A',
        textSecondary: '#8E8E93',
        border: '#D1D1D6',
        borderLight: '#E5E5EA'
    },
    dark: {
        name: 'Dark',
        bg: '#1C1C1E',
        cardBg: '#2C2C2E',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        border: '#3A3A3C',
        borderLight: '#48484A'
    },
    amethyst: {
        name: 'Amethyst',
        bg: '#1A1625',
        cardBg: '#252033',
        text: '#FFFFFF',
        textSecondary: '#9D8EC9',
        border: '#3D3456',
        borderLight: '#4A4066'
    },
    oled: {
        name: 'OLED Pure Black',
        bg: '#000000',
        cardBg: '#0A0A0A',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        border: '#1C1C1E',
        borderLight: '#2C2C2E'
    },
    midnight: {
        name: 'Midnight Blue',
        bg: '#0D1B2A',
        cardBg: '#1B263B',
        text: '#E0E1DD',
        textSecondary: '#778DA9',
        border: '#415A77',
        borderLight: '#1B263B'
    },
    forest: {
        name: 'Forest',
        bg: '#1A2F1A',
        cardBg: '#243524',
        text: '#E8F5E9',
        textSecondary: '#81C784',
        border: '#2E7D32',
        borderLight: '#1B5E20'
    },
    sunset: {
        name: 'Sunset',
        bg: '#2D1B1B',
        cardBg: '#3D2525',
        text: '#FFE0B2',
        textSecondary: '#FFAB91',
        border: '#5D4037',
        borderLight: '#4E342E'
    },
    ocean: {
        name: 'Ocean',
        bg: '#0A1929',
        cardBg: '#132F4C',
        text: '#B2BAC2',
        textSecondary: '#5090D3',
        border: '#1E4976',
        borderLight: '#173A5E'
    }
};

// Accent color options - expanded
export const accentColors = [
    { name: 'Blue', value: '#007AFF' },
    { name: 'Purple', value: '#AF52DE' },
    { name: 'Pink', value: '#FF2D55' },
    { name: 'Red', value: '#FF3B30' },
    { name: 'Orange', value: '#FF9500' },
    { name: 'Yellow', value: '#FFCC00' },
    { name: 'Green', value: '#34C759' },
    { name: 'Teal', value: '#5AC8FA' },
    { name: 'Indigo', value: '#5856D6' },
    { name: 'Mint', value: '#00C7BE' },
    { name: 'Coral', value: '#FF6B6B' },
    { name: 'Lavender', value: '#B4A7D6' }
];

function createThemeStore() {
    const defaultTheme = 'light';
    const defaultAccent = '#007AFF';
    
    const stored = browser ? localStorage.getItem(THEME_KEY) : null;
    const storedAccent = browser ? localStorage.getItem(ACCENT_KEY) : null;
    
    const { subscribe, set, update } = writable({
        mode: stored || defaultTheme,
        accent: storedAccent || defaultAccent
    });

    return {
        subscribe,
        setTheme: (mode) => {
            update(state => {
                if (browser) localStorage.setItem(THEME_KEY, mode);
                applyTheme(mode, state.accent);
                return { ...state, mode };
            });
        },
        setAccent: (accent) => {
            update(state => {
                if (browser) localStorage.setItem(ACCENT_KEY, accent);
                applyTheme(state.mode, accent);
                return { ...state, accent };
            });
        },
        init: () => {
            if (browser) {
                const mode = localStorage.getItem(THEME_KEY) || defaultTheme;
                const accent = localStorage.getItem(ACCENT_KEY) || defaultAccent;
                set({ mode, accent });
                applyTheme(mode, accent);
            }
        }
    };
}

function applyTheme(mode, accent) {
    if (!browser) return;
    
    const theme = themes[mode] || themes.light;
    const root = document.documentElement;
    
    root.style.setProperty('--theme-bg', theme.bg);
    root.style.setProperty('--theme-card-bg', theme.cardBg);
    root.style.setProperty('--theme-text', theme.text);
    root.style.setProperty('--theme-text-secondary', theme.textSecondary);
    root.style.setProperty('--theme-border', theme.border);
    root.style.setProperty('--theme-border-light', theme.borderLight);
    root.style.setProperty('--apple-accent', accent);
    root.style.setProperty('--apple-accent-hover', adjustColor(accent, -20));
    
    // Set data attribute for CSS selectors
    root.setAttribute('data-theme', mode);
}

function adjustColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export const themeStore = createThemeStore();
