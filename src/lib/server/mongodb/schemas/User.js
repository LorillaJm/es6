// src/lib/server/mongodb/schemas/User.js
// User Schema - MongoDB Atlas (PRIMARY)
// ✅ All user data stored in MongoDB
// ❌ Firebase only stores transient realtime status

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    // Firebase UID for auth linking
    firebaseUid: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
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
    displayName: String,
    profilePhoto: String,
    phone: String,
    
    // Organization
    orgId: {
        type: String,
        index: true
    },
    department: {
        type: String,
        index: true
    },
    position: String,
    employeeId: {
        type: String,
        sparse: true,
        index: true
    },
    
    // Role & Permissions
    role: {
        type: String,
        enum: ['user', 'admin', 'superadmin', 'manager', 'student', 'teacher', 'staff'],
        default: 'user',
        index: true
    },
    permissions: [{
        type: String
    }],
    
    // Status
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'pending'],
        default: 'active',
        index: true
    },
    
    // Email Verification
    emailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationCode: String,
    emailVerificationExpiry: Date,
    
    // Security
    lastLogin: Date,
    lastLoginIp: String,
    loginCount: {
        type: Number,
        default: 0
    },
    failedLoginAttempts: {
        type: Number,
        default: 0
    },
    lockedUntil: Date,
    
    // Face Recognition
    faceEnrollmentData: {
        enrolled: { type: Boolean, default: false },
        enrolledAt: Date,
        faceId: String,
        provider: String
    },
    
    // Device Info
    devices: [{
        deviceId: String,
        deviceName: String,
        platform: String,
        lastUsed: Date,
        fcmToken: String
    }],
    
    // Preferences
    preferences: {
        notifications: { type: Boolean, default: true },
        emailNotifications: { type: Boolean, default: true },
        theme: { type: String, default: 'system' },
        language: { type: String, default: 'en' }
    },
    
    // Schedule
    schedule: {
        workDays: {
            type: [Number],
            default: [1, 2, 3, 4, 5] // Mon-Fri
        },
        startTime: { type: String, default: '08:00' },
        endTime: { type: String, default: '17:00' },
        timezone: { type: String, default: 'Asia/Manila' }
    },
    
    // Metadata
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    createdBy: String,
    updatedBy: String
}, {
    timestamps: true,
    collection: 'users'
});

// Compound indexes for common queries
userSchema.index({ orgId: 1, department: 1 });
userSchema.index({ orgId: 1, role: 1 });
userSchema.index({ orgId: 1, status: 1 });
userSchema.index({ email: 1, status: 1 });

// Pre-save middleware - timestamps:true handles updatedAt automatically
// Remove next() as it's not needed with async/await style

// Virtual for full name
userSchema.virtual('fullName').get(function() {
    return this.displayName || this.name;
});

// Instance methods
userSchema.methods.isAdmin = function() {
    return ['admin', 'superadmin'].includes(this.role);
};

userSchema.methods.canManageUsers = function() {
    return ['admin', 'superadmin', 'manager'].includes(this.role);
};

userSchema.methods.toPublicJSON = function() {
    return {
        id: this._id,
        firebaseUid: this.firebaseUid,
        email: this.email,
        name: this.name,
        displayName: this.displayName,
        profilePhoto: this.profilePhoto,
        department: this.department,
        position: this.position,
        role: this.role,
        status: this.status,
        emailVerified: this.emailVerified
    };
};

// Static methods
userSchema.statics.findByFirebaseUid = function(uid) {
    return this.findOne({ firebaseUid: uid });
};

userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findActiveByOrg = function(orgId) {
    return this.find({ orgId, status: 'active' });
};

// Clear cached model to pick up schema changes (fixes hot-reload issues)
if (mongoose.models.User) {
    delete mongoose.models.User;
}

export const User = mongoose.model('User', userSchema);
export default User;
