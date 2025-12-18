// src/lib/notifications/pushNotificationService.js
// Real Push Notification Service with FCM, vibration, and sound support
import { browser } from '$app/environment';
import { db } from '$lib/firebase';
import { ref, set, get, update } from 'firebase/database';

// Notification sound URLs - using actual files from static/sounds folder
const NOTIFICATION_SOUNDS = {
    default: '/sounds/notification.mp3',
    urgent: '/sounds/notification-urgent.mp3',
    success: '/sounds/notification.mp3',
    reminder: '/sounds/notification.mp3'
};

// Vibration patterns (in milliseconds)
const VIBRATION_PATTERNS = {
    default: [200, 100, 200],
    urgent: [300, 100, 300, 100, 300, 100, 300],
    gentle: [100],
    success: [100, 50, 100, 50, 200]
};

// Store service worker registration globally
let swRegistration = null;

// Audio cache for preloaded sounds
const audioCache = new Map();

/**
 * Initialize push notification service
 */
export async function initPushNotifications() {
    if (!browser) return { success: false, error: 'Not in browser' };

    try {
        // Check if notifications are supported
        if (!('Notification' in window)) {
            return { success: false, error: 'Notifications not supported' };
        }

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            return { success: false, error: 'Permission denied' };
        }

        // Preload notification sounds for instant playback
        preloadNotificationSounds();

        // Set up listener for service worker sound messages
        setupServiceWorkerSoundListener();

        // Try to register service worker (may fail on HTTPS with self-signed cert)
        if ('serviceWorker' in navigator) {
            try {
                swRegistration = await navigator.serviceWorker.register('/sw.js');
                console.log('[Push] Service Worker registered:', swRegistration.scope);
                await navigator.serviceWorker.ready;
                console.log('[Push] Service Worker ready');
                return { success: true, registration: swRegistration, swEnabled: true };
            } catch (swError) {
                // Service Worker failed (likely SSL issue in dev), but notifications still work
                console.warn('[Push] Service Worker registration failed (will use fallback):', swError.message);
                return { success: true, swEnabled: false, swError: swError.message };
            }
        }

        return { success: true, swEnabled: false };
    } catch (error) {
        console.error('[Push] Push notification init error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Set up listener for service worker messages to play sounds
 * This allows the service worker to trigger sounds even when handling background notifications
 */
function setupServiceWorkerSoundListener() {
    if (!browser || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'PLAY_NOTIFICATION_SOUND') {
            console.log('[Push] Playing sound from SW message:', event.data.soundType);
            playNotificationSound(event.data.soundType || 'default');
        }
    });
    
    console.log('[Push] Service worker sound listener set up');
}

/**
 * Get or register service worker
 */
async function getServiceWorkerRegistration() {
    if (swRegistration) return swRegistration;
    
    if ('serviceWorker' in navigator) {
        try {
            swRegistration = await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;
            return swRegistration;
        } catch (e) {
            console.warn('Could not register service worker:', e);
        }
    }
    return null;
}

/**
 * Save FCM token to user profile
 */
export async function saveFCMToken(userId, token) {
    if (!browser || !db || !userId || !token) return false;

    try {
        const tokenRef = ref(db, `users/${userId}/fcmTokens/${token.replace(/[.#$[\]]/g, '_')}`);
        await set(tokenRef, {
            token,
            createdAt: new Date().toISOString(),
            platform: navigator.platform,
            userAgent: navigator.userAgent.substring(0, 100)
        });
        return true;
    } catch (error) {
        console.error('Error saving FCM token:', error);
        return false;
    }
}

/**
 * Preload notification sounds for instant playback
 */
export function preloadNotificationSounds() {
    if (!browser) return;
    
    Object.entries(NOTIFICATION_SOUNDS).forEach(([type, url]) => {
        if (!audioCache.has(type)) {
            const audio = new Audio(url);
            audio.preload = 'auto';
            audio.volume = 0.7;
            audioCache.set(type, audio);
        }
    });
    console.log('[Push] Notification sounds preloaded');
}

/**
 * Play notification sound using actual audio files
 * @param {string} type - Sound type: 'default', 'urgent', 'success', 'reminder'
 */
export function playNotificationSound(type = 'default') {
    if (!browser) return;

    try {
        const soundUrl = NOTIFICATION_SOUNDS[type] || NOTIFICATION_SOUNDS.default;
        
        // Try to use cached audio first for instant playback
        let audio = audioCache.get(type);
        
        if (audio) {
            // Reset and play cached audio
            audio.currentTime = 0;
            audio.volume = type === 'urgent' ? 0.9 : 0.7;
            audio.play().catch(err => {
                console.warn('[Push] Cached audio play failed, creating new:', err.message);
                playNewAudio(soundUrl, type);
            });
        } else {
            // Create new audio element
            playNewAudio(soundUrl, type);
        }
    } catch (error) {
        console.warn('[Push] Could not play notification sound:', error);
        // Fallback to Web Audio API beep
        playFallbackBeep(type);
    }
}

