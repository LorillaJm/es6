import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// Storage key for persistence
const STORAGE_KEY = 'pcc_app_install_prefs';

// Default preferences
const defaultPrefs = {
    dismissed: false,
    dismissedAt: null,
    neverShow: false,
    pageVisits: 0,
    lastVisit: null,
    isInstalled: false,
    hasSeenPrompt: false
};

// Load preferences from localStorage
function loadPrefs() {
    if (!browser) return defaultPrefs;
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? { ...defaultPrefs, ...JSON.parse(stored) } : defaultPrefs;
    } catch {
        return defaultPrefs;
    }
}

// Save preferences to localStorage
function savePrefs(prefs) {
    if (!browser) return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
        console.warn('Failed to save app install prefs:', e);
    }
}

// Create the store
function createAppInstallStore() {
    const { subscribe, set, update } = writable(loadPrefs());

    return {
        subscribe,
        
        // Track page visit
        trackVisit: () => {
            update(prefs => {
                const newPrefs = {
                    ...prefs,
                    pageVisits: prefs.pageVisits + 1,
                    lastVisit: Date.now()
                };
                savePrefs(newPrefs);
                return newPrefs;
            });
        },

        // Dismiss prompt temporarily (1 week)
        dismissTemporarily: () => {
            update(prefs => {
                const newPrefs = {
                    ...prefs,
                    dismissed: true,
                    dismissedAt: Date.now(),
                    hasSeenPrompt: true
                };
                savePrefs(newPrefs);
                return newPrefs;
            });
        },

        // Never show again
        dismissPermanently: () => {
            update(prefs => {
                const newPrefs = {
                    ...prefs,
                    dismissed: true,
                    neverShow: true,
                    hasSeenPrompt: true
                };
                savePrefs(newPrefs);
                return newPrefs;
            });
        },

        // Mark as installed
        markInstalled: () => {
            update(prefs => {
                const newPrefs = {
                    ...prefs,
                    isInstalled: true,
                    dismissed: true
                };
                savePrefs(newPrefs);
                return newPrefs;
            });
        },

        // Reset (for testing)
        reset: () => {
            const newPrefs = { ...defaultPrefs };
            savePrefs(newPrefs);
            set(newPrefs);
        }
    };
}

export const appInstallPrefs = createAppInstallStore();

// Device detection utilities
export function detectDevice() {
    if (!browser) return { isMobile: false, isIOS: false, isAndroid: false, isPWA: false, isStandalone: false };

    const ua = navigator.userAgent || navigator.vendor || window.opera;
    
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /android/i.test(ua);
    const isMobile = isIOS || isAndroid || /webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua);
    
    // Check if running as PWA (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
        || window.navigator.standalone === true
        || document.referrer.includes('android-app://');
    
    // Check if PWA is installable
    const isPWA = 'serviceWorker' in navigator;

    return { isMobile, isIOS, isAndroid, isPWA, isStandalone };
}

// Check if prompt should be shown
export function shouldShowPrompt(prefs) {
    if (!browser) return false;
    
    const device = detectDevice();
    
    // Don't show if not mobile
    if (!device.isMobile) return false;
    
    // Don't show if already installed/standalone
    if (device.isStandalone || prefs.isInstalled) return false;
    
    // Don't show if user chose "never show"
    if (prefs.neverShow) return false;
    
    // Don't show if dismissed recently (within 1 week)
    if (prefs.dismissed && prefs.dismissedAt) {
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - prefs.dismissedAt < oneWeek) return false;
    }
    
    // Show only after 2+ page visits
    if (prefs.pageVisits < 2) return false;
    
    return true;
}

// Derived store for showing prompt
export const showInstallPrompt = derived(
    appInstallPrefs,
    $prefs => shouldShowPrompt($prefs)
);

