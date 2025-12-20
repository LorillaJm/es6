// src/lib/server/adminAuth.js
import { adminDb, adminAuth } from './firebase-admin.js';
import crypto from 'crypto';

// JWT Configuration - defaults (can be overridden by system settings)
const DEFAULT_ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutes
const DEFAULT_REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days
const MFA_CODE_EXPIRY = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_LOGIN_ATTEMPTS = 5;
const DEFAULT_SESSION_TIMEOUT_HOURS = 8;

// Cache for security settings
let cachedSecuritySettings = null;
let securityCacheTimestamp = 0;
const SECURITY_CACHE_DURATION = 60000; // 1 minute

// Fetch security settings from system settings
async function getSecuritySettings() {
    const now = Date.now();
    if (cachedSecuritySettings && (now - securityCacheTimestamp) < SECURITY_CACHE_DURATION) {
        return cachedSecuritySettings;
    }
    
    const defaults = {
        sessionTimeout: DEFAULT_SESSION_TIMEOUT_HOURS,
        maxLoginAttempts: DEFAULT_MAX_LOGIN_ATTEMPTS,
        mfaRequired: false
    };
    
    if (!adminDb) return defaults;
    
    try {
        const snapshot = await adminDb.ref('systemSettings/security').once('value');
        if (snapshot.exists()) {
            cachedSecuritySettings = { ...defaults, ...snapshot.val() };
            securityCacheTimestamp = now;
            return cachedSecuritySettings;
        }
    } catch (error) {
        console.error('Error fetching security settings:', error);
    }
    return defaults;
}

// Admin Roles
export const ADMIN_ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin'
};

// Permissions
export const PERMISSIONS = {
    MANAGE_USERS: 'manage_users',
    VIEW_ATTENDANCE: 'view_attendance',
    EDIT_LOGS: 'edit_logs',
    ACCESS_REPORTS: 'access_reports',
    MANAGE_SYSTEM_SETTINGS: 'manage_system_settings',
    VIEW_AUDIT_LOGS: 'view_audit_logs',
    MANAGE_ANNOUNCEMENTS: 'manage_announcements',
    MANAGE_FEEDBACK: 'manage_feedback',
    MANAGE_SECURITY: 'manage_security'
};

