// scripts/restore-firebase-history.js
// Restore full attendance history from Firebase to MongoDB
// This will fetch ALL attendance records from Firebase and ensure they exist in MongoDB
// Run: node scripts/restore-firebase-history.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

dotenv.config();

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    MONGODB_URI: process.env.MONGODB_URI,
    FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT,
    FIREBASE_DATABASE_URL: process.env.PUBLIC_FIREBASE_DATABASE_URL
};

// ============================================
// SCHEMAS
// ============================================

const userSchema = new mongoose.Schema({
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: String,
    name: String,
    orgId: String,
    department: String
}, { strict: false, collection: 'users' });

const attendanceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    firebaseUid: { type: String, required: true, index: true },
    orgId: String,
    department: String,
    date: Date,
    dateString: { type: String, index: true },
    shiftNumber: { type: Number, default: 1 },
    checkIn: {
        timestamp: Date,
        location: mongoose.Schema.Types.Mixed,
        deviceId: String,
        deviceInfo: mongoose.Schema.Types.Mixed,
        method: String,
        ipAddress: String,
        photo: String
    },
    checkOut: {
        timestamp: Date,
        location: mongoose.Schema.Types.Mixed,
        deviceId: String,
        deviceInfo: mongoose.Schema.Types.Mixed,
        method: String,
        ipAddress: String,
        photo: String
    },
    breaks: [{
        startTime: Date,
        endTime: Date,
        duration: Number,
        type: String
    }],
    currentStatus: String,
    actualWorkMinutes: Number,
    breakMinutes: Number,
    isLate: Boolean,
    lateMinutes: Number,
    isManualEntry: Boolean,
    _firebaseRecordId: String,
    _migratedFromFirebase: { type: Boolean, default: true },
    _migrationTimestamp: Date
}, { strict: false, collection: 'attendance' });

attendanceSchema.index({ firebaseUid: 1, dateString: 1 });

// ============================================
// HELPER FUNCTIONS
// ============================================

function parseFirebaseDate(dateValue) {
    if (!dateValue) return null;
    
    // Handle different date formats from Firebase
    if (dateValue instanceof Date) return dateValue;
    
    // Try parsing as ISO string or timestamp
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) return parsed;
    
    // Try parsing "Sat Dec 21 2025" format
    const parts = dateValue.split(' ');
    if (parts.length >= 4) {
        const monthMap = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
        const month = monthMap[parts[1]];
        const day = parseInt(parts[2]);
        const year = parseInt(parts[3]);
        if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
            return new Date(year, month, day);
        }
    }
    
    return null;
}