// App configuration
export const appConfig = {
    name: 'PCC Attendance',
    icon: '/logo.png',
    description: 'Install the app for faster access and a smoother experience.',
    playStoreUrl: null, // Set your Play Store URL here when published
    appStoreUrl: null,  // Set your App Store URL here when published
    apkUrl: null,       // Set direct APK download URL here if needed
    apkSize: null,      // e.g., '12.5 MB'
    // Deep linking configuration
    deepLink: {
        scheme: 'pccattendance',           // Custom URL scheme (e.g., pccattendance://open)
        androidPackage: null,               // e.g., 'com.pcc.attendance'
        iosBundleId: null,                  // e.g., 'com.pcc.attendance'
        universalLinkDomain: null,          // e.g., 'pccattendance.com'
    },
    // QR code configuration
    qrCode: {
        enabled: true,
        size: 180,
        color: '#000000',
        backgroundColor: '#ffffff',
    }
};

// Generate QR code data URL using a simple QR code algorithm
export function generateQRCodeDataUrl(text, size = 180) {
    // Use a canvas-based QR code generation or external service
    // For simplicity, we'll use a Google Charts API fallback
    const encodedText = encodeURIComponent(text);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedText}&format=svg`;
}

// Deep linking utilities
export const deepLinking = {
    // Generate app deep link URL
    getAppLink: (path = '') => {
        const config = appConfig.deepLink;
        if (!config.scheme) return null;
        return `${config.scheme}://${path}`;
    },

    // Generate universal link (iOS) / App Link (Android)
    getUniversalLink: (path = '') => {
        const config = appConfig.deepLink;
        if (!config.universalLinkDomain) return null;
        return `https://${config.universalLinkDomain}/${path}`;
    },

    // Generate Play Store intent link (opens app if installed, store if not)
    getPlayStoreIntent: (path = '') => {
        const config = appConfig.deepLink;
        if (!config.androidPackage) return appConfig.playStoreUrl;
        
        const fallbackUrl = appConfig.playStoreUrl || window.location.href;
        const appLink = `intent://${path}#Intent;scheme=${config.scheme};package=${config.androidPackage};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
        return appLink;
    },

    // Try to open app, fallback to store/web
    tryOpenApp: async (path = '') => {
        if (!browser) return false;
        
        const device = detectDevice();
        const config = appConfig.deepLink;
        
        return new Promise((resolve) => {
            let opened = false;
            const timeout = setTimeout(() => {
                if (!opened) {
                    // App not installed, redirect to store or stay on web
                    if (device.isAndroid && appConfig.playStoreUrl) {
                        window.location.href = appConfig.playStoreUrl;
                    } else if (device.isIOS && appConfig.appStoreUrl) {
                        window.location.href = appConfig.appStoreUrl;
                    }
                    resolve(false);
                }
            }, 2500);

            // Try universal link first
            const universalLink = deepLinking.getUniversalLink(path);
            if (universalLink) {
                window.location.href = universalLink;
            } else if (device.isAndroid && config.androidPackage) {
                // Use Android intent
                window.location.href = deepLinking.getPlayStoreIntent(path);
            } else if (config.scheme) {
                // Try custom scheme
                window.location.href = deepLinking.getAppLink(path);
            }

            // Listen for visibility change (app opened)
            const handleVisibilityChange = () => {
                if (document.hidden) {
                    opened = true;
                    clearTimeout(timeout);
                    document.removeEventListener('visibilitychange', handleVisibilityChange);
                    resolve(true);
                }
            };
            document.addEventListener('visibilitychange', handleVisibilityChange);

            // Cleanup after timeout
            setTimeout(() => {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            }, 3000);
        });
    },

    // Check if app might be installed (heuristic)
    checkAppInstalled: async () => {
        if (!browser) return false;
        
        const device = detectDevice();
        
        // If running standalone, app is "installed"
        if (device.isStandalone) return true;
        
        // Check related apps API (Chrome only)
        if ('getInstalledRelatedApps' in navigator) {
            try {
                const relatedApps = await navigator.getInstalledRelatedApps();
                return relatedApps.length > 0;
            } catch {
                return false;
            }
        }
        
        return false;
    }
};

// Get the best download URL for current device
export function getDownloadUrl() {
    if (!browser) return null;
    
    const device = detectDevice();
    
    if (device.isAndroid) {
        return appConfig.playStoreUrl || appConfig.apkUrl;
    } else if (device.isIOS) {
        return appConfig.appStoreUrl;
    }
    
    // Desktop - return web app URL
    return window.location.origin;
}
