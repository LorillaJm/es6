// src/routes/api/admin/attendance/overview/+server.js
// Admin Attendance Overview API
// ✅ Reads from MongoDB (source of truth)

import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, PERMISSIONS } from '$lib/server/adminAuth.js';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import { Attendance } from '$lib/server/mongodb/schemas/Attendance.js';
import { User } from '$lib/server/mongodb/schemas/User.js';

export async function GET({ request, url }) {
    try {
        // Validate admin authentication using admin access token
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];

        // Use verifyAccessToken (admin's custom token system)
        const admin = await verifyAccessToken(token);
        if (!admin) {
            return json({ success: false, error: 'Invalid token' }, { status: 401 });
        }

        // Check permission
        if (!checkPermission(admin, PERMISSIONS.VIEW_ATTENDANCE)) {
            return json({ success: false, error: 'Permission denied' }, { status: 403 });
        }

        await connectMongoDB();

        // Parse query parameters
        const dateString = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
        const department = url.searchParams.get('department');
        const orgId = url.searchParams.get('orgId') || 'org_default';

        // Build query
        const query = {
            orgId,
            dateString
        };

        if (department) {
            query.department = department;
        }

        // Get attendance records
        const attendanceRecords = await Attendance.find(query)
            .populate('userId', 'name email profilePhoto department position')
            .sort({ 'checkIn.timestamp': -1 });

        // Get total user count for the org
        const totalUsers = await User.countDocuments({
            orgId,
            status: 'active',
            ...(department ? { department } : {})
        });

        // Calculate statistics
        const stats = {
            totalUsers,
            present: 0,
            absent: 0,
            late: 0,
            onBreak: 0,
            checkedOut: 0
        };

        const presentUserIds = new Set();

        for (const record of attendanceRecords) {
            presentUserIds.add(record.firebaseUid);

            if (record.isLate) stats.late++;

            switch (record.currentStatus) {
                case 'checkedIn':
                    stats.present++;
                    break;
                case 'onBreak':
                    stats.onBreak++;
                    stats.present++;
                    break;
                case 'checkedOut':
                    stats.checkedOut++;
                    stats.present++;
                    break;
            }
        }

        stats.absent = totalUsers - presentUserIds.size;

        return json({
            success: true,
            data: {
                date: dateString,
                stats,
                records: attendanceRecords.map(record => ({
                    id: record._id.toString(),
                    user: record.userId ? {
                        id: record.userId._id.toString(),
                        name: record.userId.name,
                        email: record.userId.email,
                        profilePhoto: record.userId.profilePhoto,
                        department: record.userId.department,
                        position: record.userId.position
                    } : null,
                    firebaseUid: record.firebaseUid,
                    status: record.currentStatus,
                    checkInTime: record.checkIn?.timestamp?.toISOString(),
                    checkOutTime: record.checkOut?.timestamp?.toISOString(),
                    isLate: record.isLate,
                    lateMinutes: record.lateMinutes || 0,
                    actualWorkMinutes: record.actualWorkMinutes || 0,
                    isManualEntry: record.isManualEntry
                }))
            }
        });

    } catch (error) {
        console.error('[API] Admin attendance overview error:', error);
        return json({
            success: false,
            error: 'Failed to get attendance overview'
        }, { status: 500 });
    }
}
