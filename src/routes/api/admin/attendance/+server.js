// src/routes/api/admin/attendance/+server.js
import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, logAuditEvent, PERMISSIONS } from '$lib/server/adminAuth.js';
import { adminDb } from '$lib/server/firebase-admin.js';

// Helper to get system settings for attendance rules
async function getAttendanceSettings() {
    const defaults = {
        startTime: '08:00',
        endTime: '17:00',
        gracePeriod: 15,
        lateThreshold: 15,
        workDays: [1, 2, 3, 4, 5]
    };
    
    if (!adminDb) return defaults;
    
    try {
        const snapshot = await adminDb.ref('systemSettings/attendance').once('value');
        if (snapshot.exists()) {
            return { ...defaults, ...snapshot.val() };
        }
    } catch (error) {
        console.error('Error fetching attendance settings:', error);
    }
    return defaults;
}

// Create manual attendance record
export async function POST({ request }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const admin = await verifyAccessToken(authHeader.substring(7));
        if (!admin || !checkPermission(admin, PERMISSIONS.EDIT_LOGS)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }
        
        const { userId, date, checkIn, checkOut, status, notes } = await request.json();
        
        if (!userId || !date) {
            return json({ error: 'User ID and date are required' }, { status: 400 });
        }
        
        if (!adminDb) return json({ error: 'Database not available' }, { status: 500 });
        
        // Create attendance record
        const recordId = Date.now().toString();
        const record = {
            date: new Date(date).toDateString(),
            currentStatus: status || 'checkedOut',
            manualEntry: true,
            createdBy: admin.id,
            createdAt: new Date().toISOString()
        };
        
        if (checkIn) {
            record.checkIn = {
                timestamp: new Date(`${date}T${checkIn}`).toISOString(),
                manual: true,
                addedBy: admin.id
            };
        }
        
        if (checkOut) {
            record.checkOut = {
                timestamp: new Date(`${date}T${checkOut}`).toISOString(),
                manual: true,
                addedBy: admin.id
            };
        }
        
        if (notes) {
            record.adminNotes = notes;
        }
        
        await adminDb.ref(`attendance/${userId}/${recordId}`).set(record);
        
        await logAuditEvent({
            action: 'ATTENDANCE_MANUAL_CREATED',
            adminId: admin.id,
            targetId: userId,
            details: { date, recordId }
        });
        
        return json({ success: true, recordId });
    } catch (error) {
        console.error('Create attendance error:', error);
        return json({ error: 'Failed to create record' }, { status: 500 });
    }
}