// Role permissions mapping
export const ROLE_PERMISSIONS = {
    [ADMIN_ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
    [ADMIN_ROLES.ADMIN]: [
        PERMISSIONS.MANAGE_USERS,
        PERMISSIONS.VIEW_ATTENDANCE,
        PERMISSIONS.ACCESS_REPORTS,
        PERMISSIONS.MANAGE_ANNOUNCEMENTS,
        PERMISSIONS.MANAGE_FEEDBACK
    ]
};

/**
 * Generate secure random token
 */
function generateToken(length = 64) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash password using SHA-256 with salt
 */
function hashPassword(password, salt = null) {
    salt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return { hash, salt };
}

/**
 * Verify password
 */
function verifyPassword(password, storedHash, salt) {
    const { hash } = hashPassword(password, salt);
    return hash === storedHash;
}

/**
 * Create admin account
 */
export async function createAdmin(adminData) {
    if (!adminDb) throw new Error('Database not available');
    
    const { email, password, name, role = ADMIN_ROLES.ADMIN } = adminData;
    
    // Check if admin already exists
    const existingAdmin = await getAdminByEmail(email);
    if (existingAdmin) {
        throw new Error('Admin with this email already exists');
    }
    
    // Hash password
    const { hash, salt } = hashPassword(password);
    
    const adminId = generateToken(16);
    const admin = {
        id: adminId,
        email,
        name,
        role,
        passwordHash: hash,
        passwordSalt: salt,
        mfaEnabled: false,
        mfaSecret: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLogin: null,
        loginAttempts: 0,
        lockedUntil: null
    };
    
    await adminDb.ref(`admins/${adminId}`).set(admin);
    
    // Log audit
    await logAuditEvent({
        action: 'ADMIN_CREATED',
        adminId,
        targetId: adminId,
        details: { email, name, role },
        ipAddress: adminData.ipAddress || 'unknown'
    });
    
    // Return admin without sensitive data
    const { passwordHash, passwordSalt, mfaSecret, ...safeAdmin } = admin;
    return safeAdmin;
}

/**
 * Get admin by email
 */
export async function getAdminByEmail(email) {
    if (!adminDb) return null;
    
    const snapshot = await adminDb.ref('admins')
        .orderByChild('email')
        .equalTo(email)
        .once('value');
    
    if (!snapshot.exists()) return null;
    
    const admins = snapshot.val();
    const adminId = Object.keys(admins)[0];
    return { ...admins[adminId], id: adminId };
}

/**
 * Get admin by ID
 */
export async function getAdminById(adminId) {
    if (!adminDb) return null;
    
    const snapshot = await adminDb.ref(`admins/${adminId}`).once('value');
    if (!snapshot.exists()) return null;
    
    return { ...snapshot.val(), id: adminId };
}

/**
 * Admin login
 */
export async function adminLogin(email, password, ipAddress = 'unknown', deviceInfo = null) {
    const admin = await getAdminByEmail(email);
    const securitySettings = await getSecuritySettings();
    const maxLoginAttempts = securitySettings.maxLoginAttempts || DEFAULT_MAX_LOGIN_ATTEMPTS;
    
    if (!admin) {
        await logAuditEvent({
            action: 'LOGIN_FAILED',
            details: { email, reason: 'Admin not found' },
            ipAddress,
            deviceInfo
        });
        throw new Error('Invalid credentials');
    }
    
    // Check if account is locked
    if (admin.lockedUntil && new Date(admin.lockedUntil) > new Date()) {
        throw new Error('Account is locked. Please try again later.');
    }
    
    // Check if account is active
    if (!admin.isActive) {
        throw new Error('Account is deactivated');
    }
    
    // Verify password
    if (!verifyPassword(password, admin.passwordHash, admin.passwordSalt)) {
        // Increment login attempts
        const loginAttempts = (admin.loginAttempts || 0) + 1;
        const updates = { loginAttempts };
        
        // Lock account after max failed attempts (from system settings)
        if (loginAttempts >= maxLoginAttempts) {
            updates.lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
        }
        
        await adminDb.ref(`admins/${admin.id}`).update(updates);
        
        await logAuditEvent({
            action: 'LOGIN_FAILED',
            adminId: admin.id,
            details: { email, reason: 'Invalid password', attempts: loginAttempts, maxAttempts: maxLoginAttempts },
            ipAddress,
            deviceInfo
        });
        
        throw new Error('Invalid credentials');
    }
    
    // Reset login attempts on successful login
    await adminDb.ref(`admins/${admin.id}`).update({
        loginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date().toISOString()
    });
    
    // Check if email verification is required (first-time login)
    if (!admin.emailVerified) {
        // Import email verification service
        const { sendAdminVerificationOTP } = await import('./emailVerificationService.js');
        
        // Send verification OTP
        const otpResult = await sendAdminVerificationOTP(admin.id, admin.email, admin.name);
        
        if (otpResult.success) {
            return {
                emailVerificationRequired: true,
                adminId: admin.id,
                email: admin.email,
                sessionToken: otpResult.sessionToken,
                expiresIn: otpResult.expiresIn
            };
        }
        // If OTP sending fails, continue with login (don't block)
    }
    
    // Check if MFA is required (from system settings or admin-specific)
    const mfaRequired = securitySettings.mfaRequired || admin.mfaEnabled;
    if (mfaRequired && admin.mfaEnabled) {
        // Generate MFA session token
        const mfaSessionToken = generateToken(32);
        await adminDb.ref(`mfaSessions/${mfaSessionToken}`).set({
            adminId: admin.id,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + MFA_CODE_EXPIRY).toISOString()
        });
        
        return {
            mfaRequired: true,
            mfaSessionToken
        };
    }
    
    // Generate tokens with session timeout from settings
    const tokens = await generateAuthTokens(admin.id, securitySettings.sessionTimeout);
    
    await logAuditEvent({
        action: 'LOGIN_SUCCESS',
        adminId: admin.id,
        details: { email },
        ipAddress,
        deviceInfo
    });
    
    // Return admin without sensitive data
    const { passwordHash, passwordSalt, mfaSecret, ...safeAdmin } = admin;
    
    return {
        admin: safeAdmin,
        ...tokens
    };
}

/**
 * Generate auth tokens
 */
export async function generateAuthTokens(adminId, sessionTimeoutHours = null) {
    const accessToken = generateToken(32);
    const refreshToken = generateToken(64);
    const now = Date.now();
    
    // Use session timeout from settings or default
    const timeoutHours = sessionTimeoutHours || DEFAULT_SESSION_TIMEOUT_HOURS;
    const accessTokenExpiry = timeoutHours * 60 * 60 * 1000; // Convert hours to ms
    
    // Store tokens
    await adminDb.ref(`adminTokens/${accessToken}`).set({
        adminId,
        type: 'access',
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + accessTokenExpiry).toISOString()
    });
    
    await adminDb.ref(`adminRefreshTokens/${refreshToken}`).set({
        adminId,
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + DEFAULT_REFRESH_TOKEN_EXPIRY).toISOString()
    });
    
    return {
        accessToken,
        refreshToken,
        tokenExpiry: now + accessTokenExpiry
    };
}