function formatDateString(date) {
    if (!date) return null;
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mapFirebaseAttendance(firebaseUid, recordId, data, mongoUser) {
    const date = parseFirebaseDate(data.date || data.checkIn?.timestamp);
    const dateString = formatDateString(date);
    
    if (!dateString) {
        console.log(`    ⚠️ Skipping record with invalid date: ${data.date}`);
        return null;
    }
    
    return {
        userId: mongoUser?._id,
        firebaseUid,
        orgId: data.orgId || mongoUser?.orgId || 'default',
        department: data.department || mongoUser?.department,
        date,
        dateString,
        shiftNumber: data.shiftNumber || 1,
        checkIn: data.checkIn ? {
            timestamp: data.checkIn.timestamp ? new Date(data.checkIn.timestamp) : null,
            location: data.checkIn.location,
            deviceId: data.checkIn.deviceId,
            deviceInfo: data.checkIn.device || data.checkIn.deviceInfo,
            method: data.checkIn.method || 'manual',
            ipAddress: data.checkIn.ipAddress,
            photo: data.checkIn.capturedImage || data.checkIn.photo
        } : undefined,
        checkOut: data.checkOut ? {
            timestamp: data.checkOut.timestamp ? new Date(data.checkOut.timestamp) : null,
            location: data.checkOut.location,
            deviceId: data.checkOut.deviceId,
            deviceInfo: data.checkOut.device || data.checkOut.deviceInfo,
            method: data.checkOut.method || 'manual',
            ipAddress: data.checkOut.ipAddress,
            photo: data.checkOut.capturedImage || data.checkOut.photo
        } : undefined,
        breaks: mapBreaks(data),
        currentStatus: data.currentStatus || (data.checkOut ? 'checkedOut' : 'checkedIn'),
        actualWorkMinutes: data.actualWorkMinutes || calculateWorkMinutes(data),
        breakMinutes: data.breakMinutes || 0,
        isLate: data.isLate || false,
        lateMinutes: data.lateMinutes || 0,
        isManualEntry: data.isManualEntry || data.manualCorrection || false,
        _firebaseRecordId: recordId,
        _migratedFromFirebase: true,
        _migrationTimestamp: new Date()
    };
}

function mapBreaks(data) {
    const breaks = [];
    
    // Handle breakIn/breakOut format
    if (data.breakIn?.timestamp || data.breakStart?.timestamp) {
        breaks.push({
            startTime: new Date(data.breakIn?.timestamp || data.breakStart?.timestamp),
            endTime: data.breakOut?.timestamp || data.breakEnd?.timestamp 
                ? new Date(data.breakOut?.timestamp || data.breakEnd?.timestamp) 
                : null,
            type: 'break'
        });
    }
    
    // Handle breaks array format
    if (Array.isArray(data.breaks)) {
        data.breaks.forEach(b => {
            breaks.push({
                startTime: b.startTime ? new Date(b.startTime) : null,
                endTime: b.endTime ? new Date(b.endTime) : null,
                duration: b.duration,
                type: b.type || 'break'
            });
        });
    }
    
    return breaks;
}

function calculateWorkMinutes(data) {
    if (!data.checkIn?.timestamp) return 0;
    const checkIn = new Date(data.checkIn.timestamp);
    const checkOut = data.checkOut?.timestamp ? new Date(data.checkOut.timestamp) : null;
    if (!checkOut) return 0;
    return Math.floor((checkOut - checkIn) / 60000);
}

// ============================================
// MAIN RESTORE FUNCTION
// ============================================

async function restoreHistory() {
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     RESTORE FIREBASE ATTENDANCE HISTORY TO MONGODB           ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n');
    
    // Validate config
    if (!CONFIG.MONGODB_URI) {
        console.error('❌ MONGODB_URI not found');
        process.exit(1);
    }
    if (!CONFIG.FIREBASE_SERVICE_ACCOUNT) {
        console.error('❌ FIREBASE_SERVICE_ACCOUNT not found');
        process.exit(1);
    }
    
    let adminDb;
    const stats = {
        usersProcessed: 0,
        recordsRead: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        errors: 0
    };
    
    try {
        // Initialize Firebase
        console.log('🔄 Initializing Firebase Admin SDK...');
        let serviceAccount = CONFIG.FIREBASE_SERVICE_ACCOUNT.trim();
        if (serviceAccount.startsWith('"') && serviceAccount.endsWith('"')) {
            serviceAccount = serviceAccount.slice(1, -1);
        }
        const parsedServiceAccount = JSON.parse(serviceAccount);
        if (parsedServiceAccount.private_key) {
            parsedServiceAccount.private_key = parsedServiceAccount.private_key.replace(/\\n/g, '\n');
        }
        
        if (!getApps().length) {
            initializeApp({
                credential: cert(parsedServiceAccount),
                databaseURL: CONFIG.FIREBASE_DATABASE_URL
            });
        }
        adminDb = getDatabase();
        console.log('✅ Firebase initialized\n');
        
        // Connect to MongoDB
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(CONFIG.MONGODB_URI);
        console.log('✅ MongoDB connected\n');
        
        // Initialize models
        const User = mongoose.models.User || mongoose.model('User', userSchema);
        const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);
        
        // Get all attendance data from Firebase
        console.log('📥 Fetching all attendance data from Firebase...');
        const attendanceSnapshot = await adminDb.ref('attendance').once('value');
        const allAttendance = attendanceSnapshot.val() || {};
        
        const userIds = Object.keys(allAttendance);
        console.log(`📋 Found ${userIds.length} users with attendance data\n`);
        
        // Process each user
        for (const firebaseUid of userIds) {
            stats.usersProcessed++;
            const userAttendance = allAttendance[firebaseUid] || {};
            const recordIds = Object.keys(userAttendance);
            
            console.log(`\n👤 Processing user ${firebaseUid} (${recordIds.length} records)...`);
            
            // Get MongoDB user
            const mongoUser = await User.findOne({ firebaseUid });
            if (!mongoUser) {
                console.log(`   ⚠️ User not found in MongoDB, will create records without user reference`);
            }
            
            for (const recordId of recordIds) {
                stats.recordsRead++;
                const firebaseRecord = userAttendance[recordId];
                
                try {
                    const mappedData = mapFirebaseAttendance(firebaseUid, recordId, firebaseRecord, mongoUser);
                    
                    if (!mappedData) {
                        stats.recordsSkipped++;
                        continue;
                    }
                    
                    // Check if record already exists
                    const existing = await Attendance.findOne({
                        firebaseUid,
                        dateString: mappedData.dateString,
                        shiftNumber: mappedData.shiftNumber
                    });
                    
                    if (existing) {
                        // Update if Firebase has more data (like photos)
                        let needsUpdate = false;
                        
                        if (mappedData.checkIn?.photo && !existing.checkIn?.photo) {
                            existing.checkIn = existing.checkIn || {};
                            existing.checkIn.photo = mappedData.checkIn.photo;
                            needsUpdate = true;
                        }
                        if (mappedData.checkOut?.photo && !existing.checkOut?.photo) {
                            existing.checkOut = existing.checkOut || {};
                            existing.checkOut.photo = mappedData.checkOut.photo;
                            needsUpdate = true;
                        }
                        if (mappedData.checkIn?.location && !existing.checkIn?.location) {
                            existing.checkIn = existing.checkIn || {};
                            existing.checkIn.location = mappedData.checkIn.location;
                            needsUpdate = true;
                        }
                        if (mappedData.checkIn?.deviceInfo && !existing.checkIn?.deviceInfo) {
                            existing.checkIn = existing.checkIn || {};
                            existing.checkIn.deviceInfo = mappedData.checkIn.deviceInfo;
                            needsUpdate = true;
                        }
                        if (mappedData.breaks?.length > 0 && (!existing.breaks || existing.breaks.length === 0)) {
                            existing.breaks = mappedData.breaks;
                            needsUpdate = true;
                        }
                        
                        if (needsUpdate) {
                            await existing.save();
                            stats.recordsUpdated++;
                            console.log(`   📝 Updated: ${mappedData.dateString}`);
                        } else {
                            stats.recordsSkipped++;
                        }
                    } else {
                        // Create new record
                        const attendance = new Attendance(mappedData);
                        await attendance.save();
                        stats.recordsCreated++;
                        console.log(`   ✅ Created: ${mappedData.dateString}`);
                    }
                    
                } catch (error) {
                    stats.errors++;
                    console.log(`   ❌ Error processing ${recordId}: ${error.message}`);
                }
            }
        }
        
        // Print summary
        console.log('\n');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║                      RESTORE SUMMARY                         ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log(`\n   Users Processed:  ${stats.usersProcessed}`);
        console.log(`   Records Read:     ${stats.recordsRead}`);
        console.log(`   Records Created:  ${stats.recordsCreated}`);
        console.log(`   Records Updated:  ${stats.recordsUpdated}`);
        console.log(`   Records Skipped:  ${stats.recordsSkipped}`);
        console.log(`   Errors:           ${stats.errors}`);
        console.log('\n✅ Restore complete!\n');
        
    } catch (error) {
        console.error('\n❌ Restore failed:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from databases');
    }
}

restoreHistory();
