// scripts/firebase-to-mongodb-migration.js
// ============================================
// FIREBASE TO MONGODB ATLAS MIGRATION SCRIPT
// ============================================
// Purpose: One-time migration of all Firebase Realtime Database data to MongoDB Atlas
// Rules:
//   - Firebase is READ-ONLY (no writes during migration)
//   - MongoDB becomes the SINGLE SOURCE OF TRUTH
//   - No data duplication
//   - Full verification logging
//   - Disable Firebase historical paths after success
//
// Run: node scripts/firebase-to-mongodb-migration.js
// ============================================

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    MONGODB_URI: process.env.MONGODB_URI,
    FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT,
    FIREBASE_DATABASE_URL: process.env.PUBLIC_FIREBASE_DATABASE_URL,
    LOG_DIR: path.join(__dirname, '../logs/migration'),
    DRY_RUN: process.argv.includes('--dry-run'),
    VERBOSE: process.argv.includes('--verbose'),
    BATCH_SIZE: 100
};

// ============================================
// VERIFICATION LOG
// ============================================

class MigrationLogger {
    constructor() {
        this.startTime = new Date();
        this.logs = [];
        this.stats = {
            users: { read: 0, migrated: 0, skipped: 0, errors: 0 },
            attendance: { read: 0, migrated: 0, skipped: 0, errors: 0 },
            admins: { read: 0, migrated: 0, skipped: 0, errors: 0 },
            announcements: { read: 0, migrated: 0, skipped: 0, errors: 0 },
            settings: { read: 0, migrated: 0, skipped: 0, errors: 0 },
            gamification: { read: 0, migrated: 0, skipped: 0, errors: 0 }
        };
        this.errors = [];
        this.warnings = [];
    }