/**
 * Play new audio element
 */
function playNewAudio(url, type) {
    const audio = new Audio(url);
    audio.volume = type === 'urgent' ? 0.9 : 0.7;
    audio.play().catch(err => {
        console.warn('[Push] Audio play failed:', err.message);
        playFallbackBeep(type);
    });
    // Cache for future use
    audioCache.set(type, audio);
}

/**
 * Fallback beep using Web Audio API when audio files fail
 */
function playFallbackBeep(type = 'default') {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        // Different frequencies for different notification types
        const frequencies = {
            default: 800,
            urgent: 1000,
            success: 600,
            reminder: 700
        };

        oscillator.frequency.value = frequencies[type] || 800;
        oscillator.type = 'sine';
        gainNode.gain.value = type === 'urgent' ? 0.5 : 0.3;

        oscillator.start();
        
        // Urgent plays longer
        const duration = type === 'urgent' ? 0.5 : 0.3;
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        oscillator.stop(audioCtx.currentTime + duration);
    } catch (error) {
        console.warn('[Push] Fallback beep failed:', error);
    }
}

/**
 * Trigger device vibration
 */
export function vibrateDevice(pattern = 'default') {
    if (!browser || !navigator.vibrate) return;

    try {
        const vibrationPattern = VIBRATION_PATTERNS[pattern] || VIBRATION_PATTERNS.default;
        navigator.vibrate(vibrationPattern);
    } catch (error) {
        console.warn('Vibration not supported:', error);
    }
}

/**
 * Show native OS push notification popup with sound and vibration
 */
export async function showPushNotification(options) {
    if (!browser) return false;

    const {
        title,
        body,
        icon = '/logo.png',
        badge = '/logo.png',
        tag = `notif-${Date.now()}`,
        data = {},
        sound = 'default',
        vibrate = 'default',
        requireInteraction = false,
        actions = [],
        silent = false
    } = options;

    try {
        // Check permission
        if (Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return false;
        }

        // Play sound (unless silent)
        if (!silent) {
            playNotificationSound(sound);
        }

        // Vibrate device (unless silent)
        if (!silent) {
            vibrateDevice(vibrate);
        }

        const notificationOptions = {
            body,
            icon,
            badge,
            tag,
            data: { ...data, url: data.url || '/' },
            requireInteraction,
            renotify: true, // Always show even if same tag
            vibrate: VIBRATION_PATTERNS[vibrate] || VIBRATION_PATTERNS.default,
            silent: silent
        };

        // Add actions if supported (only works with service worker)
        if (actions.length > 0) {
            notificationOptions.actions = actions;
        }

        // Try to show via Service Worker first (better support for native popups)
        const registration = await getServiceWorkerRegistration();
        
        if (registration) {
            await registration.showNotification(title, notificationOptions);
            console.log('Notification shown via Service Worker');
        } else {
            // Fallback to regular Notification API
            const notification = new Notification(title, {
                body,
                icon,
                badge,
                tag,
                data,
                requireInteraction,
                silent
            });

            // Handle click
            notification.onclick = () => {
                window.focus();
                if (data.url) {
                    window.location.href = data.url;
                }
                notification.close();
            };

            console.log('Notification shown via Notification API');
        }

        return true;
    } catch (error) {
        console.error('Error showing notification:', error);
        return false;
    }
}

/**
 * Get notification permission status
 */
export function getNotificationPermission() {
    if (!browser || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission() {
    if (!browser || !('Notification' in window)) {
        return { granted: false, error: 'Notifications not supported' };
    }

    try {
        const permission = await Notification.requestPermission();
        return { granted: permission === 'granted', permission };
    } catch (error) {
        return { granted: false, error: error.message };
    }
}

/**
 * Check if push notifications are fully supported
 */
export function isPushSupported() {
    if (!browser) return false;
    return 'Notification' in window && 'serviceWorker' in navigator;
}

/**
 * Subscribe to push notifications topic
 */
export async function subscribeToTopic(userId, topic) {
    if (!browser || !db) return false;

    try {
        const subscriptionRef = ref(db, `pushSubscriptions/${topic}/${userId}`);
        await set(subscriptionRef, {
            subscribedAt: new Date().toISOString(),
            active: true
        });
        return true;
    } catch (error) {
        console.error('Error subscribing to topic:', error);
        return false;
    }
}

/**
 * Unsubscribe from push notifications topic
 */
export async function unsubscribeFromTopic(userId, topic) {
    if (!browser || !db) return false;

    try {
        const subscriptionRef = ref(db, `pushSubscriptions/${topic}/${userId}`);
        await set(subscriptionRef, null);
        return true;
    } catch (error) {
        console.error('Error unsubscribing from topic:', error);
        return false;
    }
}
