// src/lib/server/mongodb/schemas/Admin.js
// Admin Schema - MongoDB Atlas (PRIMARY)
// ✅ All admin data stored in MongoDB
// ✅ Compatible with existing admin data format
// ❌ Firebase NEVER stores admin credentials

import mongoose from 'mongoose';
import crypto from 'crypto';

// Permission object schema (for existing data format)
const permissionObjectSchema = new mongoose.Schema({
    manageUsers: { type: Boolean, default: false },
    manageAttendance: { type: Boolean, default: false },
    viewReports: { type: Boolean, default: false },
    manageSettings: { type: Boolean, default: false },
    manageAdmins: { type: Boolean, default: false },
    viewAuditLogs: { type: Boolean, default: false },
    exportData: { type: Boolean, default: false },
    manageAnnouncements: { type: Boolean, default: false },
    impersonateUsers: { type: Boolean, default: false },
    manageBackups: { type: Boolean, default: false }
}, { _id: false });

const adminSchema = new mongoose.Schema({
    // Basic Info
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    
    // Authentication - NOT required for existing data compatibility
    passwordHash: {
        type: String,
        required: false  // Changed: existing admins may not have this
    },
    passwordSalt: {
        type: String,
        required: false  // Changed: existing admins may not have this
    },
    
    // Role & Permissions
    role: {
        type: String,
        enum: ['super_admin', 'admin', 'moderator'],
        default: 'admin',
        index: true
    },
    
    // Permissions - supports both array of objects (existing) and array of strings (new)
    permissions: {
        type: mongoose.Schema.Types.Mixed,  // Flexible type for compatibility
        default: []
    },
    
    // Status
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    
    // Email Verification
    emailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: String,
    emailVerificationExpiry: Date,
    
    // MFA
    mfaEnabled: {
        type: Boolean,
        default: false
    },
    mfaSecret: String,
    mfaBackupCodes: [String],
    
    // Security
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockedUntil: Date,
    lastLogin: Date,
    lastLoginIp: String,
    lastLoginUserAgent: String,
    
    // Password Reset
    passwordResetToken: String,
    passwordResetExpiry: Date,
    passwordChangedAt: Date,
    
    // Metadata
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    createdBy: String,
    updatedBy: String
}, {
    timestamps: true,
    collection: 'admins',
    strict: false  // Allow fields not in schema (for compatibility)
});

// Indexes
adminSchema.index({ email: 1, isActive: 1 });
adminSchema.index({ role: 1, isActive: 1 });

// Static: Hash password
adminSchema.statics.hashPassword = function(password, salt = null) {
    salt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return { hash, salt };
};

// Instance: Verify password
adminSchema.methods.verifyPassword = function(password) {
    // If no password hash stored, can't verify
    if (!this.passwordHash || !this.passwordSalt) {
        return false;
    }
    const { hash } = this.constructor.hashPassword(password, this.passwordSalt);
    return hash === this.passwordHash;
};

// Instance: Check if account is locked
adminSchema.methods.isLocked = function() {
    return this.lockedUntil && new Date(this.lockedUntil) > new Date();
};

// Instance: Increment login attempts (without saving to avoid validation errors)
adminSchema.methods.incrementLoginAttempts = async function(maxAttempts = 5) {
    const newAttempts = (this.loginAttempts || 0) + 1;
    
    const update = { loginAttempts: newAttempts };
    
    if (newAttempts >= maxAttempts) {
        update.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }
    
    // Use updateOne to avoid validation issues with existing data
    await this.constructor.updateOne({ _id: this._id }, { $set: update });
    this.loginAttempts = newAttempts;
    
    return newAttempts;
};

// Instance: Reset login attempts
adminSchema.methods.resetLoginAttempts = async function() {
    await this.constructor.updateOne(
        { _id: this._id }, 
        { $set: { loginAttempts: 0, lockedUntil: null } }
    );
    this.loginAttempts = 0;
    this.lockedUntil = null;
};

// Instance: Record successful login
adminSchema.methods.recordLogin = async function(ipAddress, userAgent) {
    await this.constructor.updateOne(
        { _id: this._id },
        { 
            $set: {
                lastLogin: new Date(),
                lastLoginIp: ipAddress,
                lastLoginUserAgent: userAgent,
                loginAttempts: 0,
                lockedUntil: null
            }
        }
    );
};

// Instance: Get safe admin object (no sensitive data)
adminSchema.methods.toSafeObject = function() {
    // Normalize permissions to a consistent format
    let normalizedPermissions = this.permissions;
    
    // If permissions is an array of objects, convert to permission flags
    if (Array.isArray(this.permissions) && this.permissions.length > 0) {
        const firstPerm = this.permissions[0];
        if (typeof firstPerm === 'object' && firstPerm !== null) {
            // It's the old format - extract true permissions
            normalizedPermissions = firstPerm;
        }
    }
    
    return {
        id: this._id.toString(),
        email: this.email,
        name: this.name,
        role: this.role,
        permissions: normalizedPermissions,
        isActive: this.isActive,
        emailVerified: this.emailVerified,
        mfaEnabled: this.mfaEnabled,
        lastLogin: this.lastLogin,
        createdAt: this.createdAt
    };
};

// Instance: Check permission (handles both old and new formats)
adminSchema.methods.hasPermission = function(permission) {
    // Super admin has all permissions
    if (this.role === 'super_admin') return true;
    
    // Handle array of strings format
    if (Array.isArray(this.permissions)) {
        // Check if it's old format (array of objects)
        if (this.permissions.length > 0 && typeof this.permissions[0] === 'object') {
            const permObj = this.permissions[0];
            // Map new permission names to old format
            const permMap = {
                'manage_users': 'manageUsers',
                'view_attendance': 'manageAttendance',
                'access_reports': 'viewReports',
                'manage_system_settings': 'manageSettings',
                'view_audit_logs': 'viewAuditLogs',
                'manage_announcements': 'manageAnnouncements',
                'manage_security': 'manageBackups'
            };
            const oldKey = permMap[permission] || permission;
            return permObj[oldKey] === true;
        }
        // New format - array of strings
        return this.permissions.includes(permission);
    }
    
    return false;
};

// Static: Find by email
adminSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

// Static: Find active admins
adminSchema.statics.findActive = function() {
    return this.find({ isActive: true });
};

// Static: Generate secure token
adminSchema.statics.generateToken = function(length = 32) {
    return crypto.randomBytes(length).toString('hex');
};

// Clear cached model
if (mongoose.models.Admin) {
    delete mongoose.models.Admin;
}

export const Admin = mongoose.model('Admin', adminSchema);
export default Admin;
