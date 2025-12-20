// src/lib/services/attendanceRules.js
// Automated Attendance Rules Engine

import { db, ref, get, set, update } from '$lib/firebase';

// Default schedule configuration
export const DEFAULT_SCHEDULE = {
    workDays: [1, 2, 3, 4, 5], // Monday to Friday
    startTime: '08:00',
    endTime: '17:00',
    gracePeriod: 15, // minutes
    lateThreshold: 30, // minutes after start time = late
    halfDayThreshold: 4, // hours = half day
    fullDayThreshold: 8, // hours = full day
    breakDuration: 60, // minutes allowed for break
    autoAbsentTime: '10:00' // If not checked in by this time, mark absent
};

// Cache for system settings
let cachedSystemSettings = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60000; // 1 minute cache

// Fetch system settings from database
async function getSystemSettings() {
    const now = Date.now();
    if (cachedSystemSettings && (now - cacheTimestamp) < CACHE_DURATION) {
        return cachedSystemSettings;
    }
    
    try {
        const settingsRef = ref(db, 'systemSettings/attendance');
        const snapshot = await get(settingsRef);
        if (snapshot.exists()) {
            cachedSystemSettings = { ...DEFAULT_SCHEDULE, ...snapshot.val() };
            cacheTimestamp = now;
            return cachedSystemSettings;
        }
    } catch (error) {
        console.error('Error fetching system settings:', error);
    }
    return DEFAULT_SCHEDULE;
}

// Get schedule for a user (can be customized per department/user)
export async function getSchedule(userId) {
    try {
        // First get system-wide settings
        const systemSettings = await getSystemSettings();
        
        // Check for user-specific schedule
        const userScheduleRef = ref(db, `schedules/users/${userId}`);
        const userSnapshot = await get(userScheduleRef);
        if (userSnapshot.exists()) {
            return { ...systemSettings, ...userSnapshot.val() };
        }
        
        // Check for department schedule
        const userRef = ref(db, `users/${userId}`);
        const userSnapshot2 = await get(userRef);
        if (userSnapshot2.exists()) {
            const user = userSnapshot2.val();
            if (user.department) {
                const deptScheduleRef = ref(db, `schedules/departments/${user.department}`);
                const deptSnapshot = await get(deptScheduleRef);
                if (deptSnapshot.exists()) {
                    return { ...systemSettings, ...deptSnapshot.val() };
                }
            }
        }
        
        // Return system settings (merged with defaults)
        return systemSettings;
    } catch (error) {
        console.error('Error getting schedule:', error);
        return DEFAULT_SCHEDULE;
    }
}

// Determine attendance status based on check-in time
export function determineStatus(checkInTime, schedule = DEFAULT_SCHEDULE) {
    const checkIn = new Date(checkInTime);
    const [startHour, startMin] = schedule.startTime.split(':').map(Number);
    
    const scheduledStart = new Date(checkIn);
    scheduledStart.setHours(startHour, startMin, 0, 0);
    
    const graceEnd = new Date(scheduledStart.getTime() + schedule.gracePeriod * 60000);
    const lateThreshold = new Date(scheduledStart.getTime() + schedule.lateThreshold * 60000);
    
    if (checkIn <= graceEnd) {
        return { status: 'present', message: 'On time' };
    } else if (checkIn <= lateThreshold) {
        return { status: 'late', message: 'Late (within grace period)', minutesLate: Math.round((checkIn - scheduledStart) / 60000) };
    } else {
        const minutesLate = Math.round((checkIn - scheduledStart) / 60000);
        return { status: 'late', message: `Late by ${minutesLate} minutes`, minutesLate };
    }
}

// Calculate work duration and determine if early out
export function calculateWorkDuration(checkIn, checkOut, breakMinutes = 0, schedule = DEFAULT_SCHEDULE) {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const totalMinutes = Math.round((end - start) / 60000) - breakMinutes;
    const hours = totalMinutes / 60;
    
    const [endHour, endMin] = schedule.endTime.split(':').map(Number);
    const scheduledEnd = new Date(end);
    scheduledEnd.setHours(endHour, endMin, 0, 0);
    
    let status = 'completed';
    let message = 'Full day completed';
    
    if (end < scheduledEnd) {
        const earlyMinutes = Math.round((scheduledEnd - end) / 60000);
        if (earlyMinutes > 30) {
            status = 'early_out';
            message = `Left ${earlyMinutes} minutes early`;
        }
    }
    
    if (hours < schedule.halfDayThreshold) {
        status = 'half_day';
        message = 'Less than half day';
    }
    
    return {
        totalMinutes,
        hours: Math.round(hours * 100) / 100,
        status,
        message
    };
}

