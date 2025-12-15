// src/lib/server/backupService.js
// Backup & Recovery System for Firebase Realtime Database
import { adminDb } from './firebase-admin.js';
import { logAuditEvent } from './adminAuth.js';

const BACKUP_PATH = 'systemBackups';
const BACKUP_METADATA_PATH = 'backupMetadata';

/**
 * @typedef {Object} BackupMetadata
 * @property {string} id
 * @property {string} type - 'manual' | 'scheduled'
 * @property {string} createdAt
 * @property {string} createdBy - Admin ID or 'system'
 * @property {string} status - 'completed' | 'failed' | 'in_progress'
 * @property {number} size - Approximate size in bytes
 * @property {string[]} collections - What was backed up
 * @property {string} [description]
 */

const BACKUP_COLLECTIONS = ['users', 'attendance', 'announcements', 'feedback', 'settings', 'admins'];

/**
 * Create a manual backup
 * @param {string} adminId - Admin performing the backup
 * @param {string} [description] - Optional description
 * @returns {Promise<BackupMetadata>}
 */
export async function createManualBackup(adminId, description = '') {
    if (!adminDb) throw new Error('Database not available');

    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const startTime = new Date().toISOString();

    // Create metadata entry first
    const metadata = {
        id: backupId,
        type: 'manual',
        createdAt: startTime,
        createdBy: adminId,
        status: 'in_progress',
        size: 0,
        collections: BACKUP_COLLECTIONS,
        description
    };

    await adminDb.ref(`${BACKUP_METADATA_PATH}/${backupId}`).set(metadata);

    try {
        const backupData = {};
        let totalSize = 0;

        // Backup each collection
        for (const collection of BACKUP_COLLECTIONS) {
            const snapshot = await adminDb.ref(collection).once('value');
            if (snapshot.exists()) {
                backupData[collection] = snapshot.val();
                totalSize += JSON.stringify(snapshot.val()).length;
            }
        }

        // Store backup data
        await adminDb.ref(`${BACKUP_PATH}/${backupId}`).set({
            data: backupData,
            createdAt: startTime,
            completedAt: new Date().toISOString()
        });

        // Update metadata
        metadata.status = 'completed';
        metadata.size = totalSize;
        metadata.completedAt = new Date().toISOString();
        await adminDb.ref(`${BACKUP_METADATA_PATH}/${backupId}`).update(metadata);

        // Log audit event
        await logAuditEvent({
            action: 'BACKUP_CREATED',
            adminId,
            details: { backupId, type: 'manual', size: totalSize, collections: BACKUP_COLLECTIONS }
        });

        return metadata;
    } catch (error) {
        // Update metadata with failure
        await adminDb.ref(`${BACKUP_METADATA_PATH}/${backupId}`).update({
            status: 'failed',
            error: error.message,
            failedAt: new Date().toISOString()
        });
        throw error;
    }
}

/**
 * Create scheduled backup (called by cron/scheduler)
 * @returns {Promise<BackupMetadata>}
 */
export async function createScheduledBackup() {
    return createManualBackup('system', 'Scheduled automatic backup');
}

/**
 * Get all backup metadata
 * @param {number} [limit=20]
 * @returns {Promise<BackupMetadata[]>}
 */
export async function getBackupList(limit = 20) {
    if (!adminDb) return [];

    const snapshot = await adminDb
        .ref(BACKUP_METADATA_PATH)
        .orderByChild('createdAt')
        .limitToLast(limit)
        .once('value');

    if (!snapshot.exists()) return [];

    const backups = [];
    snapshot.forEach(child => {
        backups.push(child.val());
    });

    return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get latest backup info
 * @returns {Promise<BackupMetadata|null>}
 */
export async function getLatestBackup() {
    const backups = await getBackupList(1);
    return backups[0] || null;
}

/**
 * Restore from backup
 * @param {string} backupId
 * @param {string} adminId
 * @param {string[]} [collectionsToRestore] - Specific collections, or all if empty
 * @returns {Promise<{success: boolean, restored: string[]}>}
 */
export async function restoreFromBackup(backupId, adminId, collectionsToRestore = []) {
    if (!adminDb) throw new Error('Database not available');

    // Get backup data
    const backupSnapshot = await adminDb.ref(`${BACKUP_PATH}/${backupId}`).once('value');
    if (!backupSnapshot.exists()) {
        throw new Error('Backup not found');
    }

    const backup = backupSnapshot.val();
    const collections = collectionsToRestore.length > 0 
        ? collectionsToRestore 
        : Object.keys(backup.data);

    const restored = [];

    for (const collection of collections) {
        if (backup.data[collection]) {
            await adminDb.ref(collection).set(backup.data[collection]);
            restored.push(collection);
        }
    }

    // Log audit event
    await logAuditEvent({
        action: 'BACKUP_RESTORED',
        adminId,
        details: { backupId, restoredCollections: restored }
    });

    return { success: true, restored };
}

/**
 * Delete old backups (retention policy)
 * @param {number} keepCount - Number of backups to keep
 * @returns {Promise<number>} Number of deleted backups
 */
export async function cleanupOldBackups(keepCount = 10) {
    if (!adminDb) return 0;

    const backups = await getBackupList(100);
    
    if (backups.length <= keepCount) return 0;

    const toDelete = backups.slice(keepCount);
    let deleted = 0;

    for (const backup of toDelete) {
        await adminDb.ref(`${BACKUP_PATH}/${backup.id}`).remove();
        await adminDb.ref(`${BACKUP_METADATA_PATH}/${backup.id}`).remove();
        deleted++;
    }

    return deleted;
}

/**
 * Delete a specific backup
 * @param {string} backupId
 * @param {string} adminId
 */
export async function deleteBackup(backupId, adminId) {
    if (!adminDb) throw new Error('Database not available');

    await adminDb.ref(`${BACKUP_PATH}/${backupId}`).remove();
    await adminDb.ref(`${BACKUP_METADATA_PATH}/${backupId}`).remove();

    await logAuditEvent({
        action: 'BACKUP_DELETED',
        adminId,
        details: { backupId }
    });

    return true;
}
