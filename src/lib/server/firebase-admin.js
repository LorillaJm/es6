// src/lib/server/firebase-admin.js
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getStorage } from 'firebase-admin/storage';
import { getMessaging } from 'firebase-admin/messaging';

// Use dynamic import to avoid build errors when env vars are missing
let FIREBASE_SERVICE_ACCOUNT = '';
let PUBLIC_FIREBASE_DATABASE_URL = '';

try {
    const { env } = await import('$env/dynamic/private');
    FIREBASE_SERVICE_ACCOUNT = env.FIREBASE_SERVICE_ACCOUNT || '';
} catch (e) {
    console.warn('FIREBASE_SERVICE_ACCOUNT not available');
}

try {
    const { env } = await import('$env/dynamic/public');
    PUBLIC_FIREBASE_DATABASE_URL = env.PUBLIC_FIREBASE_DATABASE_URL || '';
} catch (e) {
    console.warn('PUBLIC_FIREBASE_DATABASE_URL not available');
}

let adminAuth = null;
let adminDb = null;
let adminStorage = null;
let adminMessaging = null;

if (!getApps().length && FIREBASE_SERVICE_ACCOUNT) {
    try {
        let jsonString = FIREBASE_SERVICE_ACCOUNT.trim();
        if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
            jsonString = jsonString.slice(1, -1);
        }

        const serviceAccount = JSON.parse(jsonString);

        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        initializeApp({ 
            credential: cert(serviceAccount),
            databaseURL: PUBLIC_FIREBASE_DATABASE_URL
        });
        console.log("Firebase Admin initialized successfully");

        adminAuth = getAuth();
        adminDb = getDatabase();
        adminStorage = getStorage();
        adminMessaging = getMessaging();
    } catch (err) {
        console.error("Failed to initialize Firebase Admin:", err.message);
    }
} else if (getApps().length) {
    adminAuth = getAuth();
    adminDb = getDatabase();
    adminStorage = getStorage();
    adminMessaging = getMessaging();
} else {
    console.warn("⚠️ Running without Firebase Admin - FIREBASE_SERVICE_ACCOUNT not set");
    console.warn("⚠️ Server-side authentication will be disabled");
}


export { adminAuth, adminDb, adminStorage, adminMessaging };

/**
 * Send FCM push notification to a user's devices
 * @param {string} userId - User ID to send notification to
 * @param {object} notification - Notification data { title, body, data }
 */
