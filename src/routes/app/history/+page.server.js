// src/routes/app/history/+page.server.js
// ✅ UPDATED: Fetch from MongoDB (Single Source of Truth)
// ❌ Firebase is no longer used for historical attendance data

import { adminAuth } from '$lib/server/firebase-admin';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import { Attendance } from '$lib/server/mongodb/schemas/Attendance.js';

export async function load({ cookies }) {
    // If Firebase Admin is not configured for auth, return empty
    if (!adminAuth) {
        return { records: [] };
    }

    const sessionCookie = cookies.get('session');
    
    if (!sessionCookie) {
        return { records: [] };
    }

    try {
        // Verify session with Firebase Auth
        const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
        const userId = decodedClaims.uid;
        
        // ✅ Connect to MongoDB and fetch attendance records
        await connectMongoDB();
        
        const mongoRecords = await Attendance.find({ firebaseUid: userId })
            .sort({ date: -1 })
            .limit(500)
            .lean();
        
        // Transform MongoDB records to match expected format
        const records = mongoRecords.map(record => ({
            shiftId: record._id.toString(),
            date: record.date ? record.date.toDateString() : record.dateString,
            dateString: record.dateString,
            currentStatus: record.currentStatus,
            checkIn: record.checkIn ? {
                timestamp: record.checkIn.timestamp?.toISOString?.() || record.checkIn.timestamp,
                capturedImage: record.checkIn.photo || null,
                device: record.checkIn.deviceInfo ? {
                    browser: record.checkIn.deviceInfo.browser || record.checkIn.deviceInfo.platform,
                    deviceType: record.checkIn.deviceInfo.platform || 'Unknown',
                    ...record.checkIn.deviceInfo
                } : null,
                location: record.checkIn.location ? {
                    name: record.checkIn.location.name || record.checkIn.location.address || 
                          (record.checkIn.location.latitude ? `${record.checkIn.location.latitude.toFixed(4)}, ${record.checkIn.location.longitude.toFixed(4)}` : null),
                    ...record.checkIn.location
                } : null
            } : null,
            breakStart: record.breaks?.[0] ? {
                timestamp: record.breaks[0].startTime?.toISOString?.() || record.breaks[0].startTime
            } : null,
            breakEnd: record.breaks?.[0]?.endTime ? {
                timestamp: record.breaks[0].endTime?.toISOString?.() || record.breaks[0].endTime
            } : null,
            checkOut: record.checkOut ? {
                timestamp: record.checkOut.timestamp?.toISOString?.() || record.checkOut.timestamp,
                capturedImage: record.checkOut.photo || null,
                device: record.checkOut.deviceInfo ? {
                    browser: record.checkOut.deviceInfo.browser || record.checkOut.deviceInfo.platform,
                    deviceType: record.checkOut.deviceInfo.platform || 'Unknown',
                    ...record.checkOut.deviceInfo
                } : null,
                location: record.checkOut.location ? {
                    name: record.checkOut.location.name || record.checkOut.location.address,
                    ...record.checkOut.location
                } : null
            } : null,
            manualCorrection: record.isManualEntry || false,
            correctedBy: record.editHistory?.[0]?.editedBy || null,
            isLate: record.isLate || false,
            lateMinutes: record.lateMinutes || 0,
            actualWorkMinutes: record.actualWorkMinutes || 0
        }));

        return { records };
    } catch (error) {
        console.error('Error loading attendance history:', error);
        return { records: [] };
    }
}
