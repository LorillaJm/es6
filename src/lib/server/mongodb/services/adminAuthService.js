// src/lib/server/mongodb/services/adminAuthService.js
// Admin Authentication Service - MongoDB Atlas (PRIMARY)
// ✅ All admin auth operations use MongoDB for data storage
// ✅ Falls back to legacy Firebase auth for existing admins without MongoDB passwords
// ❌ New admins use MongoDB-only authentication

import crypto from 'crypto';
import { connectMongoDB } from '../connection.js';
import { Admin } from '../schemas/Admin.js';
import { AdminToken } from '../schemas/AdminToken.js';
import { AuditLog } from '../schemas/AuditLog.js';
// Import legacy Firebase auth for backward compatibility
import * as legacyAdminAuth from '../../adminAuth.js';

// Token expiry configuration
const TOKEN_CONFIG = {
    ACCESS_TOKEN_EXPIRY: 15 * 60 * 1000,      // 15 minutes
    REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60 * 1000, // 7 days
    MFA_SESSION_EXPIRY: 5 * 60 * 1000,        // 5 minutes
    EMAIL_VERIFICATION_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours
    PASSWORD_RESET_EXPIRY: 60 * 60 * 1000     // 1 hour
};

// Role permissions mapping
const ROLE_PERMISSIONS = {
    super_admin: [
        'manage_users',
        'view_attendance',
        'edit_logs',
        'access_reports',
        'manage_system_settings',
        'view_audit_logs',
        'manage_announcements',
        'manage_feedback',
        'manage_security'
    ],
    admin: [
        'manage_users',
        'view_attendance',
        'access_reports',
        'manage_announcements',
        'manage_feedback'
    ],
    moderator: [
        'view_attendance',
        'access_reports',
        'manage_announcements'
    ]
};

/**
 * Create a new admin account
 */
export async function createAdmin(adminData, createdBy = 'system') {
    await connectMongoDB();
    
    const { email, password, name, role = 'admin' } = adminData;
    
    // Check if admin already exists
    const existingAdmin = await Admin.findByEmail(email);
    if (existingAdmin) {
        throw new Error('Admin with this email already exists');
    }
    
    // Hash password
    const { hash, salt } = Admin.hashPassword(password);
    
    // Get permissions for role
    const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.admin;
    
    const admin = new Admin({
        email,
        name,
        role,
        permissions,
        passwordHash: hash,
        passwordSalt: salt,
        createdBy
    });
    
    await admin.save();
    
    // Log audit event
    await AuditLog.logEvent({
        eventType: 'admin.created',
        actorId: createdBy,
        actorType: createdBy === 'system' ? 'system' : 'admin',
        targetId: admin._id.toString(),
        targetType: 'admin',
        targetEmail: admin.email,
        action: 'create',
        description: `Admin ${admin.email} created with role ${role}`,
        newData: admin.toSafeObject(),
        severity: 'high'
    });
    
    return admin.toSafeObject();
}

/**
 * Admin login
 * Tries MongoDB auth first, falls back to legacy Firebase auth for existing admins
 */