export async function sendFCMNotification(userId, notification) {
    if (!adminMessaging || !adminDb) {
        console.warn('FCM not available');
        return { success: false, error: 'FCM not initialized' };
    }

    try {
        // Get user's FCM tokens
        const tokensSnapshot = await adminDb.ref(`users/${userId}/fcmTokens`).once('value');
        const tokensData = tokensSnapshot.val();

        if (!tokensData) {
            return { success: false, error: 'No FCM tokens found for user' };
        }

        const tokens = Object.values(tokensData).map(t => t.token).filter(Boolean);

        if (tokens.length === 0) {
            return { success: false, error: 'No valid FCM tokens' };
        }

        console.log(`[FCM] Sending to ${tokens.length} tokens for user ${userId}`);

        // Build FCM message - data values must be strings
        const message = {
            notification: {
                title: notification.title,
                body: notification.body
            },
            data: {
                url: String(notification.data?.url || '/app/dashboard'),
                type: String(notification.data?.type || 'general'),
                click_action: String(notification.data?.url || '/app/dashboard')
            },
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'default'
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1
                    }
                }
            },
            webpush: {
                notification: {
                    icon: '/logo.png',
                    badge: '/logo.png',
                    vibrate: [200, 100, 200]
                },
                fcmOptions: {
                    link: notification.data?.url || '/app/dashboard'
                }
            }
        };

        // Send to all user's devices
        const results = await Promise.allSettled(
            tokens.map(token => 
                adminMessaging.send({ ...message, token })
            )
        );

        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failedTokens = [];

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const error = result.reason;
                // Remove invalid tokens
                if (error.code === 'messaging/invalid-registration-token' ||
                    error.code === 'messaging/registration-token-not-registered') {
                    failedTokens.push(tokens[index]);
                }
            }
        });

        // Clean up invalid tokens
        if (failedTokens.length > 0) {
            const updates = {};
            for (const token of failedTokens) {
                const tokenKey = token.replace(/[.#$[\]]/g, '_');
                updates[`users/${userId}/fcmTokens/${tokenKey}`] = null;
            }
            await adminDb.ref().update(updates);
        }

        return { 
            success: successCount > 0, 
            sent: successCount, 
            failed: results.length - successCount 
        };
    } catch (error) {
        console.error('FCM send error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send FCM push notification to multiple users
 * @param {string[]} userIds - Array of user IDs
 * @param {object} notification - Notification data
 */
export async function sendFCMToMultipleUsers(userIds, notification) {
    const results = await Promise.allSettled(
        userIds.map(userId => sendFCMNotification(userId, notification))
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    return { success: successCount > 0, sent: successCount, total: userIds.length };
}

/**
 * @param {string} uid 
 */
export async function getAdminUserProfile(uid) {
    try {
        const snapshot = await adminDb.ref(`users/${uid}`).once('value');
        return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
        console.error('Error fetching user profile:', error);
        throw error;
    }
}

/**
 * @param {string} uid 
 * @param {object} profileData
 */
export async function saveAdminUserProfile(uid, profileData) {
    try {
        await adminDb.ref(`users/${uid}`).set({
            ...profileData,
            updatedAt: new Date().toISOString()
        });
        return true;
    } catch (error) {
        console.error('Error saving user profile:', error);
        throw error;
    }
}

/**
 * @param {string} uid 
 * @param {object} updates 
 */
export async function updateAdminUserProfile(uid, updates) {
    try {
        await adminDb.ref(`users/${uid}`).update({
            ...updates,
            updatedAt: new Date().toISOString()
        });
        return true;
    } catch (error) {
        console.error('Error updating user profile:', error);
        throw error;
    }
}

/**
 * @param {string} uid
 */
export async function deleteAdminUserProfile(uid) {
    try {
        await adminDb.ref(`users/${uid}`).remove();
        return true;
    } catch (error) {
        console.error('Error deleting user profile:', error);
        throw error;
    }
}

/**
 * @param {string} path
 */
export async function getAdminData(path) {
    try {
        const snapshot = await adminDb.ref(path).once('value');
        return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
        console.error(`Error fetching data from ${path}:`, error);
        throw error;
    }
}

/**
 * @param {string} path 
 * @param {any} data 
 */
export async function setAdminData(path, data) {
    try {
        await adminDb.ref(path).set(data);
        return true;
    } catch (error) {
        console.error(`Error setting data at ${path}:`, error);
        throw error;
    }
}

/**
 * @param {string} path 
 * @param {object} updates 
 */
export async function updateAdminData(path, updates) {
    try {
        await adminDb.ref(path).update(updates);
        return true;
    } catch (error) {
        console.error(`Error updating data at ${path}:`, error);
        throw error;
    }
}

/**
 * 
 * @param {string} path 
 */
export async function deleteAdminData(path) {
    try {
        await adminDb.ref(path).remove();
        return true;
    } catch (error) {
        console.error(`Error deleting data at ${path}:`, error);
        throw error;
    }
}

/**
 * @param {string} path 
 * @param {object} options 
 */
export async function queryAdminData(path, options = {}) {
    try {
        let query = adminDb.ref(path);

        if (options.orderByChild) {
            query = query.orderByChild(options.orderByChild);
        } else if (options.orderByKey) {
            query = query.orderByKey();
        } else if (options.orderByValue) {
            query = query.orderByValue();
        }

        if (options.equalTo !== undefined) {
            query = query.equalTo(options.equalTo);
        }

        if (options.startAt !== undefined) {
            query = query.startAt(options.startAt);
        }

        if (options.endAt !== undefined) {
            query = query.endAt(options.endAt);
        }

        if (options.limitToFirst) {
            query = query.limitToFirst(options.limitToFirst);
        }

        if (options.limitToLast) {
            query = query.limitToLast(options.limitToLast);
        }

        const snapshot = await query.once('value');
        return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
        console.error(`Error querying data at ${path}:`, error);
        throw error;
    }
}