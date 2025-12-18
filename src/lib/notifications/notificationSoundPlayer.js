// src/lib/notifications/notificationSoundPlayer.js
// Dedicated notification sound player with preloading and caching
// Uses actual audio files from static/sounds folder

import { browser } from '$app/environment';

// Sound file paths (relative to static folder)
const SOUND_FILES = {
    default: '/sounds/notification.mp3',
    urgent: '/sounds/notification-urgent.mp3'
};

// Audio element cache for instant playback
const audioCache = new Map();

// Track if sounds are preloaded
let soundsPreloaded = false;

/**
 * Preload all notification sounds for instant playback
 * Call this early in app initialization
 */
export function preloadSounds() {
    if (!browser || soundsPreloaded) return;

    Object.entries(SOUND_FILES).forEach(([type, url]) => {
        try {
            const audio = new Audio(url);
            audio.preload = 'auto';
            audio.volume = type === 'urgent' ? 0.9 : 0.7;
            
            // Force load
            audio.load();
            
            audioCache.set(type, audio);
        } catch (error) {
            console.warn(`[Sound] Failed to preload ${type}:`, error);
        }
    });

    soundsPreloaded = true;
    console.log('[Sound] Notification sounds preloaded');
}

/**
 * Play a notification sound
 * @param {string} type - 'default' or 'urgent'
 * @returns {Promise<boolean>} - Whether sound played successfully
 */
export async function playSound(type = 'default') {
    if (!browser) return false;

    try {
        // Ensure sounds are preloaded
        if (!soundsPreloaded) {
            preloadSounds();
        }

        const soundUrl = SOUND_FILES[type] || SOUND_FILES.default;
        let audio = audioCache.get(type);

        if (audio) {
            // Reset and play cached audio
            audio.currentTime = 0;
            audio.volume = type === 'urgent' ? 0.9 : 0.7;
            await audio.play();
            return true;
        } else {
            // Create new audio element
            audio = new Audio(soundUrl);
            audio.volume = type === 'urgent' ? 0.9 : 0.7;
            await audio.play();
            audioCache.set(type, audio);
            return true;
        }
    } catch (error) {
        console.warn('[Sound] Playback failed:', error.message);
        // Try fallback beep
        return playFallbackBeep(type);
    }
}

/**
 * Play fallback beep using Web Audio API
 * Used when audio files fail to load
 */
function playFallbackBeep(type = 'default') {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return false;

        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        // Urgent sounds are higher pitched and longer
        if (type === 'urgent') {
            oscillator.frequency.value = 1000;
            oscillator.type = 'square';
            gainNode.gain.value = 0.4;
            
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            oscillator.stop(ctx.currentTime + 0.5);
        } else {
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;
            
            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            oscillator.stop(ctx.currentTime + 0.3);
        }

        return true;
    } catch (error) {
        console.warn('[Sound] Fallback beep failed:', error);
        return false;
    }
}

/**
 * Set up listener for service worker sound messages
 * This allows the service worker to trigger sounds for background notifications
 */
export function setupServiceWorkerSoundListener() {
    if (!browser || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
            console.log('[Sound] Playing from SW message:', event.data.soundType);
            playSound(event.data.soundType || 'default');
        }
    });

    console.log('[Sound] Service worker sound listener active');
}

/**
 * Get available sound types
 */
export function getAvailableSounds() {
    return Object.keys(SOUND_FILES);
}

/**
 * Check if sounds are ready
 */
export function areSoundsReady() {
    return soundsPreloaded && audioCache.size > 0;
}

export default {
    preloadSounds,
    playSound,
    setupServiceWorkerSoundListener,
    getAvailableSounds,
    areSoundsReady
};
