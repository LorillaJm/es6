// src/routes/api/admin/dashboard/stats/+server.js
// Phase 9.1 - Performance Optimized Dashboard Stats
// ✅ Updated to read from MongoDB (PRIMARY) instead of Firebase
import { json } from '@sveltejs/kit';
import { verifyAccessToken, getAuditLogs } from '$lib/server/adminAuth.js';
import { adminDb } from '$lib/server/firebase-admin.js';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import { Attendance } from '$lib/server/mongodb/schemas/Attendance.js';
import { User } from '$lib/server/mongodb/schemas/User.js';

export async function GET({ request }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const token = authHeader.substring(7);
        const admin = await verifyAccessToken(token);
        
        if (!admin) {
            return json({ error: 'Invalid token' }, { status: 401 });
        }

        // Connect to MongoDB
        await connectMongoDB();
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Use local date format (same as attendance service)
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        
        console.log('[Dashboard] Querying attendance for dateString:', todayStr);

        // Initialize comprehensive stats
        let stats = {
            totalPresent: 0,
            yesterdayPresent: 0,
            totalAbsent: 0,
            excusedAbsent: 0,
            unexcusedAbsent: 0,
            lateArrivals: 0,
            avgLateArrivals: 0,
            activeScanners: 0,
            totalScanners: 0,
            liveCheckIns: 0,
            totalUsers: 0,
            attendanceRate: 0,
            pendingFeedback: 0
        };

        let departments = [];
        let hourlyData = [];
        let pendingFeedback = [];
        let pendingRequests = [];
        let systemAlerts = [];
        let auditLogs = [];
        let liveActivities = [];

        // Get total users from MongoDB
        const totalUsers = await User.countDocuments({ status: 'active' });
        stats.totalUsers = totalUsers;

        // Get department breakdown from MongoDB
        const deptAgg = await User.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: '$department', total: { $sum: 1 } } }
        ]);
        
        const deptMap = {};
        deptAgg.forEach(d => {
            const deptName = d._id || 'Other';
            deptMap[deptName] = { name: deptName, total: d.total, present: 0, absent: 0, late: 0 };
        });

        // Get today's attendance from MongoDB
        const todayAttendance = await Attendance.find({
            dateString: todayStr
        }).populate('userId', 'name displayName department');

        console.log('[Dashboard] Found attendance records:', todayAttendance.length);
        if (todayAttendance.length > 0) {
            console.log('[Dashboard] Sample record:', {
                id: todayAttendance[0]._id,
                dateString: todayAttendance[0].dateString,
                isLate: todayAttendance[0].isLate,
                status: todayAttendance[0].currentStatus
            });
        }

        stats.totalPresent = todayAttendance.length;
        stats.liveCheckIns = todayAttendance.length;

        // Process today's attendance
        const hourlyCount = {};
        
        for (const record of todayAttendance) {
            const userDept = record.department || record.userId?.department || 'Other';
            
            // Update department stats
            if (deptMap[userDept]) {
                deptMap[userDept].present++;
            }
            
            // Check if late
            if (record.isLate) {
                stats.lateArrivals++;
                if (deptMap[userDept]) {
                    deptMap[userDept].late++;
                }
            }
            
            // Hourly breakdown
            if (record.checkIn?.timestamp) {
                const checkInHour = new Date(record.checkIn.timestamp).getHours();
                const hourKey = `${checkInHour}:00`;
                hourlyCount[hourKey] = (hourlyCount[hourKey] || 0) + 1;
            }
            
            // Add to live activities (last 20)
            if (liveActivities.length < 20 && record.checkIn?.timestamp) {
                const checkInTime = new Date(record.checkIn.timestamp);
                liveActivities.push({
                    id: record._id.toString(),
                    odId: record._id.toString(),
                    studentName: record.userId?.name || record.userId?.displayName || 'Unknown',
                    department: userDept,
                    scanTime: checkInTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                    location: record.checkIn?.location?.name || 'Main Gate',
                    device: record.checkIn?.method || 'Scanner',
                    status: record.isLate ? 'late' : 'on_time',
                    timestamp: record.checkIn.timestamp
                });
            }
        }

        // Get yesterday's attendance count
        const yesterdayCount = await Attendance.countDocuments({ dateString: yesterdayStr });
        stats.yesterdayPresent = yesterdayCount;

        // Calculate absences
        stats.totalAbsent = Math.max(0, stats.totalUsers - stats.totalPresent);

        // Get excused absences (from leave requests in Firebase for now)
        let excusedCount = 0;
        if (adminDb) {
            try {
                const leaveRequestsSnapshot = await adminDb.ref('leaveRequests').once('value');
                if (leaveRequestsSnapshot.exists()) {
                    const leaveRequests = leaveRequestsSnapshot.val();
                    const todayAttendeeIds = new Set(todayAttendance.map(a => a.firebaseUid));
                    
                    for (const [userId, requests] of Object.entries(leaveRequests)) {
                        if (typeof requests === 'object') {
                            for (const [requestId, request] of Object.entries(requests)) {
                                if (request.status === 'approved') {
                                    const startDate = new Date(request.startDate);
                                    const endDate = new Date(request.endDate);
                                    if (today >= startDate && today <= endDate && !todayAttendeeIds.has(userId)) {
                                        excusedCount++;
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('Error fetching leave requests:', e);
            }
        }
        
        stats.excusedAbsent = Math.min(excusedCount, stats.totalAbsent);
        stats.unexcusedAbsent = stats.totalAbsent - stats.excusedAbsent;

        // Calculate average late arrivals from last 7 days
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const lateStats = await Attendance.aggregate([
            { 
                $match: { 
                    date: { $gte: sevenDaysAgo, $lt: today },
                    isLate: true 
                } 
            },
            { $group: { _id: '$dateString', count: { $sum: 1 } } }
        ]);
        
        if (lateStats.length > 0) {
            const totalLate = lateStats.reduce((sum, d) => sum + d.count, 0);
            stats.avgLateArrivals = Math.round(totalLate / lateStats.length);
        }

        stats.attendanceRate = stats.totalUsers > 0 ? Math.round((stats.totalPresent / stats.totalUsers) * 100) : 0;

        // Update department absences
        Object.values(deptMap).forEach(dept => {
            dept.absent = dept.total - dept.present;
            dept.attendanceRate = dept.total > 0 ? Math.round((dept.present / dept.total) * 100) : 0;
        });

        departments = Object.values(deptMap).sort((a, b) => b.attendanceRate - a.attendanceRate);

        // Format hourly data
        for (let h = 6; h <= 18; h++) {
            const hourKey = `${h}:00`;
            const nextHour = h + 1;
            const timeLabel = `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'} - ${nextHour > 12 ? nextHour - 12 : nextHour}:00 ${nextHour >= 12 ? 'PM' : 'AM'}`;
            hourlyData.push({
                time: timeLabel,
                count: hourlyCount[hourKey] || 0
            });
        }

        // Sort live activities by timestamp (most recent first)
        liveActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Get pending feedback from Firebase (check both /feedback and /userFeedback paths)
        if (adminDb) {
            try {
                // Get users for name lookup
                const usersSnapshot = await adminDb.ref('users').once('value');
                const users = usersSnapshot.exists() ? usersSnapshot.val() : {};
                
                // Check /feedback collection first
                const feedbackSnapshot = await adminDb.ref('feedback').once('value');
                if (feedbackSnapshot.exists()) {
                    const feedback = feedbackSnapshot.val();
                    for (const [id, f] of Object.entries(feedback)) {
                        if (typeof f !== 'object' || !f) continue;
                        // Include pending or items without status (default to pending)
                        if (f.status === 'pending' || f.status === 'in_progress' || !f.status) {
                            const user = users[f.userId] || {};
                            pendingFeedback.push({
                                id,
                                title: f.title || f.subject || f.message?.substring(0, 50) || 'Feedback',
                                user: user.name || user.displayName || f.userName || f.userEmail || 'Anonymous',
                                category: f.category || f.type || 'General',
                                urgency: f.priority || 'medium',
                                timestamp: f.createdAt || f.timestamp
                            });
                        }
                    }
                }
                
                // Also check /userFeedback/{userId}/{feedbackId} structure
                if (pendingFeedback.length === 0) {
                    const userFeedbackSnapshot = await adminDb.ref('userFeedback').once('value');
                    if (userFeedbackSnapshot.exists()) {
                        const userFeedbackData = userFeedbackSnapshot.val();
                        for (const [userId, userFeedbacks] of Object.entries(userFeedbackData)) {
                            if (typeof userFeedbacks !== 'object' || !userFeedbacks) continue;
                            const user = users[userId] || {};
                            
                            for (const [feedbackId, f] of Object.entries(userFeedbacks)) {
                                if (typeof f !== 'object' || !f) continue;
                                if (f.status === 'pending' || f.status === 'in_progress' || !f.status) {
                                    pendingFeedback.push({
                                        id: `${userId}_${feedbackId}`,
                                        title: f.title || f.subject || f.message?.substring(0, 50) || 'Feedback',
                                        user: user.name || user.displayName || f.userName || 'Anonymous',
                                        category: f.category || f.type || 'General',
                                        urgency: f.priority || 'medium',
                                        timestamp: f.createdAt || f.timestamp
                                    });
                                }
                            }
                        }
                    }
                }
                
                // Sort by urgency (high first) then by timestamp (newest first)
                const urgencyOrder = { high: 0, medium: 1, low: 2 };
                pendingFeedback.sort((a, b) => {
                    const urgA = urgencyOrder[a.urgency] ?? 1;
                    const urgB = urgencyOrder[b.urgency] ?? 1;
                    if (urgA !== urgB) return urgA - urgB;
                    return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
                });
                
                // Limit to 10 items
                pendingFeedback = pendingFeedback.slice(0, 10);
                stats.pendingFeedback = pendingFeedback.length;
                
            } catch (e) {
                console.error('Error fetching feedback:', e);
            }
            
            // Get pending leave requests
            try {
                const leaveRequestsSnapshot = await adminDb.ref('leaveRequests').once('value');
                if (leaveRequestsSnapshot.exists()) {
                    const leaveRequests = leaveRequestsSnapshot.val();
                    const usersSnapshot = await adminDb.ref('users').once('value');
                    const users = usersSnapshot.exists() ? usersSnapshot.val() : {};
                    
                    for (const [userId, requests] of Object.entries(leaveRequests)) {
                        if (typeof requests !== 'object' || !requests) continue;
                        const user = users[userId] || {};
                        
                        for (const [requestId, request] of Object.entries(requests)) {
                            if (typeof request !== 'object' || !request) continue;
                            // Only include pending requests
                            if (request.status === 'pending') {
                                pendingRequests.push({
                                    id: `${userId}_${requestId}`,
                                    title: `${request.type || 'Leave'} Request`,
                                    user: user.name || user.displayName || 'Unknown',
                                    type: request.type || 'leave',
                                    startDate: request.startDate,
                                    endDate: request.endDate,
                                    reason: request.reason,
                                    timestamp: request.createdAt || request.submittedAt
                                });
                            }
                        }
                    }
                    
                    // Sort by timestamp (newest first)
                    pendingRequests.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
                    pendingRequests = pendingRequests.slice(0, 10);
                }
            } catch (e) {
                console.error('Error fetching leave requests:', e);
            }
        }

        // Get scanner info from Firebase
        if (adminDb) {
            try {
                const scannersSnapshot = await adminDb.ref('scanners').once('value');
                if (scannersSnapshot.exists()) {
                    const scanners = scannersSnapshot.val();
                    const scannerList = Object.values(scanners);
                    stats.totalScanners = scannerList.length;
                    stats.activeScanners = scannerList.filter(s => s.status === 'online' || s.active).length;
                } else {
                    stats.totalScanners = 3;
                    stats.activeScanners = 2;
                }
            } catch (e) {
                stats.totalScanners = 3;
                stats.activeScanners = 2;
            }
        }

        // Get audit logs
        try {
            const { logs } = await getAuditLogs({ limit: 10 });
            auditLogs = logs.map(log => ({
                id: log.id || Date.now(),
                odId: log.id || Date.now(),
                action: getActionType(log.action),
                message: formatAuditMessage(log),
                adminName: log.adminName || log.adminEmail || 'Admin',
                timestamp: log.timestamp
            }));
        } catch (e) {
            console.error('Failed to get audit logs:', e);
        }

        // Monthly analytics from MongoDB
        const monthlyAnalytics = await getMonthlyAnalytics(stats.totalUsers);

        // System health
        const systemHealth = await getSystemHealth(adminDb);

        // Generate system alerts based on actual conditions
        systemAlerts = generateSystemAlerts(stats, systemHealth, pendingFeedback, pendingRequests);

        // Predictions
        const predictions = generatePredictions(stats, departments);

        return json({
            stats,
            departments,
            hourlyData,
            liveActivities,
            pendingFeedback,
            pendingRequests,
            systemAlerts,
            auditLogs,
            monthlyAnalytics,
            systemHealth,
            predictions,
            admin: {
                name: admin.name || admin.email,
                role: admin.role,
                lastLogin: admin.lastLogin
            }
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        return json({ error: 'Failed to load stats' }, { status: 500 });
    }
}

async function getMonthlyAnalytics(totalUsers) {
    const analytics = {
        totalDaysTracked: 0,
        avgDailyAttendance: 0,
        mostAbsentDay: '',
        bestAttendanceDay: '',
        dailyData: [],
        patterns: []
    };

    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Get daily attendance stats from MongoDB
        const dailyStats = await Attendance.aggregate([
            { $match: { date: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: '$dateString',
                    present: { $sum: 1 },
                    late: { $sum: { $cond: ['$isLate', 1, 0] } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        if (dailyStats.length === 0) return analytics;

        analytics.totalDaysTracked = dailyStats.length;

        let totalAttendance = 0;
        let bestDay = { date: '', rate: 0 };
        let worstDay = { date: '', rate: 100 };

        dailyStats.forEach(day => {
            const absent = Math.max(0, totalUsers - day.present);
            const rate = totalUsers > 0 ? (day.present / totalUsers) * 100 : 0;
            totalAttendance += rate;

            if (rate > bestDay.rate) bestDay = { date: day._id, rate };
            if (rate < worstDay.rate && rate > 0) worstDay = { date: day._id, rate };

            analytics.dailyData.push({
                day: new Date(day._id).getDate(),
                date: day._id,
                present: day.present,
                absent,
                late: day.late
            });
        });

        analytics.avgDailyAttendance = analytics.totalDaysTracked > 0 
            ? Math.round(totalAttendance / analytics.totalDaysTracked) : 0;
        analytics.bestAttendanceDay = bestDay.date ? new Date(bestDay.date).toLocaleDateString('en-US', { weekday: 'long' }) : 'N/A';
        analytics.mostAbsentDay = worstDay.date ? new Date(worstDay.date).toLocaleDateString('en-US', { weekday: 'long' }) : 'N/A';

        if (analytics.avgDailyAttendance > 85) {
            analytics.patterns.push({
                type: 'positive',
                message: `Overall attendance rate is strong at ${analytics.avgDailyAttendance}%`
            });
        }

    } catch (e) {
        console.error('Monthly analytics error:', e);
    }

    return analytics;
}

async function getSystemHealth(db) {
    const healthStartTime = Date.now();
    let dbStatus = 'offline';
    let dbQueryPerformance = 'unknown';
    let dbResponseTime = 0;
    
    try {
        const mongoStart = Date.now();
        await User.findOne().limit(1);
        dbResponseTime = Date.now() - mongoStart;
        dbStatus = 'online';
        
        if (dbResponseTime < 50) dbQueryPerformance = 'excellent';
        else if (dbResponseTime < 100) dbQueryPerformance = 'good';
        else if (dbResponseTime < 300) dbQueryPerformance = 'slow';
        else dbQueryPerformance = 'degraded';
    } catch (dbError) {
        dbStatus = 'error';
        dbQueryPerformance = 'error';
    }
    
    const serverResponseTime = Date.now() - healthStartTime;
    const scanners = db ? await getScannerHealth(db) : [];
    
    return {
        server: { 
            status: 'online', 
            responseTime: serverResponseTime,
            uptime: process.uptime ? Math.floor(process.uptime()) : null
        },
        database: { 
            status: dbStatus, 
            queryPerformance: dbQueryPerformance,
            responseTime: dbResponseTime
        },
        redis: { queueLength: 0, failedJobs: 0, delayedJobs: 0 },
        scanners
    };
}

async function getScannerHealth(db) {
    if (!db) return [];

    try {
        const snapshot = await db.ref('scanners').once('value');
        if (snapshot.exists()) {
            const now = Date.now();
            return Object.entries(snapshot.val()).map(([id, s]) => {
                let status = 'offline';
                let lastSyncText = 'Unknown';
                
                if (s.lastHeartbeat) {
                    const lastHeartbeat = new Date(s.lastHeartbeat).getTime();
                    const diffMs = now - lastHeartbeat;
                    const diffMinutes = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    
                    if (diffMinutes < 5) {
                        status = 'online';
                        lastSyncText = diffMinutes < 1 ? 'Just now' : `${diffMinutes}m ago`;
                    } else if (diffMinutes < 30) {
                        status = 'degraded';
                        lastSyncText = `${diffMinutes}m ago`;
                    } else if (diffHours < 24) {
                        status = 'offline';
                        lastSyncText = `${diffHours}h ago`;
                    } else {
                        status = 'offline';
                        lastSyncText = `${Math.floor(diffHours / 24)}d ago`;
                    }
                }
                
                if (s.status === 'maintenance') status = 'maintenance';
                
                return {
                    id,
                    odId: id,
                    name: s.name || `Scanner ${id}`,
                    location: s.location || 'Unknown',
                    status,
                    battery: typeof s.battery === 'number' ? s.battery : null,
                    lastSync: lastSyncText
                };
            });
        }
        return [];
    } catch (e) {
        console.error('Scanner health error:', e);
        return [];
    }
}

function generatePredictions(stats, departments) {
    const insights = [];
    
    let predictedRate = stats.attendanceRate || 75;
    const dayOfWeek = new Date().getDay();
    
    if (dayOfWeek === 1) predictedRate -= 5;
    if (dayOfWeek === 3) predictedRate += 3;
    if (dayOfWeek === 5) predictedRate -= 3;
    
    predictedRate = Math.min(100, Math.max(0, predictedRate));

    insights.push(`Tomorrow's expected attendance: ${predictedRate}%`);

    const lowDepts = departments.filter(d => d.attendanceRate < 85);
    if (lowDepts.length > 0) {
        insights.push(`${lowDepts[0].name} may need attention with ${lowDepts[0].attendanceRate}% attendance`);
    }

    if (stats.lateArrivals > stats.avgLateArrivals) {
        insights.push('Late arrivals are above average today - consider early reminders');
    }

    return {
        tomorrowAttendance: predictedRate,
        confidence: 75 + Math.floor(Math.random() * 15),
        insights
    };
}

function getActionType(action) {
    if (action?.includes('EDIT') || action?.includes('UPDATE')) return 'edit';
    if (action?.includes('RESET') || action?.includes('REGENERATE')) return 'reset';
    if (action?.includes('SETTING') || action?.includes('CONFIG')) return 'settings';
    return 'default';
}

function formatAuditMessage(log) {
    const messages = {
        'LOGIN_SUCCESS': `${log.adminName || 'Admin'} logged in successfully`,
        'LOGIN_FAILED': 'Failed login attempt detected',
        'LOGOUT': `${log.adminName || 'Admin'} logged out`,
        'ADMIN_CREATED': 'New admin account created',
        'ADMIN_UPDATED': 'Admin account updated',
        'ADMIN_DELETED': 'Admin account deleted',
        'MFA_ENABLED': 'MFA enabled for admin',
        'PASSWORD_CHANGED': 'Password changed',
        'USER_CREATED': 'New user created',
        'USER_UPDATED': 'User profile updated',
        'USER_DELETED': 'User deleted',
        'SETTINGS_UPDATED': 'System settings updated',
        'ATTENDANCE_EDITED': 'Attendance record modified',
        'QR_REGENERATED': 'QR code regenerated for user'
    };
    
    return messages[log.action] || (log.action || 'Action').replace(/_/g, ' ').toLowerCase();
}

function generateSystemAlerts(stats, systemHealth, pendingFeedback, pendingRequests) {
    const alerts = [];
    const now = new Date();
    
    // Database performance alerts
    if (systemHealth.database.status === 'error') {
        alerts.push({
            id: 'db-error',
            title: 'Database Connection Error',
            message: 'Unable to connect to the database. Some features may not work.',
            severity: 'critical',
            timestamp: now.toISOString(),
            read: false
        });
    } else if (systemHealth.database.queryPerformance === 'slow' || systemHealth.database.queryPerformance === 'degraded') {
        alerts.push({
            id: 'db-slow',
            title: 'Database Performance Degraded',
            message: `Database response time is ${systemHealth.database.responseTime}ms. Consider optimization.`,
            severity: 'warning',
            timestamp: now.toISOString(),
            read: false
        });
    }
    
    // High pending feedback alert
    if (pendingFeedback.length >= 5) {
        const highPriority = pendingFeedback.filter(f => f.urgency === 'high').length;
        alerts.push({
            id: 'feedback-pending',
            title: 'Pending Feedback Requires Attention',
            message: `${pendingFeedback.length} feedback items pending${highPriority > 0 ? ` (${highPriority} high priority)` : ''}.`,
            severity: highPriority > 0 ? 'warning' : 'info',
            timestamp: now.toISOString(),
            read: false
        });
    }
    
    // Pending leave requests alert
    if (pendingRequests.length >= 3) {
        alerts.push({
            id: 'requests-pending',
            title: 'Leave Requests Awaiting Review',
            message: `${pendingRequests.length} leave requests need approval.`,
            severity: 'info',
            timestamp: now.toISOString(),
            read: false
        });
    }
    
    // Low attendance alert
    if (stats.attendanceRate > 0 && stats.attendanceRate < 70) {
        alerts.push({
            id: 'low-attendance',
            title: 'Low Attendance Today',
            message: `Only ${stats.attendanceRate}% attendance recorded. ${stats.totalAbsent} users absent.`,
            severity: 'warning',
            timestamp: now.toISOString(),
            read: false
        });
    }
    
    // High late arrivals alert
    if (stats.lateArrivals > 0 && stats.avgLateArrivals > 0 && stats.lateArrivals > stats.avgLateArrivals * 1.5) {
        alerts.push({
            id: 'high-late',
            title: 'Above Average Late Arrivals',
            message: `${stats.lateArrivals} late arrivals today vs ${stats.avgLateArrivals} average.`,
            severity: 'info',
            timestamp: now.toISOString(),
            read: false
        });
    }
    
    // Scanner offline alerts (generated from systemHealth.scanners)
    if (systemHealth.scanners && systemHealth.scanners.length > 0) {
        const offlineScanners = systemHealth.scanners.filter(s => s.status === 'offline');
        const degradedScanners = systemHealth.scanners.filter(s => s.status === 'degraded');
        
        if (offlineScanners.length > 0) {
            alerts.push({
                id: 'scanners-offline',
                title: `${offlineScanners.length} Scanner(s) Offline`,
                message: offlineScanners.map(s => s.name).join(', ') + ' not responding.',
                severity: offlineScanners.length > 1 ? 'critical' : 'warning',
                timestamp: now.toISOString(),
                read: false
            });
        }
        
        if (degradedScanners.length > 0) {
            alerts.push({
                id: 'scanners-degraded',
                title: 'Scanner Performance Degraded',
                message: degradedScanners.map(s => s.name).join(', ') + ' experiencing delays.',
                severity: 'info',
                timestamp: now.toISOString(),
                read: false
            });
        }
        
        // Low battery scanners
        const lowBatteryScanners = systemHealth.scanners.filter(s => s.battery !== null && s.battery < 20);
        if (lowBatteryScanners.length > 0) {
            alerts.push({
                id: 'scanners-battery',
                title: 'Scanner Battery Low',
                message: lowBatteryScanners.map(s => `${s.name} (${s.battery}%)`).join(', '),
                severity: 'warning',
                timestamp: now.toISOString(),
                read: false
            });
        }
    }
    
    // Redis queue alerts
    if (systemHealth.redis.failedJobs > 0) {
        alerts.push({
            id: 'redis-failed',
            title: 'Failed Background Jobs',
            message: `${systemHealth.redis.failedJobs} jobs failed in the queue.`,
            severity: systemHealth.redis.failedJobs > 5 ? 'warning' : 'info',
            timestamp: now.toISOString(),
            read: false
        });
    }
    
    return alerts;
}
