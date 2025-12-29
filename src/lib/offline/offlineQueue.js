// src/lib/offline/offlineQueue.js
// Offline Mode Support: IndexedDB queue with automatic sync
import { browser } from '$app/environment';
import { db } from '$lib/firebase';
import { ref, push, set, update } from 'firebase/database';

const DB_NAME = 'AttendanceOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'pendingActions';

let indexedDB = null;

/**
 * Initialize IndexedDB for offline storage
 * @returns {Promise<IDBDatabase>} Database instance
 */
async function initDB() {
    if (!browser) return null;
    
    return new Promise((resolve, reject) => {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
            indexedDB = request.result;
            resolve(indexedDB);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('synced', 'synced', { unique: false });
                store.createIndex('userId', 'userId', { unique: false });
            }
        };
    });
}

/**
 * Get database instance
 * @returns {Promise<IDBDatabase>}
 */
async function getDB() {
    if (indexedDB) return indexedDB;
    return await initDB();
}

/**
 * Queue an attendance action for offline storage
 * @param {object} action - Action data
 * @returns {Promise<number>} Action ID
 */
export async function queueOfflineAction(action) {
    if (!browser) return null;
    
    try {
        const db = await getDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            const actionData = {
                ...action,
                timestamp: new Date().toISOString(),
                synced: 0, // Use 0 for false (IndexedDB compatible)
                syncAttempts: 0,
                lastSyncAttempt: null
            };
            
            const request = store.add(actionData);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error queuing offline action:', error);
        return null;
    }
}

/**
 * Get all pending (unsynced) actions
 * @param {string} userId - Optional user ID filter
 * @returns {Promise<Array>} Pending actions
 */