    log(level, category, message, data = null) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            category,
            message,
            data
        };
        this.logs.push(entry);
        
        const prefix = {
            INFO: '📋',
            SUCCESS: '✅',
            WARNING: '⚠️',
            ERROR: '❌',
            DEBUG: '🔍'
        }[level] || '•';
        
        if (level !== 'DEBUG' || CONFIG.VERBOSE) {
            console.log(`${prefix} [${category}] ${message}`);
        }
        
        if (level === 'ERROR') this.errors.push(entry);
        if (level === 'WARNING') this.warnings.push(entry);
    }

    incrementStat(collection, type) {
        if (this.stats[collection]) {
            this.stats[collection][type]++;
        }
    }

    async saveReport() {
        const endTime = new Date();
        const duration = (endTime - this.startTime) / 1000;
        
        const report = {
            migrationId: `migration_${this.startTime.toISOString().replace(/[:.]/g, '-')}`,
            startTime: this.startTime.toISOString(),
            endTime: endTime.toISOString(),
            durationSeconds: duration,
            dryRun: CONFIG.DRY_RUN,
            stats: this.stats,
            totalErrors: this.errors.length,
            totalWarnings: this.warnings.length,
            errors: this.errors,
            warnings: this.warnings,
            logs: this.logs
        };
        
        // Ensure log directory exists
        if (!fs.existsSync(CONFIG.LOG_DIR)) {
            fs.mkdirSync(CONFIG.LOG_DIR, { recursive: true });
        }
        
        const reportPath = path.join(CONFIG.LOG_DIR, `${report.migrationId}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        return { report, reportPath };
    }
}

// ============================================
// MONGODB SCHEMAS (Inline for standalone script)
// ============================================

const userSchema = new mongoose.Schema({
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    name: { type: String, required: true },
    displayName: String,
    profilePhoto: String,
    phone: String,
    orgId: { type: String, index: true },
    department: { type: String, index: true },
    position: String,
    employeeId: { type: String, sparse: true, index: true },
    role: { type: String, enum: ['user', 'admin', 'superadmin', 'manager', 'student', 'teacher', 'staff'], default: 'user', index: true },
    permissions: [String],
    status: { type: String, enum: ['active', 'inactive', 'suspended', 'pending'], default: 'active', index: true },
    emailVerified: { type: Boolean, default: false },
    emailVerificationCode: String,
    emailVerificationExpiry: Date,
    lastLogin: Date,
    lastLoginIp: String,
    loginCount: { type: Number, default: 0 },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
    faceEnrollmentData: {
        enrolled: { type: Boolean, default: false },
        enrolledAt: Date,
        faceId: String,
        provider: String
    },
    devices: [{
        deviceId: String,
        deviceName: String,
        platform: String,
        lastUsed: Date,
        fcmToken: String
    }],
    preferences: {
        notifications: { type: Boolean, default: true },
        emailNotifications: { type: Boolean, default: true },
        theme: { type: String, default: 'system' },
        language: { type: String, default: 'en' }
    },
    schedule: {
        workDays: { type: [Number], default: [1, 2, 3, 4, 5] },
        startTime: { type: String, default: '08:00' },
        endTime: { type: String, default: '17:00' },
        timezone: { type: String, default: 'Asia/Manila' }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    createdBy: String,
    updatedBy: String,
    _migratedFromFirebase: { type: Boolean, default: true },
    _migrationTimestamp: Date
}, { timestamps: true, collection: 'users' });

const attendanceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    firebaseUid: { type: String, required: true, index: true },
    orgId: { type: String, required: true, index: true },
    department: { type: String, index: true },
    date: { type: Date, required: true, index: true },
    dateString: { type: String, required: true, index: true },
    shiftNumber: { type: Number, default: 1 },
    checkIn: {
        timestamp: Date,
        location: {
            latitude: Number,
            longitude: Number,
            accuracy: Number,
            address: String,
            withinGeofence: Boolean
        },
        deviceId: String,
        method: { type: String, enum: ['qr', 'face', 'manual', 'auto', 'api'], default: 'manual' },
        ipAddress: String,
        photo: String
    },
    checkOut: {
        timestamp: Date,
        location: {
            latitude: Number,
            longitude: Number,
            accuracy: Number,
            address: String,
            withinGeofence: Boolean
        },
        deviceId: String,
        method: { type: String, enum: ['qr', 'face', 'manual', 'auto', 'api'], default: 'manual' },
        ipAddress: String,
        photo: String
    },
    breaks: [{
        startTime: Date,
        endTime: Date,
        duration: Number,
        type: { type: String, enum: ['lunch', 'short', 'other'] }
    }],
    currentStatus: { type: String, enum: ['checkedIn', 'onBreak', 'checkedOut', 'absent', 'leave', 'holiday'], default: 'checkedIn', index: true },
    scheduledStart: Date,
    scheduledEnd: Date,
    actualWorkMinutes: Number,
    breakMinutes: Number,
    overtimeMinutes: Number,
    isLate: { type: Boolean, default: false, index: true },
    lateMinutes: Number,
    isEarlyOut: { type: Boolean, default: false },
    earlyOutMinutes: Number,
    isManualEntry: { type: Boolean, default: false },
    isEdited: { type: Boolean, default: false },
    notes: String,
    adminNotes: String,
    verificationStatus: { type: String, enum: ['pending', 'verified', 'flagged', 'rejected'], default: 'verified' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    _firebaseRecordId: String,
    _migratedFromFirebase: { type: Boolean, default: true },
    _migrationTimestamp: Date
}, { timestamps: true, collection: 'attendance' });

attendanceSchema.index({ firebaseUid: 1, dateString: 1 }, { unique: true, sparse: true });

const adminSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', sparse: true, index: true },
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    name: String,
    adminLevel: { type: String, enum: ['admin', 'superadmin', 'orgAdmin'], default: 'admin' },
    orgId: { type: String, index: true },
    managedDepartments: [String],
    permissions: {
        manageUsers: { type: Boolean, default: true },
        manageAttendance: { type: Boolean, default: true },
        viewReports: { type: Boolean, default: true },
        manageSettings: { type: Boolean, default: false },
        manageAdmins: { type: Boolean, default: false },
        viewAuditLogs: { type: Boolean, default: true },
        exportData: { type: Boolean, default: true },
        manageAnnouncements: { type: Boolean, default: true },
        impersonateUsers: { type: Boolean, default: false },
        manageBackups: { type: Boolean, default: false }
    },
    twoFactorEnabled: { type: Boolean, default: false },
    allowedIPs: [String],
    ipRestrictionEnabled: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active', index: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    _migratedFromFirebase: { type: Boolean, default: true },
    _migrationTimestamp: Date
}, { timestamps: true, collection: 'admins' });

const announcementSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    summary: String,
    type: { type: String, enum: ['general', 'urgent', 'policy', 'event', 'maintenance', 'holiday'], default: 'general', index: true },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal', index: true },
    orgId: { type: String, required: true, index: true },
    targetAudience: { type: String, enum: ['all', 'admins', 'users', 'department'], default: 'all' },
    targetDepartments: [String],
    authorId: { type: String, required: true },
    authorName: String,
    authorEmail: String,
    publishAt: { type: Date, default: Date.now },
    expiresAt: Date,
    status: { type: String, enum: ['draft', 'published', 'scheduled', 'archived'], default: 'published', index: true },
    viewCount: { type: Number, default: 0 },
    isPinned: { type: Boolean, default: false },
    sendPushNotification: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    _firebaseKey: String,
    _migratedFromFirebase: { type: Boolean, default: true },
    _migrationTimestamp: Date
}, { timestamps: true, collection: 'announcements' });

const gamificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', sparse: true, index: true },
    firebaseUid: { type: String, required: true, unique: true, index: true },
    orgId: { type: String, required: true, index: true },
    department: String,
    totalPoints: { type: Number, default: 0, index: true },
    monthlyPoints: { type: Number, default: 0 },
    weeklyPoints: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    levelName: { type: String, default: 'Newcomer' },
    experiencePoints: { type: Number, default: 0 },
    nextLevelXP: { type: Number, default: 100 },
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastCheckInDate: Date,
    onTimeCount: { type: Number, default: 0 },
    lateCount: { type: Number, default: 0 },
    punctualityRate: { type: Number, default: 100 },
    totalCheckIns: { type: Number, default: 0 },
    badges: [{
        badgeId: String,
        name: String,
        description: String,
        icon: String,
        earnedAt: Date,
        category: String
    }],
    achievements: [{
        achievementId: String,
        name: String,
        description: String,
        progress: Number,
        target: Number,
        completedAt: Date,
        rewardPoints: Number
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    _migratedFromFirebase: { type: Boolean, default: true },
    _migrationTimestamp: Date
}, { timestamps: true, collection: 'gamification' });

const auditLogSchema = new mongoose.Schema({
    eventType: { type: String, required: true, index: true },
    actorId: { type: String, index: true },
    actorType: { type: String, enum: ['user', 'admin', 'system', 'api', 'migration'], default: 'system' },
    actorEmail: String,
    actorName: String,
    targetId: String,
    targetType: String,
    orgId: { type: String, index: true },
    action: { type: String, required: true },
    description: String,
    previousData: mongoose.Schema.Types.Mixed,
    newData: mongoose.Schema.Types.Mixed,
    status: { type: String, enum: ['success', 'failure', 'warning'], default: 'success' },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low', index: true },
    metadata: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now, index: true }
}, { timestamps: false, collection: 'audit_logs' });

const settingsSchema = new mongoose.Schema({
    orgId: { type: String, required: true, unique: true, index: true },
    settingType: { type: String, required: true },
    settings: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    _migratedFromFirebase: { type: Boolean, default: true },
    _migrationTimestamp: Date
}, { timestamps: true, collection: 'settings' });

// ============================================
// MODELS
// ============================================

let User, Attendance, Admin, Announcement, Gamification, AuditLog, Settings;

function initModels() {
    // Clear any existing models to avoid OverwriteModelError
    if (mongoose.models.User) delete mongoose.models.User;
    if (mongoose.models.Attendance) delete mongoose.models.Attendance;
    if (mongoose.models.Admin) delete mongoose.models.Admin;
    if (mongoose.models.Announcement) delete mongoose.models.Announcement;
    if (mongoose.models.Gamification) delete mongoose.models.Gamification;
    if (mongoose.models.AuditLog) delete mongoose.models.AuditLog;
    if (mongoose.models.Settings) delete mongoose.models.Settings;

    User = mongoose.model('User', userSchema);
    Attendance = mongoose.model('Attendance', attendanceSchema);
    Admin = mongoose.model('Admin', adminSchema);
    Announcement = mongoose.model('Announcement', announcementSchema);
    Gamification = mongoose.model('Gamification', gamificationSchema);
    AuditLog = mongoose.model('AuditLog', auditLogSchema);
    Settings = mongoose.model('Settings', settingsSchema);
}

// ============================================
// DATA MAPPING FUNCTIONS
// ============================================

/**
 * Maps Firebase user data to MongoDB User schema
 */
function mapFirebaseUserToMongo(firebaseUid, firebaseData) {
    return {
        firebaseUid,
        email: firebaseData.email?.toLowerCase() || `${firebaseUid}@migrated.local`,
        name: firebaseData.name || firebaseData.displayName || 'Unknown User',
        displayName: firebaseData.displayName || firebaseData.name,
        profilePhoto: firebaseData.profilePhoto || firebaseData.photoURL,
        phone: firebaseData.phone || firebaseData.phoneNumber,
        orgId: firebaseData.orgId || firebaseData.organizationId || 'default',
        department: firebaseData.department,
        position: firebaseData.position || firebaseData.jobTitle,
        employeeId: firebaseData.employeeId || firebaseData.empId,
        role: mapRole(firebaseData.role),
        permissions: firebaseData.permissions || [],
        status: mapStatus(firebaseData.status),
        emailVerified: firebaseData.emailVerified || false,
        lastLogin: firebaseData.lastLogin ? new Date(firebaseData.lastLogin) : null,
        lastLoginIp: firebaseData.lastLoginIp,
        loginCount: firebaseData.loginCount || 0,
        faceEnrollmentData: firebaseData.faceEnrollmentData || { enrolled: false },
        devices: mapDevices(firebaseData.devices || firebaseData.fcmTokens),
        preferences: {
            notifications: firebaseData.preferences?.notifications ?? true,
            emailNotifications: firebaseData.preferences?.emailNotifications ?? true,
            theme: firebaseData.preferences?.theme || 'system',
            language: firebaseData.preferences?.language || 'en'
        },
        schedule: {
            workDays: firebaseData.schedule?.workDays || [1, 2, 3, 4, 5],
            startTime: firebaseData.schedule?.startTime || '08:00',
            endTime: firebaseData.schedule?.endTime || '17:00',
            timezone: firebaseData.schedule?.timezone || 'Asia/Manila'
        },
        createdAt: firebaseData.createdAt ? new Date(firebaseData.createdAt) : new Date(),
        updatedAt: firebaseData.updatedAt ? new Date(firebaseData.updatedAt) : new Date(),
        _migratedFromFirebase: true,
        _migrationTimestamp: new Date()
    };
}

/**
 * Maps Firebase attendance record to MongoDB Attendance schema
 */
function mapFirebaseAttendanceToMongo(firebaseUid, recordId, firebaseData, mongoUserId, userOrgId, userDepartment) {
    const date = parseDate(firebaseData.date || firebaseData.checkIn?.timestamp);
    const dateString = date.toISOString().split('T')[0];
    
    return {
        userId: mongoUserId,
        firebaseUid,
        orgId: firebaseData.orgId || userOrgId || 'default',
        department: firebaseData.department || userDepartment,
        date,
        dateString,
        shiftNumber: firebaseData.shiftNumber || 1,
        checkIn: firebaseData.checkIn ? {
            timestamp: new Date(firebaseData.checkIn.timestamp),
            location: firebaseData.checkIn.location,
            deviceId: firebaseData.checkIn.deviceId,
            method: firebaseData.checkIn.method || 'manual',
            ipAddress: firebaseData.checkIn.ipAddress,
            photo: firebaseData.checkIn.photo
        } : undefined,
        checkOut: firebaseData.checkOut ? {
            timestamp: new Date(firebaseData.checkOut.timestamp),
            location: firebaseData.checkOut.location,
            deviceId: firebaseData.checkOut.deviceId,
            method: firebaseData.checkOut.method || 'manual',
            ipAddress: firebaseData.checkOut.ipAddress,
            photo: firebaseData.checkOut.photo
        } : undefined,
        breaks: firebaseData.breaks || [],
        currentStatus: firebaseData.currentStatus || (firebaseData.checkOut ? 'checkedOut' : 'checkedIn'),
        actualWorkMinutes: firebaseData.actualWorkMinutes || calculateWorkMinutes(firebaseData),
        breakMinutes: firebaseData.breakMinutes || 0,
        isLate: firebaseData.isLate || false,
        lateMinutes: firebaseData.lateMinutes || 0,
        isEarlyOut: firebaseData.isEarlyOut || false,
        isManualEntry: firebaseData.isManualEntry || false,
        notes: firebaseData.notes,
        verificationStatus: firebaseData.verificationStatus || 'verified',
        createdAt: firebaseData.createdAt ? new Date(firebaseData.createdAt) : date,
        _firebaseRecordId: recordId,
        _migratedFromFirebase: true,
        _migrationTimestamp: new Date()
    };
}

/**
 * Maps Firebase admin data to MongoDB Admin schema
 */
function mapFirebaseAdminToMongo(firebaseUid, firebaseData, mongoUserId) {
    return {
        userId: mongoUserId,
        firebaseUid,
        email: firebaseData.email?.toLowerCase(),
        name: firebaseData.name || firebaseData.displayName,
        adminLevel: mapAdminLevel(firebaseData.adminLevel || firebaseData.role),
        orgId: firebaseData.orgId || 'default',
        managedDepartments: firebaseData.managedDepartments || [],
        permissions: {
            manageUsers: firebaseData.permissions?.manageUsers ?? true,
            manageAttendance: firebaseData.permissions?.manageAttendance ?? true,
            viewReports: firebaseData.permissions?.viewReports ?? true,
            manageSettings: firebaseData.permissions?.manageSettings ?? false,
            manageAdmins: firebaseData.permissions?.manageAdmins ?? false,
            viewAuditLogs: firebaseData.permissions?.viewAuditLogs ?? true,
            exportData: firebaseData.permissions?.exportData ?? true,
            manageAnnouncements: firebaseData.permissions?.manageAnnouncements ?? true,
            impersonateUsers: firebaseData.permissions?.impersonateUsers ?? false,
            manageBackups: firebaseData.permissions?.manageBackups ?? false
        },
        status: firebaseData.status || 'active',
        createdAt: firebaseData.createdAt ? new Date(firebaseData.createdAt) : new Date(),
        _migratedFromFirebase: true,
        _migrationTimestamp: new Date()
    };
}

/**
 * Maps Firebase announcement to MongoDB Announcement schema
 */
function mapFirebaseAnnouncementToMongo(firebaseKey, firebaseData) {
    return {
        title: firebaseData.title || 'Untitled Announcement',
        content: firebaseData.content || firebaseData.message || '',
        summary: firebaseData.summary || (firebaseData.content || '').substring(0, 100),
        type: mapAnnouncementType(firebaseData.type),
        priority: mapPriority(firebaseData.priority),
        orgId: firebaseData.orgId || 'default',
        targetAudience: firebaseData.targetAudience || 'all',
        targetDepartments: firebaseData.targetDepartments || [],
        authorId: firebaseData.authorId || firebaseData.createdBy || 'system',
        authorName: firebaseData.authorName,
        authorEmail: firebaseData.authorEmail,
        publishAt: firebaseData.publishAt ? new Date(firebaseData.publishAt) : new Date(firebaseData.createdAt || Date.now()),
        expiresAt: firebaseData.expiresAt ? new Date(firebaseData.expiresAt) : null,
        status: firebaseData.status || 'published',
        viewCount: firebaseData.viewCount || 0,
        isPinned: firebaseData.isPinned || false,
        sendPushNotification: firebaseData.sendPushNotification || false,
        createdAt: firebaseData.createdAt ? new Date(firebaseData.createdAt) : new Date(),
        _firebaseKey: firebaseKey,
        _migratedFromFirebase: true,
        _migrationTimestamp: new Date()
    };
}

/**
 * Maps Firebase gamification data to MongoDB Gamification schema
 */
function mapFirebaseGamificationToMongo(firebaseUid, firebaseData, mongoUserId, userOrgId, userDepartment) {
    return {
        userId: mongoUserId,
        firebaseUid,
        orgId: firebaseData.orgId || userOrgId || 'default',
        department: firebaseData.department || userDepartment,
        totalPoints: firebaseData.totalPoints || firebaseData.points || 0,
        monthlyPoints: firebaseData.monthlyPoints || 0,
        weeklyPoints: firebaseData.weeklyPoints || 0,
        level: firebaseData.level || 1,
        levelName: firebaseData.levelName || 'Newcomer',
        experiencePoints: firebaseData.experiencePoints || firebaseData.xp || 0,
        nextLevelXP: firebaseData.nextLevelXP || 100,
        currentStreak: firebaseData.currentStreak || firebaseData.streak || 0,
        longestStreak: firebaseData.longestStreak || firebaseData.currentStreak || 0,
        lastCheckInDate: firebaseData.lastCheckInDate ? new Date(firebaseData.lastCheckInDate) : null,
        onTimeCount: firebaseData.onTimeCount || 0,
        lateCount: firebaseData.lateCount || 0,
        punctualityRate: firebaseData.punctualityRate || 100,
        totalCheckIns: firebaseData.totalCheckIns || 0,
        badges: (firebaseData.badges || []).map(b => {
            // Handle both string IDs (Firebase format) and objects
            if (typeof b === 'string') {
                return {
                    badgeId: b,
                    name: b.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    description: '',
                    icon: '🏅',
                    earnedAt: new Date(),
                    category: 'milestone'
                };
            }
            return {
                badgeId: b.badgeId || b.id || 'unknown',
                name: b.name,
                description: b.description,
                icon: b.icon,
                earnedAt: b.earnedAt ? new Date(b.earnedAt) : new Date(),
                category: b.category
            };
        }),
        achievements: firebaseData.achievements || [],
        createdAt: firebaseData.createdAt ? new Date(firebaseData.createdAt) : new Date(),
        _migratedFromFirebase: true,
        _migrationTimestamp: new Date()
    };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function mapRole(role) {
    const validRoles = ['user', 'admin', 'superadmin', 'manager', 'student', 'teacher', 'staff'];
    if (validRoles.includes(role)) return role;
    if (role === 'super_admin' || role === 'super-admin') return 'superadmin';
    return 'user';
}

function mapStatus(status) {
    const validStatuses = ['active', 'inactive', 'suspended', 'pending'];
    if (validStatuses.includes(status)) return status;
    if (status === 'disabled' || status === 'blocked') return 'suspended';
    return 'active';
}

function mapAdminLevel(level) {
    if (level === 'superadmin' || level === 'super_admin') return 'superadmin';
    if (level === 'orgAdmin' || level === 'org_admin') return 'orgAdmin';
    return 'admin';
}

function mapAnnouncementType(type) {
    const validTypes = ['general', 'urgent', 'policy', 'event', 'maintenance', 'holiday'];
    if (validTypes.includes(type)) return type;
    return 'general';
}

function mapPriority(priority) {
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    if (validPriorities.includes(priority)) return priority;
    if (priority === 'critical') return 'urgent';
    return 'normal';
}

function mapDevices(devicesOrTokens) {
    if (!devicesOrTokens) return [];
    
    if (Array.isArray(devicesOrTokens)) {
        return devicesOrTokens.map(d => ({
            deviceId: d.deviceId || d.id,
            deviceName: d.deviceName || d.name,
            platform: d.platform,
            lastUsed: d.lastUsed ? new Date(d.lastUsed) : null,
            fcmToken: d.fcmToken || d.token
        }));
    }
    
    // Handle object format (Firebase fcmTokens)
    return Object.entries(devicesOrTokens).map(([key, value]) => ({
        deviceId: key,
        deviceName: value.deviceName || 'Unknown Device',
        platform: value.platform,
        lastUsed: value.lastUsed ? new Date(value.lastUsed) : null,
        fcmToken: value.token || value.fcmToken
    }));
}

function parseDate(dateValue) {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue === 'number') return new Date(dateValue);
    if (typeof dateValue === 'string') return new Date(dateValue);
    return new Date();
}

function calculateWorkMinutes(record) {
    if (!record.checkIn?.timestamp) return 0;
    const checkIn = new Date(record.checkIn.timestamp);
    const checkOut = record.checkOut?.timestamp ? new Date(record.checkOut.timestamp) : new Date();
    return Math.round((checkOut - checkIn) / 60000);
}

// ============================================
// MIGRATION FUNCTIONS
// ============================================

async function migrateUsers(adminDb, logger) {
    logger.log('INFO', 'USERS', 'Starting user migration...');
    
    const snapshot = await adminDb.ref('users').once('value');
    const usersData = snapshot.val() || {};
    const userEntries = Object.entries(usersData);
    
    logger.log('INFO', 'USERS', `Found ${userEntries.length} users in Firebase`);
    
    const userMap = new Map(); // firebaseUid -> mongoUser
    
    for (const [firebaseUid, userData] of userEntries) {
        logger.incrementStat('users', 'read');
        
        try {
            // Check if already exists in MongoDB
            const existing = await User.findOne({ firebaseUid });
            
            if (existing) {
                logger.log('DEBUG', 'USERS', `User ${firebaseUid} already exists, skipping`);
                logger.incrementStat('users', 'skipped');
                userMap.set(firebaseUid, existing);
                continue;
            }
            
            // Check for email conflict
            const emailConflict = await User.findOne({ email: userData.email?.toLowerCase() });
            if (emailConflict) {
                logger.log('WARNING', 'USERS', `Email conflict for ${userData.email}, using modified email`);
                userData.email = `${firebaseUid}_${userData.email}`;
            }
            
            const mappedData = mapFirebaseUserToMongo(firebaseUid, userData);
            
            if (CONFIG.DRY_RUN) {
                logger.log('DEBUG', 'USERS', `[DRY RUN] Would create user: ${mappedData.email}`);
                logger.incrementStat('users', 'migrated');
                continue;
            }
            
            const user = new User(mappedData);
            await user.save();
            userMap.set(firebaseUid, user);
            
            logger.log('SUCCESS', 'USERS', `Migrated user: ${user.email}`);
            logger.incrementStat('users', 'migrated');
            
        } catch (error) {
            logger.log('ERROR', 'USERS', `Failed to migrate user ${firebaseUid}: ${error.message}`, { firebaseUid, error: error.message });
            logger.incrementStat('users', 'errors');
        }
    }
    
    return userMap;
}

async function migrateAttendance(adminDb, logger, userMap) {
    logger.log('INFO', 'ATTENDANCE', 'Starting attendance migration...');
    
    const snapshot = await adminDb.ref('attendance').once('value');
    const attendanceData = snapshot.val() || {};
    
    let totalRecords = 0;
    for (const userAttendance of Object.values(attendanceData)) {
        totalRecords += Object.keys(userAttendance || {}).length;
    }
    
    logger.log('INFO', 'ATTENDANCE', `Found ${totalRecords} attendance records in Firebase`);
    
    for (const [firebaseUid, userAttendance] of Object.entries(attendanceData)) {
        const mongoUser = userMap.get(firebaseUid) || await User.findOne({ firebaseUid });
        
        if (!mongoUser) {
            logger.log('WARNING', 'ATTENDANCE', `No user found for attendance records: ${firebaseUid}`);
            continue;
        }
        
        for (const [recordId, record] of Object.entries(userAttendance || {})) {
            logger.incrementStat('attendance', 'read');
            
            try {
                const mappedData = mapFirebaseAttendanceToMongo(
                    firebaseUid, recordId, record,
                    mongoUser._id, mongoUser.orgId, mongoUser.department
                );
                
                // Check for duplicate
                const existing = await Attendance.findOne({
                    firebaseUid,
                    dateString: mappedData.dateString
                });
                
                if (existing) {
                    logger.log('DEBUG', 'ATTENDANCE', `Record exists for ${firebaseUid} on ${mappedData.dateString}, skipping`);
                    logger.incrementStat('attendance', 'skipped');
                    continue;
                }
                
                if (CONFIG.DRY_RUN) {
                    logger.log('DEBUG', 'ATTENDANCE', `[DRY RUN] Would create attendance: ${firebaseUid} - ${mappedData.dateString}`);
                    logger.incrementStat('attendance', 'migrated');
                    continue;
                }
                
                const attendance = new Attendance(mappedData);
                await attendance.save();
                
                logger.incrementStat('attendance', 'migrated');
                
            } catch (error) {
                logger.log('ERROR', 'ATTENDANCE', `Failed to migrate attendance ${recordId}: ${error.message}`);
                logger.incrementStat('attendance', 'errors');
            }
        }
    }
    
    logger.log('SUCCESS', 'ATTENDANCE', `Attendance migration complete`);
}

async function migrateAdmins(adminDb, logger, userMap) {
    logger.log('INFO', 'ADMINS', 'Starting admin migration...');
    
    const snapshot = await adminDb.ref('admins').once('value');
    const adminsData = snapshot.val() || {};
    const adminEntries = Object.entries(adminsData);
    
    logger.log('INFO', 'ADMINS', `Found ${adminEntries.length} admins in Firebase`);
    
    for (const [firebaseUid, adminData] of adminEntries) {
        logger.incrementStat('admins', 'read');
        
        try {
            const existing = await Admin.findOne({ firebaseUid });
            
            if (existing) {
                logger.log('DEBUG', 'ADMINS', `Admin ${firebaseUid} already exists, skipping`);
                logger.incrementStat('admins', 'skipped');
                continue;
            }
            
            const mongoUser = userMap.get(firebaseUid) || await User.findOne({ firebaseUid });
            const mappedData = mapFirebaseAdminToMongo(firebaseUid, adminData, mongoUser?._id);
            
            if (CONFIG.DRY_RUN) {
                logger.log('DEBUG', 'ADMINS', `[DRY RUN] Would create admin: ${mappedData.email}`);
                logger.incrementStat('admins', 'migrated');
                continue;
            }
            
            const admin = new Admin(mappedData);
            await admin.save();
            
            logger.log('SUCCESS', 'ADMINS', `Migrated admin: ${admin.email}`);
            logger.incrementStat('admins', 'migrated');
            
        } catch (error) {
            logger.log('ERROR', 'ADMINS', `Failed to migrate admin ${firebaseUid}: ${error.message}`);
            logger.incrementStat('admins', 'errors');
        }
    }
}

async function migrateAnnouncements(adminDb, logger) {
    logger.log('INFO', 'ANNOUNCEMENTS', 'Starting announcement migration...');
    
    const snapshot = await adminDb.ref('announcements').once('value');
    const announcementsData = snapshot.val() || {};
    const entries = Object.entries(announcementsData);
    
    logger.log('INFO', 'ANNOUNCEMENTS', `Found ${entries.length} announcements in Firebase`);
    
    for (const [key, data] of entries) {
        logger.incrementStat('announcements', 'read');
        
        try {
            const existing = await Announcement.findOne({ _firebaseKey: key });
            
            if (existing) {
                logger.log('DEBUG', 'ANNOUNCEMENTS', `Announcement ${key} already exists, skipping`);
                logger.incrementStat('announcements', 'skipped');
                continue;
            }
            
            const mappedData = mapFirebaseAnnouncementToMongo(key, data);
            
            if (CONFIG.DRY_RUN) {
                logger.log('DEBUG', 'ANNOUNCEMENTS', `[DRY RUN] Would create announcement: ${mappedData.title}`);
                logger.incrementStat('announcements', 'migrated');
                continue;
            }
            
            const announcement = new Announcement(mappedData);
            await announcement.save();
            
            logger.log('SUCCESS', 'ANNOUNCEMENTS', `Migrated announcement: ${announcement.title}`);
            logger.incrementStat('announcements', 'migrated');
            
        } catch (error) {
            logger.log('ERROR', 'ANNOUNCEMENTS', `Failed to migrate announcement ${key}: ${error.message}`);
            logger.incrementStat('announcements', 'errors');
        }
    }
}

async function migrateSettings(adminDb, logger) {
    logger.log('INFO', 'SETTINGS', 'Starting settings migration...');
    
    const snapshot = await adminDb.ref('settings').once('value');
    const settingsData = snapshot.val() || {};
    
    logger.log('INFO', 'SETTINGS', `Found settings data in Firebase`);
    logger.incrementStat('settings', 'read');
    
    try {
        if (CONFIG.DRY_RUN) {
            logger.log('DEBUG', 'SETTINGS', `[DRY RUN] Would migrate settings`);
            logger.incrementStat('settings', 'migrated');
            return;
        }
        
        // Store as a single settings document
        const existing = await Settings.findOne({ orgId: 'default', settingType: 'global' });
        
        if (existing) {
            existing.settings = settingsData;
            existing.updatedAt = new Date();
            await existing.save();
            logger.log('SUCCESS', 'SETTINGS', 'Updated existing settings');
        } else {
            const settings = new Settings({
                orgId: 'default',
                settingType: 'global',
                settings: settingsData,
                _migratedFromFirebase: true,
                _migrationTimestamp: new Date()
            });
            await settings.save();
            logger.log('SUCCESS', 'SETTINGS', 'Created new settings document');
        }
        
        logger.incrementStat('settings', 'migrated');
        
    } catch (error) {
        logger.log('ERROR', 'SETTINGS', `Failed to migrate settings: ${error.message}`);
        logger.incrementStat('settings', 'errors');
    }
}

async function migrateGamification(adminDb, logger, userMap) {
    logger.log('INFO', 'GAMIFICATION', 'Starting gamification migration...');
    
    // Try multiple possible paths for gamification data
    const paths = ['gamification', 'realtime/gamification/leaderboard'];
    let gamificationData = {};
    
    for (const path of paths) {
        const snapshot = await adminDb.ref(path).once('value');
        const data = snapshot.val();
        if (data) {
            gamificationData = { ...gamificationData, ...data };
        }
    }
    
    const entries = Object.entries(gamificationData);
    logger.log('INFO', 'GAMIFICATION', `Found ${entries.length} gamification records in Firebase`);
    
    for (const [key, data] of entries) {
        logger.incrementStat('gamification', 'read');
        
        // Key could be firebaseUid or orgId containing user data
        const firebaseUid = data.userId || data.firebaseUid || key;
        
        try {
            const existing = await Gamification.findOne({ firebaseUid });
            
            if (existing) {
                logger.log('DEBUG', 'GAMIFICATION', `Gamification for ${firebaseUid} already exists, skipping`);
                logger.incrementStat('gamification', 'skipped');
                continue;
            }
            
            const mongoUser = userMap.get(firebaseUid) || await User.findOne({ firebaseUid });
            
            if (!mongoUser) {
                logger.log('WARNING', 'GAMIFICATION', `No user found for gamification: ${firebaseUid}`);
                continue;
            }
            
            const mappedData = mapFirebaseGamificationToMongo(
                firebaseUid, data, mongoUser._id, mongoUser.orgId, mongoUser.department
            );
            
            if (CONFIG.DRY_RUN) {
                logger.log('DEBUG', 'GAMIFICATION', `[DRY RUN] Would create gamification for: ${firebaseUid}`);
                logger.incrementStat('gamification', 'migrated');
                continue;
            }
            
            const gamification = new Gamification(mappedData);
            await gamification.save();
            
            logger.log('SUCCESS', 'GAMIFICATION', `Migrated gamification for: ${firebaseUid}`);
            logger.incrementStat('gamification', 'migrated');
            
        } catch (error) {
            logger.log('ERROR', 'GAMIFICATION', `Failed to migrate gamification ${key}: ${error.message}`);
            logger.incrementStat('gamification', 'errors');
        }
    }
}

// ============================================
// VERIFICATION FUNCTIONS
// ============================================

async function verifyMigration(adminDb, logger) {
    logger.log('INFO', 'VERIFY', 'Starting migration verification...');
    
    const verification = {
        timestamp: new Date().toISOString(),
        checks: [],
        passed: true
    };
    
    // Verify user counts
    const firebaseUsersSnapshot = await adminDb.ref('users').once('value');
    const firebaseUserCount = Object.keys(firebaseUsersSnapshot.val() || {}).length;
    const mongoUserCount = await User.countDocuments({ _migratedFromFirebase: true });
    
    verification.checks.push({
        name: 'User Count',
        firebase: firebaseUserCount,
        mongodb: mongoUserCount,
        passed: mongoUserCount >= firebaseUserCount * 0.95 // Allow 5% tolerance for conflicts
    });
    
    // Verify attendance counts
    const firebaseAttendanceSnapshot = await adminDb.ref('attendance').once('value');
    const firebaseAttendanceData = firebaseAttendanceSnapshot.val() || {};
    let firebaseAttendanceCount = 0;
    for (const userAttendance of Object.values(firebaseAttendanceData)) {
        firebaseAttendanceCount += Object.keys(userAttendance || {}).length;
    }
    const mongoAttendanceCount = await Attendance.countDocuments({ _migratedFromFirebase: true });
    
    verification.checks.push({
        name: 'Attendance Count',
        firebase: firebaseAttendanceCount,
        mongodb: mongoAttendanceCount,
        passed: mongoAttendanceCount >= firebaseAttendanceCount * 0.95
    });
    
    // Verify admin counts
    const firebaseAdminsSnapshot = await adminDb.ref('admins').once('value');
    const firebaseAdminCount = Object.keys(firebaseAdminsSnapshot.val() || {}).length;
    const mongoAdminCount = await Admin.countDocuments({ _migratedFromFirebase: true });
    
    verification.checks.push({
        name: 'Admin Count',
        firebase: firebaseAdminCount,
        mongodb: mongoAdminCount,
        passed: mongoAdminCount >= firebaseAdminCount
    });
    
    // Check overall pass status
    verification.passed = verification.checks.every(c => c.passed);
    
    for (const check of verification.checks) {
        const status = check.passed ? 'SUCCESS' : 'WARNING';
        logger.log(status, 'VERIFY', `${check.name}: Firebase=${check.firebase}, MongoDB=${check.mongodb}`);
    }
    
    return verification;
}

// ============================================
// AUDIT LOG ENTRY
// ============================================

async function logMigrationAudit(logger, verification) {
    if (CONFIG.DRY_RUN) return;
    
    const auditEntry = new AuditLog({
        eventType: 'system.data_import',
        actorId: 'migration_script',
        actorType: 'migration',
        actorName: 'Firebase to MongoDB Migration',
        action: 'migrate',
        description: 'Full migration from Firebase Realtime Database to MongoDB Atlas',
        newData: {
            stats: logger.stats,
            verification: verification
        },
        status: verification.passed ? 'success' : 'warning',
        severity: verification.passed ? 'low' : 'medium',
        metadata: {
            dryRun: CONFIG.DRY_RUN,
            duration: (new Date() - logger.startTime) / 1000
        },
        timestamp: new Date()
    });
    
    await auditEntry.save();
    logger.log('SUCCESS', 'AUDIT', 'Migration audit log created');
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     FIREBASE TO MONGODB ATLAS MIGRATION                      ║');
    console.log('║     Single Source of Truth Migration Script                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    if (CONFIG.DRY_RUN) {
        console.log('🔍 DRY RUN MODE - No data will be written to MongoDB\n');
    }
    
    const logger = new MigrationLogger();
    
    // Validate configuration
    if (!CONFIG.MONGODB_URI) {
        logger.log('ERROR', 'CONFIG', 'MONGODB_URI not found in environment');
        process.exit(1);
    }
    
    if (!CONFIG.FIREBASE_SERVICE_ACCOUNT) {
        logger.log('ERROR', 'CONFIG', 'FIREBASE_SERVICE_ACCOUNT not found in environment');
        process.exit(1);
    }
    
    let adminDb;
    
    try {
        // Initialize Firebase Admin
        logger.log('INFO', 'INIT', 'Initializing Firebase Admin SDK...');
        
        let serviceAccount = CONFIG.FIREBASE_SERVICE_ACCOUNT.trim();
        if (serviceAccount.startsWith('"') && serviceAccount.endsWith('"')) {
            serviceAccount = serviceAccount.slice(1, -1);
        }
        const parsedServiceAccount = JSON.parse(serviceAccount);
        if (parsedServiceAccount.private_key) {
            parsedServiceAccount.private_key = parsedServiceAccount.private_key.replace(/\\n/g, '\n');
        }
        
        initializeApp({
            credential: cert(parsedServiceAccount),
            databaseURL: CONFIG.FIREBASE_DATABASE_URL
        });
        
        adminDb = getDatabase();
        logger.log('SUCCESS', 'INIT', 'Firebase Admin SDK initialized');
        
        // Connect to MongoDB
        logger.log('INFO', 'INIT', 'Connecting to MongoDB Atlas...');
        await mongoose.connect(CONFIG.MONGODB_URI);
        logger.log('SUCCESS', 'INIT', 'Connected to MongoDB Atlas');
        
        // Initialize models
        initModels();
        
        // Confirmation prompt (skip in dry run)
        if (!CONFIG.DRY_RUN) {
            console.log('\n⚠️  This will migrate all data from Firebase to MongoDB.');
            console.log('   Existing MongoDB data will NOT be overwritten (duplicates skipped).');
            console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        // Run migrations
        console.log('\n📦 Starting Migration...\n');
        console.log('─'.repeat(60));
        
        const userMap = await migrateUsers(adminDb, logger);
        console.log('─'.repeat(60));
        
        await migrateAttendance(adminDb, logger, userMap);
        console.log('─'.repeat(60));
        
        await migrateAdmins(adminDb, logger, userMap);
        console.log('─'.repeat(60));
        
        await migrateAnnouncements(adminDb, logger);
        console.log('─'.repeat(60));
        
        await migrateSettings(adminDb, logger);
        console.log('─'.repeat(60));
        
        await migrateGamification(adminDb, logger, userMap);
        console.log('─'.repeat(60));
        
        // Verify migration
        console.log('\n🔍 Verifying Migration...\n');
        const verification = await verifyMigration(adminDb, logger);
        
        // Log audit entry
        await logMigrationAudit(logger, verification);
        
        // Save report
        const { report, reportPath } = await logger.saveReport();
        
        // Print summary
        console.log('\n');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║                    MIGRATION SUMMARY                         ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log('\n');
        
        console.log('📊 Statistics:');
        console.log('─'.repeat(40));
        for (const [collection, stats] of Object.entries(logger.stats)) {
            console.log(`   ${collection.padEnd(15)} Read: ${stats.read.toString().padStart(5)} | Migrated: ${stats.migrated.toString().padStart(5)} | Skipped: ${stats.skipped.toString().padStart(5)} | Errors: ${stats.errors.toString().padStart(3)}`);
        }
        
        console.log('\n✅ Verification:');
        console.log('─'.repeat(40));
        for (const check of verification.checks) {
            const icon = check.passed ? '✅' : '⚠️';
            console.log(`   ${icon} ${check.name}: Firebase=${check.firebase}, MongoDB=${check.mongodb}`);
        }
        
        console.log(`\n📁 Report saved to: ${reportPath}`);
        console.log(`⏱️  Duration: ${((new Date() - logger.startTime) / 1000).toFixed(2)} seconds`);
        
        if (verification.passed) {
            console.log('\n🎉 Migration completed successfully!');
            console.log('\n📋 Next Steps:');
            console.log('   1. Review the migration report');
            console.log('   2. Update Firebase rules to disable historical paths');
            console.log('   3. Update application code to use MongoDB as primary');
            console.log('   4. Monitor for any issues');
        } else {
            console.log('\n⚠️  Migration completed with warnings. Please review the report.');
        }
        
    } catch (error) {
        logger.log('ERROR', 'MAIN', `Migration failed: ${error.message}`, { stack: error.stack });
        console.error('\n❌ Migration failed:', error.message);
        await logger.saveReport();
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from databases');
    }
}

main();
