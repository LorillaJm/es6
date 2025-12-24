// src/lib/server/mongodb/services/attendanceService.js
// Attendance Service - MongoDB Atlas (PRIMARY)
// ✅ MANDATORY: All attendance records saved to MongoDB FIRST
// ✅ ONLY IF MongoDB write succeeds → emit to Firebase
// ✅ Uses MongoDB transactions for atomic operations
// ❌ Firebase NEVER stores attendance history

import mongoose from 'mongoose';
import { connectMongoDB } from '../connection.js';
import { Attendance } from '../schemas/Attendance.js';
import { User } from '../schemas/User.js';
import { AuditLog } from '../schemas/AuditLog.js';
import { Gamification } from '../schemas/Gamification.js';
import { emitAttendanceStatus, emitDashboardStats, emitAdminEvent } from '../../realtimeEmitter.js';
import { adminDb } from '../../firebase-admin.js';

/**
 * Sync user from Firebase to MongoDB
 * Called when user exists in Firebase but not in MongoDB
 */
async function syncUserFromFirebase(firebaseUid) {
    try {
        if (!adminDb) {
            console.error('[AttendanceService] Firebase Admin not available for user sync');
            return null;
        }

        console.log(`[AttendanceService] Attempting to sync user ${firebaseUid} from Firebase...`);

        // Get user data from Firebase
        const snapshot = await adminDb.ref(`users/${firebaseUid}`).once('value');
        const firebaseUser = snapshot.val();

        console.log(`[AttendanceService] Firebase user data:`, firebaseUser ? 'Found' : 'Not found');

        if (!firebaseUser) {
            console.error(`[AttendanceService] User ${firebaseUid} not found in Firebase`);
            return null;
        }

        // Check if user already exists by email (might have different firebaseUid)
        const existingByEmail = await User.findOne({ email: firebaseUser.email?.toLowerCase() });
        if (existingByEmail) {
            console.log(`[AttendanceService] User with email ${firebaseUser.email} already exists, updating firebaseUid`);
            existingByEmail.firebaseUid = firebaseUid;
            await existingByEmail.save();
            return existingByEmail;
        }

        // Create user in MongoDB
        const user = new User({
            firebaseUid,
            email: firebaseUser.email?.toLowerCase() || `${firebaseUid}@placeholder.com`,
            name: firebaseUser.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Unknown User',
            displayName: firebaseUser.displayName || firebaseUser.name,
            profilePhoto: firebaseUser.profilePhoto || firebaseUser.photoURL,
            phone: firebaseUser.phone,
            orgId: firebaseUser.orgId || 'org_default',
            department: firebaseUser.department || 'General',
            position: firebaseUser.position,
            employeeId: firebaseUser.employeeId || firebaseUser.digitalId,
            role: firebaseUser.role || 'user',
            status: 'active',
            emailVerified: firebaseUser.emailVerified || false,
            schedule: {
                workDays: firebaseUser.schedule?.workDays || [1, 2, 3, 4, 5],
                startTime: firebaseUser.schedule?.startTime || '08:00',
                endTime: firebaseUser.schedule?.endTime || '17:00',
                timezone: firebaseUser.schedule?.timezone || 'Asia/Manila'
            },
            createdBy: 'system_sync'
        });

        await user.save();

        console.log(`[AttendanceService] ✅ User ${firebaseUid} synced from Firebase to MongoDB`);

        // Log audit event (don't await to avoid blocking)
        AuditLog.logEvent({
            eventType: 'user.synced',
            actorId: 'system',
            actorType: 'system',
            targetId: user._id.toString(),
            targetType: 'user',
            targetEmail: user.email,
            action: 'sync_from_firebase',
            description: `User ${user.name} synced from Firebase to MongoDB`,
            orgId: user.orgId,
            status: 'success'
        }).catch(err => console.warn('[AttendanceService] Audit log failed:', err.message));

        return user;
    } catch (error) {
        console.error('[AttendanceService] Failed to sync user from Firebase:', error.message);
        console.error('[AttendanceService] Full error:', error);
        
        // If duplicate key error, try to find and return existing user
        if (error.code === 11000) {
            console.log('[AttendanceService] Duplicate key error, trying to find existing user...');
            const existingUser = await User.findByFirebaseUid(firebaseUid);
            if (existingUser) return existingUser;
        }
        
        return null;
    }
}

