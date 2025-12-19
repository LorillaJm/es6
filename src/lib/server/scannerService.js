// src/lib/server/scannerService.js
// Scanner Management Service - Production-ready implementation
import { adminDb } from './firebase-admin.js';
import { logAuditEvent } from './adminAuth.js';

/**
 * @typedef {Object} Scanner
 * @property {string} id - Scanner ID
 * @property {string} name - Scanner name
 * @property {string} location - Physical location
 * @property {string} status - online, offline, maintenance, degraded
 * @property {number} [battery] - Battery percentage (for portable scanners)
 * @property {string} lastHeartbeat - ISO timestamp of last heartbeat
 * @property {string} [ipAddress] - IP address
 * @property {string} [firmwareVersion] - Firmware version
 * @property {number} scanCount - Total scans performed
 * @property {Object} [config] - Scanner configuration
 */

const HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const DEGRADED_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Register a new scanner
 * @param {Object} scannerData - Scanner data
 * @param {string} adminId - Admin performing the action
 * @returns {Promise<{success: boolean, scanner?: Scanner, error?: string}>}
 */
export async function registerScanner(scannerData, adminId) {
    if (!adminDb) {
        return { success: false, error: 'Database not available' };
    }

    try {
        const scannerId = scannerData.id || `scanner_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        
        const scanner = {
            id: scannerId,
            name: scannerData.name || `Scanner ${scannerId.substring(0, 8)}`,
            location: scannerData.location || 'Unknown',
            status: 'offline',
            battery: scannerData.battery || null,
            lastHeartbeat: null,
            ipAddress: scannerData.ipAddress || null,
            firmwareVersion: scannerData.firmwareVersion || null,
            scanCount: 0,
            createdAt: new Date().toISOString(),
            createdBy: adminId,
            config: {
                scanInterval: scannerData.config?.scanInterval || 1000,
                soundEnabled: scannerData.config?.soundEnabled !== false,
                ledEnabled: scannerData.config?.ledEnabled !== false,
                autoSync: scannerData.config?.autoSync !== false
            }
        };

        await adminDb.ref(`scanners/${scannerId}`).set(scanner);

        await logAuditEvent({
            action: 'SCANNER_REGISTERED',
            adminId,
            details: { scannerId, name: scanner.name, location: scanner.location }
        });

        return { success: true, scanner };
    } catch (error) {
        console.error('Register scanner error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update scanner heartbeat (called by scanner devices)
 * @param {string} scannerId - Scanner ID
 * @param {Object} heartbeatData - Heartbeat data
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateHeartbeat(scannerId, heartbeatData = {}) {
    if (!adminDb) {
        return { success: false, error: 'Database not available' };
    }

    try {
        const updates = {
            lastHeartbeat: new Date().toISOString(),
            status: 'online'
        };

        if (typeof heartbeatData.battery === 'number') {
            updates.battery = heartbeatData.battery;
        }

        if (heartbeatData.ipAddress) {
            updates.ipAddress = heartbeatData.ipAddress;
        }

        if (heartbeatData.firmwareVersion) {
            updates.firmwareVersion = heartbeatData.firmwareVersion;
        }

        if (typeof heartbeatData.scanCount === 'number') {
            updates.scanCount = heartbeatData.scanCount;
        }

        await adminDb.ref(`scanners/${scannerId}`).update(updates);
        return { success: true };
    } catch (error) {
        console.error('Update heartbeat error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Record a scan event
 * @param {string} scannerId - Scanner ID
 * @param {Object} scanData - Scan data
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function recordScan(scannerId, scanData) {
    if (!adminDb) {
        return { success: false, error: 'Database not available' };
    }

    try {
        // Increment scan count
        const scannerRef = adminDb.ref(`scanners/${scannerId}`);
        const snapshot = await scannerRef.once('value');
        
        if (!snapshot.exists()) {
            return { success: false, error: 'Scanner not found' };
        }

        const currentCount = snapshot.val().scanCount || 0;
        await scannerRef.update({
            scanCount: currentCount + 1,
            lastScan: new Date().toISOString(),
            lastHeartbeat: new Date().toISOString(),
            status: 'online'
        });

        // Log scan event
        const scanLogRef = adminDb.ref(`scannerLogs/${scannerId}`).push();
        await scanLogRef.set({
            timestamp: new Date().toISOString(),
            userId: scanData.userId || null,
            qrData: scanData.qrData || null,
            success: scanData.success !== false,
            location: scanData.location || null
        });

        return { success: true };
    } catch (error) {
        console.error('Record scan error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all scanners with real-time status
 * @returns {Promise<Scanner[]>}
 */
export async function getAllScanners() {
    if (!adminDb) return [];

    try {
        const snapshot = await adminDb.ref('scanners').once('value');
        if (!snapshot.exists()) return [];

        const now = Date.now();
        const scanners = [];

        snapshot.forEach(child => {
            const scanner = child.val();
            
            // Calculate real status based on heartbeat
            let status = 'offline';
            if (scanner.lastHeartbeat) {
                const lastHeartbeat = new Date(scanner.lastHeartbeat).getTime();
                const timeSinceHeartbeat = now - lastHeartbeat;

                if (timeSinceHeartbeat < HEARTBEAT_TIMEOUT_MS) {
                    status = 'online';
                } else if (timeSinceHeartbeat < DEGRADED_TIMEOUT_MS) {
                    status = 'degraded';
                }
            }

            // Override with explicit maintenance status
            if (scanner.status === 'maintenance') {
                status = 'maintenance';
            }

            scanners.push({
                ...scanner,
                id: child.key,
                status
            });
        });

        return scanners;
    } catch (error) {
        console.error('Get all scanners error:', error);
        return [];
    }
}

/**
 * Get scanner by ID
 * @param {string} scannerId - Scanner ID
 * @returns {Promise<Scanner|null>}
 */
export async function getScanner(scannerId) {
    if (!adminDb) return null;

    try {
        const snapshot = await adminDb.ref(`scanners/${scannerId}`).once('value');
        if (!snapshot.exists()) return null;

        const scanner = snapshot.val();
        const now = Date.now();

        // Calculate real status
        let status = 'offline';
        if (scanner.lastHeartbeat) {
            const lastHeartbeat = new Date(scanner.lastHeartbeat).getTime();
            const timeSinceHeartbeat = now - lastHeartbeat;

            if (timeSinceHeartbeat < HEARTBEAT_TIMEOUT_MS) {
                status = 'online';
            } else if (timeSinceHeartbeat < DEGRADED_TIMEOUT_MS) {
                status = 'degraded';
            }
        }

        if (scanner.status === 'maintenance') {
            status = 'maintenance';
        }

        return { ...scanner, id: scannerId, status };
    } catch (error) {
        console.error('Get scanner error:', error);
        return null;
    }
}

/**
 * Update scanner configuration
 * @param {string} scannerId - Scanner ID
 * @param {Object} updates - Updates to apply
 * @param {string} adminId - Admin performing the action
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateScanner(scannerId, updates, adminId) {
    if (!adminDb) {
        return { success: false, error: 'Database not available' };
    }

    try {
        // Filter allowed updates
        const allowedFields = ['name', 'location', 'status', 'config'];
        const filteredUpdates = {};
        
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                filteredUpdates[field] = updates[field];
            }
        }

        filteredUpdates.updatedAt = new Date().toISOString();
        filteredUpdates.updatedBy = adminId;

        await adminDb.ref(`scanners/${scannerId}`).update(filteredUpdates);

        await logAuditEvent({
            action: 'SCANNER_UPDATED',
            adminId,
            details: { scannerId, updates: Object.keys(filteredUpdates) }
        });

        return { success: true };
    } catch (error) {
        console.error('Update scanner error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete a scanner
 * @param {string} scannerId - Scanner ID
 * @param {string} adminId - Admin performing the action
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteScanner(scannerId, adminId) {
    if (!adminDb) {
        return { success: false, error: 'Database not available' };
    }

    try {
        await adminDb.ref(`scanners/${scannerId}`).remove();
        await adminDb.ref(`scannerLogs/${scannerId}`).remove();

        await logAuditEvent({
            action: 'SCANNER_DELETED',
            adminId,
            details: { scannerId }
        });

        return { success: true };
    } catch (error) {
        console.error('Delete scanner error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get scanner statistics
 * @returns {Promise<Object>}
 */
export async function getScannerStats() {
    if (!adminDb) {
        return {
            total: 0,
            online: 0,
            offline: 0,
            degraded: 0,
            maintenance: 0,
            totalScans: 0
        };
    }

    try {
        const scanners = await getAllScanners();
        
        const stats = {
            total: scanners.length,
            online: 0,
            offline: 0,
            degraded: 0,
            maintenance: 0,
            totalScans: 0,
            avgBattery: null,
            lowBatteryCount: 0
        };

        let batterySum = 0;
        let batteryCount = 0;

        for (const scanner of scanners) {
            stats[scanner.status] = (stats[scanner.status] || 0) + 1;
            stats.totalScans += scanner.scanCount || 0;

            if (typeof scanner.battery === 'number') {
                batterySum += scanner.battery;
                batteryCount++;
                if (scanner.battery < 20) {
                    stats.lowBatteryCount++;
                }
            }
        }

        if (batteryCount > 0) {
            stats.avgBattery = Math.round(batterySum / batteryCount);
        }

        return stats;
    } catch (error) {
        console.error('Get scanner stats error:', error);
        return {
            total: 0,
            online: 0,
            offline: 0,
            degraded: 0,
            maintenance: 0,
            totalScans: 0
        };
    }
}

/**
 * Get scanner logs
 * @param {string} scannerId - Scanner ID
 * @param {number} limit - Max logs to return
 * @returns {Promise<Array>}
 */
export async function getScannerLogs(scannerId, limit = 100) {
    if (!adminDb) return [];

    try {
        const snapshot = await adminDb
            .ref(`scannerLogs/${scannerId}`)
            .orderByChild('timestamp')
            .limitToLast(limit)
            .once('value');

        if (!snapshot.exists()) return [];

        const logs = [];
        snapshot.forEach(child => {
            logs.push({ id: child.key, ...child.val() });
        });

        return logs.reverse();
    } catch (error) {
        console.error('Get scanner logs error:', error);
        return [];
    }
}