export async function adminLogin(email, password, ipAddress = 'unknown', deviceInfo = null) {
    await connectMongoDB();
    
    const admin = await Admin.findByEmail(email);
    
    if (!admin) {
        await logFailedLogin(email, ipAddress, 'Admin not found');
        throw new Error('Invalid credentials');
    }
    
    // Check if account is locked
    if (admin.isLocked()) {
        await logFailedLogin(email, ipAddress, 'Account locked');
        throw new Error('Account is locked. Please try again later.');
    }
    
    // Check if account is active
    if (!admin.isActive) {
        await logFailedLogin(email, ipAddress, 'Account deactivated');
        throw new Error('Account is deactivated');
    }
    
    // Try MongoDB password verification first
    let passwordValid = false;
    
    if (admin.passwordHash && admin.passwordSalt) {
        // Admin has MongoDB password - verify it
        passwordValid = admin.verifyPassword(password);
    }
    
    // If MongoDB auth failed or not available, try legacy Firebase auth
    if (!passwordValid) {
        try {
            console.log(`[AdminAuth] Trying legacy Firebase auth for ${email}...`);
            const firebaseResult = await legacyAdminAuth.adminLogin(email, password, ipAddress, deviceInfo);
            
            // Firebase auth succeeded - return the result directly
            // This maintains backward compatibility with existing admin sessions
            console.log(`[AdminAuth] ✅ Legacy Firebase auth succeeded for ${email}`);
            
            // Update last login in MongoDB
            await admin.recordLogin(ipAddress, deviceInfo?.userAgent);
            
            return firebaseResult;
        } catch (firebaseError) {
            // Firebase auth also failed
            console.log(`[AdminAuth] ❌ Legacy Firebase auth failed for ${email}:`, firebaseError.message);
            await admin.incrementLoginAttempts();
            await logFailedLogin(email, ipAddress, 'Invalid password (both MongoDB and Firebase)');
            throw new Error('Invalid credentials');
        }
    }
    
    // MongoDB auth succeeded
    console.log(`[AdminAuth] ✅ MongoDB auth succeeded for ${email}`);
    
    // Check if MFA is required
    if (admin.mfaEnabled) {
        // Create MFA session token
        const { token: mfaSessionToken, expiresAt } = await AdminToken.createToken(
            admin._id,
            'mfa_session',
            TOKEN_CONFIG.MFA_SESSION_EXPIRY,
            { ipAddress, ...deviceInfo }
        );
        
        return {
            mfaRequired: true,
            mfaSessionToken,
            expiresAt
        };
    }
    
    // Generate auth tokens
    const tokens = await generateAuthTokens(admin._id, { ipAddress, ...deviceInfo });
    
    // Record successful login
    await admin.recordLogin(ipAddress, deviceInfo?.userAgent);
    
    // Log audit event
    await AuditLog.logEvent({
        eventType: 'auth.login',
        actorId: admin._id.toString(),
        actorType: 'admin',
        actorEmail: admin.email,
        actorIp: ipAddress,
        actorUserAgent: deviceInfo?.userAgent,
        action: 'login',
        description: `Admin ${admin.email} logged in`,
        status: 'success'
    });
    
    return {
        admin: admin.toSafeObject(),
        ...tokens
    };
}

/**
 * Generate auth tokens for admin
 */
async function generateAuthTokens(adminId, deviceInfo = {}) {
    const [accessTokenResult, refreshTokenResult] = await Promise.all([
        AdminToken.createToken(adminId, 'access', TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY, deviceInfo),
        AdminToken.createToken(adminId, 'refresh', TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY, deviceInfo)
    ]);
    
    return {
        accessToken: accessTokenResult.token,
        refreshToken: refreshTokenResult.token,
        tokenExpiry: accessTokenResult.expiresAt.getTime()
    };
}

/**
 * Verify access token
 * Tries MongoDB token first, falls back to legacy Firebase token
 */
export async function verifyAccessToken(accessToken) {
    await connectMongoDB();
    
    // First try MongoDB token verification
    try {
        const tokenDoc = await AdminToken.verifyToken(accessToken, 'access');
        
        if (tokenDoc && tokenDoc.adminId) {
            const admin = tokenDoc.adminId;
            
            // Check if admin is still active
            if (admin.isActive) {
                return admin.toSafeObject();
            }
        }
    } catch (mongoError) {
        // MongoDB token verification failed, try legacy
        console.log('[AdminAuth] MongoDB token not found, trying legacy Firebase...');
    }
    
    // Fall back to legacy Firebase token verification
    try {
        const legacyAdmin = await legacyAdminAuth.verifyAccessToken(accessToken);
        if (legacyAdmin) {
            console.log('[AdminAuth] ✅ Legacy Firebase token valid');
            return legacyAdmin;
        }
    } catch (firebaseError) {
        console.log('[AdminAuth] Legacy Firebase token also invalid');
    }
    
    return null;
}

/**
 * Refresh access token
 * Tries MongoDB token first, falls back to legacy Firebase token
 */
export async function refreshAccessToken(refreshToken, deviceInfo = {}) {
    await connectMongoDB();
    
    // First try MongoDB token
    try {
        const tokenDoc = await AdminToken.verifyToken(refreshToken, 'refresh');
        
        if (tokenDoc) {
            const admin = tokenDoc.adminId;
            
            if (admin && admin.isActive) {
                // Generate new access token
                const { token: newAccessToken, expiresAt } = await AdminToken.createToken(
                    admin._id,
                    'access',
                    TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY,
                    deviceInfo
                );
                
                return {
                    accessToken: newAccessToken,
                    tokenExpiry: expiresAt.getTime()
                };
            }
        }
    } catch (mongoError) {
        console.log('[AdminAuth] MongoDB refresh token not found, trying legacy...');
    }
    
    // Fall back to legacy Firebase token refresh
    try {
        const legacyResult = await legacyAdminAuth.refreshAccessToken(refreshToken);
        if (legacyResult) {
            console.log('[AdminAuth] ✅ Legacy Firebase token refreshed');
            return legacyResult;
        }
    } catch (firebaseError) {
        console.log('[AdminAuth] Legacy Firebase refresh also failed:', firebaseError.message);
    }
    
    throw new Error('Invalid refresh token');
}