/**
 * MANDATORY CHECK-IN LOGIC WITH TRANSACTION
 * 1. Backend validates auth, device, location
 * 2. Start MongoDB transaction
 * 3. Attendance record saved to MongoDB
 * 4. Audit log saved to MongoDB
 * 5. Commit transaction
 * 6. IF AND ONLY IF transaction succeeds → Push realtime event to Firebase
 * 7. Frontend updates instantly via Firebase listener
 */
export async function checkIn(firebaseUid, checkInData) {
    await connectMongoDB();
    
    // Get user from MongoDB - auto-create if not exists
    let user = await User.findByFirebaseUid(firebaseUid);
    
    if (!user) {
        // Try to get user data from Firebase and create in MongoDB
        console.log(`[AttendanceService] User ${firebaseUid} not in MongoDB, attempting to sync...`);
        user = await syncUserFromFirebase(firebaseUid);
        
        if (!user) {
            throw new Error('User not found');
        }
    }
    
    if (user.status !== 'active') {
        throw new Error('User account is not active');
    }
    
    // Check for existing check-in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Use local date string to avoid timezone issues
    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const existingAttendance = await Attendance.findOne({
        firebaseUid,
        dateString,
        currentStatus: { $in: ['checkedIn', 'onBreak'] }
    });
    
    if (existingAttendance) {
        throw new Error('Already checked in today');
    }
    
    // Calculate if late
    const scheduledStart = user.schedule?.startTime || '08:00';
    const [schedHour, schedMin] = scheduledStart.split(':').map(Number);
    const scheduledTime = new Date(today);
    scheduledTime.setHours(schedHour, schedMin, 0, 0);
    
    const checkInTime = new Date();
    const graceMinutes = 15;
    const graceTime = new Date(scheduledTime.getTime() + graceMinutes * 60000);
    
    const isLate = checkInTime > graceTime;
    const lateMinutes = isLate ? Math.floor((checkInTime - scheduledTime) / 60000) : 0;
    
    // Count existing shifts today
    const shiftsToday = await Attendance.countDocuments({ firebaseUid, dateString });
    
    // ✅ START MONGODB TRANSACTION
    const session = await mongoose.startSession();
    let attendance;
    
    try {
        await session.startTransaction();
        
        // Create attendance record
        attendance = new Attendance({
            userId: user._id,
            firebaseUid,
            orgId: user.orgId,
            department: user.department,
            date: today,
            dateString,
            shiftNumber: shiftsToday + 1,
            checkIn: {
                timestamp: checkInTime,
                location: checkInData.location,
                deviceId: checkInData.deviceId,
                deviceInfo: checkInData.deviceInfo,
                method: checkInData.method || 'manual',
                verificationData: checkInData.verificationData,
                ipAddress: checkInData.ipAddress,
                photo: checkInData.photo
            },
            currentStatus: 'checkedIn',
            scheduledStart: scheduledTime,
            isLate,
            lateMinutes,
            isManualEntry: checkInData.isManualEntry || false
        });
        
        // Save attendance within transaction
        await attendance.save({ session });
        
        // Log audit event within transaction
        const auditLog = new AuditLog({
            eventType: 'attendance.check_in',
            actorId: firebaseUid,
            actorType: 'user',
            actorEmail: user.email,
            actorIp: checkInData.ipAddress,
            targetId: attendance._id.toString(),
            targetType: 'attendance',
            action: 'check_in',
            description: `${user.name} checked in${isLate ? ' (late)' : ''}`,
            newData: {
                checkInTime: checkInTime.toISOString(),
                isLate,
                lateMinutes,
                method: checkInData.method
            },
            location: checkInData.location,
            orgId: user.orgId,
            status: 'success',
            timestamp: new Date()
        });
        await auditLog.save({ session });
        
        // Commit transaction
        await session.commitTransaction();
        console.log(`[AttendanceService] ✅ MongoDB Transaction: Check-in committed for ${firebaseUid}`);
        
    } catch (error) {
        // Abort transaction on error
        await session.abortTransaction();
        console.error(`[AttendanceService] ❌ MongoDB Transaction: Check-in aborted for ${firebaseUid}:`, error.message);
        throw error;
    } finally {
        session.endSession();
    }
    
    // ✅ ONLY AFTER TRANSACTION SUCCEEDS → Firebase operations (non-transactional)
    try {
        // Update gamification (non-critical, don't fail check-in if this fails)
        await updateGamificationOnCheckIn(firebaseUid, user.orgId, isLate, checkInTime);
        
        // Emit to Firebase
        const realtimePayload = {
            odId: attendance._id.toString(),
            status: 'checkedIn',
            checkInTime: checkInTime.toISOString(),
            isLate
        };
        
        await emitAttendanceStatus(firebaseUid, realtimePayload);
        
        // Update dashboard stats
        await updateAndEmitDashboardStats(user.orgId, dateString);
        
        // Emit admin event
        await emitAdminEvent(user.orgId, 'check_in', {
            userId: firebaseUid,
            userName: user.name,
            isLate,
            time: checkInTime.toISOString()
        });
        
        console.log(`[AttendanceService] ✅ Firebase: Realtime status emitted for ${firebaseUid}`);
    } catch (firebaseError) {
        // Log but don't fail - MongoDB is source of truth
        console.warn(`[AttendanceService] ⚠️ Firebase emit failed (non-critical):`, firebaseError.message);
    }
    
    return attendance;
}