// Check if today is a work day
export function isWorkDay(date = new Date(), schedule = DEFAULT_SCHEDULE) {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    return schedule.workDays.includes(dayOfWeek);
}

// Process attendance record with rules
export async function processAttendanceRecord(userId, record, schedule = null) {
    if (!schedule) {
        schedule = await getSchedule(userId);
    }
    
    const processed = { ...record };
    
    // Determine check-in status
    if (record.checkIn?.timestamp) {
        const checkInStatus = determineStatus(record.checkIn.timestamp, schedule);
        processed.checkInStatus = checkInStatus;
        processed.status = checkInStatus.status;
    }
    
    // Calculate duration if checked out
    if (record.checkIn?.timestamp && record.checkOut?.timestamp) {
        const breakMinutes = record.breakDuration || 0;
        const duration = calculateWorkDuration(
            record.checkIn.timestamp,
            record.checkOut.timestamp,
            breakMinutes,
            schedule
        );
        processed.duration = duration;
        processed.workHours = duration.hours;
        
        // Update final status based on duration
        if (duration.status === 'early_out' || duration.status === 'half_day') {
            processed.finalStatus = duration.status;
        } else {
            processed.finalStatus = processed.status;
        }
    }
    
    return processed;
}

// Mark user as absent (called by scheduled job or admin)
export async function markAbsent(userId, date = new Date()) {
    const dateStr = date.toDateString();
    const attendanceRef = ref(db, `attendance/${userId}`);
    
    // Check if already has a record for today
    const snapshot = await get(attendanceRef);
    if (snapshot.exists()) {
        let hasRecord = false;
        snapshot.forEach(child => {
            if (child.val().date === dateStr) {
                hasRecord = true;
            }
        });
        if (hasRecord) return { success: false, message: 'Already has attendance record' };
    }
    
    // Create absent record
    const absentRecord = {
        date: dateStr,
        status: 'absent',
        currentStatus: 'absent',
        markedAt: new Date().toISOString(),
        markedBy: 'system',
        reason: 'No check-in recorded'
    };
    
    const newRef = ref(db, `attendance/${userId}/${Date.now()}`);
    await set(newRef, absentRecord);
    
    return { success: true, message: 'Marked as absent' };
}

// Get attendance summary for a user
export async function getAttendanceSummary(userId, startDate, endDate) {
    const snapshot = await get(ref(db, `attendance/${userId}`));
    if (!snapshot.exists()) return { present: 0, late: 0, absent: 0, earlyOut: 0, totalHours: 0 };
    
    const summary = { present: 0, late: 0, absent: 0, earlyOut: 0, halfDay: 0, totalHours: 0, records: [] };
    
    snapshot.forEach(child => {
        const record = child.val();
        const recordDate = new Date(record.date);
        
        if (recordDate >= startDate && recordDate <= endDate) {
            summary.records.push(record);
            
            if (record.status === 'absent') summary.absent++;
            else if (record.status === 'late') summary.late++;
            else if (record.status === 'present' || record.currentStatus === 'checkedIn' || record.currentStatus === 'checkedOut') summary.present++;
            
            if (record.finalStatus === 'early_out') summary.earlyOut++;
            if (record.finalStatus === 'half_day') summary.halfDay++;
            
            if (record.workHours) summary.totalHours += record.workHours;
        }
    });
    
    return summary;
}

// Validate check-in time against schedule
export function validateCheckInTime(schedule = DEFAULT_SCHEDULE) {
    const now = new Date();
    const [autoAbsentHour, autoAbsentMin] = schedule.autoAbsentTime.split(':').map(Number);
    
    const autoAbsentTime = new Date(now);
    autoAbsentTime.setHours(autoAbsentHour, autoAbsentMin, 0, 0);
    
    if (now > autoAbsentTime) {
        return {
            allowed: true,
            warning: true,
            message: 'You are checking in very late. This will be flagged for review.'
        };
    }
    
    return { allowed: true, warning: false };
}