/**
 * Admin logout
 * Revokes tokens from both MongoDB and legacy Firebase
 */
export async function adminLogout(accessToken, refreshToken) {
    await connectMongoDB();
    
    // Revoke MongoDB tokens
    await Promise.all([
        accessToken ? AdminToken.revokeToken(accessToken, 'logout').catch(() => {}) : Promise.resolve(),
        refreshToken ? AdminToken.revokeToken(refreshToken, 'logout').catch(() => {}) : Promise.resolve()
    ]);
    
    // Also revoke legacy Firebase tokens
    try {
        await legacyAdminAuth.adminLogout(accessToken, refreshToken);
    } catch (e) {
        // Ignore errors from legacy logout
    }
    
    return true;
}

/**
 * Verify MFA code
 */
export async function verifyMfaCode(mfaSessionToken, code, deviceInfo = {}) {
    await connectMongoDB();
    
    const tokenDoc = await AdminToken.verifyToken(mfaSessionToken, 'mfa_session');
    
    if (!tokenDoc) {
        throw new Error('Invalid or expired MFA session');
    }
    
    const admin = await Admin.findById(tokenDoc.adminId);
    
    if (!admin) {
        throw new Error('Admin not found');
    }
    
    // Verify MFA code (simplified TOTP)
    const expectedCode = generateTimeBasedCode(admin.mfaSecret);
    
    if (code !== expectedCode) {
        await AuditLog.logEvent({
            eventType: 'auth.failed_login',
            actorId: admin._id.toString(),
            actorType: 'admin',
            actorIp: deviceInfo.ipAddress,
            action: 'mfa_verification_failed',
            description: 'MFA verification failed',
            status: 'failure',
            severity: 'medium'
        });
        throw new Error('Invalid MFA code');
    }
    
    // Revoke MFA session token
    await AdminToken.revokeToken(mfaSessionToken, 'mfa_verified');
    
    // Generate auth tokens
    const tokens = await generateAuthTokens(admin._id, deviceInfo);
    
    // Record login
    await admin.recordLogin(deviceInfo.ipAddress, deviceInfo.userAgent);
    
    // Log success
    await AuditLog.logEvent({
        eventType: 'auth.login',
        actorId: admin._id.toString(),
        actorType: 'admin',
        actorEmail: admin.email,
        actorIp: deviceInfo.ipAddress,
        action: 'mfa_login',
        description: `Admin ${admin.email} logged in with MFA`,
        status: 'success'
    });
    
    return {
        admin: admin.toSafeObject(),
        ...tokens
    };
}

/**
 * Setup MFA for admin
 */
export async function setupMfa(adminId) {
    await connectMongoDB();
    
    const admin = await Admin.findById(adminId);
    if (!admin) {
        throw new Error('Admin not found');
    }
    
    const secret = Admin.generateToken(20);
    
    admin.mfaSecret = secret;
    admin.mfaEnabled = false; // Will be enabled after verification
    await admin.save();
    
    return { secret };
}

/**
 * Enable MFA after verification
 */
export async function enableMfa(adminId, code) {
    await connectMongoDB();
    
    const admin = await Admin.findById(adminId);
    if (!admin || !admin.mfaSecret) {
        throw new Error('MFA not setup');
    }
    
    const expectedCode = generateTimeBasedCode(admin.mfaSecret);
    
    if (code !== expectedCode) {
        throw new Error('Invalid MFA code');
    }
    
    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
        Admin.generateToken(4).toUpperCase()
    );
    
    admin.mfaEnabled = true;
    admin.mfaBackupCodes = backupCodes;
    await admin.save();
    
    await AuditLog.logEvent({
        eventType: 'admin.updated',
        actorId: adminId,
        actorType: 'admin',
        targetId: adminId,
        targetType: 'admin',
        action: 'mfa_enabled',
        description: 'MFA enabled for admin account',
        severity: 'high'
    });
    
    return { backupCodes };
}

/**
 * Change admin password
 */