/**
 * MANDATORY CHECK-OUT LOGIC WITH TRANSACTION
 */
export async function checkOut(firebaseUid, checkOutData) {
    await connectMongoDB();
    
    const user = await User.findByFirebaseUid(firebaseUid);
    if (!user) {
        throw new Error('User not found');
    }
    
    // Find the most recent active attendance (not limited to today)
    // This allows checking out from a check-in that started yesterday
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    console.log(`[CheckOut] Looking for active check-in for ${firebaseUid}`);
    
    // First try to find any active check-in (regardless of date)
    let attendance = await Attendance.findOne({
        firebaseUid,
        currentStatus: { $in: ['checkedIn', 'onBreak'] }
    }).sort({ date: -1, shiftNumber: -1, createdAt: -1 });
    
    console.log(`[CheckOut] Found attendance:`, attendance ? {
        id: attendance._id,
        dateString: attendance.dateString,
        status: attendance.currentStatus,
        shiftNumber: attendance.shiftNumber,
        hasCheckIn: !!attendance.checkIn?.timestamp
    } : 'null');
    
    if (!attendance) {
        // Debug: Check what records exist
        const recentRecords = await Attendance.find({ firebaseUid })
            .sort({ date: -1 })
            .limit(5);
        console.log(`[CheckOut] Recent records:`, recentRecords.map(r => ({
            id: r._id,
            dateString: r.dateString,
            status: r.currentStatus,
            shift: r.shiftNumber
        })));
        throw new Error('No active check-in found');
    }
    
    // Validate checkIn data exists
    if (!attendance.checkIn || !attendance.checkIn.timestamp) {
        throw new Error('Invalid attendance record: missing check-in timestamp');
    }
    
    const checkOutTime = new Date();
    const checkInTimestamp = new Date(attendance.checkIn.timestamp);
    
    // Validate checkIn timestamp is valid
    if (isNaN(checkInTimestamp.getTime())) {
        throw new Error('Invalid attendance record: check-in timestamp is invalid');
    }
    
    // Calculate work duration
    const workMs = checkOutTime - checkInTimestamp;
    const totalMinutes = Math.floor(workMs / 60000);
    const breakMinutes = attendance.breakMinutes || 0;
    const actualWorkMinutes = Math.max(0, totalMinutes - breakMinutes); // Ensure non-negative
    
    // Check for early out - use the attendance record's date for scheduled end time
    const scheduledEnd = user.schedule?.endTime || '17:00';
    const [schedHour, schedMin] = scheduledEnd.split(':').map(Number);
    const recordDate = new Date(attendance.date || checkInTimestamp);
    recordDate.setHours(0, 0, 0, 0);
    const scheduledEndTime = new Date(recordDate);
    scheduledEndTime.setHours(schedHour, schedMin, 0, 0);
    
    // If check-out is on a different day than check-in, use check-out day for scheduled end
    const checkOutDay = new Date(checkOutTime);
    checkOutDay.setHours(0, 0, 0, 0);
    if (checkOutDay.getTime() !== recordDate.getTime()) {
        scheduledEndTime.setTime(checkOutDay.getTime());
        scheduledEndTime.setHours(schedHour, schedMin, 0, 0);
    }
    
    const isEarlyOut = checkOutTime < scheduledEndTime;
    const earlyOutMinutes = isEarlyOut ? Math.floor((scheduledEndTime - checkOutTime) / 60000) : 0;
    
    // Calculate overtime
    const overtimeMinutes = !isEarlyOut ? Math.floor((checkOutTime - scheduledEndTime) / 60000) : 0;
    
    // ✅ START MONGODB TRANSACTION
    const session = await mongoose.startSession();
    
    try {
        await session.startTransaction();
        
        // Update attendance within transaction
        attendance.checkOut = {
            timestamp: checkOutTime,
            location: checkOutData.location,
            deviceId: checkOutData.deviceId,
            deviceInfo: checkOutData.deviceInfo,
            method: checkOutData.method || 'manual',
            ipAddress: checkOutData.ipAddress
        };
        attendance.currentStatus = 'checkedOut';
        attendance.scheduledEnd = scheduledEndTime;
        attendance.actualWorkMinutes = actualWorkMinutes;
        attendance.overtimeMinutes = overtimeMinutes;
        attendance.isEarlyOut = isEarlyOut;
        attendance.earlyOutMinutes = earlyOutMinutes;
        
        await attendance.save({ session });
        
        // Log audit event within transaction
        const auditLog = new AuditLog({
            eventType: 'attendance.check_out',
            actorId: firebaseUid,
            actorType: 'user',
            actorEmail: user.email,
            actorIp: checkOutData.ipAddress,
            targetId: attendance._id.toString(),
            targetType: 'attendance',
            action: 'check_out',
            description: `${user.name} checked out`,
            newData: {
                checkOutTime: checkOutTime.toISOString(),
                actualWorkMinutes,
                isEarlyOut
            },
            orgId: user.orgId,
            status: 'success',
            timestamp: new Date()
        });
        await auditLog.save({ session });
        
        // Commit transaction
        await session.commitTransaction();
        console.log(`[AttendanceService] ✅ MongoDB Transaction: Check-out committed for ${firebaseUid}`);
        
    } catch (error) {
        // Abort transaction on error
        await session.abortTransaction();
        console.error(`[AttendanceService] ❌ MongoDB Transaction: Check-out aborted for ${firebaseUid}:`, error.message);
        throw error;
    } finally {
        session.endSession();
    }
    
    // ✅ ONLY AFTER TRANSACTION SUCCEEDS → Firebase operations (non-transactional)
    try {
        const realtimePayload = {
            odId: attendance._id.toString(),
            status: 'checkedOut',
            checkInTime: checkInTimestamp.toISOString(),
            checkOutTime: checkOutTime.toISOString(),
            isLate: attendance.isLate
        };
        
        await emitAttendanceStatus(firebaseUid, realtimePayload);
        
        // Update dashboard stats - use the attendance record's dateString
        await updateAndEmitDashboardStats(user.orgId, attendance.dateString);
        
        // Emit admin event
        await emitAdminEvent(user.orgId, 'check_out', {
            userId: firebaseUid,
            userName: user.name,
            workMinutes: actualWorkMinutes,
            time: checkOutTime.toISOString()
        });
        
        console.log(`[AttendanceService] ✅ Firebase: Realtime status emitted for ${firebaseUid}`);
    } catch (firebaseError) {
        // Log but don't fail - MongoDB is source of truth
        console.warn(`[AttendanceService] ⚠️ Firebase emit failed (non-critical):`, firebaseError.message);
    }
    
    return attendance;
}