/**
 * Verify access token
 */
export async function verifyAccessToken(accessToken) {
    if (!adminDb || !accessToken) return null;
    
    const snapshot = await adminDb.ref(`adminTokens/${accessToken}`).once('value');
    if (!snapshot.exists()) return null;
    
    const tokenData = snapshot.val();
    
    // Check expiry
    if (new Date(tokenData.expiresAt) < new Date()) {
        await adminDb.ref(`adminTokens/${accessToken}`).remove();
        return null;
    }
    
    const admin = await getAdminById(tokenData.adminId);
    if (!admin || !admin.isActive) return null;
    
    const { passwordHash, passwordSalt, mfaSecret, ...safeAdmin } = admin;
    return safeAdmin;
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken) {
    if (!adminDb || !refreshToken) throw new Error('Invalid refresh token');
    
    const snapshot = await adminDb.ref(`adminRefreshTokens/${refreshToken}`).once('value');
    if (!snapshot.exists()) throw new Error('Invalid refresh token');
    
    const tokenData = snapshot.val();
    
    // Check expiry
    if (new Date(tokenData.expiresAt) < new Date()) {
        await adminDb.ref(`adminRefreshTokens/${refreshToken}`).remove();
        throw new Error('Refresh token expired');
    }
    
    // Generate new access token
    const accessToken = generateToken(32);
    const now = Date.now();
    
    await adminDb.ref(`adminTokens/${accessToken}`).set({
        adminId: tokenData.adminId,
        type: 'access',
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + DEFAULT_ACCESS_TOKEN_EXPIRY).toISOString()
    });
    
    return {
        accessToken,
        tokenExpiry: now + DEFAULT_ACCESS_TOKEN_EXPIRY
    };
}

/**
 * Logout admin (invalidate tokens)
 */
export async function adminLogout(accessToken, refreshToken) {
    if (adminDb) {
        if (accessToken) {
            await adminDb.ref(`adminTokens/${accessToken}`).remove();
        }
        if (refreshToken) {
            await adminDb.ref(`adminRefreshTokens/${refreshToken}`).remove();
        }
    }
    return true;
}

/**
 * Setup MFA for admin
 */
export async function setupMfa(adminId) {
    const secret = generateToken(20);
    
    await adminDb.ref(`admins/${adminId}`).update({
        mfaSecret: secret,
        mfaEnabled: false // Will be enabled after verification
    });
    
    return { secret };
}

/**
 * Enable MFA after verification
 */
export async function enableMfa(adminId, code) {
    const admin = await getAdminById(adminId);
    if (!admin || !admin.mfaSecret) {
        throw new Error('MFA not setup');
    }
    
    // Simple TOTP-like verification (in production, use proper TOTP library)
    // For now, we'll use a simple time-based code
    const expectedCode = generateTimeBasedCode(admin.mfaSecret);
    
    if (code !== expectedCode) {
        throw new Error('Invalid MFA code');
    }
    
    await adminDb.ref(`admins/${adminId}`).update({
        mfaEnabled: true,
        updatedAt: new Date().toISOString()
    });
    
    await logAuditEvent({
        action: 'MFA_ENABLED',
        adminId,
        details: {}
    });
    
    return true;
}

/**
 * Verify MFA code during login
 */
export async function verifyMfaCode(mfaSessionToken, code, ipAddress = 'unknown') {
    const sessionSnapshot = await adminDb.ref(`mfaSessions/${mfaSessionToken}`).once('value');
    if (!sessionSnapshot.exists()) {
        throw new Error('Invalid MFA session');
    }
    
    const session = sessionSnapshot.val();
    
    // Check expiry
    if (new Date(session.expiresAt) < new Date()) {
        await adminDb.ref(`mfaSessions/${mfaSessionToken}`).remove();
        throw new Error('MFA session expired');
    }
    
    const admin = await getAdminById(session.adminId);
    if (!admin) {
        throw new Error('Admin not found');
    }
    
    const expectedCode = generateTimeBasedCode(admin.mfaSecret);
    
    if (code !== expectedCode) {
        await logAuditEvent({
            action: 'MFA_VERIFICATION_FAILED',
            adminId: admin.id,
            ipAddress
        });
        throw new Error('Invalid MFA code');
    }
    
    // Clean up MFA session
    await adminDb.ref(`mfaSessions/${mfaSessionToken}`).remove();
    
    // Generate tokens
    const tokens = await generateAuthTokens(admin.id);
    
    await logAuditEvent({
        action: 'MFA_VERIFICATION_SUCCESS',
        adminId: admin.id,
        ipAddress
    });
    
    const { passwordHash, passwordSalt, mfaSecret, ...safeAdmin } = admin;
    
    return {
        admin: safeAdmin,
        ...tokens
    };
}

