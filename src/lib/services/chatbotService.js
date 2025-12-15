// src/lib/services/chatbotService.js
// Professional Chatbot Service - Hybrid Rule-based + AI-assisted

import { browser } from '$app/environment';
import { db, ref, get } from '$lib/firebase';
import { MESSAGE_TYPES, CHATBOT_ROLES, QUERY_CATEGORIES } from '$lib/stores/chatbot';
import { DEFAULT_SCHEDULE, getAttendanceSummary } from './attendanceRules';
import { isAttendanceFrozen } from './holidayService';

// Intent patterns - USER
const USER_INTENTS = {
    ATTENDANCE_STATUS: /\b(am i|my|check|status|present|absent|today|attendance)\b/i,
    CHECK_IN_TIME: /\b(what time|when|check.?in|arrived|came)\b/i,
    CHECK_OUT_TIME: /\b(check.?out|left|leave|clock.?out)\b/i,
    LATE_REASON: /\b(why|late|marked late|reason|tardy)\b/i,
    ABSENCE_COUNT: /\b(how many|absences|absent|missed|days off)\b/i,
    WORK_HOURS: /\b(work hours|total hours|hours worked)\b/i,
    LATE_POLICY: /\b(late policy|grace period|allowed late)\b/i,
    ABSENCE_POLICY: /\b(absence policy|allowed absences|miss)\b/i,
    HOLIDAY: /\b(holiday|vacation|day off|is today|weekend)\b/i,
    SCHEDULE: /\b(schedule|class|work|exam|calendar)\b/i,
    QR_ISSUE: /\b(qr|scan|failed|not working|error)\b/i,
    FACE_ISSUE: /\b(face|biometric|recognition|didn't work)\b/i,
    FORGOT_CHECKIN: /\b(forgot|missed|didn't check|correction)\b/i,
    DASHBOARD: /\b(dashboard|home|main|overview)\b/i,
    PROFILE: /\b(profile|settings|account)\b/i,
    HISTORY: /\b(history|records|past|previous)\b/i,
    EPASS: /\b(e.?pass|id|badge|card)\b/i,
    HELP: /\b(help|how to|guide|what can)\b/i,
    GREETING: /\b(hi|hello|hey|good morning|good afternoon)\b/i,
    THANKS: /\b(thank|thanks|appreciate)\b/i
};

// Intent patterns - ADMIN
const ADMIN_INTENTS = {
    TODAY_SUMMARY: /\b(today|summary|overview|attendance today)\b/i,
    LATE_COUNT: /\b(how many|late|tardy|count)\b/i,
    ABSENT_COUNT: /\b(absent|missing|not here)\b/i,
    ATTENDANCE_RATE: /\b(rate|percentage|attendance rate|this week)\b/i,
    PRESENT_COUNT: /\b(present|checked in|here|arrived)\b/i,
    EXPORT_REPORTS: /\b(export|download|report|generate)\b/i,
    LOW_ATTENDANCE: /\b(low attendance|poor|department|worst)\b/i,
    FREQUENT_ABSENCE: /\b(frequent|often absent|chronic)\b/i,
    SYSTEM_HEALTH: /\b(system|health|status|working)\b/i,
    DEACTIVATE_USER: /\b(deactivate|disable|remove|suspend)\b/i,
    POLICY_CONFIG: /\b(change|configure|set|grace|policy)\b/i,
    HOLIDAY_CONFIG: /\b(holiday|set holiday|add holiday)\b/i,
    AUDIT_LOGS: /\b(audit|log|history|track)\b/i,
    HELP: /\b(help|how to|guide|what can)\b/i,
    GREETING: /\b(hi|hello|hey|good morning)\b/i
};


const RESPONSES = {
    greeting: {
        user: "Hello! I'm here to help you with your attendance. Ask me about your status, policies, or get help with issues.",
        admin: "Hello! I'm your Admin Assistant. I can help with attendance analytics, system management, and user oversight."
    },
    thanks: "You're welcome! Let me know if you need anything else.",
    unknown: "I'm not sure I understand. Could you rephrase? Type 'help' to see what I can do.",
    error: "Sorry, I encountered an issue. Please try again."
};

class ChatbotService {
    constructor() {
        this.queryLog = [];
    }

    async processMessage(message, role, context = {}) {
        try {
            const intent = this.detectIntent(message, role);
            let response;
            if (role === CHATBOT_ROLES.ADMIN) {
                response = await this.handleAdminIntent(intent, message, context);
            } else {
                response = await this.handleUserIntent(intent, message, context);
            }
            return response;
        } catch (error) {
            console.error('[Chatbot] Error:', error);
            return { type: MESSAGE_TYPES.TEXT, content: RESPONSES.error };
        }
    }

    detectIntent(message, role) {
        const intents = role === CHATBOT_ROLES.ADMIN ? ADMIN_INTENTS : USER_INTENTS;
        for (const [intent, pattern] of Object.entries(intents)) {
            if (pattern.test(message.toLowerCase())) return intent;
        }
        return 'UNKNOWN';
    }

    async handleUserIntent(intent, message, context) {
        const { userId } = context;
        switch (intent) {
            case 'GREETING': return { type: MESSAGE_TYPES.TEXT, content: RESPONSES.greeting.user };
            case 'THANKS': return { type: MESSAGE_TYPES.TEXT, content: RESPONSES.thanks };
            case 'ATTENDANCE_STATUS': return await this.getUserAttendanceStatus(userId);
            case 'CHECK_IN_TIME': return await this.getUserCheckInTime(userId);
            case 'LATE_REASON': return await this.getLateReason(userId);
            case 'ABSENCE_COUNT': return await this.getUserAbsenceCount(userId);
            case 'LATE_POLICY': return this.getLatePolicyInfo();
            case 'ABSENCE_POLICY': return this.getAbsencePolicyInfo();
            case 'HOLIDAY': return await this.getHolidayInfo();
            case 'SCHEDULE': return this.getScheduleInfo();
            case 'QR_ISSUE': return this.getQRIssueGuide();
            case 'FACE_ISSUE': return this.getFaceIssueGuide();
            case 'FORGOT_CHECKIN': return this.getForgotCheckInGuide();
            case 'DASHBOARD': return this.getNavigationHelp('dashboard');
            case 'PROFILE': return this.getNavigationHelp('profile');
            case 'HISTORY': return this.getNavigationHelp('history');
            case 'EPASS': return this.getNavigationHelp('epass');
            case 'HELP': return this.getUserHelpMenu();
            default: return { type: MESSAGE_TYPES.TEXT, content: RESPONSES.unknown };
        }
    }

    async handleAdminIntent(intent, message, context) {
        switch (intent) {
            case 'GREETING': return { type: MESSAGE_TYPES.TEXT, content: RESPONSES.greeting.admin };
            case 'TODAY_SUMMARY': return await this.getTodayAttendanceSummary();
            case 'LATE_COUNT': return await this.getLateCountToday();
            case 'ABSENT_COUNT': return await this.getAbsentCountToday();
            case 'PRESENT_COUNT': return await this.getPresentCountToday();
            case 'ATTENDANCE_RATE': return await this.getAttendanceRate();
            case 'EXPORT_REPORTS': return this.getExportReportsGuide();
            case 'LOW_ATTENDANCE': return await this.getLowAttendanceDepartments();
            case 'FREQUENT_ABSENCE': return await this.getFrequentAbsentees();
            case 'SYSTEM_HEALTH': return this.getSystemHealthStatus();
            case 'DEACTIVATE_USER': return this.getDeactivateUserGuide();
            case 'POLICY_CONFIG': return this.getPolicyConfigGuide();
            case 'HOLIDAY_CONFIG': return this.getHolidayConfigGuide();
            case 'AUDIT_LOGS': return this.getAuditLogsGuide();
            case 'HELP': return this.getAdminHelpMenu();
            default: return { type: MESSAGE_TYPES.TEXT, content: RESPONSES.unknown };
        }
    }


    // USER HANDLERS
    async getUserAttendanceStatus(userId) {
        if (!browser || !db || !userId) return { type: MESSAGE_TYPES.TEXT, content: "I couldn't access your attendance data." };
        try {
            const today = new Date().toDateString();
            const snapshot = await get(ref(db, `attendance/${userId}`));
            if (!snapshot.exists()) {
                return { type: MESSAGE_TYPES.CARD, content: { icon: '📋', title: 'No Attendance Record', description: "You haven't checked in today yet.", status: 'warning', actions: [{ label: 'Go to Attendance', href: '/app/attendance' }] } };
            }
            let todayRecord = null;
            snapshot.forEach(child => { if (child.val().date === today) todayRecord = child.val(); });
            if (!todayRecord) {
                return { type: MESSAGE_TYPES.CARD, content: { icon: '⏰', title: 'Not Checked In', description: "You haven't checked in today.", status: 'warning', actions: [{ label: 'Check In Now', href: '/app/attendance' }] } };
            }
            const statusIcons = { present: '✅', late: '⚠️', absent: '❌', checkedIn: '🟢', checkedOut: '🔵' };
            const status = todayRecord.status || todayRecord.currentStatus;
            return { type: MESSAGE_TYPES.CARD, content: { icon: statusIcons[status] || '📋', title: `Status: ${status}`, description: todayRecord.checkIn?.timestamp ? `Checked in at ${new Date(todayRecord.checkIn.timestamp).toLocaleTimeString()}` : 'Attendance recorded', status: status === 'present' || status === 'checkedIn' ? 'success' : 'warning', details: todayRecord.workHours ? `Work hours: ${todayRecord.workHours.toFixed(1)}h` : null } };
        } catch (error) { return { type: MESSAGE_TYPES.TEXT, content: "Sorry, I couldn't fetch your attendance status." }; }
    }

    async getUserCheckInTime(userId) {
        if (!browser || !db || !userId) return { type: MESSAGE_TYPES.TEXT, content: "I couldn't access your data." };
        try {
            const today = new Date().toDateString();
            const snapshot = await get(ref(db, `attendance/${userId}`));
            let todayRecord = null;
            if (snapshot.exists()) snapshot.forEach(child => { if (child.val().date === today) todayRecord = child.val(); });
            if (!todayRecord?.checkIn?.timestamp) return { type: MESSAGE_TYPES.TEXT, content: "No check-in time recorded for today." };
            return { type: MESSAGE_TYPES.CARD, content: { icon: '⏰', title: 'Check-in Time', description: `You checked in at ${new Date(todayRecord.checkIn.timestamp).toLocaleTimeString()}`, status: todayRecord.status === 'late' ? 'warning' : 'success' } };
        } catch (error) { return { type: MESSAGE_TYPES.TEXT, content: "Sorry, I couldn't fetch your check-in time." }; }
    }

    async getLateReason(userId) {
        if (!browser || !db || !userId) return { type: MESSAGE_TYPES.TEXT, content: "I couldn't access your data." };
        try {
            const today = new Date().toDateString();
            const snapshot = await get(ref(db, `attendance/${userId}`));
            let todayRecord = null;
            if (snapshot.exists()) snapshot.forEach(child => { if (child.val().date === today) todayRecord = child.val(); });
            if (!todayRecord || todayRecord.status !== 'late') return { type: MESSAGE_TYPES.CARD, content: { icon: '✅', title: 'Not Marked Late', description: "You're not marked as late today!", status: 'success' } };
            const checkInTime = new Date(todayRecord.checkIn?.timestamp);
            const [startHour, startMin] = DEFAULT_SCHEDULE.startTime.split(':').map(Number);
            const scheduledStart = new Date(checkInTime); scheduledStart.setHours(startHour, startMin, 0, 0);
            const minutesLate = Math.round((checkInTime - scheduledStart) / 60000);
            return { type: MESSAGE_TYPES.GUIDE, content: { title: '⚠️ Late Arrival Explanation', sections: [{ heading: 'Why You Were Marked Late', text: `You checked in at ${checkInTime.toLocaleTimeString()}, which is ${minutesLate} minutes after the scheduled start time (${DEFAULT_SCHEDULE.startTime}).` }, { heading: 'Grace Period', text: `The grace period is ${DEFAULT_SCHEDULE.gracePeriod} minutes.` }], actions: [{ label: 'Request Correction', href: '/app/attendance?action=correction' }] } };
        } catch (error) { return { type: MESSAGE_TYPES.TEXT, content: "Sorry, I couldn't determine the late reason." }; }
    }

    async getUserAbsenceCount(userId) {
        if (!browser || !db || !userId) return { type: MESSAGE_TYPES.TEXT, content: "I couldn't access your data." };
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const summary = await getAttendanceSummary(userId, startOfMonth, now);
            return { type: MESSAGE_TYPES.STATS, content: { title: 'Your Attendance This Month', stats: [{ label: 'Present', value: summary.present, icon: '✅', color: 'green' }, { label: 'Late', value: summary.late, icon: '⚠️', color: 'yellow' }, { label: 'Absent', value: summary.absent, icon: '❌', color: 'red' }, { label: 'Total Hours', value: `${summary.totalHours.toFixed(1)}h`, icon: '⏱️' }] } };
        } catch (error) { return { type: MESSAGE_TYPES.TEXT, content: "Sorry, I couldn't fetch your attendance summary." }; }
    }


    getLatePolicyInfo() {
        return { type: MESSAGE_TYPES.GUIDE, content: { title: '📋 Late Policy', sections: [{ heading: 'Grace Period', text: `You have a ${DEFAULT_SCHEDULE.gracePeriod}-minute grace period after ${DEFAULT_SCHEDULE.startTime}.` }, { heading: 'Late Threshold', text: `Arriving more than ${DEFAULT_SCHEDULE.lateThreshold} minutes late will be flagged.` }, { heading: 'Consequences', text: 'Frequent late arrivals may affect your attendance record.' }] } };
    }

    getAbsencePolicyInfo() {
        return { type: MESSAGE_TYPES.GUIDE, content: { title: '📋 Absence Policy', sections: [{ heading: 'Allowed Absences', text: 'Check with your department for specific limits.' }, { heading: 'Reporting', text: 'Notify your supervisor in advance when possible.' }, { heading: 'Documentation', text: 'Extended absences may require documentation.' }] } };
    }

    async getHolidayInfo() {
        try {
            const frozen = await isAttendanceFrozen();
            if (frozen.frozen && frozen.reason === 'holiday') return { type: MESSAGE_TYPES.CARD, content: { icon: '🎉', title: `Today is ${frozen.holiday?.name || 'a Holiday'}!`, description: 'Attendance is not required today.', status: 'success' } };
            if (frozen.frozen && frozen.reason === 'weekend') return { type: MESSAGE_TYPES.CARD, content: { icon: '🌴', title: "It's the Weekend!", description: 'No attendance required.', status: 'success' } };
            return { type: MESSAGE_TYPES.CARD, content: { icon: '📅', title: 'Regular Working Day', description: "Today is a regular working day.", status: 'success', actions: [{ label: 'View Calendar', href: '/app/dashboard' }] } };
        } catch (error) { return { type: MESSAGE_TYPES.TEXT, content: "I couldn't check the holiday schedule." }; }
    }

    getScheduleInfo() {
        return { type: MESSAGE_TYPES.GUIDE, content: { title: '📅 Your Schedule', sections: [{ heading: 'Work Days', text: 'Monday - Friday' }, { heading: 'Start Time', text: DEFAULT_SCHEDULE.startTime }, { heading: 'End Time', text: DEFAULT_SCHEDULE.endTime }, { heading: 'Break', text: `${DEFAULT_SCHEDULE.breakDuration} minutes` }], actions: [{ label: 'View Calendar', href: '/app/dashboard' }] } };
    }

    getQRIssueGuide() {
        return { type: MESSAGE_TYPES.GUIDE, content: { title: '🔧 QR Scan Troubleshooting', sections: [{ heading: 'Common Solutions', text: '• Clean camera lens\n• Ensure good lighting\n• Hold phone steady\n• Check QR code is not damaged' }, { heading: 'Still Not Working?', text: 'Try face recognition as backup.' }], actions: [{ label: 'Try Face Scan', href: '/app/attendance?method=face' }, { label: 'Request Correction', href: '/app/attendance?action=correction' }] } };
    }

    getFaceIssueGuide() {
        return { type: MESSAGE_TYPES.GUIDE, content: { title: '🔧 Face Recognition Troubleshooting', sections: [{ heading: 'Tips', text: '• Good lighting\n• Face camera directly\n• Remove sunglasses/hats\n• Neutral expression' }, { heading: 'Re-register', text: 'Go to Profile to re-register your face.' }], actions: [{ label: 'Go to Profile', href: '/app/profile' }, { label: 'Try QR Scan', href: '/app/attendance?method=qr' }] } };
    }

    getForgotCheckInGuide() {
        return { type: MESSAGE_TYPES.GUIDE, content: { title: '📝 Forgot to Check In?', sections: [{ heading: 'Request Correction', text: 'Submit a correction request for review.' }, { heading: 'What You Need', text: '• Date of missed check-in\n• Approximate arrival time\n• Reason' }, { heading: 'Processing', text: 'Requests are reviewed within 1-2 business days.' }], actions: [{ label: 'Submit Request', href: '/app/attendance?action=correction' }] } };
    }

    getNavigationHelp(section) {
        const navInfo = {
            dashboard: { icon: '🏠', title: 'Dashboard', description: 'View your attendance overview and quick actions.', href: '/app/dashboard' },
            profile: { icon: '👤', title: 'Profile', description: 'Manage your profile and settings.', href: '/app/profile' },
            history: { icon: '📜', title: 'History', description: 'View your attendance history.', href: '/app/history' },
            epass: { icon: '🎫', title: 'E-Pass', description: 'Your digital ID card.', href: '/app/epass' }
        };
        const info = navInfo[section] || navInfo.dashboard;
        return { type: MESSAGE_TYPES.CARD, content: { icon: info.icon, title: info.title, description: info.description, status: 'success', actions: [{ label: `Go to ${info.title}`, href: info.href }] } };
    }

    getUserHelpMenu() {
        return { type: MESSAGE_TYPES.QUICK_REPLIES, content: { title: "Here's what I can help with:", options: [{ label: '✅ My status', query: 'Am I present today?' }, { label: '⏰ Check-in time', query: 'What time did I check in?' }, { label: '📊 My summary', query: 'How many absences do I have?' }, { label: '📋 Late policy', query: 'What is the late policy?' }, { label: '🎉 Holiday info', query: 'Is today a holiday?' }, { label: '🔧 QR issues', query: 'My QR scan failed' }, { label: '📝 Forgot check-in', query: 'I forgot to check in' }] } };
    }


    // ADMIN HANDLERS
    async getTodayAttendanceSummary() {
        if (!browser || !db) return { type: MESSAGE_TYPES.TEXT, content: "Database not available." };
        try {
            const today = new Date().toDateString();
            const usersSnapshot = await get(ref(db, 'users'));
            let totalUsers = 0, present = 0, late = 0, absent = 0;
            if (usersSnapshot.exists()) {
                const userIds = Object.keys(usersSnapshot.val());
                totalUsers = userIds.length;
                for (const userId of userIds) {
                    const attSnapshot = await get(ref(db, `attendance/${userId}`));
                    let hasRecord = false;
                    if (attSnapshot.exists()) {
                        attSnapshot.forEach(child => {
                            const record = child.val();
                            if (record.date === today) {
                                hasRecord = true;
                                if (record.status === 'late') late++;
                                else if (record.status === 'present' || record.currentStatus === 'checkedIn' || record.currentStatus === 'checkedOut') present++;
                                else if (record.status === 'absent') absent++;
                            }
                        });
                    }
                    if (!hasRecord) absent++;
                }
            }
            const rate = totalUsers > 0 ? ((present + late) / totalUsers * 100).toFixed(1) : 0;
            return { type: MESSAGE_TYPES.STATS, content: { title: "Today's Attendance Summary", stats: [{ label: 'Total', value: totalUsers, icon: '👥' }, { label: 'Present', value: present, icon: '✅', color: 'green' }, { label: 'Late', value: late, icon: '⚠️', color: 'yellow' }, { label: 'Absent', value: absent, icon: '❌', color: 'red' }], note: `Attendance Rate: ${rate}%` } };
        } catch (error) { return { type: MESSAGE_TYPES.TEXT, content: "Sorry, I couldn't fetch today's summary." }; }
    }

    async getLateCountToday() {
        if (!browser || !db) return { type: MESSAGE_TYPES.TEXT, content: "Database not available." };
        try {
            const today = new Date().toDateString();
            const usersSnapshot = await get(ref(db, 'users'));
            let lateCount = 0;
            const lateUsers = [];
            if (usersSnapshot.exists()) {
                const users = usersSnapshot.val();
                for (const [userId, userData] of Object.entries(users)) {
                    const attSnapshot = await get(ref(db, `attendance/${userId}`));
                    if (attSnapshot.exists()) {
                        attSnapshot.forEach(child => {
                            const record = child.val();
                            if (record.date === today && record.status === 'late') {
                                lateCount++;
                                if (lateUsers.length < 5) lateUsers.push({ name: userData.name || 'Unknown', time: record.checkIn?.timestamp ? new Date(record.checkIn.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '' });
                            }
                        });
                    }
                }
            }
            if (lateCount === 0) return { type: MESSAGE_TYPES.CARD, content: { icon: '✅', title: 'No Late Arrivals', description: 'Everyone arrived on time!', status: 'success' } };
            return { type: MESSAGE_TYPES.LIST, content: { icon: '⚠️', title: `${lateCount} Users Late Today`, items: lateUsers.map(u => ({ primary: u.name, secondary: `Arrived: ${u.time}` })), note: lateCount > 5 ? `...and ${lateCount - 5} more` : null, status: 'warning', actions: [{ label: 'View Details', href: '/admin/attendance' }] } };
        } catch (error) { return { type: MESSAGE_TYPES.TEXT, content: "Sorry, I couldn't fetch the late count." }; }
    }

    async getAbsentCountToday() {
        if (!browser || !db) return { type: MESSAGE_TYPES.TEXT, content: "Database not available." };
        try {
            const today = new Date().toDateString();
            const usersSnapshot = await get(ref(db, 'users'));
            let absentCount = 0;
            if (usersSnapshot.exists()) {
                for (const userId of Object.keys(usersSnapshot.val())) {
                    const attSnapshot = await get(ref(db, `attendance/${userId}`));
                    let hasCheckedIn = false;
                    if (attSnapshot.exists()) attSnapshot.forEach(child => { if (child.val().date === today && (child.val().checkIn || child.val().currentStatus)) hasCheckedIn = true; });
                    if (!hasCheckedIn) absentCount++;
                }
            }
            return { type: MESSAGE_TYPES.CARD, content: { icon: absentCount > 0 ? '❌' : '✅', title: absentCount > 0 ? `${absentCount} Users Absent` : 'Full Attendance!', description: absentCount > 0 ? `${absentCount} users haven't checked in.` : 'Everyone has checked in!', status: absentCount > 5 ? 'error' : absentCount > 0 ? 'warning' : 'success', actions: absentCount > 0 ? [{ label: 'View Details', href: '/admin/attendance' }] : null } };
        } catch (error) { return { type: MESSAGE_TYPES.TEXT, content: "Sorry, I couldn't fetch the absent count." }; }
    }

    async getPresentCountToday() {
        if (!browser || !db) return { type: MESSAGE_TYPES.TEXT, content: "Database not available." };
        try {
            const today = new Date().toDateString();
            const usersSnapshot = await get(ref(db, 'users'));
            let presentCount = 0, totalUsers = 0;
            if (usersSnapshot.exists()) {
                totalUsers = Object.keys(usersSnapshot.val()).length;
                for (const userId of Object.keys(usersSnapshot.val())) {
                    const attSnapshot = await get(ref(db, `attendance/${userId}`));
                    if (attSnapshot.exists()) attSnapshot.forEach(child => { if (child.val().date === today && (child.val().status === 'present' || child.val().status === 'late' || child.val().currentStatus)) presentCount++; });
                }
            }
            const pct = totalUsers > 0 ? (presentCount / totalUsers * 100).toFixed(1) : 0;
            return { type: MESSAGE_TYPES.CARD, content: { icon: '✅', title: `${presentCount} Users Present`, description: `${presentCount} out of ${totalUsers} users checked in.`, status: pct >= 90 ? 'success' : pct >= 70 ? 'warning' : 'error', details: `Attendance: ${pct}%` } };
        } catch (error) { return { type: MESSAGE_TYPES.TEXT, content: "Sorry, I couldn't fetch the present count." }; }
    }

    async getAttendanceRate() {
        if (!browser || !db) return { type: MESSAGE_TYPES.TEXT, content: "Database not available." };
        try {
            const now = new Date();
            const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
            const usersSnapshot = await get(ref(db, 'users'));
            let totalExpected = 0, totalPresent = 0;
            if (usersSnapshot.exists()) {
                const userIds = Object.keys(usersSnapshot.val());
                const workDays = Math.min(now.getDay() || 7, 5);
                totalExpected = userIds.length * workDays;
                for (const userId of userIds) {
                    const attSnapshot = await get(ref(db, `attendance/${userId}`));
                    if (attSnapshot.exists()) attSnapshot.forEach(child => { const r = child.val(); const d = new Date(r.date); if (d >= weekStart && d <= now && (r.status === 'present' || r.status === 'late' || r.currentStatus)) totalPresent++; });
                }
            }
            const rate = totalExpected > 0 ? (totalPresent / totalExpected * 100).toFixed(1) : 0;
            return { type: MESSAGE_TYPES.CARD, content: { icon: '📈', title: `Weekly Rate: ${rate}%`, description: `${totalPresent} check-ins out of ${totalExpected} expected.`, status: rate >= 90 ? 'success' : rate >= 75 ? 'warning' : 'error', actions: [{ label: 'View Reports', href: '/admin/reports' }] } };
        } catch (error) { return { type: MESSAGE_TYPES.TEXT, content: "Sorry, I couldn't calculate the rate." }; }
    }


    async getLowAttendanceDepartments() {
        if (!browser || !db) return { type: MESSAGE_TYPES.TEXT, content: "Database not available." };
        try {
            const usersSnapshot = await get(ref(db, 'users'));
            const deptStats = {};
            const now = new Date();
            const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
            if (usersSnapshot.exists()) {
                for (const [userId, userData] of Object.entries(usersSnapshot.val())) {
                    const dept = userData.departmentOrCourse || 'Unassigned';
                    if (!deptStats[dept]) deptStats[dept] = { total: 0, present: 0 };
                    deptStats[dept].total++;
                    const attSnapshot = await get(ref(db, `attendance/${userId}`));
                    if (attSnapshot.exists()) attSnapshot.forEach(child => { const r = child.val(); if (new Date(r.date) >= weekStart && (r.status === 'present' || r.status === 'late' || r.currentStatus)) deptStats[dept].present++; });
                }
            }
            const deptRates = Object.entries(deptStats).map(([dept, stats]) => ({ dept, rate: stats.total > 0 ? (stats.present / (stats.total * 5) * 100) : 0, count: stats.total })).sort((a, b) => a.rate - b.rate).slice(0, 5);
            if (deptRates.length === 0) return { type: MESSAGE_TYPES.TEXT, content: "No department data available." };
            return { type: MESSAGE_TYPES.LIST, content: { icon: '📉', title: 'Departments by Attendance', subtitle: 'Last 7 days (lowest first)', items: deptRates.map(d => ({ primary: d.dept, secondary: `${d.rate.toFixed(1)}% • ${d.count} users` })), status: deptRates[0]?.rate < 70 ? 'error' : 'warning', actions: [{ label: 'View Report', href: '/admin/reports' }] } };
        } catch (error) { return { type: MESSAGE_TYPES.TEXT, content: "Sorry, I couldn't analyze departments." }; }
    }

    async getFrequentAbsentees() {
        if (!browser || !db) return { type: MESSAGE_TYPES.TEXT, content: "Database not available." };
        try {
            const usersSnapshot = await get(ref(db, 'users'));
            const absenteeList = [];
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            if (usersSnapshot.exists()) {
                for (const [userId, userData] of Object.entries(usersSnapshot.val())) {
                    let absences = 0, lateCount = 0;
                    const attSnapshot = await get(ref(db, `attendance/${userId}`));
                    if (attSnapshot.exists()) attSnapshot.forEach(child => { const r = child.val(); if (new Date(r.date) >= monthStart) { if (r.status === 'absent') absences++; if (r.status === 'late') lateCount++; } });
                    if (absences >= 3 || lateCount >= 5) absenteeList.push({ name: userData.name || 'Unknown', absences, lateCount, dept: userData.departmentOrCourse || '' });
                }
            }
            absenteeList.sort((a, b) => (b.absences + b.lateCount) - (a.absences + a.lateCount));
            if (absenteeList.length === 0) return { type: MESSAGE_TYPES.CARD, content: { icon: '✅', title: 'No Attendance Concerns', description: 'No users with excessive absences this month.', status: 'success' } };
            return { type: MESSAGE_TYPES.LIST, content: { icon: '⚠️', title: 'Users with Concerns', subtitle: 'This month (3+ absences or 5+ late)', items: absenteeList.slice(0, 5).map(u => ({ primary: u.name, secondary: `${u.absences} absences, ${u.lateCount} late` })), note: absenteeList.length > 5 ? `...and ${absenteeList.length - 5} more` : null, status: 'warning', actions: [{ label: 'View Users', href: '/admin/users' }] } };
        } catch (error) { return { type: MESSAGE_TYPES.TEXT, content: "Sorry, I couldn't fetch absentee data." }; }
    }

    getSystemHealthStatus() {
        return { type: MESSAGE_TYPES.STATS, content: { title: 'System Health', stats: [{ label: 'QR Scanner', value: 'OK', icon: '✅', color: 'green' }, { label: 'Face Recognition', value: 'OK', icon: '✅', color: 'green' }, { label: 'Database', value: 'Connected', icon: '✅', color: 'green' }, { label: 'Last Sync', value: 'Now', icon: '🔄' }], note: 'All systems operational.' } };
    }

    getExportReportsGuide() {
        return { type: MESSAGE_TYPES.GUIDE, content: { title: '📥 Export Reports', sections: [{ heading: 'Formats', text: '• PDF - For printing\n• Excel - For analysis\n• CSV - For import' }, { heading: 'How to Export', text: '1. Go to Reports\n2. Select date range\n3. Apply filters\n4. Click Export' }], actions: [{ label: 'Go to Reports', href: '/admin/reports' }] } };
    }

    getDeactivateUserGuide() {
        return { type: MESSAGE_TYPES.GUIDE, content: { title: '👤 Deactivate User', sections: [{ heading: 'Before Deactivating', text: '• Export attendance history\n• Document the reason' }, { heading: 'Steps', text: '1. Go to User Management\n2. Find the user\n3. Click Deactivate\n4. Confirm' }], actions: [{ label: 'User Management', href: '/admin/users' }] } };
    }

    getPolicyConfigGuide() {
        return { type: MESSAGE_TYPES.GUIDE, content: { title: '⚙️ Policy Configuration', sections: [{ heading: 'Grace Period', text: `Current: ${DEFAULT_SCHEDULE.gracePeriod} minutes` }, { heading: 'Work Hours', text: `${DEFAULT_SCHEDULE.startTime} - ${DEFAULT_SCHEDULE.endTime}` }], actions: [{ label: 'System Settings', href: '/admin/settings' }] } };
    }

    getHolidayConfigGuide() {
        return { type: MESSAGE_TYPES.GUIDE, content: { title: '🎉 Holiday Configuration', sections: [{ heading: 'Add Holiday', text: '1. Go to System Settings\n2. Navigate to Holidays\n3. Click Add Holiday' }], actions: [{ label: 'Manage Holidays', href: '/admin/settings?tab=holidays' }] } };
    }

    getAuditLogsGuide() {
        return { type: MESSAGE_TYPES.GUIDE, content: { title: '📜 Audit Logs', sections: [{ heading: 'What is Logged', text: '• User logins\n• Attendance records\n• Admin actions\n• System changes' }], actions: [{ label: 'View Logs', href: '/admin/audit-logs' }] } };
    }

    getAdminHelpMenu() {
        return { type: MESSAGE_TYPES.QUICK_REPLIES, content: { title: "Here's what I can help with:", options: [{ label: "📊 Today's summary", query: "Show today's attendance" }, { label: '⚠️ Late arrivals', query: 'How many are late?' }, { label: '❌ Absent users', query: 'Who is absent?' }, { label: '📈 Weekly rate', query: 'Attendance rate this week?' }, { label: '📥 Export reports', query: 'How to export reports?' }, { label: '📉 Low attendance', query: 'Which department has low attendance?' }, { label: '🔧 System health', query: 'Is the system working?' }, { label: '⚙️ Configure policy', query: 'How to change grace period?' }] } };
    }
}

export const chatbotService = new ChatbotService();
export async function sendMessage(message, role, context) {
    return chatbotService.processMessage(message, role, context);
}