/**
 * Start break
 */
export async function startBreak(firebaseUid, breakType = 'short') {
    await connectMongoDB();
    
    const user = await User.findByFirebaseUid(firebaseUid);
    if (!user) throw new Error('User not found');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const attendance = await Attendance.findOne({
        firebaseUid,
        dateString,
        currentStatus: 'checkedIn'
    }).sort({ shiftNumber: -1 });
    
    if (!attendance) {
        throw new Error('No active check-in found');
    }
    
    // Add break
    attendance.breaks.push({
        startTime: new Date(),
        type: breakType
    });
    attendance.currentStatus = 'onBreak';
    
    await attendance.save();
    
    // Emit to Firebase
    await emitAttendanceStatus(firebaseUid, {
        odId: attendance._id.toString(),
        status: 'onBreak',
        checkInTime: attendance.checkIn.timestamp.toISOString()
    });
    
    await updateAndEmitDashboardStats(user.orgId, dateString);
    
    return attendance;
}

/**
 * End break
 */
export async function endBreak(firebaseUid) {
    await connectMongoDB();
    
    const user = await User.findByFirebaseUid(firebaseUid);
    if (!user) throw new Error('User not found');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const attendance = await Attendance.findOne({
        firebaseUid,
        dateString,
        currentStatus: 'onBreak'
    }).sort({ shiftNumber: -1 });
    
    if (!attendance) {
        throw new Error('No active break found');
    }
    
    // End the last break
    const lastBreak = attendance.breaks[attendance.breaks.length - 1];
    if (lastBreak && !lastBreak.endTime) {
        lastBreak.endTime = new Date();
        lastBreak.duration = Math.floor((lastBreak.endTime - lastBreak.startTime) / 60000);
        
        // Update total break minutes
        attendance.breakMinutes = attendance.breaks.reduce((total, b) => total + (b.duration || 0), 0);
    }
    
    attendance.currentStatus = 'checkedIn';
    await attendance.save();
    
    // Emit to Firebase
    await emitAttendanceStatus(firebaseUid, {
        odId: attendance._id.toString(),
        status: 'checkedIn',
        checkInTime: attendance.checkIn.timestamp.toISOString()
    });
    
    await updateAndEmitDashboardStats(user.orgId, dateString);
    
    return attendance;
}

