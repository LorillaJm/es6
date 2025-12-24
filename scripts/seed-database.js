// scripts/seed-database.js
// Database Seeder for MongoDB Atlas
// Run: node scripts/seed-database.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

// ============================================
// SCHEMAS (inline for standalone script)
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
    role: { type: String, enum: ['user', 'admin', 'superadmin', 'manager'], default: 'user', index: true },
    permissions: [String],
    status: { type: String, enum: ['active', 'inactive', 'suspended', 'pending'], default: 'active', index: true },
    emailVerified: { type: Boolean, default: false },
    lastLogin: Date,
    loginCount: { type: Number, default: 0 },
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
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'users' });

const adminSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
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
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active', index: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'admins' });

const attendanceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    firebaseUid: { type: String, required: true, index: true },
    orgId: { type: String, required: true, index: true },
    department: { type: String, index: true },
    date: { type: Date, required: true, index: true },
    dateString: { type: String, required: true, index: true },
    shiftNumber: { type: Number, default: 1 },
    checkIn: {
        timestamp: Date,
        method: { type: String, enum: ['qr', 'face', 'manual', 'auto', 'api'], default: 'manual' },
        ipAddress: String
    },
    checkOut: {
        timestamp: Date,
        method: { type: String, enum: ['qr', 'face', 'manual', 'auto', 'api'], default: 'manual' },
        ipAddress: String
    },
    currentStatus: { type: String, enum: ['checkedIn', 'onBreak', 'checkedOut', 'absent', 'leave', 'holiday'], default: 'checkedIn', index: true },
    actualWorkMinutes: Number,
    breakMinutes: { type: Number, default: 0 },
    isLate: { type: Boolean, default: false, index: true },
    lateMinutes: Number,
    isManualEntry: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'attendance' });

const announcementSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    summary: String,
    type: { type: String, enum: ['general', 'urgent', 'policy', 'event', 'maintenance', 'holiday'], default: 'general', index: true },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal', index: true },
    orgId: { type: String, required: true, index: true },
    targetAudience: { type: String, enum: ['all', 'admins', 'users', 'department'], default: 'all' },
    authorId: { type: String, required: true },
    authorName: String,
    status: { type: String, enum: ['draft', 'published', 'scheduled', 'archived'], default: 'published', index: true },
    publishAt: { type: Date, default: Date.now },
    isPinned: { type: Boolean, default: false },
    viewCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'announcements' });

const gamificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
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
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'gamification' });

const feedbackSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    userEmail: String,
    userName: String,
    orgId: { type: String, index: true },
    type: { type: String, enum: ['bug', 'feature', 'improvement', 'complaint', 'praise', 'question', 'other'], default: 'other', index: true },
    category: { type: String, enum: ['attendance', 'ui', 'performance', 'notifications', 'reports', 'admin', 'general'], default: 'general' },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5 },
    status: { type: String, enum: ['new', 'in_review', 'in_progress', 'resolved', 'closed', 'wont_fix'], default: 'new', index: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, collection: 'feedback' });

const auditLogSchema = new mongoose.Schema({
    eventType: { type: String, required: true, index: true },
    actorId: { type: String, index: true },
    actorType: { type: String, enum: ['user', 'admin', 'system', 'api'], default: 'system' },
    actorEmail: String,
    actorName: String,
    targetId: String,
    targetType: String,
    orgId: { type: String, index: true },
    action: { type: String, required: true },
    description: String,
    status: { type: String, enum: ['success', 'failure', 'warning'], default: 'success' },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low', index: true },
    timestamp: { type: Date, default: Date.now, index: true }
}, { timestamps: false, collection: 'audit_logs' });

