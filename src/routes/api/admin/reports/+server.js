// src/routes/api/admin/reports/+server.js
// Comprehensive Reports API with real data
import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, PERMISSIONS } from '$lib/server/adminAuth.js';
import { adminDb } from '$lib/server/firebase-admin.js';

export async function GET({ request, url }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const admin = await verifyAccessToken(authHeader.substring(7));
        if (!admin || !checkPermission(admin, PERMISSIONS.ACCESS_REPORTS)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }
        
        const type = url.searchParams.get('type') || 'attendance';
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        const department = url.searchParams.get('department');
        
        if (!adminDb) {
            return json({ error: 'Database not available' }, { status: 500 });
        }
        
        // Get users data
        const usersSnapshot = await adminDb.ref('users').once('value');
        const users = usersSnapshot.exists() ? usersSnapshot.val() : {};
        const usersList = Object.entries(users);
        const totalUsers = usersList.length;
        
        // Get attendance data
        const attendanceSnapshot = await adminDb.ref('attendance').once('value');
        const allAttendance = attendanceSnapshot.exists() ? attendanceSnapshot.val() : {};
        
        let reportData = {};
        
        if (type === 'attendance') {
            reportData = await generateAttendanceReport(allAttendance, users, from, to, department);
        } else if (type === 'users') {
            reportData = await generateUserActivityReport(allAttendance, users, from, to, department);
        } else if (type === 'summary') {
            reportData = await generateSummaryReport(allAttendance, users, from, to, department, adminDb);
        }
        
        return json(reportData);
    } catch (error) {
        console.error('Generate report error:', error);
        return json({ error: 'Failed to generate report' }, { status: 500 });
    }
}

// Attendance Report - detailed attendance records
async function generateAttendanceReport(allAttendance, users, from, to, department) {
    const records = [];
    const uniqueUserIds = new Set();
    let totalPresent = 0;
    let totalLate = 0;
    let totalOnTime = 0;
    const departmentStats = {};
    const dailyStats = {};
    
    for (const [uid, userAttendance] of Object.entries(allAttendance)) {
        if (typeof userAttendance !== 'object' || !userAttendance) continue;
        
        const user = users[uid] || {};
        const userDept = user.department || user.departmentOrCourse || 'Other';
        
        // Filter by department if specified
        if (department && userDept !== department) continue;
        
        for (const [recordId, record] of Object.entries(userAttendance)) {
            if (typeof record !== 'object' || !record) continue;
            
            // Parse record date
            let recordDate = null;
            let recordDateISO = null;
            
            if (record.date) {
                const parsedDate = new Date(record.date);
                if (!isNaN(parsedDate.getTime())) {
                    recordDateISO = parsedDate.toISOString().split('T')[0];
                    recordDate = record.date;
                }
            }
            
            if (!recordDateISO && record.checkIn?.timestamp) {
                const parsedDate = new Date(record.checkIn.timestamp);
                if (!isNaN(parsedDate.getTime())) {
                    recordDateISO = parsedDate.toISOString().split('T')[0];
                }
            }
            
            // Filter by date range
            if (from && recordDateISO && recordDateISO < from) continue;
            if (to && recordDateISO && recordDateISO > to) continue;
            
            uniqueUserIds.add(uid);
            totalPresent++;
            
            // Check if late (after 9:00 AM)
            const checkInTime = record.checkIn?.timestamp || record.checkIn;
            let isLate = false;
            let checkInHour = null;
            
            if (checkInTime) {
                const checkIn = new Date(checkInTime);
                checkInHour = checkIn.getHours();
                if (checkInHour >= 9) {
                    isLate = true;
                    totalLate++;
                } else {
                    totalOnTime++;
                }
            }
            
            // Department stats
            if (!departmentStats[userDept]) {
                departmentStats[userDept] = { present: 0, late: 0, onTime: 0 };
            }
            departmentStats[userDept].present++;
            if (isLate) departmentStats[userDept].late++;
            else departmentStats[userDept].onTime++;
            
            // Daily stats
            if (recordDateISO) {
                if (!dailyStats[recordDateISO]) {
                    dailyStats[recordDateISO] = { present: 0, late: 0, onTime: 0 };
                }
                dailyStats[recordDateISO].present++;
                if (isLate) dailyStats[recordDateISO].late++;
                else dailyStats[recordDateISO].onTime++;
            }
            
            // Add to records
            records.push({
                id: `${uid}_${recordId}`,
                userId: uid,
                userName: user.name || user.displayName || 'Unknown',
                userEmail: user.email || '',
                department: userDept,
                date: recordDateISO,
                checkIn: checkInTime,
                checkOut: record.checkOut?.timestamp || record.checkOut,
                status: isLate ? 'late' : 'present',
                duration: calculateDuration(checkInTime, record.checkOut?.timestamp || record.checkOut),
                method: record.method || 'qr'
            });
        }
    }
    
    // Calculate average attendance
    const totalUsers = Object.keys(users).length;
    const daysDiff = from && to ? Math.ceil((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)) + 1 : 30;
    const expectedRecords = totalUsers * daysDiff;
    const averageAttendance = expectedRecords > 0 ? Math.round((totalPresent / expectedRecords) * 100) : 0;
    
    // Sort records by date (most recent first)
    records.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Format daily stats for chart
    const dailyData = Object.entries(dailyStats)
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Format department stats
    const departmentData = Object.entries(departmentStats)
        .map(([name, stats]) => ({ name, ...stats, attendanceRate: stats.present > 0 ? Math.round((stats.onTime / stats.present) * 100) : 0 }))
        .sort((a, b) => b.present - a.present);
    
    return {
        totalRecords: records.length,
        uniqueUsers: uniqueUserIds.size,
        averageAttendance,
        totalPresent,
        totalLate,
        totalOnTime,
        latePercentage: totalPresent > 0 ? Math.round((totalLate / totalPresent) * 100) : 0,
        records: records.slice(0, 500), // Limit to 500 records for preview
        dailyData,
        departmentData,
        dateRange: { from, to }
    };
}