/**
 * Get today's attendance for user
 */
export async function getTodayAttendance(firebaseUid) {
    await connectMongoDB();
    return Attendance.findTodayByUser(firebaseUid);
}

/**
 * Get attendance history
 */
export async function getAttendanceHistory(firebaseUid, startDate, endDate, options = {}) {
    await connectMongoDB();
    
    const query = { firebaseUid };
    
    if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
    }
    
    let queryBuilder = Attendance.find(query).sort({ date: -1 });
    
    if (options.limit) {
        queryBuilder = queryBuilder.limit(options.limit);
    }
    
    if (options.skip) {
        queryBuilder = queryBuilder.skip(options.skip);
    }
    
    return queryBuilder.exec();
}

/**
 * Get organization attendance for a date
 */
export async function getOrgAttendance(orgId, dateString, options = {}) {
    await connectMongoDB();
    
    const query = { orgId, dateString };
    
    if (options.department) {
        query.department = options.department;
    }
    
    if (options.status) {
        query.currentStatus = options.status;
    }
    
    return Attendance.find(query)
        .populate('userId', 'name email profilePhoto')
        .sort({ 'checkIn.timestamp': -1 })
        .exec();
}

/**
 * Manual attendance entry (admin)
 */
export async function createManualEntry(adminId, targetFirebaseUid, entryData) {
    await connectMongoDB();
    
    const user = await User.findByFirebaseUid(targetFirebaseUid);
    if (!user) throw new Error('User not found');
    
    const date = new Date(entryData.date);
    date.setHours(0, 0, 0, 0);
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    const attendance = new Attendance({
        userId: user._id,
        firebaseUid: targetFirebaseUid,
        orgId: user.orgId,
        department: user.department,
        date,
        dateString,
        shiftNumber: 1,
        checkIn: {
            timestamp: new Date(entryData.checkInTime),
            method: 'manual',
            verificationData: {
                adminId,
                reason: entryData.reason
            }
        },
        checkOut: entryData.checkOutTime ? {
            timestamp: new Date(entryData.checkOutTime),
            method: 'manual'
        } : undefined,
        currentStatus: entryData.checkOutTime ? 'checkedOut' : 'checkedIn',
        isManualEntry: true,
        notes: entryData.notes,
        adminNotes: entryData.adminNotes
    });
    
    await attendance.save();
    
    // Log audit
    await AuditLog.logEvent({
        eventType: 'attendance.manual_entry',
        actorId: adminId,
        actorType: 'admin',
        targetId: attendance._id.toString(),
        targetType: 'attendance',
        targetEmail: user.email,
        action: 'manual_entry',
        description: `Manual attendance entry created for ${user.name}`,
        newData: entryData,
        orgId: user.orgId,
        severity: 'medium'
    });
    
    return attendance;
}