export async function getPendingActions(userId = null) {
    if (!browser) return [];
    
    try {
        const db = await getDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('synced');
            // Use 0 for unsynced (false), 1 for synced (true)
            const request = index.getAll(IDBKeyRange.only(0));
            
            request.onsuccess = () => {
                let results = request.result || [];
                if (userId) {
                    results = results.filter(a => a.userId === userId);
                }
                resolve(results.sort((a, b) => 
                    new Date(a.timestamp) - new Date(b.timestamp)
                ));
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error getting pending actions:', error);
        return [];
    }
}

/**
 * Mark an action as synced
 * @param {number} actionId - Action ID
 * @param {string} firebaseKey - Firebase key after sync
 */
export async function markActionSynced(actionId, firebaseKey = null) {
    if (!browser) return;
    
    try {
        const db = await getDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const getRequest = store.get(actionId);
            
            getRequest.onsuccess = () => {
                const action = getRequest.result;
                if (action) {
                    action.synced = 1; // Use 1 for true (IndexedDB compatible)
                    action.syncedAt = new Date().toISOString();
                    action.firebaseKey = firebaseKey;
                    
                    const updateRequest = store.put(action);
                    updateRequest.onsuccess = () => resolve(true);
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    resolve(false);
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    } catch (error) {
        console.error('Error marking action synced:', error);
    }
}

/**
 * Update sync attempt count
 * @param {number} actionId - Action ID
 */
async function updateSyncAttempt(actionId) {
    if (!browser) return;
    
    try {
        const db = await getDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const getRequest = store.get(actionId);
            
            getRequest.onsuccess = () => {
                const action = getRequest.result;
                if (action) {
                    action.syncAttempts = (action.syncAttempts || 0) + 1;
                    action.lastSyncAttempt = new Date().toISOString();
                    
                    const updateRequest = store.put(action);
                    updateRequest.onsuccess = () => resolve(true);
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    resolve(false);
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    } catch (error) {
        console.error('Error updating sync attempt:', error);
    }
}

/**
 * Sync all pending actions to Firebase
 * @returns {Promise<object>} Sync results
 */
export async function syncPendingActions() {
    if (!browser || !db) return { synced: 0, failed: 0, pending: 0 };
    
    // Check if online
    if (!navigator.onLine) {
        const pending = await getPendingActions();
        return { synced: 0, failed: 0, pending: pending.length };
    }
    
    const pendingActions = await getPendingActions();
    let synced = 0;
    let failed = 0;
    
    for (const action of pendingActions) {
        try {
            await updateSyncAttempt(action.id);
            
            // Sync based on action type
            let firebaseKey = null;
            
            switch (action.type) {
                case 'checkIn':
                    firebaseKey = await syncCheckIn(action);
                    break;
                case 'checkOut':
                    await syncCheckOut(action);
                    firebaseKey = action.shiftId;
                    break;
                case 'breakIn':
                case 'breakOut':
                    await syncBreakAction(action);
                    firebaseKey = action.shiftId;
                    break;
                default:
                    console.warn('Unknown action type:', action.type);
            }
            
            await markActionSynced(action.id, firebaseKey);
            synced++;
        } catch (error) {
            console.error('Error syncing action:', action.id, error);
            failed++;
            
            // If too many attempts, mark as failed permanently
            if (action.syncAttempts >= 5) {
                await markActionFailed(action.id, error.message);
            }
        }
    }
    
    return { synced, failed, pending: pendingActions.length - synced - failed };
}

/**
 * Sync check-in action to Firebase
 * @param {object} action - Check-in action data
 * @returns {Promise<string>} Firebase key
 */
async function syncCheckIn(action) {
    const entryRef = push(ref(db, `attendance/${action.userId}`));
    
    await set(entryRef, {
        checkIn: {
            timestamp: action.data.timestamp,
            location: action.data.location,
            device: action.data.device,
            capturedImage: action.data.capturedImage,
            offlineSync: true,
            originalTimestamp: action.timestamp
        },
        currentStatus: 'checkedIn',
        date: new Date(action.data.timestamp).toDateString()
    });
    
    return entryRef.key;
}

/**
 * Sync check-out action to Firebase
 * @param {object} action - Check-out action data
 */
async function syncCheckOut(action) {
    const entryRef = ref(db, `attendance/${action.userId}/${action.shiftId}`);
    
    await update(entryRef, {
        checkOut: {
            timestamp: action.data.timestamp,
            location: action.data.location,
            device: action.data.device,
            capturedImage: action.data.capturedImage,
            offlineSync: true,
            originalTimestamp: action.timestamp
        },
        currentStatus: 'checkedOut'
    });
}

/**
 * Sync break action to Firebase
 * @param {object} action - Break action data
 */
async function syncBreakAction(action) {
    const entryRef = ref(db, `attendance/${action.userId}/${action.shiftId}`);
    const field = action.type === 'breakIn' ? 'breakIn' : 'breakOut';
    const status = action.type === 'breakIn' ? 'onBreak' : 'checkedIn';
    
    await update(entryRef, {
        [field]: {
            timestamp: action.data.timestamp,
            location: action.data.location,
            device: action.data.device,
            capturedImage: action.data.capturedImage,
            offlineSync: true,
            originalTimestamp: action.timestamp
        },
        currentStatus: status
    });
}

/**
 * Mark action as permanently failed
 * @param {number} actionId - Action ID
 * @param {string} errorMessage - Error message
 */
async function markActionFailed(actionId, errorMessage) {
    if (!browser) return;
    
    try {
        const db = await getDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const getRequest = store.get(actionId);
            
            getRequest.onsuccess = () => {
                const action = getRequest.result;
                if (action) {
                    action.failed = true;
                    action.failedAt = new Date().toISOString();
                    action.errorMessage = errorMessage;
                    
                    const updateRequest = store.put(action);
                    updateRequest.onsuccess = () => resolve(true);
                    updateRequest.onerror = () => reject(updateRequest.error);
                } else {
                    resolve(false);
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    } catch (error) {
        console.error('Error marking action failed:', error);
    }
}

/**
 * Get pending action count
 * @param {string} userId - Optional user ID filter
 * @returns {Promise<number>} Count of pending actions
 */
export async function getPendingCount(userId = null) {
    const pending = await getPendingActions(userId);
    return pending.length;
}

/**
 * Clear all synced actions (cleanup)
 * @returns {Promise<number>} Number of cleared actions
 */
export async function clearSyncedActions() {
    if (!browser) return 0;
    
    try {
        const db = await getDB();
        
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('synced');
            // Use 1 for synced (true)
            const request = index.openCursor(IDBKeyRange.only(1));
            
            let count = 0;
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    count++;
                    cursor.continue();
                } else {
                    resolve(count);
                }
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error clearing synced actions:', error);
        return 0;
    }
}

/**
 * Setup automatic sync on network reconnection
 */
export function setupAutoSync() {
    if (!browser) return;
    
    window.addEventListener('online', async () => {
        console.log('Network reconnected - syncing pending actions...');
        const result = await syncPendingActions();
        console.log('Sync complete:', result);
        
        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('offline-sync-complete', { 
            detail: result 
        }));
    });
    
    // Also try to sync periodically when online
    setInterval(async () => {
        if (navigator.onLine) {
            const pending = await getPendingCount();
            if (pending > 0) {
                await syncPendingActions();
            }
        }
    }, 30000); // Every 30 seconds
}

/**
 * Check if currently offline
 * @returns {boolean}
 */
export function isOffline() {
    return browser ? !navigator.onLine : false;
}