export async function changePassword(adminId, currentPassword, newPassword) {
    await connectMongoDB();
    
    const admin = await Admin.findById(adminId);
    if (!admin) {
        throw new Error('Admin not found');
    }
    
    if (!admin.verifyPassword(currentPassword)) {
        throw new Error('Current password is incorrect');
    }
    
    const { hash, salt } = Admin.hashPassword(newPassword);
    
    admin.passwordHash = hash;
    admin.passwordSalt = salt;
    admin.passwordChangedAt = new Date();
    await admin.save();
    
    // Revoke all existing tokens (force re-login)
    await AdminToken.revokeAllForAdmin(adminId, null, 'password_changed');
    
    await AuditLog.logEvent({
        eventType: 'admin.updated',
        actorId: adminId,
        actorType: 'admin',
        targetId: adminId,
        targetType: 'admin',
        action: 'password_changed',
        description: 'Admin password changed',
        severity: 'high'
    });
    
    return true;
}

/**
 * Get admin by ID
 */
export async function getAdminById(adminId) {
    await connectMongoDB();
    
    const admin = await Admin.findById(adminId);
    return admin ? admin.toSafeObject() : null;
}

/**
 * Get all admins
 */
export async function getAllAdmins() {
    await connectMongoDB();
    
    const admins = await Admin.findActive();
    return admins.map(admin => admin.toSafeObject());
}

/**
 * Update admin
 */
export async function updateAdmin(adminId, updates, performedBy) {
    await connectMongoDB();
    
    const admin = await Admin.findById(adminId);
    if (!admin) {
        throw new Error('Admin not found');
    }
    
    const allowedUpdates = ['name', 'role', 'isActive', 'permissions'];
    const filteredUpdates = {};
    
    for (const key of allowedUpdates) {
        if (updates[key] !== undefined) {
            filteredUpdates[key] = updates[key];
        }
    }
    
    // If role changed, update permissions
    if (filteredUpdates.role && !filteredUpdates.permissions) {
        filteredUpdates.permissions = ROLE_PERMISSIONS[filteredUpdates.role] || [];
    }
    
    Object.assign(admin, filteredUpdates);
    admin.updatedBy = performedBy;
    await admin.save();
    
    await AuditLog.logEvent({
        eventType: 'admin.updated',
        actorId: performedBy,
        actorType: 'admin',
        targetId: adminId,
        targetType: 'admin',
        targetEmail: admin.email,
        action: 'update',
        description: `Admin ${admin.email} updated`,
        changedFields: Object.keys(filteredUpdates),
        severity: 'medium'
    });
    
    return admin.toSafeObject();
}

/**
 * Delete admin
 */
export async function deleteAdmin(adminId, performedBy) {
    await connectMongoDB();
    
    const admin = await Admin.findById(adminId);
    if (!admin) {
        throw new Error('Admin not found');
    }
    
    const adminEmail = admin.email;
    
    // Revoke all tokens
    await AdminToken.revokeAllForAdmin(adminId, null, 'admin_deleted');
    
    // Delete admin
    await Admin.deleteOne({ _id: adminId });
    
    await AuditLog.logEvent({
        eventType: 'admin.deleted',
        actorId: performedBy,
        actorType: 'admin',
        targetId: adminId,
        targetType: 'admin',
        targetEmail: adminEmail,
        action: 'delete',
        description: `Admin ${adminEmail} deleted`,
        severity: 'critical'
    });
    
    return true;
}

/**
 * Check if admin has permission
 */
export function checkPermission(admin, permission) {
    if (!admin || !admin.role) return false;
    if (admin.role === 'super_admin') return true;
    return admin.permissions?.includes(permission) || false;
}

/**
 * Log failed login attempt
 */
async function logFailedLogin(email, ipAddress, reason) {
    await AuditLog.logEvent({
        eventType: 'auth.failed_login',
        actorEmail: email,
        actorIp: ipAddress,
        actorType: 'admin',
        action: 'failed_login',
        description: `Failed admin login attempt for ${email}: ${reason}`,
        status: 'failure',
        errorMessage: reason,
        severity: 'medium'
    });
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

// Export permissions for use elsewhere
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

export default {
    createAdmin,
    adminLogin,
    verifyAccessToken,
    refreshAccessToken,
    adminLogout,
    verifyMfaCode,
    setupMfa,
    enableMfa,
    changePassword,
    getAdminById,
    getAllAdmins,
    updateAdmin,
    deleteAdmin,
    checkPermission,
    PERMISSIONS
};
