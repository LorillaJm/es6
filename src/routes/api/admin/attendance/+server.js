// src/routes/api/admin/attendance/+server.js
// ✅ UPDATED: Now reads from MongoDB (source of truth)
import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, logAuditEvent, PERMISSIONS } from '$lib/server/adminAuth.js';
import { adminDb } from '$lib/server/firebase-admin.js';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import { Attendance } from '$lib/server/mongodb/schemas/Attendance.js';
import { User } from '$lib/server/mongodb/schemas/User.js';

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
        
        await connectMongoDB();
        
        // Create attendance record in MongoDB
        const record = new Attendance({
            firebaseUid: userId,
            orgId: 'org_default',
            dateString: date,
            currentStatus: status || 'checkedOut',
            isManualEntry: true,
            createdBy: admin.id
        });
        
        if (checkIn) {
            record.checkIn = {
                timestamp: new Date(`${date}T${checkIn}`),
                method: 'manual'
            };
        }
        
        if (checkOut) {
            record.checkOut = {
                timestamp: new Date(`${date}T${checkOut}`),
                method: 'manual'
            };
        }
        
        if (notes) {
            record.notes = notes;
        }
        
        await record.save();
        
        await logAuditEvent({
            action: 'ATTENDANCE_MANUAL_CREATED',
            adminId: admin.id,
            targetId: userId,
            details: { date, recordId: record._id.toString() }
        });
        
        return json({ success: true, recordId: record._id.toString() });
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
        
        await connectMongoDB();
        
        // Fetch attendance settings from system settings
        const attendanceSettings = await getAttendanceSettings();
        
        // Build MongoDB query
        const query = {
            orgId: 'org_default'
        };
        
        // Filter by date if specified
        if (filterDate) {
            query.dateString = filterDate;
        }
        
        // Filter by userId if specified
        if (userId) {
            query.firebaseUid = userId;
        }
        
        // Fetch attendance records from MongoDB
        const attendanceRecords = await Attendance.find(query)
            .sort({ 'checkIn.timestamp': -1 })
            .lean();
        
        // Get all unique firebaseUids to fetch user info
        const firebaseUids = [...new Set(attendanceRecords.map(r => r.firebaseUid))];
        
        // Fetch user info from MongoDB
        const users = await User.find({ firebaseUid: { $in: firebaseUids } }).lean();
        const userMap = {};
        users.forEach(u => {
            userMap[u.firebaseUid] = u;
        });
        
        // Also try to get user info from Firebase for any missing users
        if (adminDb) {
            try {
                const usersSnapshot = await adminDb.ref('users').once('value');
                const firebaseUsers = usersSnapshot.exists() ? usersSnapshot.val() : {};
                
                // Merge Firebase user data for any users not in MongoDB
                firebaseUids.forEach(uid => {
                    if (!userMap[uid] && firebaseUsers[uid]) {
                        userMap[uid] = firebaseUsers[uid];
                    }
                });
            } catch (e) {
                console.error('Error fetching Firebase users:', e);
            }
        }
        
        // Transform records for frontend
        const attendance = attendanceRecords.map(record => {
            const user = userMap[record.firebaseUid] || {};
            
            // Get check-in/check-out timestamps
            const checkInTimestamp = record.checkIn?.timestamp;
            const checkOutTimestamp = record.checkOut?.timestamp;
            
            // Determine display status
            const displayStatus = determineDisplayStatus(record, checkInTimestamp, attendanceSettings);
            
            return {
                id: record._id.toString(),
                odId: record._id.toString(),
                date: record.dateString,
                userId: record.firebaseUid,
                userName: user.name || user.displayName || record.userName || 'Unknown User',
                userEmail: user.email,
                department: user.department || user.departmentOrCourse || record.department,
                checkIn: checkInTimestamp ? new Date(checkInTimestamp).toISOString() : null,
                checkOut: checkOutTimestamp ? new Date(checkOutTimestamp).toISOString() : null,
                status: displayStatus,
                rawStatus: record.currentStatus,
                duration: calculateDuration(checkInTimestamp, checkOutTimestamp),
                location: formatLocation(record.checkIn?.location),
                method: record.checkIn?.method || 'qr'
            };
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

// Helper to format location - ensures it's always a string
function formatLocation(location) {
    if (!location) return null;
    if (typeof location === 'string') return location;
    if (typeof location === 'object') {
        // Check for name field first (sent by frontend)
        if (location.name && typeof location.name === 'string') return location.name;
        // Then check for address field
        if (location.address && typeof location.address === 'string') return location.address;
        // Then check for label
        if (location.label && typeof location.label === 'string') return location.label;
        // Fallback to coordinates - show both lat and lng
        const lat = location.latitude ?? location.lat;
        const lng = location.longitude ?? location.lng;
        if (lat != null && lng != null) {
            return `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
        }
        // If only one coordinate exists, don't show partial data
        return null;
    }
    return null;
}

// Determine display status for admin panel (includes late detection)
function determineDisplayStatus(record, checkInTimestamp, attendanceSettings = null) {
    // If explicitly marked as late, use that
    if (record.isLate === true) return 'late';
    if (record.status === 'late' || record.status === 'absent') return record.status;
    
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
    
    try {
        const checkInTime = new Date(checkInTimestamp);
        
        if (!isNaN(checkInTime.getTime())) {
            const checkInMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
            const startMinutes = startHour * 60 + startMin;
            const graceEndMinutes = startMinutes + gracePeriod;
            
            // Late if after grace period
            if (checkInMinutes > graceEndMinutes) {
                return 'late';
            }
        }
    } catch (e) {
        console.error('Error parsing check-in time:', e);
    }
    
    // Default to present
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