// User Activity Report - per-user attendance summary
async function generateUserActivityReport(allAttendance, users, from, to, department) {
    const userStats = {};
    
    // Initialize all users
    for (const [uid, user] of Object.entries(users)) {
        const userDept = user.department || user.departmentOrCourse || 'Other';
        if (department && userDept !== department) continue;
        
        userStats[uid] = {
            userId: uid,
            userName: user.name || user.displayName || 'Unknown',
            userEmail: user.email || '',
            department: userDept,
            role: user.role || 'student',
            totalDays: 0,
            presentDays: 0,
            lateDays: 0,
            onTimeDays: 0,
            absentDays: 0,
            avgCheckInTime: null,
            checkInTimes: [],
            lastAttendance: null
        };
    }
    
    // Process attendance records
    for (const [uid, userAttendance] of Object.entries(allAttendance)) {
        if (typeof userAttendance !== 'object' || !userAttendance) continue;
        if (!userStats[uid]) continue;
        
        const attendedDates = new Set();
        
        for (const [recordId, record] of Object.entries(userAttendance)) {
            if (typeof record !== 'object' || !record) continue;
            
            let recordDateISO = null;
            if (record.date) {
                const parsedDate = new Date(record.date);
                if (!isNaN(parsedDate.getTime())) {
                    recordDateISO = parsedDate.toISOString().split('T')[0];
                }
            }
            if (!recordDateISO && record.checkIn?.timestamp) {
                recordDateISO = new Date(record.checkIn.timestamp).toISOString().split('T')[0];
            }
            
            // Filter by date range
            if (from && recordDateISO && recordDateISO < from) continue;
            if (to && recordDateISO && recordDateISO > to) continue;
            
            attendedDates.add(recordDateISO);
            userStats[uid].presentDays++;
            
            // Track check-in time
            const checkInTime = record.checkIn?.timestamp || record.checkIn;
            if (checkInTime) {
                const checkIn = new Date(checkInTime);
                const hour = checkIn.getHours();
                const minutes = checkIn.getMinutes();
                userStats[uid].checkInTimes.push(hour * 60 + minutes);
                
                if (hour >= 9) {
                    userStats[uid].lateDays++;
                } else {
                    userStats[uid].onTimeDays++;
                }
                
                // Track last attendance
                if (!userStats[uid].lastAttendance || recordDateISO > userStats[uid].lastAttendance) {
                    userStats[uid].lastAttendance = recordDateISO;
                }
            }
        }
    }
    
    // Calculate totals and averages
    const daysDiff = from && to ? Math.ceil((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)) + 1 : 30;
    
    const userList = Object.values(userStats).map(user => {
        user.totalDays = daysDiff;
        user.absentDays = Math.max(0, daysDiff - user.presentDays);
        user.attendanceRate = daysDiff > 0 ? Math.round((user.presentDays / daysDiff) * 100) : 0;
        user.punctualityRate = user.presentDays > 0 ? Math.round((user.onTimeDays / user.presentDays) * 100) : 0;
        
        // Calculate average check-in time
        if (user.checkInTimes.length > 0) {
            const avgMinutes = Math.round(user.checkInTimes.reduce((a, b) => a + b, 0) / user.checkInTimes.length);
            const hours = Math.floor(avgMinutes / 60);
            const mins = avgMinutes % 60;
            user.avgCheckInTime = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        }
        delete user.checkInTimes;
        
        return user;
    });
    
    // Sort by attendance rate (lowest first to highlight issues)
    userList.sort((a, b) => a.attendanceRate - b.attendanceRate);
    
    // Calculate summary stats
    const totalUsers = userList.length;
    const avgAttendanceRate = totalUsers > 0 ? Math.round(userList.reduce((sum, u) => sum + u.attendanceRate, 0) / totalUsers) : 0;
    const avgPunctualityRate = totalUsers > 0 ? Math.round(userList.reduce((sum, u) => sum + u.punctualityRate, 0) / totalUsers) : 0;
    const usersWithPerfectAttendance = userList.filter(u => u.attendanceRate === 100).length;
    const usersWithLowAttendance = userList.filter(u => u.attendanceRate < 70).length;
    
    return {
        totalRecords: userList.length,
        uniqueUsers: totalUsers,
        averageAttendance: avgAttendanceRate,
        avgPunctualityRate,
        usersWithPerfectAttendance,
        usersWithLowAttendance,
        users: userList,
        dateRange: { from, to }
    };
}

