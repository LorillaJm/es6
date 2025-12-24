// src/routes/api/attendance/break/+server.js
// Break Management API
// ✅ STRICT DATA FLOW: Frontend → Backend → MongoDB → Firebase → Clients

import { json } from '@sveltejs/kit';
import { adminAuth } from '$lib/server/firebase-admin.js';
import { startBreak, endBreak } from '$lib/server/mongodb/services/attendanceService.js';

export async function POST({ request }) {
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
        const body = await request.json();
        const action = body.action; // 'start' or 'end'
        const breakType = body.breakType || 'short';
        
        let attendance;
        
        if (action === 'start') {
            attendance = await startBreak(firebaseUid, breakType);
        } else if (action === 'end') {
            attendance = await endBreak(firebaseUid);
        } else {
            return json({ success: false, error: 'Invalid action' }, { status: 400 });
        }
        
        return json({
            success: true,
            data: {
                id: attendance._id.toString(),
                status: attendance.currentStatus,
                breakMinutes: attendance.breakMinutes || 0
            }
        });
        
    } catch (error) {
        console.error('[API] Break error:', error);
        
        if (error.message.includes('No active')) {
            return json({ success: false, error: error.message }, { status: 409 });
        }
        
        return json({ 
            success: false, 
            error: 'Break action failed' 
        }, { status: 500 });
    }
}
