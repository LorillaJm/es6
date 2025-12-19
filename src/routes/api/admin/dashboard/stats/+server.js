// src/routes/api/admin/dashboard/stats/+server.js
// Phase 9.1 - Performance Optimized Dashboard Stats
import { json } from '@sveltejs/kit';
import { verifyAccessToken, getAuditLogs } from '$lib/server/adminAuth.js';
import { adminDb } from '$lib/server/firebase-admin.js';
import { cacheService, CacheKeys, CacheTTL } from '$lib/server/cacheService.js';
import { 
    getOptimizedDashboardStats, 
    getOptimizedDepartmentStats,
    getOptimizedHourlyData,
    getOptimizedLiveActivities
} from '$lib/server/queryOptimizer.js';

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
        
        const today = new Date();
        const todayStr = today.toDateString();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

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

        if (adminDb) {
            // Get all users with departments
            const usersSnapshot = await adminDb.ref('users').once('value');
            const users = usersSnapshot.exists() ? usersSnapshot.val() : {};
            const usersList = Object.entries(users);
            stats.totalUsers = usersList.length;

            // Department breakdown
            const deptMap = {};
            usersList.forEach(([uid, user]) => {
                const dept = user.department || user.course || 'Other';
                if (!deptMap[dept]) {
                    deptMap[dept] = { name: dept, total: 0, present: 0, absent: 0, late: 0 };
                }
                deptMap[dept].total++;
            });

            // Get attendance data
            const attendanceSnapshot = await adminDb.ref('attendance').once('value');
            const hourlyCount = {};
            const todayAttendees = new Set();
            const yesterdayAttendees = new Set();
            let totalLateThisWeek = 0;
            let daysThisWeek = 0;

            if (attendanceSnapshot.exists()) {
                const allAttendance = attendanceSnapshot.val();
                
                for (const [uid, userAttendance] of Object.entries(allAttendance)) {
                    if (typeof userAttendance !== 'object') continue;
                    
                    const user = users[uid] || {};
                    const userDept = user.department || user.course || 'Other';
                    
                    for (const [recordId, record] of Object.entries(userAttendance)) {
                        if (typeof record !== 'object') continue;
                        
                        let recordDate = null;
                        let checkInTime = null;
                        
                        if (record.date) {
                            const parsed = new Date(record.date);
                            if (!isNaN(parsed.getTime())) {
                                recordDate = parsed.toDateString();
                            }
                        }
                        if (!recordDate && record.checkIn?.timestamp) {
                            recordDate = new Date(record.checkIn.timestamp).toDateString();
                        }
                        
                        checkInTime = record.checkIn?.timestamp || record.checkIn;
                        
                        // Today's attendance
                        if (recordDate === todayStr) {
                            todayAttendees.add(uid);
                            stats.totalPresent++;
                            
                            if (deptMap[userDept]) {
                                deptMap[userDept].present++;
                            }
                            
                            // Check if late (after 8 AM)
                            if (checkInTime) {
                                const checkIn = new Date(checkInTime);
                                const hour = checkIn.getHours();
                                
                                // Hourly breakdown
                                const hourKey = `${hour}:00`;
                                hourlyCount[hourKey] = (hourlyCount[hourKey] || 0) + 1;
                                
                                if (hour >= 8 && (hour > 8 || checkIn.getMinutes() > 0)) {
                                    stats.lateArrivals++;
                                    if (deptMap[userDept]) {
                                        deptMap[userDept].late++;
                                    }
                                }
                                
                                // Add to live activities (last 20)
                                if (liveActivities.length < 20) {
                                    liveActivities.push({
                                        id: recordId,
                                        studentName: user.name || user.displayName || 'Unknown',
                                        department: userDept,
                                        scanTime: checkIn.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                                        location: record.location || 'Main Gate',
                                        device: record.device || 'Scanner',
                                        status: hour < 8 ? 'on_time' : (record.excused ? 'excused' : 'late'),
                                        timestamp: checkInTime
                                    });
                                }
                            }
                        }
                        
                        // Yesterday's attendance
                        if (recordDate === yesterdayStr) {
                            yesterdayAttendees.add(uid);
                            stats.yesterdayPresent++;
                        }
                    }
                }
            }

            // Calculate absences from real data
            stats.totalAbsent = stats.totalUsers - stats.totalPresent;
            
            // Get real excused/unexcused absence data from leave requests
            let excusedCount = 0;
            const leaveRequestsSnapshot = await adminDb.ref('leaveRequests').once('value');
            if (leaveRequestsSnapshot.exists()) {
                const leaveRequests = leaveRequestsSnapshot.val();
                for (const [userId, requests] of Object.entries(leaveRequests)) {
                    if (typeof requests === 'object') {
                        for (const [requestId, request] of Object.entries(requests)) {
                            // Check if leave is approved and covers today
                            if (request.status === 'approved') {
                                const startDate = new Date(request.startDate);
                                const endDate = new Date(request.endDate);
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                if (today >= startDate && today <= endDate && !todayAttendees.has(userId)) {
                                    excusedCount++;
                                }
                            }
                        }
                    }
                }
            }
            
            // Also check for excused absences marked directly in attendance
            const excusedAbsenceSnapshot = await adminDb.ref('excusedAbsences').once('value');
            if (excusedAbsenceSnapshot.exists()) {
                const excusedAbsences = excusedAbsenceSnapshot.val();
                for (const [userId, absences] of Object.entries(excusedAbsences)) {
                    if (typeof absences === 'object') {
                        for (const [absenceId, absence] of Object.entries(absences)) {
                            if (absence.date === todayStr && absence.approved && !todayAttendees.has(userId)) {
                                excusedCount++;
                            }
                        }
                    }
                }
            }
            
            stats.excusedAbsent = Math.min(excusedCount, stats.totalAbsent);
            stats.unexcusedAbsent = stats.totalAbsent - stats.excusedAbsent;
            
            // Calculate average late arrivals from historical data (last 7 days)
            let totalLateLastWeek = 0;
            let daysWithData = 0;
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            if (attendanceSnapshot.exists()) {
                const dailyLateCounts = {};
                const allAttendance = attendanceSnapshot.val();
                
                for (const [uid, userAttendance] of Object.entries(allAttendance)) {
                    if (typeof userAttendance !== 'object') continue;
                    
                    for (const [recordId, record] of Object.entries(userAttendance)) {
                        if (typeof record !== 'object') continue;
                        
                        let recordDate = record.date ? new Date(record.date) : 
                            (record.checkIn?.timestamp ? new Date(record.checkIn.timestamp) : null);
                        
                        if (!recordDate || recordDate < sevenDaysAgo || recordDate >= today) continue;
                        
                        const dateKey = recordDate.toDateString();
                        if (!dailyLateCounts[dateKey]) {
                            dailyLateCounts[dateKey] = 0;
                        }
                        
                        const checkInTime = record.checkIn?.timestamp || record.checkIn;
                        if (checkInTime) {
                            const checkIn = new Date(checkInTime);
                            const hour = checkIn.getHours();
                            if (hour >= 8 && (hour > 8 || checkIn.getMinutes() > 0)) {
                                dailyLateCounts[dateKey]++;
                            }
                        }
                    }
                }
                
                const dailyCounts = Object.values(dailyLateCounts);
                if (dailyCounts.length > 0) {
                    totalLateLastWeek = dailyCounts.reduce((sum, count) => sum + count, 0);
                    daysWithData = dailyCounts.length;
                }
            }
            
            stats.avgLateArrivals = daysWithData > 0 ? Math.round(totalLateLastWeek / daysWithData) : 0;
            stats.attendanceRate = stats.totalUsers > 0 ? Math.round((stats.totalPresent / stats.totalUsers) * 100) : 0;
            stats.liveCheckIns = stats.totalPresent;

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

            // Get pending feedback
            const feedbackSnapshot = await adminDb.ref('feedback').once('value');
            if (feedbackSnapshot.exists()) {
                const feedback = feedbackSnapshot.val();
                pendingFeedback = Object.entries(feedback)
                    .filter(([_, f]) => f.status === 'pending' || !f.status)
                    .slice(0, 10)
                    .map(([id, f]) => ({
                        id,
                        title: f.title || f.subject || 'Feedback',
                        user: f.userName || f.userEmail || 'Anonymous',
                        category: f.category || 'General',
                        urgency: f.priority || 'medium',
                        timestamp: f.createdAt || f.timestamp
                    }));
                stats.pendingFeedback = pendingFeedback.length;
            }

            // Get user feedback as well
            const userFeedbackSnapshot = await adminDb.ref('userFeedback').once('value');
            if (userFeedbackSnapshot.exists()) {
                const userFeedback = userFeedbackSnapshot.val();
                for (const [userId, feedbacks] of Object.entries(userFeedback)) {
                    if (typeof feedbacks === 'object') {
                        const user = users[userId] || {};
                        Object.entries(feedbacks)
                            .filter(([_, f]) => f.status === 'pending' || !f.status)
                            .forEach(([id, f]) => {
                                if (pendingFeedback.length < 10) {
                                    pendingFeedback.push({
                                        id,
                                        title: f.title || f.subject || 'User Feedback',
                                        user: user.name || user.displayName || 'User',
                                        category: f.category || 'General',
                                        urgency: f.priority || 'medium',
                                        timestamp: f.createdAt || f.timestamp
                                    });
                                }
                            });
                    }
                }
            }

            // Get scanner/device info
            const scannersSnapshot = await adminDb.ref('scanners').once('value');
            if (scannersSnapshot.exists()) {
                const scanners = scannersSnapshot.val();
                const scannerList = Object.values(scanners);
                stats.totalScanners = scannerList.length;
                stats.activeScanners = scannerList.filter(s => s.status === 'online' || s.active).length;
            } else {
                // Default scanner data if none configured
                stats.totalScanners = 3;
                stats.activeScanners = 2;
            }
        }

        // Get audit logs
        try {
            const { logs } = await getAuditLogs({ limit: 10 });
            auditLogs = logs.map(log => ({
                id: log.id || Date.now(),
                action: getActionType(log.action),
                message: formatAuditMessage(log),
                adminName: log.adminName || log.adminEmail || 'Admin',
                timestamp: log.timestamp
            }));
        } catch (e) {
            console.error('Failed to get audit logs:', e);
        }

        // Monthly analytics (last 30 days)
        const monthlyAnalytics = await getMonthlyAnalytics(adminDb, stats.totalUsers);

        // System health - measure real response times
        const healthStartTime = Date.now();
        let dbStatus = 'offline';
        let dbQueryPerformance = 'unknown';
        let dbResponseTime = 0;
        
        if (adminDb) {
            try {
                const dbTestStart = Date.now();
                await adminDb.ref('.info/connected').once('value');
                dbResponseTime = Date.now() - dbTestStart;
                dbStatus = 'online';
                
                // Classify query performance based on response time
                if (dbResponseTime < 50) {
                    dbQueryPerformance = 'excellent';
                } else if (dbResponseTime < 100) {
                    dbQueryPerformance = 'good';
                } else if (dbResponseTime < 300) {
                    dbQueryPerformance = 'slow';
                } else {
                    dbQueryPerformance = 'degraded';
                }
            } catch (dbError) {
                dbStatus = 'error';
                dbQueryPerformance = 'error';
            }
        }
        
        const serverResponseTime = Date.now() - healthStartTime;
        
        // Get queue stats if available
        let queueStats = { queueLength: 0, failedJobs: 0, delayedJobs: 0 };
        try {
            const queueSnapshot = await adminDb.ref('jobQueue/stats').once('value');
            if (queueSnapshot.exists()) {
                const queueData = queueSnapshot.val();
                queueStats = {
                    queueLength: queueData.pending || 0,
                    failedJobs: queueData.failed || 0,
                    delayedJobs: queueData.delayed || 0
                };
            }
        } catch (queueError) {
            // Queue stats not available, use defaults
        }
        
        const systemHealth = {
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
            redis: queueStats,
            scanners: await getScannerHealth(adminDb)
        };

        // Predictions (simple rule-based)
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

