// src/lib/server/mongodb/services/userService.js
// User Service - MongoDB Atlas (PRIMARY)
// ✅ All user operations go through MongoDB
// ✅ Firebase only receives realtime presence updates

import { connectMongoDB } from '../connection.js';
import { User } from '../schemas/User.js';
import { AuditLog } from '../schemas/AuditLog.js';
import { emitUserPresence } from '../../realtimeEmitter.js';

/**
 * Create a new user
 */
export async function createUser(userData, createdBy = 'system') {
    await connectMongoDB();
    
    const user = new User({
        ...userData,
        createdBy,
        createdAt: new Date()
    });
    
    await user.save();
    
    // Log audit event
    await AuditLog.logEvent({
        eventType: 'user.created',
        actorId: createdBy,
        actorType: createdBy === 'system' ? 'system' : 'admin',
        targetId: user._id.toString(),
        targetType: 'user',
        targetEmail: user.email,
        action: 'create',
        description: `User ${user.email} created`,
        newData: user.toPublicJSON(),
        orgId: user.orgId
    });
    
    return user;
}

/**
 * Find user by Firebase UID
 */
export async function findUserByFirebaseUid(firebaseUid) {
    await connectMongoDB();
    return User.findByFirebaseUid(firebaseUid);
}

/**
 * Find user by email
 */
export async function findUserByEmail(email) {
    await connectMongoDB();
    return User.findByEmail(email);
}

/**
 * Find user by ID
 */
export async function findUserById(userId) {
    await connectMongoDB();
    return User.findById(userId);
}

/**
 * Update user profile
 */
export async function updateUser(firebaseUid, updates, updatedBy = 'system') {
    await connectMongoDB();
    
    const user = await User.findByFirebaseUid(firebaseUid);
    if (!user) {
        throw new Error('User not found');
    }
    
    const previousData = user.toPublicJSON();
    const changedFields = Object.keys(updates);
    
    Object.assign(user, updates, { updatedBy, updatedAt: new Date() });
    await user.save();
    
    // Log audit event
    await AuditLog.logEvent({
        eventType: 'user.updated',
        actorId: updatedBy,
        actorType: updatedBy === 'system' ? 'system' : 'user',
        targetId: user._id.toString(),
        targetType: 'user',
        targetEmail: user.email,
        action: 'update',
        description: `User ${user.email} updated`,
        previousData,
        newData: user.toPublicJSON(),
        changedFields,
        orgId: user.orgId
    });
    
    return user;
}

/**
 * Update user status
 */
export async function updateUserStatus(firebaseUid, status, updatedBy, reason = '') {
    await connectMongoDB();
    
    const user = await User.findByFirebaseUid(firebaseUid);
    if (!user) {
        throw new Error('User not found');
    }
    
    const previousStatus = user.status;
    user.status = status;
    user.updatedBy = updatedBy;
    await user.save();
    
    // Log audit event
    await AuditLog.logEvent({
        eventType: 'user.status_changed',
        actorId: updatedBy,
        actorType: 'admin',
        targetId: user._id.toString(),
        targetType: 'user',
        targetEmail: user.email,
        action: 'status_change',
        description: `User status changed from ${previousStatus} to ${status}`,
        previousData: { status: previousStatus },
        newData: { status },
        metadata: { reason },
        orgId: user.orgId,
        severity: status === 'suspended' ? 'high' : 'medium'
    });
    
    return user;
}

/**
 * Record user login
 */
export async function recordUserLogin(firebaseUid, loginData) {
    await connectMongoDB();
    
    const user = await User.findByFirebaseUid(firebaseUid);
    if (!user) {
        throw new Error('User not found');
    }
    
    user.lastLogin = new Date();
    user.lastLoginIp = loginData.ipAddress;
    user.loginCount = (user.loginCount || 0) + 1;
    user.failedLoginAttempts = 0;
    await user.save();
    
    // Emit presence to Firebase (realtime only)
    await emitUserPresence(firebaseUid, true);
    
    // Log audit event
    await AuditLog.logEvent({
        eventType: 'auth.login',
        actorId: firebaseUid,
        actorType: 'user',
        actorEmail: user.email,
        actorIp: loginData.ipAddress,
        actorUserAgent: loginData.userAgent,
        action: 'login',
        description: `User ${user.email} logged in`,
        orgId: user.orgId,
        status: 'success'
    });
    
    return user;
}

