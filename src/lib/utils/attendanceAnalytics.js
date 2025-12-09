// src/lib/utils/attendanceAnalytics.js
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInMinutes, getDay, subDays, eachDayOfInterval } from 'date-fns';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const STANDARD_CHECK_IN = 9 * 60; // 9:00 AM in minutes
const STANDARD_HOURS = 8; // 8 hours workday

/**
 * Calculate attendance percentage for a given period
 */
export function calculateAttendancePercentage(records, startDate, endDate) {
    const workDays = getWorkDaysInRange(startDate, endDate);
    const attendedDays = records.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate >= startDate && recordDate <= endDate && r.checkIn?.timestamp;
    }).length;
    return workDays > 0 ? Math.round((attendedDays / workDays) * 100) : 0;
}

/**
 * Get working days (Mon-Fri) in a date range
 */
function getWorkDaysInRange(startDate, endDate) {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    return days.filter(d => getDay(d) !== 0 && getDay(d) !== 6).length;
}

/**
 * Calculate late frequency and details
 */
export function calculateLateStats(records, lateThresholdMinutes = STANDARD_CHECK_IN) {
    const recordsWithCheckIn = records.filter(r => r.checkIn?.timestamp);
    if (recordsWithCheckIn.length === 0) return { lateCount: 0, latePercentage: 0, avgLateMinutes: 0 };

    let lateCount = 0;
    let totalLateMinutes = 0;

    recordsWithCheckIn.forEach(r => {
        const checkInTime = new Date(r.checkIn.timestamp);
        const checkInMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
        if (checkInMinutes > lateThresholdMinutes) {
            lateCount++;
            totalLateMinutes += checkInMinutes - lateThresholdMinutes;
        }
    });

    return {
        lateCount,
        latePercentage: Math.round((lateCount / recordsWithCheckIn.length) * 100),
        avgLateMinutes: lateCount > 0 ? Math.round(totalLateMinutes / lateCount) : 0
    };
}

/**
 * Find the day with most late arrivals
 */
export function findMostLateDay(records, lateThresholdMinutes = STANDARD_CHECK_IN) {
    const lateDays = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    records.filter(r => r.checkIn?.timestamp).forEach(r => {
        const checkInTime = new Date(r.checkIn.timestamp);
        const checkInMinutes = checkInTime.getHours() * 60 + checkInTime.getMinutes();
        if (checkInMinutes > lateThresholdMinutes) {
            const dayOfWeek = getDay(new Date(r.date));
            lateDays[dayOfWeek]++;
        }
    });

    const maxLateDay = Object.entries(lateDays).reduce((max, [day, count]) => 
        count > max.count ? { day: parseInt(day), count } : max, { day: -1, count: 0 });

    return maxLateDay.count > 0 ? { day: DAY_NAMES[maxLateDay.day], count: maxLateDay.count } : null;
}

/**
 * Calculate peak check-in time
 */