/**
 * Generate time-based code (simplified TOTP)
 */
function generateTimeBasedCode(secret) {
    const timeStep = Math.floor(Date.now() / 30000);
    const hash = crypto.createHmac('sha256', secret)
        .update(timeStep.toString())
        .digest('hex');
    return hash.substring(0, 6).toUpperCase();
}

/**
 * Log audit event
 */
export async function logAuditEvent(event) {
    if (!adminDb) return;
    
    const auditId = generateToken(16);
    const auditEntry = {
        id: auditId,
        ...event,
        timestamp: new Date().toISOString()
    };
    
    await adminDb.ref(`auditLogs/${auditId}`).set(auditEntry);
    return auditId;
}

/**
 * Get audit logs with pagination
 */
export async function getAuditLogs(options = {}) {
    if (!adminDb) return { logs: [], total: 0 };
    
    const { limit = 50, startAfter = null, action = null, adminId = null } = options;
    
    let query = adminDb.ref('auditLogs').orderByChild('timestamp');
    
    if (limit) {
        query = query.limitToLast(limit);
    }
    
    const snapshot = await query.once('value');
    if (!snapshot.exists()) return { logs: [], total: 0 };
    
    let logs = [];
    snapshot.forEach(child => {
        const log = { ...child.val(), id: child.key };
        
        // Filter by action if specified
        if (action && log.action !== action) return;
        
        // Filter by adminId if specified
        if (adminId && log.adminId !== adminId) return;
        
        logs.push(log);
    });
    
    // Sort by timestamp descending
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return { logs, total: logs.length };
}

/**
 * Check if admin has permission
 */
export function checkPermission(admin, permission) {
    if (!admin || !admin.role) return false;
    const permissions = ROLE_PERMISSIONS[admin.role] || [];
    return permissions.includes(permission);
}

/**
 * Get all admins
 */
export async function getAllAdmins() {
    if (!adminDb) return [];
    
    const snapshot = await adminDb.ref('admins').once('value');
    if (!snapshot.exists()) return [];
    
    const admins = [];
    snapshot.forEach(child => {
        const admin = child.val();
        const { passwordHash, passwordSalt, mfaSecret, ...safeAdmin } = admin;
        admins.push({ ...safeAdmin, id: child.key });
    });
    
    return admins;
}

/**
 * Update admin
 */
export async function updateAdmin(adminId, updates, performedBy) {
    if (!adminDb) throw new Error('Database not available');
    
    const admin = await getAdminById(adminId);
    if (!admin) throw new Error('Admin not found');
    
    const allowedUpdates = ['name', 'role', 'isActive'];
    const filteredUpdates = {};
    
    for (const key of allowedUpdates) {
        if (updates[key] !== undefined) {
            filteredUpdates[key] = updates[key];
        }
    }
    
    filteredUpdates.updatedAt = new Date().toISOString();
    
    await adminDb.ref(`admins/${adminId}`).update(filteredUpdates);
    
    await logAuditEvent({
        action: 'ADMIN_UPDATED',
        adminId: performedBy,
        targetId: adminId,
        details: filteredUpdates
    });
    
    return true;
}

/**
 * Delete admin
 */
export async function deleteAdmin(adminId, performedBy) {
    if (!adminDb) throw new Error('Database not available');
    
    const admin = await getAdminById(adminId);
    if (!admin) throw new Error('Admin not found');
    
    await adminDb.ref(`admins/${adminId}`).remove();
    
    await logAuditEvent({
        action: 'ADMIN_DELETED',
        adminId: performedBy,
        targetId: adminId,
        details: { email: admin.email }
    });
    
    return true;
}

/**
 * Change admin password
 */
export async function changeAdminPassword(adminId, currentPassword, newPassword) {
    const admin = await getAdminById(adminId);
    if (!admin) throw new Error('Admin not found');
    
    // Verify current password
    if (!verifyPassword(currentPassword, admin.passwordHash, admin.passwordSalt)) {
        throw new Error('Current password is incorrect');
    }
    
    // Hash new password
    const { hash, salt } = hashPassword(newPassword);
    
    await adminDb.ref(`admins/${adminId}`).update({
        passwordHash: hash,
        passwordSalt: salt,
        updatedAt: new Date().toISOString()
    });
    
    await logAuditEvent({
        action: 'PASSWORD_CHANGED',
        adminId,
        details: {}
    });
    
    return true;
}
