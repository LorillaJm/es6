// src/lib/services/fcmService.js
// Firebase Cloud Messaging client-side service for background push notifications
import { browser } from '$app/environment';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getApps } from 'firebase/app';
import { db, ref, set, update } from '$lib/firebase';

let messaging = null;
let fcmInitialized = false;

// Your Firebase VAPID key (Web Push certificate key pair)
// Get this from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
const VAPID_KEY = import.meta.env.PUBLIC_FIREBASE_VAPID_KEY || 'BAYUKAMEt6j2bRIwU9IAYZz_5HJdvopgDQ1WlcNb3zgDq0gZXAwRDUtK3uAYfNRxfx3rcGSBeAvjR_b4Mit5wXc';

/**
 * Initialize FCM and get permission
 */
export async function initFCM() {
    if (!browser || fcmInitialized) return { success: false };
    
    try {
        const apps = getApps();
        if (apps.length === 0) {
            console.warn('Firebase app not initialized');
            return { success: false, error: 'Firebase not initialized' };
        }

        // Check if messaging is supported
        if (!('Notification' in window)) {
            return { success: false, error: 'Notifications not supported' };
        }

        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            return { success: false, error: 'Permission denied' };
        }

        // Initialize messaging
        messaging = getMessaging(apps[0]);
        fcmInitialized = true;

        return { success: true };
    } catch (error) {
        console.error('FCM init error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get FCM token and save to user profile
 */
export async function registerFCMToken(userId) {
    if (!browser || !userId) return { success: false };

    try {
        // Initialize FCM if not done
        if (!fcmInitialized) {
            const initResult = await initFCM();
            if (!initResult.success) return initResult;
        }

        if (!messaging) {
            return { success: false, error: 'Messaging not initialized' };
        }

        // Register the Firebase messaging service worker specifically
        let swRegistration;
        try {
            // First, unregister any existing service workers for this scope to ensure fresh registration
            const existingRegistrations = await navigator.serviceWorker.getRegistrations();
            for (const reg of existingRegistrations) {
                if (reg.scope.includes('firebase-messaging-sw')) {
                    console.log('[FCM] Found existing FCM SW, updating...');
                }
            }

            // Register the FCM service worker
            swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                scope: '/'
            });
            
            // Wait for the service worker to be ready
            if (swRegistration.installing) {
                console.log('[FCM] Service worker installing...');
                await new Promise((resolve) => {
                    swRegistration.installing.addEventListener('statechange', (e) => {
                        if (e.target.state === 'activated') {
                            resolve();
                        }
                    });
                });
            } else if (swRegistration.waiting) {
                console.log('[FCM] Service worker waiting, activating...');
                swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            
            // Ensure the service worker is active
            await navigator.serviceWorker.ready;
            console.log('[FCM] Firebase messaging SW registered and active:', swRegistration.scope);
        } catch (swError) {
            console.warn('[FCM] Could not register firebase-messaging-sw.js:', swError.message);
            // Try to use any available service worker
            swRegistration = await navigator.serviceWorker.ready;
        }

        // Get FCM token with the service worker registration
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: swRegistration
        });

        if (!token) {
            return { success: false, error: 'Failed to get FCM token' };
        }

        console.log('[FCM] Token obtained:', token.substring(0, 20) + '...');

        // Save token to user profile in Firebase
        const tokenKey = token.replace(/[.#$[\]]/g, '_');
        const tokenRef = ref(db, `users/${userId}/fcmTokens/${tokenKey}`);
        
        await set(tokenRef, {
            token,
            createdAt: new Date().toISOString(),
            platform: navigator.platform || 'unknown',
            userAgent: navigator.userAgent.substring(0, 100),
            browser: getBrowserName()
        });

        console.log('[FCM] Token registered successfully for user:', userId);
        return { success: true, token };
    } catch (error) {
        console.error('[FCM] Token registration error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get browser name for debugging
 */
function getBrowserName() {
    const ua = navigator.userAgent;
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    return 'Unknown';
}

/**
 * Listen for foreground messages
 */
export function onForegroundMessage(callback) {
    if (!browser || !messaging) return () => {};

    return onMessage(messaging, (payload) => {
        console.log('Foreground message received:', payload);
        callback(payload);
    });
}

/**
 * Remove FCM token (on logout)
 */
export async function removeFCMToken(userId, token) {
    if (!browser || !userId || !token || !db) return false;

    try {
        const tokenKey = token.replace(/[.#$[\]]/g, '_');
        await set(ref(db, `users/${userId}/fcmTokens/${tokenKey}`), null);
        return true;
    } catch (error) {
        console.error('Error removing FCM token:', error);
        return false;
    }
}