export function calculatePeakCheckInTime(records) {
    const hourCounts = {};
    records.filter(r => r.checkIn?.timestamp).forEach(r => {
        const hour = new Date(r.checkIn.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const peakHour = Object.entries(hourCounts).reduce((max, [hour, count]) => 
        count > max.count ? { hour: parseInt(hour), count } : max, { hour: -1, count: 0 });

    if (peakHour.hour === -1) return null;
    const period = peakHour.hour >= 12 ? 'PM' : 'AM';
    const displayHour = peakHour.hour > 12 ? peakHour.hour - 12 : peakHour.hour === 0 ? 12 : peakHour.hour;
    return { time: `${displayHour}:00 ${period}`, count: peakHour.count };
}

/**
 * Calculate overtime hours
 */
export function calculateOvertimeStats(records, standardHours = STANDARD_HOURS) {
    let totalOvertimeMinutes = 0;
    let overtimeDays = 0;
    const todayStr = new Date().toDateString();

    records.filter(r => r.checkIn?.timestamp).forEach(r => {
        const checkIn = new Date(r.checkIn.timestamp);
        let checkOut;
        if (r.checkOut?.timestamp) {
            checkOut = new Date(r.checkOut.timestamp);
        } else if (r.date === todayStr) {
            checkOut = new Date(); // Currently working
        } else {
            return; // Skip past incomplete records for overtime calc
        }
        
        const workedMinutes = differenceInMinutes(checkOut, checkIn);
        const standardMinutes = standardHours * 60;

        if (workedMinutes > standardMinutes) {
            totalOvertimeMinutes += workedMinutes - standardMinutes;
            overtimeDays++;
        }
    });

    return {
        totalHours: Math.round(totalOvertimeMinutes / 60 * 10) / 10,
        totalMinutes: totalOvertimeMinutes,
        overtimeDays,
        avgOvertimePerDay: overtimeDays > 0 ? Math.round(totalOvertimeMinutes / overtimeDays) : 0
    };
}

/**
 * Generate trend data for charts (last N days)
 */
export function generateTrendData(records, days = 30) {
    const endDate = new Date();
    const startDate = subDays(endDate, days - 1);
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
    const today = new Date().toDateString();

    return dateRange.map(date => {
        const dateStr = date.toDateString();
        const record = records.find(r => r.date === dateStr);
        let hoursWorked = 0;
        let checkInMinutes = null;

        if (record?.checkIn?.timestamp) {
            const checkIn = new Date(record.checkIn.timestamp);
            checkInMinutes = checkIn.getHours() * 60 + checkIn.getMinutes();
            // For today's record without checkout, use current time; for past days use checkIn time
            let checkOut;
            if (record.checkOut?.timestamp) {
                checkOut = new Date(record.checkOut.timestamp);
            } else if (dateStr === today) {
                checkOut = new Date(); // Still working today
            } else {
                checkOut = checkIn; // Past day with no checkout = 0 hours
            }
            hoursWorked = Math.max(0, Math.round(differenceInMinutes(checkOut, checkIn) / 60 * 10) / 10);
        }

        return {
            date: format(date, 'MMM d'),
            dayOfWeek: format(date, 'EEE'),
            hoursWorked,
            checkInMinutes,
            isWeekend: getDay(date) === 0 || getDay(date) === 6,
            hasData: !!record?.checkIn?.timestamp
        };
    });
}

/**
 * Generate weekly summary data
 */
export function generateWeeklySummary(records, weeks = 8) {
    const summaries = [];
    const today = new Date();
    const todayStr = today.toDateString();

    for (let i = 0; i < weeks; i++) {
        const weekEnd = subDays(today, i * 7);
        const weekStart = startOfWeek(weekEnd, { weekStartsOn: 1 });
        const weekEndDate = endOfWeek(weekEnd, { weekStartsOn: 1 });

        const weekRecords = records.filter(r => {
            const recordDate = new Date(r.date);
            return recordDate >= weekStart && recordDate <= weekEndDate;
        });

        let totalMinutes = 0;
        weekRecords.forEach(r => {
            if (r.checkIn?.timestamp) {
                const checkIn = new Date(r.checkIn.timestamp);
                let checkOut;
                if (r.checkOut?.timestamp) {
                    checkOut = new Date(r.checkOut.timestamp);
                } else if (r.date === todayStr) {
                    checkOut = new Date(); // Currently working
                } else {
                    checkOut = checkIn; // Past incomplete record
                }
                totalMinutes += Math.max(0, differenceInMinutes(checkOut, checkIn));
            }
        });

        const daysWorked = weekRecords.filter(r => r.checkIn?.timestamp).length;
        const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

        summaries.unshift({
            weekLabel: format(weekStart, 'MMM d'),
            startDate: weekStart.toISOString(),
            endDate: weekEndDate.toISOString(),
            dateRange: `${format(weekStart, 'MMM d')} - ${format(weekEndDate, 'MMM d')}`,
            totalHours,
            daysWorked,
            avgHoursPerDay: daysWorked > 0 ? Math.round(totalHours / daysWorked * 10) / 10 : 0,
            target: 40
        });
    }

    return summaries;
}

/**
 * Calculate check-in time distribution by hour
 */
export function getCheckInDistribution(records) {
    const distribution = Array(24).fill(0);
    records.filter(r => r.checkIn?.timestamp).forEach(r => {
        const hour = new Date(r.checkIn.timestamp).getHours();
        distribution[hour]++;
    });
    return distribution.map((count, hour) => ({ hour, count })).filter(d => d.count > 0);
}

/**
 * Get day-of-week performance stats
 */
export function getDayOfWeekStats(records) {
    const stats = DAY_NAMES.map((name, index) => ({
        day: name.slice(0, 3),
        fullDay: name,
        avgHours: 0,
        totalDays: 0,
        lateCount: 0
    }));

    const todayStr = new Date().toDateString();

    records.filter(r => r.checkIn?.timestamp).forEach(r => {
        const dayIndex = getDay(new Date(r.date));
        const checkIn = new Date(r.checkIn.timestamp);
        let checkOut;
        if (r.checkOut?.timestamp) {
            checkOut = new Date(r.checkOut.timestamp);
        } else if (r.date === todayStr) {
            checkOut = new Date(); // Currently working
        } else {
            checkOut = checkIn; // Past incomplete record
        }
        const hours = Math.max(0, differenceInMinutes(checkOut, checkIn) / 60);
        const checkInMinutes = checkIn.getHours() * 60 + checkIn.getMinutes();

        stats[dayIndex].totalDays++;
        stats[dayIndex].avgHours += hours;
        if (checkInMinutes > STANDARD_CHECK_IN) stats[dayIndex].lateCount++;
    });

    stats.forEach(s => {
        if (s.totalDays > 0) s.avgHours = Math.round(s.avgHours / s.totalDays * 10) / 10;
    });

    return stats;
}