/**
 * Record failed login attempt
 */
export async function recordFailedLogin(email, ipAddress, reason) {
    await connectMongoDB();
    
    const user = await User.findByEmail(email);
    
    if (user) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        
        // Lock account after 5 failed attempts
        if (user.failedLoginAttempts >= 5) {
            user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        }
        
        await user.save();
    }
    
    // Log audit event
    await AuditLog.logEvent({
        eventType: 'auth.failed_login',
        actorEmail: email,
        actorIp: ipAddress,
        actorType: 'user',
        action: 'failed_login',
        description: `Failed login attempt for ${email}: ${reason}`,
        status: 'failure',
        errorMessage: reason,
        severity: 'medium'
    });
}

/**
 * Record user logout
 */
export async function recordUserLogout(firebaseUid) {
    await connectMongoDB();
    
    const user = await User.findByFirebaseUid(firebaseUid);
    if (!user) return;
    
    // Emit offline presence to Firebase
    await emitUserPresence(firebaseUid, false);
    
    // Log audit event
    await AuditLog.logEvent({
        eventType: 'auth.logout',
        actorId: firebaseUid,
        actorType: 'user',
        actorEmail: user.email,
        action: 'logout',
        description: `User ${user.email} logged out`,
        orgId: user.orgId
    });
}

/**
 * Get users by organization
 */
export async function getUsersByOrg(orgId, options = {}) {
    await connectMongoDB();
    
    const query = { orgId };
    
    if (options.status) {
        query.status = options.status;
    }
    
    if (options.department) {
        query.department = options.department;
    }
    
    if (options.role) {
        query.role = options.role;
    }
    
    let queryBuilder = User.find(query);
    
    if (options.sort) {
        queryBuilder = queryBuilder.sort(options.sort);
    }
    
    if (options.limit) {
        queryBuilder = queryBuilder.limit(options.limit);
    }
    
    if (options.skip) {
        queryBuilder = queryBuilder.skip(options.skip);
    }
    
    return queryBuilder.exec();
}

/**
 * Search users
 */
export async function searchUsers(orgId, searchTerm, options = {}) {
    await connectMongoDB();
    
    const query = {
        orgId,
        $or: [
            { name: { $regex: searchTerm, $options: 'i' } },
            { email: { $regex: searchTerm, $options: 'i' } },
            { employeeId: { $regex: searchTerm, $options: 'i' } }
        ]
    };
    
    if (options.status) {
        query.status = options.status;
    }
    
    return User.find(query)
        .limit(options.limit || 20)
        .exec();
}

/**
 * Delete user (soft delete by changing status)
 */
export async function deleteUser(firebaseUid, deletedBy, reason = '') {
    await connectMongoDB();
    
    const user = await User.findByFirebaseUid(firebaseUid);
    if (!user) {
        throw new Error('User not found');
    }
    
    const previousData = user.toPublicJSON();
    
    user.status = 'inactive';
    user.updatedBy = deletedBy;
    await user.save();
    
    // Log audit event
    await AuditLog.logEvent({
        eventType: 'user.deleted',
        actorId: deletedBy,
        actorType: 'admin',
        targetId: user._id.toString(),
        targetType: 'user',
        targetEmail: user.email,
        action: 'delete',
        description: `User ${user.email} deleted`,
        previousData,
        metadata: { reason },
        orgId: user.orgId,
        severity: 'high'
    });
    
    return user;
}

/**
 * Get or create user (for OAuth flows)
 */
export async function getOrCreateUser(firebaseUid, userData) {
    await connectMongoDB();
    
    let user = await User.findByFirebaseUid(firebaseUid);
    
    if (!user) {
        user = await createUser({
            firebaseUid,
            ...userData
        });
    }
    
    return user;
}

export default {
    createUser,
    findUserByFirebaseUid,
    findUserByEmail,
    findUserById,
    updateUser,
    updateUserStatus,
    recordUserLogin,
    recordFailedLogin,
    recordUserLogout,
    getUsersByOrg,
    searchUsers,
    deleteUser,
    getOrCreateUser
};