export async function GET({ request, url }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const admin = await verifyAccessToken(authHeader.substring(7));
        if (!admin || !checkPermission(admin, PERMISSIONS.VIEW_ATTENDANCE)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }
        
        // Get date filter - empty string means show all dates
        const dateParam = url.searchParams.get('date');
        const filterDate = dateParam && dateParam.trim() !== '' ? dateParam : null;
        const userId = url.searchParams.get('userId');
        
        if (!adminDb) {
            return json({ attendance: [], message: 'Database not configured' });
        }
        
        // Fetch attendance settings from system settings
        const attendanceSettings = await getAttendanceSettings();
        
        // Get users for name lookup
        const usersSnapshot = await adminDb.ref('users').once('value');
        const users = usersSnapshot.exists() ? usersSnapshot.val() : {};
        
        const attendance = [];
        
        // Structure: /attendance/{uid}/{recordId} with date field
        const attendanceSnapshot = await adminDb.ref('attendance').once('value');
        
        if (attendanceSnapshot.exists()) {
            const allAttendance = attendanceSnapshot.val();
            
            // Iterate through each user's attendance
            for (const [uid, userAttendance] of Object.entries(allAttendance)) {
                if (typeof userAttendance !== 'object' || !userAttendance) continue;
                
                // Filter by userId if specified
                if (userId && uid !== userId) continue;
                
                const user = users[uid] || {};
                
                // Each user can have multiple attendance records
                for (const [recordId, record] of Object.entries(userAttendance)) {
                    if (typeof record !== 'object' || !record) continue;
                    
                    // Parse record date from various formats
                    let recordDate = null;
                    let recordDateISO = null;
                    
                    if (record.date) {
                        // Handle "Thu Dec 12 2024" format or ISO format
                        const parsedDate = new Date(record.date);
                        if (!isNaN(parsedDate.getTime())) {
                            recordDateISO = parsedDate.toISOString().split('T')[0];
                            recordDate = record.date;
                        }
                    }
                    
                    // Fallback to checkIn timestamp
                    if (!recordDateISO && record.checkIn?.timestamp) {
                        const parsedDate = new Date(record.checkIn.timestamp);
                        if (!isNaN(parsedDate.getTime())) {
                            recordDateISO = parsedDate.toISOString().split('T')[0];
                        }
                    } else if (!recordDateISO && typeof record.checkIn === 'string') {
                        const parsedDate = new Date(record.checkIn);
                        if (!isNaN(parsedDate.getTime())) {
                            recordDateISO = parsedDate.toISOString().split('T')[0];
                        }
                    }
                    
                    // Fallback to timestamp field
                    if (!recordDateISO && record.timestamp) {
                        const parsedDate = new Date(record.timestamp);
                        if (!isNaN(parsedDate.getTime())) {
                            recordDateISO = parsedDate.toISOString().split('T')[0];
                        }
                    }
                    
                    // Date filtering logic:
                    // - If no filterDate, include all records
                    // - If filterDate specified, match against recordDateISO
                    const shouldInclude = !filterDate || recordDateISO === filterDate;
                    
                    if (shouldInclude) {
                        // Extract checkIn/checkOut - handle nested object or direct timestamp
                        const checkInData = record.checkIn?.timestamp || record.checkIn || record.checkInTime || record.timeIn || record.timestamp;
                        const checkOutData = record.checkOut?.timestamp || record.checkOut || record.checkOutTime || record.timeOut;
                        const locationData = record.checkIn?.location || record.location;
                        
                        // Determine display status (late detection based on check-in time)
                        const displayStatus = determineDisplayStatus(record, checkInData, attendanceSettings);
                        
                        attendance.push({
                            id: `${uid}_${recordId}`,
                            odId: recordId,
                            date: recordDateISO || filterDate || new Date().toISOString().split('T')[0],
                            userId: uid,
                            userName: user.name || user.displayName || record.userName || 'Unknown User',
                            userEmail: user.email,
                            department: user.department || user.departmentOrCourse || record.department,
                            checkIn: checkInData,
                            checkOut: checkOutData,
                            status: displayStatus,
                            rawStatus: record.currentStatus, // Keep original for reference
                            duration: calculateDuration(checkInData, checkOutData),
                            location: locationData?.name || locationData,
                            method: record.method || record.type || 'qr'
                        });
                    }
                }
            }
        }
        
        // Sort by check-in time (most recent first)
        attendance.sort((a, b) => {
            if (!a.checkIn) return 1;
            if (!b.checkIn) return -1;
            return new Date(b.checkIn) - new Date(a.checkIn);
        });
        
        // Calculate stats based on display status
        const stats = {
            total: attendance.length,
            present: attendance.filter(a => a.status === 'present').length,
            late: attendance.filter(a => a.status === 'late').length,
            absent: attendance.filter(a => a.status === 'absent').length
        };
        
        return json({ attendance, date: filterDate, stats });
    } catch (error) {
        console.error('Get attendance error:', error);
        return json({ error: 'Failed to fetch attendance', details: error.message }, { status: 500 });
    }
}

// Determine display status for admin panel (includes late detection)
// Uses system settings for startTime, gracePeriod, and lateThreshold
function determineDisplayStatus(record, checkInTimestamp, attendanceSettings = null) {
    // If explicitly marked as late or absent, use that
    if (record.status === 'late' || record.status === 'absent') return record.status;
    if (record.isLate === true) return 'late';
    
    // No check-in means absent
    if (!checkInTimestamp) return 'absent';
    
    // Use system settings or defaults
    const settings = attendanceSettings || {
        startTime: '08:00',
        gracePeriod: 15,
        lateThreshold: 15
    };
    
    // Parse start time from settings
    const [startHour, startMin] = settings.startTime.split(':').map(Number);
    const gracePeriod = settings.gracePeriod || 15;
    const lateThreshold = settings.lateThreshold || 15;
    
    try {
        // Handle both ISO string and timestamp object
        let checkInTime;
        if (typeof checkInTimestamp === 'object' && checkInTimestamp.timestamp) {
            checkInTime = new Date(checkInTimestamp.timestamp);
        } else {
            checkInTime = new Date(checkInTimestamp);
        }
        
        if (!isNaN(checkInTime.getTime())) {
            const checkInMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
            const startMinutes = startHour * 60 + startMin;
            const graceEndMinutes = startMinutes + gracePeriod;
            const lateThresholdMinutes = startMinutes + lateThreshold;
            
            // On time if within grace period
            if (checkInMinutes <= graceEndMinutes) {
                return 'present';
            }
            
            // Late if after grace period
            if (checkInMinutes > graceEndMinutes) {
                return 'late';
            }
        }
    } catch (e) {
        console.error('Error parsing check-in time:', e);
    }
    
    // Default to present if can't determine
    return 'present';
}

function calculateDuration(checkIn, checkOut) {
    if (!checkIn || !checkOut) return '-';
    try {
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        const diff = Math.abs(end - start);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    } catch {
        return '-';
    }
}
