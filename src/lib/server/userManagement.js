// src/lib/server/userManagement.js
import { adminDb } from './firebase-admin.js';
import { logAuditEvent } from './adminAuth.js';
import crypto from 'crypto';

/**
 * Generate unique Digital ID
 */
export function generateDigitalId(prefix = 'STU') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Generate QR Code data
 */
export function generateQRData(userId, digitalId) {
    const secret = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    return {
        qrCode: `${digitalId}:${secret}:${timestamp}`,
        qrSecret: secret,
        qrGeneratedAt: new Date(timestamp).toISOString()
    };
}

/**
 * Hash password
 */
function hashPassword(password, salt = null) {
    salt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return { hash, salt };
}

/**
 * Generate random password
 */
export function generateRandomPassword(length = 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

/**
 * Create a new user
 */
export async function createUser(userData, adminId) {
    if (!adminDb) throw new Error('Database not available');
    
    const { 
        name, email, role = 'student', department, year, section,
        employeeId, phone, password
    } = userData;
    
    // Check if email already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
        throw new Error('User with this email already exists');
    }
    
    // Generate IDs
    const prefix = role === 'staff' ? 'STF' : 'STU';
    const digitalId = generateDigitalId(prefix);
    
    // Generate QR data
    const qrData = generateQRData(null, digitalId);
    
    // Hash password if provided
    let passwordData = {};
    if (password) {
        const { hash, salt } = hashPassword(password);
        passwordData = { passwordHash: hash, passwordSalt: salt };
    }
    
    const newUserRef = adminDb.ref('users').push();
    const user = {
        name,
        email,
        role,
        digitalId,
        department: department || null,
        departmentOrCourse: department || null,
        year: year || null,
        section: section || null,
        employeeId: employeeId || null,
        phone: phone || null,
        ...qrData,
        ...passwordData,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: adminId
    };
    
    await newUserRef.set(user);
    
    await logAuditEvent({
        action: 'USER_CREATED',
        adminId,
        targetId: newUserRef.key,
        details: { name, email, role, digitalId }
    });
    
    // Return user without sensitive data
    const { passwordHash, passwordSalt, qrSecret, ...safeUser } = user;
    return { id: newUserRef.key, ...safeUser };
}

/**
 * Get user by email
 */
export async function getUserByEmail(email) {
    if (!adminDb) return null;
    
    const snapshot = await adminDb.ref('users')
        .orderByChild('email')
        .equalTo(email)
        .once('value');
    
    if (!snapshot.exists()) return null;
    
    const users = snapshot.val();
    const userId = Object.keys(users)[0];
    return { id: userId, ...users[userId] };
}

/**
 * Get user by ID
 */
export async function getUserById(userId) {
    if (!adminDb) return null;
    
    const snapshot = await adminDb.ref(`users/${userId}`).once('value');
    if (!snapshot.exists()) return null;
    
    return { id: userId, ...snapshot.val() };
}

/**
 * Update user
 */
export async function updateUser(userId, updates, adminId) {
    if (!adminDb) throw new Error('Database not available');
    
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');
    
    // Filter allowed updates
    const allowedFields = [
        'name', 'department', 'departmentOrCourse', 'year', 'section',
        'employeeId', 'phone', 'role', 'isActive', 'profilePhoto'
    ];
    
    const filteredUpdates = {};
    for (const key of allowedFields) {
        if (updates[key] !== undefined) {
            filteredUpdates[key] = updates[key];
            // Sync department fields
            if (key === 'department') {
                filteredUpdates.departmentOrCourse = updates[key];
            }
        }
    }
    
    filteredUpdates.updatedAt = new Date().toISOString();
    filteredUpdates.updatedBy = adminId;
    
    await adminDb.ref(`users/${userId}`).update(filteredUpdates);
    
    await logAuditEvent({
        action: 'USER_UPDATED',
        adminId,
        targetId: userId,
        details: { fields: Object.keys(filteredUpdates) }
    });
    
    return true;
}

/**
 * Reset user's QR code
 */
export async function resetUserQR(userId, adminId) {
    if (!adminDb) throw new Error('Database not available');
    
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');
    
    const qrData = generateQRData(userId, user.digitalId);
    
    await adminDb.ref(`users/${userId}`).update({
        ...qrData,
        updatedAt: new Date().toISOString()
    });
    
    // Build details object, excluding undefined values (Firebase doesn't allow undefined)
    const auditDetails = {};
    if (user.digitalId) auditDetails.digitalId = user.digitalId;
    if (user.name) auditDetails.userName = user.name;
    
    await logAuditEvent({
        action: 'USER_QR_RESET',
        adminId,
        targetId: userId,
        details: Object.keys(auditDetails).length > 0 ? auditDetails : { userId }
    });
    
    return { qrCode: qrData.qrCode, qrGeneratedAt: qrData.qrGeneratedAt };
}

/**
 * Reset user's password
 */