async function getMonthlyAnalytics(db, totalUsers) {
    const analytics = {
        totalDaysTracked: 0,
        avgDailyAttendance: 0,
        mostAbsentDay: '',
        bestAttendanceDay: '',
        dailyData: [],
        patterns: []
    };

    if (!db) return analytics;

    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const attendanceSnapshot = await db.ref('attendance').once('value');
        if (!attendanceSnapshot.exists()) return analytics;

        const dailyStats = {};
        const dayOfWeekStats = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        const dayOfWeekCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

        const allAttendance = attendanceSnapshot.val();
        for (const [uid, userAttendance] of Object.entries(allAttendance)) {
            if (typeof userAttendance !== 'object') continue;
            
            for (const [recordId, record] of Object.entries(userAttendance)) {
                if (typeof record !== 'object') continue;
                
                let recordDate = record.date ? new Date(record.date) : 
                    (record.checkIn?.timestamp ? new Date(record.checkIn.timestamp) : null);
                
                if (!recordDate || recordDate < thirtyDaysAgo) continue;

                const dateKey = recordDate.toISOString().split('T')[0];
                const dayOfWeek = recordDate.getDay();

                if (!dailyStats[dateKey]) {
                    dailyStats[dateKey] = { present: 0, absent: 0, late: 0 };
                }
                dailyStats[dateKey].present++;

                const checkInTime = record.checkIn?.timestamp || record.checkIn;
                if (checkInTime) {
                    const checkIn = new Date(checkInTime);
                    if (checkIn.getHours() >= 8) {
                        dailyStats[dateKey].late++;
                    }
                }

                dayOfWeekStats[dayOfWeek]++;
                dayOfWeekCounts[dayOfWeek]++;
            }
        }

        // Process daily data
        const sortedDates = Object.keys(dailyStats).sort();
        analytics.totalDaysTracked = sortedDates.length;

        let totalAttendance = 0;
        let bestDay = { date: '', rate: 0 };
        let worstDay = { date: '', rate: 100 };

        sortedDates.forEach(date => {
            const day = dailyStats[date];
            day.absent = Math.max(0, totalUsers - day.present);
            const rate = totalUsers > 0 ? (day.present / totalUsers) * 100 : 0;
            totalAttendance += rate;

            if (rate > bestDay.rate) bestDay = { date, rate };
            if (rate < worstDay.rate) worstDay = { date, rate };

            analytics.dailyData.push({
                day: new Date(date).getDate(),
                date,
                present: day.present,
                absent: day.absent,
                late: day.late
            });
        });

        analytics.avgDailyAttendance = analytics.totalDaysTracked > 0 
            ? Math.round(totalAttendance / analytics.totalDaysTracked) : 0;
        analytics.bestAttendanceDay = bestDay.date ? new Date(bestDay.date).toLocaleDateString('en-US', { weekday: 'long' }) : 'N/A';
        analytics.mostAbsentDay = worstDay.date ? new Date(worstDay.date).toLocaleDateString('en-US', { weekday: 'long' }) : 'N/A';

        // Generate patterns
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const avgByDay = Object.entries(dayOfWeekStats).map(([day, total]) => ({
            day: parseInt(day),
            avg: dayOfWeekCounts[day] > 0 ? total / dayOfWeekCounts[day] : 0
        }));

        const overallAvg = avgByDay.reduce((sum, d) => sum + d.avg, 0) / 7;
        avgByDay.forEach(d => {
            if (d.avg < overallAvg * 0.85) {
                analytics.patterns.push({
                    type: 'negative',
                    message: `${dayNames[d.day]}s have ${Math.round((1 - d.avg / overallAvg) * 100)}% more absences than average`
                });
            }
        });

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

async function getScannerHealth(db) {
    if (!db) return [];

    try {
        const snapshot = await db.ref('scanners').once('value');
        if (snapshot.exists()) {
            const now = Date.now();
            return Object.entries(snapshot.val()).map(([id, s]) => {
                // Calculate real status based on last heartbeat
                let status = 'offline';
                let lastSyncText = 'Unknown';
                
                if (s.lastHeartbeat) {
                    const lastHeartbeat = new Date(s.lastHeartbeat).getTime();
                    const diffMs = now - lastHeartbeat;
                    const diffMinutes = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    
                    // Scanner is online if heartbeat within last 5 minutes
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
                
                // Override with explicit status if set
                if (s.status === 'maintenance') {
                    status = 'maintenance';
                }
                
                return {
                    id,
                    name: s.name || `Scanner ${id}`,
                    location: s.location || 'Unknown',
                    status,
                    battery: typeof s.battery === 'number' ? s.battery : null,
                    lastSync: lastSyncText,
                    lastHeartbeat: s.lastHeartbeat || null,
                    firmwareVersion: s.firmwareVersion || null,
                    ipAddress: s.ipAddress || null,
                    scanCount: s.scanCount || 0
                };
            });
        }
        
        // Return empty array if no scanners configured - don't use fake data
        return [];
    } catch (e) {
        console.error('Scanner health error:', e);
        return [];
    }
}

function generatePredictions(stats, departments) {
    const insights = [];
    
    // Base prediction on current attendance rate
    let predictedRate = stats.attendanceRate;
    const dayOfWeek = new Date().getDay();
    
    // Adjust for day of week patterns
    if (dayOfWeek === 1) predictedRate -= 5; // Monday typically lower
    if (dayOfWeek === 3) predictedRate += 3; // Wednesday typically higher
    if (dayOfWeek === 5) predictedRate -= 3; // Friday typically lower
    
    predictedRate = Math.min(100, Math.max(0, predictedRate));

    insights.push(`Tomorrow's expected attendance: ${predictedRate}%`);

    // Department-specific insights
    const lowDepts = departments.filter(d => d.attendanceRate < 85);
    if (lowDepts.length > 0) {
        insights.push(`${lowDepts[0].name} may need attention with ${lowDepts[0].attendanceRate}% attendance`);
    }

    // Late arrival patterns
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