/**
 * Update and emit dashboard stats
 */
async function updateAndEmitDashboardStats(orgId, dateString) {
    const stats = await Attendance.getOrgDailyStats(orgId, dateString);
    
    const statsMap = {
        totalPresent: 0,
        totalAbsent: 0,
        totalLate: 0,
        totalOnLeave: 0,
        totalOnBreak: 0
    };
    
    for (const stat of stats) {
        switch (stat._id) {
            case 'checkedIn':
                statsMap.totalPresent += stat.count;
                break;
            case 'checkedOut':
                statsMap.totalPresent += stat.count;
                break;
            case 'onBreak':
                statsMap.totalOnBreak = stat.count;
                statsMap.totalPresent += stat.count;
                break;
            case 'leave':
                statsMap.totalOnLeave = stat.count;
                break;
            case 'absent':
                statsMap.totalAbsent = stat.count;
                break;
        }
    }
    
    // Get late count
    const lateCount = await Attendance.countDocuments({ orgId, dateString, isLate: true });
    statsMap.totalLate = lateCount;
    
    await emitDashboardStats(orgId, statsMap);
}

/**
 * Update gamification on check-in
 */
async function updateGamificationOnCheckIn(firebaseUid, orgId, isLate, checkInTime) {
    try {
        let gamification = await Gamification.findByFirebaseUid(firebaseUid);
        
        if (!gamification) {
            const user = await User.findByFirebaseUid(firebaseUid);
            gamification = new Gamification({
                userId: user._id,
                firebaseUid,
                orgId,
                department: user.department
            });
        }
        
        // Update streak
        gamification.updateStreak(checkInTime);
        
        // Add points
        const points = isLate ? 5 : 10; // Less points if late
        gamification.addPoints(points, isLate ? 'Check-in (late)' : 'On-time check-in');
        
        // Update punctuality stats
        gamification.totalCheckIns += 1;
        if (isLate) {
            gamification.lateCount += 1;
        } else {
            gamification.onTimeCount += 1;
        }
        
        // Check for streak badges
        if (gamification.currentStreak === 5) {
            gamification.awardBadge({
                badgeId: 'streak_5',
                name: '5-Day Streak',
                description: 'Checked in 5 days in a row',
                icon: '🔥',
                category: 'streak'
            });
        } else if (gamification.currentStreak === 30) {
            gamification.awardBadge({
                badgeId: 'streak_30',
                name: 'Monthly Champion',
                description: 'Checked in 30 days in a row',
                icon: '🏆',
                category: 'streak'
            });
        }
        
        await gamification.save();
    } catch (error) {
        console.error('[AttendanceService] Gamification update failed:', error.message);
        // Don't throw - gamification is secondary to attendance
    }
}

export default {
    checkIn,
    checkOut,
    startBreak,
    endBreak,
    getTodayAttendance,
    getAttendanceHistory,
    getOrgAttendance,
    createManualEntry
};