export async function resetUserPassword(userId, newPassword, adminId) {
    if (!adminDb) throw new Error('Database not available');
    
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');
    
    const { hash, salt } = hashPassword(newPassword);
    
    await adminDb.ref(`users/${userId}`).update({
        passwordHash: hash,
        passwordSalt: salt,
        passwordResetAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
    
    await logAuditEvent({
        action: 'USER_PASSWORD_RESET',
        adminId,
        targetId: userId,
        details: { email: user.email }
    });
    
    return true;
}

/**
 * Activate/Deactivate user
 */
export async function setUserActiveStatus(userId, isActive, adminId) {
    if (!adminDb) throw new Error('Database not available');
    
    await adminDb.ref(`users/${userId}`).update({
        isActive,
        updatedAt: new Date().toISOString()
    });
    
    await logAuditEvent({
        action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        adminId,
        targetId: userId
    });
    
    return true;
}

/**
 * Delete user
 */
export async function deleteUser(userId, adminId) {
    if (!adminDb) throw new Error('Database not available');
    
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');
    
    await adminDb.ref(`users/${userId}`).remove();
    
    await logAuditEvent({
        action: 'USER_DELETED',
        adminId,
        targetId: userId,
        details: { email: user.email, name: user.name }
    });
    
    return true;
}

/**
 * Promote user to admin
 */
export async function promoteToAdmin(userId, adminRole, adminId) {
    if (!adminDb) throw new Error('Database not available');
    
    const user = await getUserById(userId);
    if (!user) throw new Error('User not found');
    
    await adminDb.ref(`users/${userId}`).update({
        isAdmin: true,
        adminRole: adminRole || 'admin',
        promotedAt: new Date().toISOString(),
        promotedBy: adminId,
        updatedAt: new Date().toISOString()
    });
    
    await logAuditEvent({
        action: 'USER_PROMOTED_TO_ADMIN',
        adminId,
        targetId: userId,
        details: { adminRole }
    });
    
    return true;
}

/**
 * Demote admin to regular user
 */
export async function demoteFromAdmin(userId, adminId) {
    if (!adminDb) throw new Error('Database not available');
    
    await adminDb.ref(`users/${userId}`).update({
        isAdmin: false,
        adminRole: null,
        demotedAt: new Date().toISOString(),
        demotedBy: adminId,
        updatedAt: new Date().toISOString()
    });
    
    await logAuditEvent({
        action: 'USER_DEMOTED_FROM_ADMIN',
        adminId,
        targetId: userId
    });
    
    return true;
}

/**
 * Bulk create users from CSV data
 */
export async function bulkCreateUsers(usersData, adminId) {
    if (!adminDb) throw new Error('Database not available');
    
    const results = {
        success: [],
        failed: []
    };
    
    for (const userData of usersData) {
        try {
            const user = await createUser(userData, adminId);
            results.success.push({ email: userData.email, id: user.id, digitalId: user.digitalId });
        } catch (error) {
            results.failed.push({ email: userData.email, error: error.message });
        }
    }
    
    await logAuditEvent({
        action: 'BULK_USERS_CREATED',
        adminId,
        details: { 
            total: usersData.length,
            success: results.success.length,
            failed: results.failed.length
        }
    });
    
    return results;
}

/**
 * Bulk delete users
 */
export async function bulkDeleteUsers(userIds, adminId) {
    if (!adminDb) throw new Error('Database not available');
    
    const results = { success: [], failed: [] };
    
    for (const userId of userIds) {
        try {
            await deleteUser(userId, adminId);
            results.success.push(userId);
        } catch (error) {
            results.failed.push({ id: userId, error: error.message });
        }
    }
    
    return results;
}

/**
 * Bulk update users (assign department/section)
 */
export async function bulkUpdateUsers(userIds, updates, adminId) {
    if (!adminDb) throw new Error('Database not available');
    
    const results = { success: [], failed: [] };
    
    for (const userId of userIds) {
        try {
            await updateUser(userId, updates, adminId);
            results.success.push(userId);
        } catch (error) {
            results.failed.push({ id: userId, error: error.message });
        }
    }
    
    await logAuditEvent({
        action: 'BULK_USERS_UPDATED',
        adminId,
        details: { 
            total: userIds.length,
            success: results.success.length,
            fields: Object.keys(updates)
        }
    });
    
    return results;
}

/**
 * Get all users with filters
 */
export async function getAllUsers(filters = {}) {
    if (!adminDb) return [];
    
    const snapshot = await adminDb.ref('users').once('value');
    if (!snapshot.exists()) return [];
    
    let users = [];
    snapshot.forEach(child => {
        const user = child.val();
        const { passwordHash, passwordSalt, qrSecret, ...safeUser } = user;
        users.push({ id: child.key, ...safeUser });
    });
    
    // Apply filters
    if (filters.role) {
        users = users.filter(u => u.role === filters.role);
    }
    if (filters.department) {
        users = users.filter(u => u.department === filters.department);
    }
    if (filters.section) {
        users = users.filter(u => u.section === filters.section);
    }
    if (filters.isActive !== undefined) {
        users = users.filter(u => u.isActive === filters.isActive);
    }
    if (filters.search) {
        const search = filters.search.toLowerCase();
        users = users.filter(u => 
            u.name?.toLowerCase().includes(search) ||
            u.email?.toLowerCase().includes(search) ||
            u.digitalId?.toLowerCase().includes(search)
        );
    }
    
    return users;
}

/**
 * Get departments list
 */
export async function getDepartments() {
    if (!adminDb) return [];
    
    const snapshot = await adminDb.ref('departments').once('value');
    if (!snapshot.exists()) {
        // Return default departments
        return [
            { id: 'cs', name: 'Computer Science' },
            { id: 'it', name: 'Information Technology' },
            { id: 'eng', name: 'Engineering' },
            { id: 'bus', name: 'Business Administration' },
            { id: 'arts', name: 'Arts and Sciences' }
        ];
    }
    
    const departments = [];
    snapshot.forEach(child => {
        departments.push({ id: child.key, ...child.val() });
    });
    return departments;
}

/**
 * Export users to CSV format
 */
export function exportUsersToCSV(users) {
    const headers = ['Name', 'Email', 'Digital ID', 'Role', 'Department', 'Year', 'Section', 'Status', 'Created At'];
    const rows = users.map(u => [
        u.name || '',
        u.email || '',
        u.digitalId || '',
        u.role || '',
        u.department || '',
        u.year || '',
        u.section || '',
        u.isActive !== false ? 'Active' : 'Inactive',
        u.createdAt || ''
    ]);
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return csvContent;
}
