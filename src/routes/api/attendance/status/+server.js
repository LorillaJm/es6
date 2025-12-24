// src/routes/api/attendance/status/+server.js
// Get Current Attendance Status
// ✅ Reads from MongoDB (source of truth)

import { json } from '@sveltejs/kit';
import { adminAuth } from '$lib/server/firebase-admin.js';
import { getTodayAttendance } from '$lib/server/mongodb/services/attendanceService.js';

export async function GET({ request }) {
    try {
        // Validate authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        
        const token = authHeader.split('Bearer ')[1];
        
        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(token);
        } catch (authError) {
            return json({ success: false, error: 'Invalid token' }, { status: 401 });
        }
        
        const firebaseUid = decodedToken.uid;
        
        // Get today's attendance from MongoDB
        const attendance = await getTodayAttendance(firebaseUid);
        
        if (!attendance) {
            return json({
                success: true,
                data: {
                    status: 'none',
                    checkedIn: false
                }
            });
        }
        
        return json({
            success: true,
            data: {
                id: attendance._id.toString(),
                status: attendance.currentStatus,
                checkedIn: ['checkedIn', 'onBreak'].includes(attendance.currentStatus),
                checkInTime: attendance.checkIn?.timestamp?.toISOString(),
                checkOutTime: attendance.checkOut?.timestamp?.toISOString(),
                isLate: attendance.isLate,
                lateMinutes: attendance.lateMinutes || 0,
                breakMinutes: attendance.breakMinutes || 0
            }
        });
        
    } catch (error) {
        console.error('[API] Status error:', error);
        return json({ 
            success: false, 
            error: 'Failed to get status' 
        }, { status: 500 });
    }
}