// Summary Report - high-level overview with trends
async function generateSummaryReport(allAttendance, users, from, to, department, adminDb) {
    const totalUsers = Object.keys(users).length;
    const dailyStats = {};
    const departmentStats = {};
    const weekdayStats = { 0: { present: 0, count: 0 }, 1: { present: 0, count: 0 }, 2: { present: 0, count: 0 }, 3: { present: 0, count: 0 }, 4: { present: 0, count: 0 }, 5: { present: 0, count: 0 }, 6: { present: 0, count: 0 } };
    const hourlyDistribution = {};
    let totalPresent = 0;
    let totalLate = 0;
    const uniqueUserIds = new Set();
    
    // Process attendance
    for (const [uid, userAttendance] of Object.entries(allAttendance)) {
        if (typeof userAttendance !== 'object' || !userAttendance) continue;
        
        const user = users[uid] || {};
        const userDept = user.department || user.departmentOrCourse || 'Other';
        
        if (department && userDept !== department) continue;
        
        for (const [recordId, record] of Object.entries(userAttendance)) {
            if (typeof record !== 'object' || !record) continue;
            
            let recordDate = null;
            let recordDateISO = null;
            
            if (record.date) {
                recordDate = new Date(record.date);
                if (!isNaN(recordDate.getTime())) {
                    recordDateISO = recordDate.toISOString().split('T')[0];
                }
            }
            if (!recordDateISO && record.checkIn?.timestamp) {
                recordDate = new Date(record.checkIn.timestamp);
                recordDateISO = recordDate.toISOString().split('T')[0];
            }
            
            if (!recordDate || !recordDateISO) continue;
            
            // Filter by date range
            if (from && recordDateISO < from) continue;
            if (to && recordDateISO > to) continue;
            
            uniqueUserIds.add(uid);
            totalPresent++;
            
            // Daily stats
            if (!dailyStats[recordDateISO]) {
                dailyStats[recordDateISO] = { present: 0, late: 0, uniqueUsers: new Set() };
            }
            dailyStats[recordDateISO].present++;
            dailyStats[recordDateISO].uniqueUsers.add(uid);
            
            // Department stats
            if (!departmentStats[userDept]) {
                departmentStats[userDept] = { total: 0, present: 0, late: 0, users: new Set() };
            }
            departmentStats[userDept].present++;
            departmentStats[userDept].users.add(uid);
            
            // Weekday stats
            const dayOfWeek = recordDate.getDay();
            weekdayStats[dayOfWeek].present++;
            weekdayStats[dayOfWeek].count++;
            
            // Check-in time analysis
            const checkInTime = record.checkIn?.timestamp || record.checkIn;
            if (checkInTime) {
                const checkIn = new Date(checkInTime);
                const hour = checkIn.getHours();
                
                if (!hourlyDistribution[hour]) {
                    hourlyDistribution[hour] = 0;
                }
                hourlyDistribution[hour]++;
                
                if (hour >= 9) {
                    totalLate++;
                    dailyStats[recordDateISO].late++;
                    departmentStats[userDept].late++;
                }
            }
        }
    }
    
    // Calculate department totals
    for (const [dept, stats] of Object.entries(departmentStats)) {
        const deptUsers = Object.entries(users).filter(([_, u]) => (u.department || u.departmentOrCourse || 'Other') === dept);
        stats.total = deptUsers.length;
        stats.userCount = stats.users.size;
        delete stats.users;
    }
    
    // Format daily data
    const dailyData = Object.entries(dailyStats)
        .map(([date, stats]) => ({
            date,
            present: stats.present,
            late: stats.late,
            uniqueUsers: stats.uniqueUsers.size,
            attendanceRate: totalUsers > 0 ? Math.round((stats.uniqueUsers.size / totalUsers) * 100) : 0
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Format department data
    const departmentData = Object.entries(departmentStats)
        .map(([name, stats]) => ({
            name,
            total: stats.total,
            present: stats.present,
            late: stats.late,
            userCount: stats.userCount,
            attendanceRate: stats.total > 0 ? Math.round((stats.userCount / stats.total) * 100) : 0
        }))
        .sort((a, b) => b.attendanceRate - a.attendanceRate);
    
    // Format weekday data
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayData = Object.entries(weekdayStats)
        .map(([day, stats]) => ({
            day: dayNames[parseInt(day)],
            dayIndex: parseInt(day),
            present: stats.present,
            avgAttendance: stats.count > 0 ? Math.round(stats.present / stats.count) : 0
        }))
        .sort((a, b) => a.dayIndex - b.dayIndex);
    
    // Format hourly distribution
    const hourlyData = [];
    for (let h = 6; h <= 18; h++) {
        hourlyData.push({
            hour: h,
            label: `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}`,
            count: hourlyDistribution[h] || 0
        });
    }
    
    // Calculate trends
    const daysDiff = from && to ? Math.ceil((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24)) + 1 : dailyData.length;
    const expectedRecords = totalUsers * daysDiff;
    const averageAttendance = expectedRecords > 0 ? Math.round((totalPresent / expectedRecords) * 100) : 0;
    
    // Get leave requests for context
    let approvedLeaves = 0;
    try {
        const leaveSnapshot = await adminDb.ref('leaveRequests').once('value');
        if (leaveSnapshot.exists()) {
            const leaves = leaveSnapshot.val();
            for (const [userId, userLeaves] of Object.entries(leaves)) {
                if (typeof userLeaves === 'object') {
                    for (const [leaveId, leave] of Object.entries(userLeaves)) {
                        if (leave.status === 'approved') {
                            const startDate = new Date(leave.startDate);
                            const endDate = new Date(leave.endDate);
                            const fromDate = from ? new Date(from) : new Date(0);
                            const toDate = to ? new Date(to) : new Date();
                            
                            if (startDate <= toDate && endDate >= fromDate) {
                                approvedLeaves++;
                            }
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error fetching leave requests:', e);
    }
    
    // Peak hours analysis
    const peakHour = Object.entries(hourlyDistribution).sort((a, b) => b[1] - a[1])[0];
    const peakHourLabel = peakHour ? `${parseInt(peakHour[0]) > 12 ? parseInt(peakHour[0]) - 12 : peakHour[0]}:00 ${parseInt(peakHour[0]) >= 12 ? 'PM' : 'AM'}` : 'N/A';
    
    // Best/worst days
    const bestDay = dailyData.length > 0 ? dailyData.reduce((best, day) => day.attendanceRate > best.attendanceRate ? day : best, dailyData[0]) : null;
    const worstDay = dailyData.length > 0 ? dailyData.reduce((worst, day) => day.attendanceRate < worst.attendanceRate ? day : worst, dailyData[0]) : null;
    
    return {
        totalRecords: totalPresent,
        uniqueUsers: uniqueUserIds.size,
        totalUsers,
        averageAttendance,
        totalLate,
        latePercentage: totalPresent > 0 ? Math.round((totalLate / totalPresent) * 100) : 0,
        approvedLeaves,
        peakHour: peakHourLabel,
        bestDay: bestDay ? { date: bestDay.date, rate: bestDay.attendanceRate } : null,
        worstDay: worstDay ? { date: worstDay.date, rate: worstDay.attendanceRate } : null,
        dailyData,
        departmentData,
        weekdayData,
        hourlyData,
        dateRange: { from, to },
        insights: generateInsights(averageAttendance, totalLate, totalPresent, departmentData, weekdayData)
    };
}

function generateInsights(avgAttendance, totalLate, totalPresent, departments, weekdays) {
    const insights = [];
    
    if (avgAttendance >= 90) {
        insights.push({ type: 'positive', message: `Excellent attendance rate of ${avgAttendance}%` });
    } else if (avgAttendance < 70) {
        insights.push({ type: 'warning', message: `Low attendance rate of ${avgAttendance}% needs attention` });
    }
    
    const lateRate = totalPresent > 0 ? Math.round((totalLate / totalPresent) * 100) : 0;
    if (lateRate > 20) {
        insights.push({ type: 'warning', message: `${lateRate}% of check-ins are late - consider earlier reminders` });
    }
    
    const lowDepts = departments.filter(d => d.attendanceRate < 70);
    if (lowDepts.length > 0) {
        insights.push({ type: 'warning', message: `${lowDepts.map(d => d.name).join(', ')} have low attendance rates` });
    }
    
    const lowWeekdays = weekdays.filter(w => w.avgAttendance < weekdays.reduce((sum, d) => sum + d.avgAttendance, 0) / 7 * 0.8);
    if (lowWeekdays.length > 0) {
        insights.push({ type: 'info', message: `${lowWeekdays.map(w => w.day).join(', ')} typically have lower attendance` });
    }
    
    return insights;
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