// Models
const User = mongoose.model('User', userSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Announcement = mongoose.model('Announcement', announcementSchema);
const Gamification = mongoose.model('Gamification', gamificationSchema);
const Feedback = mongoose.model('Feedback', feedbackSchema);
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

// ============================================
// SEED DATA
// ============================================

const ORG_ID = 'org_default';

const DEPARTMENTS = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations'];

const SAMPLE_USERS = [
    { name: 'John Admin', email: 'admin@company.com', role: 'superadmin', department: 'Engineering', position: 'System Administrator' },
    { name: 'Sarah Manager', email: 'sarah@company.com', role: 'manager', department: 'Engineering', position: 'Engineering Manager' },
    { name: 'Mike Developer', email: 'mike@company.com', role: 'user', department: 'Engineering', position: 'Senior Developer' },
    { name: 'Emily Designer', email: 'emily@company.com', role: 'user', department: 'Engineering', position: 'UI/UX Designer' },
    { name: 'David Sales', email: 'david@company.com', role: 'user', department: 'Sales', position: 'Sales Representative' },
    { name: 'Lisa Marketing', email: 'lisa@company.com', role: 'user', department: 'Marketing', position: 'Marketing Specialist' },
    { name: 'Tom HR', email: 'tom@company.com', role: 'admin', department: 'HR', position: 'HR Manager' },
    { name: 'Anna Finance', email: 'anna@company.com', role: 'user', department: 'Finance', position: 'Accountant' },
    { name: 'Chris Ops', email: 'chris@company.com', role: 'user', department: 'Operations', position: 'Operations Coordinator' },
    { name: 'Jessica Dev', email: 'jessica@company.com', role: 'user', department: 'Engineering', position: 'Junior Developer' },
];

const SAMPLE_ANNOUNCEMENTS = [
    { title: 'Welcome to the New Attendance System', content: 'We are excited to announce the launch of our new attendance management system. Please check in daily using the QR code or face recognition feature.', type: 'general', priority: 'high', isPinned: true },
    { title: 'Holiday Schedule - Christmas 2025', content: 'The office will be closed from December 24-26, 2025 for the Christmas holiday. Please plan accordingly.', type: 'holiday', priority: 'normal' },
    { title: 'System Maintenance Notice', content: 'Scheduled maintenance will occur on Sunday, December 22, 2025 from 2:00 AM to 6:00 AM. The system may be temporarily unavailable.', type: 'maintenance', priority: 'urgent' },
    { title: 'New Remote Work Policy', content: 'Starting January 2026, employees may work remotely up to 2 days per week. Please coordinate with your manager.', type: 'policy', priority: 'normal' },
    { title: 'Team Building Event', content: 'Join us for our annual team building event on January 15, 2026. More details to follow.', type: 'event', priority: 'low' },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateFirebaseUid() {
    return crypto.randomBytes(14).toString('hex');
}

function generateEmployeeId(index) {
    return `EMP${String(index + 1).padStart(4, '0')}`;
}

function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getLevelName(level) {
    const levels = ['Newcomer', 'Regular', 'Dedicated', 'Committed', 'Star', 'Champion', 'Legend', 'Master', 'Grandmaster', 'Elite'];
    return levels[Math.min(level - 1, levels.length - 1)];
}

// ============================================
// SEED FUNCTIONS
// ============================================

async function seedUsers() {
    console.log('\n📝 Seeding Users...');
    
    const users = [];
    
    for (let i = 0; i < SAMPLE_USERS.length; i++) {
        const userData = SAMPLE_USERS[i];
        const firebaseUid = generateFirebaseUid();
        
        const user = new User({
            firebaseUid,
            email: userData.email,
            name: userData.name,
            displayName: userData.name,
            orgId: ORG_ID,
            department: userData.department,
            position: userData.position,
            employeeId: generateEmployeeId(i),
            role: userData.role,
            status: 'active',
            emailVerified: true,
            loginCount: Math.floor(Math.random() * 50) + 10,
            lastLogin: randomDate(new Date(2025, 11, 1), new Date())
        });
        
        await user.save();
        users.push(user);
        console.log(`   ✅ Created user: ${user.name} (${user.role})`);
    }
    
    return users;
}

async function seedAdmins(users) {
    console.log('\n👑 Seeding Admins...');
    
    const adminUsers = users.filter(u => ['admin', 'superadmin', 'manager'].includes(u.role));
    
    for (const user of adminUsers) {
        const admin = new Admin({
            userId: user._id,
            firebaseUid: user.firebaseUid,
            email: user.email,
            name: user.name,
            adminLevel: user.role === 'superadmin' ? 'superadmin' : 'admin',
            orgId: ORG_ID,
            managedDepartments: user.role === 'superadmin' ? [] : [user.department],
            permissions: {
                manageUsers: true,
                manageAttendance: true,
                viewReports: true,
                manageSettings: user.role === 'superadmin',
                manageAdmins: user.role === 'superadmin',
                viewAuditLogs: true,
                exportData: true,
                manageAnnouncements: true,
                impersonateUsers: user.role === 'superadmin',
                manageBackups: user.role === 'superadmin'
            },
            status: 'active'
        });
        
        await admin.save();
        console.log(`   ✅ Created admin: ${admin.name} (${admin.adminLevel})`);
    }
}

async function seedAttendance(users) {
    console.log('\n📅 Seeding Attendance Records (last 30 days)...');
    
    const today = new Date();
    let totalRecords = 0;
    
    for (const user of users) {
        // Generate attendance for last 30 days
        for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
            const date = new Date(today);
            date.setDate(date.getDate() - daysAgo);
            date.setHours(0, 0, 0, 0);
            
            // Skip weekends
            const dayOfWeek = date.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;
            
            // 90% chance of attendance
            if (Math.random() > 0.9) continue;
            
            const dateString = date.toISOString().split('T')[0];
            
            // Random check-in time (7:45 - 8:30)
            const checkInHour = 7 + Math.floor(Math.random() * 2);
            const checkInMinute = Math.floor(Math.random() * 60);
            const checkInTime = new Date(date);
            checkInTime.setHours(checkInHour, checkInMinute, 0, 0);
            
            // Is late? (after 8:15)
            const isLate = checkInHour > 8 || (checkInHour === 8 && checkInMinute > 15);
            const lateMinutes = isLate ? (checkInHour - 8) * 60 + checkInMinute - 15 : 0;
            
            // Random check-out time (17:00 - 18:30)
            const checkOutHour = 17 + Math.floor(Math.random() * 2);
            const checkOutMinute = Math.floor(Math.random() * 60);
            const checkOutTime = new Date(date);
            checkOutTime.setHours(checkOutHour, checkOutMinute, 0, 0);
            
            // Calculate work minutes
            const workMs = checkOutTime - checkInTime;
            const actualWorkMinutes = Math.floor(workMs / 60000) - 60; // Minus 1 hour break
            
            const attendance = new Attendance({
                userId: user._id,
                firebaseUid: user.firebaseUid,
                orgId: ORG_ID,
                department: user.department,
                date,
                dateString,
                shiftNumber: 1,
                checkIn: {
                    timestamp: checkInTime,
                    method: getRandomElement(['qr', 'face', 'manual']),
                    ipAddress: '192.168.1.' + Math.floor(Math.random() * 255)
                },
                checkOut: {
                    timestamp: checkOutTime,
                    method: getRandomElement(['qr', 'face', 'manual']),
                    ipAddress: '192.168.1.' + Math.floor(Math.random() * 255)
                },
                currentStatus: 'checkedOut',
                actualWorkMinutes,
                breakMinutes: 60,
                isLate,
                lateMinutes,
                isManualEntry: false
            });
            
            await attendance.save();
            totalRecords++;
        }
    }
    
    console.log(`   ✅ Created ${totalRecords} attendance records`);
}

async function seedGamification(users) {
    console.log('\n🎮 Seeding Gamification Data...');
    
    for (const user of users) {
        const totalCheckIns = Math.floor(Math.random() * 25) + 5;
        const onTimeCount = Math.floor(totalCheckIns * (0.7 + Math.random() * 0.3));
        const lateCount = totalCheckIns - onTimeCount;
        const totalPoints = onTimeCount * 10 + lateCount * 5 + Math.floor(Math.random() * 100);
        const level = Math.floor(totalPoints / 100) + 1;
        const currentStreak = Math.floor(Math.random() * 15);
        
        const badges = [];
        if (currentStreak >= 5) {
            badges.push({
                badgeId: 'streak_5',
                name: '5-Day Streak',
                description: 'Checked in 5 days in a row',
                icon: '🔥',
                earnedAt: new Date(),
                category: 'streak'
            });
        }
        if (onTimeCount >= 20) {
            badges.push({
                badgeId: 'punctual_20',
                name: 'Punctuality Pro',
                description: 'On time 20 times',
                icon: '⏰',
                earnedAt: new Date(),
                category: 'punctuality'
            });
        }
        
        const gamification = new Gamification({
            userId: user._id,
            firebaseUid: user.firebaseUid,
            orgId: ORG_ID,
            department: user.department,
            totalPoints,
            monthlyPoints: Math.floor(totalPoints * 0.3),
            weeklyPoints: Math.floor(totalPoints * 0.1),
            level,
            levelName: getLevelName(level),
            experiencePoints: totalPoints % 100,
            nextLevelXP: 100,
            currentStreak,
            longestStreak: Math.max(currentStreak, Math.floor(Math.random() * 20)),
            onTimeCount,
            lateCount,
            punctualityRate: Math.round((onTimeCount / totalCheckIns) * 100),
            totalCheckIns,
            badges
        });
        
        await gamification.save();
        console.log(`   ✅ Created gamification for: ${user.name} (Level ${level}, ${totalPoints} pts)`);
    }
}

async function seedAnnouncements(users) {
    console.log('\n📢 Seeding Announcements...');
    
    const adminUser = users.find(u => u.role === 'superadmin') || users[0];
    
    for (const announcementData of SAMPLE_ANNOUNCEMENTS) {
        const announcement = new Announcement({
            ...announcementData,
            summary: announcementData.content.substring(0, 100) + '...',
            orgId: ORG_ID,
            authorId: adminUser.firebaseUid,
            authorName: adminUser.name,
            status: 'published',
            publishAt: randomDate(new Date(2025, 11, 1), new Date()),
            viewCount: Math.floor(Math.random() * 50)
        });
        
        await announcement.save();
        console.log(`   ✅ Created announcement: ${announcement.title}`);
    }
}

async function seedFeedback(users) {
    console.log('\n💬 Seeding Feedback...');
    
    const feedbackItems = [
        { type: 'feature', subject: 'Add dark mode', message: 'Would love to have a dark mode option for the dashboard.', rating: 4 },
        { type: 'bug', subject: 'QR scanner not working on iOS', message: 'The QR scanner fails to open on iPhone 14. Please fix.', rating: 2 },
        { type: 'praise', subject: 'Great new UI!', message: 'The new interface is much cleaner and easier to use. Great job!', rating: 5 },
        { type: 'improvement', subject: 'Faster loading times', message: 'The dashboard takes too long to load. Can this be optimized?', rating: 3 },
        { type: 'question', subject: 'How to export reports?', message: 'I cannot find the option to export attendance reports to Excel.', rating: 3 },
    ];
    
    for (const feedbackData of feedbackItems) {
        const randomUser = getRandomElement(users);
        
        const feedback = new Feedback({
            userId: randomUser.firebaseUid,
            userEmail: randomUser.email,
            userName: randomUser.name,
            orgId: ORG_ID,
            ...feedbackData,
            category: 'general',
            status: getRandomElement(['new', 'in_review', 'resolved']),
            priority: getRandomElement(['low', 'medium', 'high'])
        });
        
        await feedback.save();
        console.log(`   ✅ Created feedback: ${feedback.subject}`);
    }
}

async function seedAuditLogs(users) {
    console.log('\n📋 Seeding Audit Logs...');
    
    const events = [
        { eventType: 'auth.login', action: 'login', description: 'User logged in' },
        { eventType: 'attendance.check_in', action: 'check_in', description: 'User checked in' },
        { eventType: 'attendance.check_out', action: 'check_out', description: 'User checked out' },
        { eventType: 'user.profile_updated', action: 'update', description: 'User updated profile' },
        { eventType: 'announcement.created', action: 'create', description: 'Announcement created' },
    ];
    
    let count = 0;
    for (let i = 0; i < 50; i++) {
        const randomUser = getRandomElement(users);
        const randomEvent = getRandomElement(events);
        
        const auditLog = new AuditLog({
            ...randomEvent,
            actorId: randomUser.firebaseUid,
            actorType: randomUser.role === 'superadmin' ? 'admin' : 'user',
            actorEmail: randomUser.email,
            actorName: randomUser.name,
            orgId: ORG_ID,
            status: 'success',
            severity: 'low',
            timestamp: randomDate(new Date(2025, 11, 1), new Date())
        });
        
        await auditLog.save();
        count++;
    }
    
    console.log(`   ✅ Created ${count} audit log entries`);
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
    console.log('🌱 MongoDB Database Seeder');
    console.log('==========================\n');
    
    if (!MONGODB_URI) {
        console.error('❌ MONGODB_URI not found in .env file');
        process.exit(1);
    }
    
    try {
        console.log('🔄 Connecting to MongoDB Atlas...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected!\n');
        
        // Ask for confirmation
        console.log('⚠️  This will clear existing data and seed fresh data.');
        console.log('   Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Clear existing data
        console.log('🗑️  Clearing existing data...');
        await User.deleteMany({});
        await Admin.deleteMany({});
        await Attendance.deleteMany({});
        await Announcement.deleteMany({});
        await Gamification.deleteMany({});
        await Feedback.deleteMany({});
        await AuditLog.deleteMany({});
        console.log('   ✅ All collections cleared\n');
        
        // Seed data
        const users = await seedUsers();
        await seedAdmins(users);
        await seedAttendance(users);
        await seedGamification(users);
        await seedAnnouncements(users);
        await seedFeedback(users);
        await seedAuditLogs(users);
        
        // Summary
        console.log('\n==========================');
        console.log('✅ SEEDING COMPLETE!');
        console.log('==========================');
        console.log(`   Users:         ${await User.countDocuments()}`);
        console.log(`   Admins:        ${await Admin.countDocuments()}`);
        console.log(`   Attendance:    ${await Attendance.countDocuments()}`);
        console.log(`   Announcements: ${await Announcement.countDocuments()}`);
        console.log(`   Gamification:  ${await Gamification.countDocuments()}`);
        console.log(`   Feedback:      ${await Feedback.countDocuments()}`);
        console.log(`   Audit Logs:    ${await AuditLog.countDocuments()}`);
        console.log('\n🎉 Database is ready to use!\n');
        
    } catch (error) {
        console.error('\n❌ Seeding failed:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

main();
