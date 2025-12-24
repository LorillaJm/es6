// src/lib/server/mongodb/initDatabase.js
// Database Initialization and Index Creation
// Run this once to set up MongoDB indexes

import { connectMongoDB } from './connection.js';
import { User } from './schemas/User.js';
import { Attendance } from './schemas/Attendance.js';
import { Admin } from './schemas/Admin.js';
import { AuditLog } from './schemas/AuditLog.js';
import { Announcement } from './schemas/Announcement.js';
import { Feedback } from './schemas/Feedback.js';
import { Gamification } from './schemas/Gamification.js';
import { EPass } from './schemas/EPass.js';

/**
 * Initialize database and create indexes
 */
export async function initializeDatabase() {
    console.log('[MongoDB] Initializing database...');
    
    await connectMongoDB();
    
    // Create indexes for all collections
    const collections = [
        { model: User, name: 'Users' },
        { model: Attendance, name: 'Attendance' },
        { model: Admin, name: 'Admins' },
        { model: AuditLog, name: 'AuditLogs' },
        { model: Announcement, name: 'Announcements' },
        { model: Feedback, name: 'Feedback' },
        { model: Gamification, name: 'Gamification' },
        { model: EPass, name: 'EPasses' }
    ];
    
    for (const { model, name } of collections) {
        try {
            await model.createIndexes();
            console.log(`[MongoDB] ✅ Indexes created for ${name}`);
        } catch (error) {
            console.error(`[MongoDB] ❌ Failed to create indexes for ${name}:`, error.message);
        }
    }
    
    console.log('[MongoDB] ✅ Database initialization complete');
    
    return true;
}

/**
 * Verify database connection and indexes
 */
export async function verifyDatabase() {
    await connectMongoDB();
    
    const results = {
        connected: true,
        collections: {}
    };
    
    const collections = [
        { model: User, name: 'users' },
        { model: Attendance, name: 'attendance' },
        { model: Admin, name: 'admins' },
        { model: AuditLog, name: 'audit_logs' },
        { model: Announcement, name: 'announcements' },
        { model: Feedback, name: 'feedback' },
        { model: Gamification, name: 'gamification' },
        { model: EPass, name: 'epasses' }
    ];
    
    for (const { model, name } of collections) {
        try {
            const count = await model.countDocuments();
            const indexes = await model.collection.indexes();
            
            results.collections[name] = {
                documentCount: count,
                indexCount: indexes.length,
                indexes: indexes.map(i => i.name)
            };
        } catch (error) {
            results.collections[name] = {
                error: error.message
            };
        }
    }
    
    return results;
}

/**
 * Migrate data from Firebase to MongoDB (one-time migration)
 */
export async function migrateFromFirebase(adminDb) {
    if (!adminDb) {
        console.error('[Migration] Firebase Admin DB not available');
        return { success: false, error: 'Firebase not available' };
    }
    
    await connectMongoDB();
    
    const results = {
        users: { migrated: 0, errors: 0 },
        attendance: { migrated: 0, errors: 0 }
    };
    
    console.log('[Migration] Starting Firebase to MongoDB migration...');
    
    // Migrate users
    try {
        const usersSnapshot = await adminDb.ref('users').once('value');
        const usersData = usersSnapshot.val() || {};
        
        for (const [firebaseUid, userData] of Object.entries(usersData)) {
            try {
                const existingUser = await User.findOne({ firebaseUid });
                
                if (!existingUser) {
                    const user = new User({
                        firebaseUid,
                        email: userData.email,
                        name: userData.name || userData.displayName,
                        displayName: userData.displayName,
                        profilePhoto: userData.profilePhoto,
                        phone: userData.phone,
                        orgId: userData.orgId || 'default',
                        department: userData.department,
                        position: userData.position,
                        employeeId: userData.employeeId,
                        role: userData.role || 'user',
                        status: userData.status || 'active',
                        emailVerified: userData.emailVerified || false,
                        createdAt: userData.createdAt ? new Date(userData.createdAt) : new Date()
                    });
                    
                    await user.save();
                    results.users.migrated++;
                }
            } catch (error) {
                console.error(`[Migration] User ${firebaseUid} error:`, error.message);
                results.users.errors++;
            }
        }
        
        console.log(`[Migration] Users: ${results.users.migrated} migrated, ${results.users.errors} errors`);
    } catch (error) {
        console.error('[Migration] Users migration failed:', error.message);
    }
    
    // Migrate attendance
    try {
        const attendanceSnapshot = await adminDb.ref('attendance').once('value');
        const attendanceData = attendanceSnapshot.val() || {};
        
        for (const [firebaseUid, userAttendance] of Object.entries(attendanceData)) {
            const user = await User.findOne({ firebaseUid });
            if (!user) continue;
            
            for (const [recordId, record] of Object.entries(userAttendance || {})) {
                try {
                    const date = new Date(record.date || record.checkIn?.timestamp);
                    const dateString = date.toISOString().split('T')[0];
                    
                    const existingAttendance = await Attendance.findOne({
                        firebaseUid,
                        dateString
                    });
                    
                    if (!existingAttendance) {
                        const attendance = new Attendance({
                            userId: user._id,
                            firebaseUid,
                            orgId: user.orgId,
                            department: user.department,
                            date,
                            dateString,
                            checkIn: record.checkIn ? {
                                timestamp: new Date(record.checkIn.timestamp),
                                method: record.checkIn.method || 'manual'
                            } : undefined,
                            checkOut: record.checkOut ? {
                                timestamp: new Date(record.checkOut.timestamp),
                                method: record.checkOut.method || 'manual'
                            } : undefined,
                            currentStatus: record.currentStatus || 'checkedOut',
                            isLate: record.isLate || false
                        });
                        
                        await attendance.save();
                        results.attendance.migrated++;
                    }
                } catch (error) {
                    results.attendance.errors++;
                }
            }
        }
        
        console.log(`[Migration] Attendance: ${results.attendance.migrated} migrated, ${results.attendance.errors} errors`);
    } catch (error) {
        console.error('[Migration] Attendance migration failed:', error.message);
    }
    
    console.log('[Migration] ✅ Migration complete');
    
    return { success: true, results };
}

export default {
    initializeDatabase,
    verifyDatabase,
    migrateFromFirebase
};
