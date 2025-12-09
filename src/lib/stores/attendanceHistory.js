// src/lib/stores/attendanceHistory.js
import { writable, derived } from 'svelte/store';

// Configuration for work schedule
// NOTE: Adjust standardStartTime to match your actual work schedule
// e.g., '08:00' for 8 AM start, '09:00' for 9 AM start
export const workConfig = writable({
    standardStartTime: '08:00',  // 8 AM start - adjust as needed
    standardEndTime: '17:00',    // 5 PM end - adjust as needed
    standardHoursPerDay: 8,
    lateThresholdMinutes: 1,     // Late if check-in is even 1 minute after start time (more strict)
    overtimeThresholdMinutes: 30,
    breakDurationMinutes: 60
});

// Function to update work config (can be called from settings)
export function updateWorkConfig(newConfig) {
    workConfig.update(current => ({ ...current, ...newConfig }));
}

// Raw attendance records store
export const attendanceRecords = writable([]);

// Filter state
export const filterState = writable({
    showLate: false,
    showOvertime: false,
    showUndertime: false,
    showMissedDays: false,
    showManualCorrections: false,
    dateRange: { start: null, end: null },
    searchQuery: ''
});

// Current view state
export const currentView = writable('daily'); // daily, weekly, monthly, yearly

// Helper functions
export function parseTime(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// Format date in local timezone as YYYY-MM-DD (avoids UTC timezone shift)
export function formatLocalDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getMinutesFromTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.getHours() * 60 + date.getMinutes();
}

export function calculateWorkDuration(checkIn, checkOut, breakDuration = 0) {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const durationMs = end - start - (breakDuration * 60 * 1000);
    return Math.max(0, durationMs / (1000 * 60 * 60)); // hours
}

export function analyzeRecord(record, config) {
    const analysis = {
        isLate: false,
        isOvertime: false,
        isUndertime: false,
        isMissed: false,
        isManualCorrection: false,
        isInProgress: false,
        lateMinutes: 0,
        overtimeMinutes: 0,
        undertimeMinutes: 0,
        totalHours: 0,
        checkInTime: null  // Store for debugging
    };

    if (!record.checkIn?.timestamp) {
        analysis.isMissed = true;
        return analysis;
    }

    const checkInDate = new Date(record.checkIn.timestamp);
    const checkInMinutes = checkInDate.getHours() * 60 + checkInDate.getMinutes();
    const standardStart = parseTime(config.standardStartTime);
    const lateThreshold = standardStart + config.lateThresholdMinutes;
    
    // Store check-in time for debugging
    analysis.checkInTime = `${String(checkInDate.getHours()).padStart(2, '0')}:${String(checkInDate.getMinutes()).padStart(2, '0')}`;
    
    // Check if late - someone is late if they check in after standard start + threshold
    // e.g., if start is 8:00 and threshold is 1 min, late if check-in > 8:01
    if (checkInMinutes > lateThreshold) {
        analysis.isLate = true;
        analysis.lateMinutes = checkInMinutes - standardStart;
    }
    
    // Also check if record has explicit isLate flag from server/database
    if (record.isLate === true || record.lateArrival === true) {
        analysis.isLate = true;
        if (!analysis.lateMinutes && checkInMinutes > standardStart) {
            analysis.lateMinutes = checkInMinutes - standardStart;
        }
    }
    
    // Check if checkIn has a late flag
    if (record.checkIn?.isLate === true || record.checkIn?.late === true) {
        analysis.isLate = true;
    }

    // Calculate work duration
    const breakDuration = record.breakStart?.timestamp && record.breakEnd?.timestamp 
        ? (new Date(record.breakEnd.timestamp) - new Date(record.breakStart.timestamp)) / (1000 * 60)
        : 0;
    
    if (record.checkOut?.timestamp) {
        // Completed shift
        analysis.totalHours = calculateWorkDuration(
            record.checkIn.timestamp, 
            record.checkOut.timestamp, 
            breakDuration
        );
    } else {
        // Still checked in - calculate hours so far (for today's record)
        const checkInDate = new Date(record.checkIn.timestamp).toDateString();
        const today = new Date().toDateString();
        if (checkInDate === today) {
            analysis.totalHours = calculateWorkDuration(
                record.checkIn.timestamp, 
                new Date().toISOString(), 
                breakDuration
            );
            analysis.isInProgress = true;
        }
    }

    if (analysis.totalHours > 0) {
        const standardHours = config.standardHoursPerDay;
        const workedMinutes = analysis.totalHours * 60;
        const standardMinutes = standardHours * 60;

        // Check overtime
        if (workedMinutes > standardMinutes + config.overtimeThresholdMinutes) {
            analysis.isOvertime = true;
            analysis.overtimeMinutes = workedMinutes - standardMinutes;
        }

        // Check undertime (only for completed shifts)
        if (!analysis.isInProgress && workedMinutes < standardMinutes - config.overtimeThresholdMinutes) {
            analysis.isUndertime = true;
            analysis.undertimeMinutes = standardMinutes - workedMinutes;
        }
    }

    // Check for manual corrections
    if (record.manualCorrection || record.correctedBy) {
        analysis.isManualCorrection = true;
    }

    return analysis;
}

// Derived store for processed records with analysis
export const processedRecords = derived(
    [attendanceRecords, workConfig],
    ([$records, $config]) => {
        return $records.map(record => ({
            ...record,
            analysis: analyzeRecord(record, $config)
        }));
    }
);

// Derived store for filtered records
export const filteredRecords = derived(
    [processedRecords, filterState],
    ([$records, $filters]) => {
        return $records.filter(record => {
            // Date range filter
            if ($filters.dateRange.start || $filters.dateRange.end) {
                const recordDate = new Date(record.date);
                if ($filters.dateRange.start && recordDate < new Date($filters.dateRange.start)) return false;
                if ($filters.dateRange.end && recordDate > new Date($filters.dateRange.end)) return false;
            }

            // Status filters (OR logic - show if any selected filter matches)
            const hasActiveFilters = $filters.showLate || $filters.showOvertime || 
                $filters.showUndertime || $filters.showMissedDays || $filters.showManualCorrections;
            
            if (hasActiveFilters) {
                const matchesFilter = 
                    ($filters.showLate && record.analysis.isLate) ||
                    ($filters.showOvertime && record.analysis.isOvertime) ||
                    ($filters.showUndertime && record.analysis.isUndertime) ||
                    ($filters.showMissedDays && record.analysis.isMissed) ||
                    ($filters.showManualCorrections && record.analysis.isManualCorrection);
                if (!matchesFilter) return false;
            }

            return true;
        });
    }
);

// Statistics derived store
export const attendanceStats = derived(processedRecords, ($records) => {
    const stats = {
        totalDays: $records.length,
        presentDays: 0,
        lateDays: 0,
        overtimeDays: 0,
        undertimeDays: 0,
        missedDays: 0,
        manualCorrections: 0,
        totalHoursWorked: 0,
        averageHoursPerDay: 0,
        totalLateMinutes: 0,
        totalOvertimeMinutes: 0,
        onTimePercentage: 0
    };

    $records.forEach(record => {
        if (record.analysis.isMissed) {
            stats.missedDays++;
        } else {
            stats.presentDays++;
            stats.totalHoursWorked += record.analysis.totalHours;
        }
        
        if (record.analysis.isLate) {
            stats.lateDays++;
            stats.totalLateMinutes += record.analysis.lateMinutes;
        }
        if (record.analysis.isOvertime) {
            stats.overtimeDays++;
            stats.totalOvertimeMinutes += record.analysis.overtimeMinutes;
        }
        if (record.analysis.isUndertime) stats.undertimeDays++;
        if (record.analysis.isManualCorrection) stats.manualCorrections++;
    });

    stats.averageHoursPerDay = stats.presentDays > 0 
        ? stats.totalHoursWorked / stats.presentDays 
        : 0;
    stats.onTimePercentage = stats.presentDays > 0 
        ? ((stats.presentDays - stats.lateDays) / stats.presentDays) * 100 
        : 0;

    return stats;
});

// Weekly summary derived store
export const weeklySummary = derived(processedRecords, ($records) => {
    const weeks = {};
    
    $records.forEach(record => {
        const date = new Date(record.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = formatLocalDate(weekStart);
        
        if (!weeks[weekKey]) {
            const weekEndDate = new Date(weekStart);
            weekEndDate.setDate(weekStart.getDate() + 6);
            weeks[weekKey] = {
                weekStart: weekKey,
                weekEnd: formatLocalDate(weekEndDate),
                days: [],
                totalHours: 0,
                lateDays: 0,
                overtimeDays: 0
            };
        }
        
        weeks[weekKey].days.push(record);
        weeks[weekKey].totalHours += record.analysis.totalHours;
        if (record.analysis.isLate) weeks[weekKey].lateDays++;
        if (record.analysis.isOvertime) weeks[weekKey].overtimeDays++;
    });
    
    return Object.values(weeks).sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart));
});

// Monthly heatmap data
export const monthlyHeatmap = derived(processedRecords, ($records) => {
    const heatmap = {};
    
    $records.forEach(record => {
        const date = new Date(record.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const dayKey = formatLocalDate(date);
        
        if (!heatmap[monthKey]) {
            heatmap[monthKey] = { days: {}, totalHours: 0, avgHours: 0 };
        }
        
        heatmap[monthKey].days[dayKey] = {
            hours: record.analysis.totalHours,
            isLate: record.analysis.isLate,
            isOvertime: record.analysis.isOvertime,
            isUndertime: record.analysis.isUndertime,
            isMissed: record.analysis.isMissed
        };
        heatmap[monthKey].totalHours += record.analysis.totalHours;
    });
    
    // Calculate averages
    Object.keys(heatmap).forEach(month => {
        const dayCount = Object.keys(heatmap[month].days).length;
        heatmap[month].avgHours = dayCount > 0 ? heatmap[month].totalHours / dayCount : 0;
    });
    
    return heatmap;
});

// Yearly summary
export const yearlySummary = derived(processedRecords, ($records) => {
    const years = {};
    
    $records.forEach(record => {
        const year = new Date(record.date).getFullYear();
        
        if (!years[year]) {
            years[year] = {
                year,
                months: {},
                totalDays: 0,
                presentDays: 0,
                lateDays: 0,
                overtimeDays: 0,
                undertimeDays: 0,
                totalHours: 0
            };
        }
        
        const month = new Date(record.date).getMonth();
        if (!years[year].months[month]) {
            years[year].months[month] = { days: 0, hours: 0, late: 0, overtime: 0 };
        }
        
        years[year].totalDays++;
        years[year].months[month].days++;
        years[year].months[month].hours += record.analysis.totalHours;
        
        if (!record.analysis.isMissed) {
            years[year].presentDays++;
            years[year].totalHours += record.analysis.totalHours;
        }
        if (record.analysis.isLate) {
            years[year].lateDays++;
            years[year].months[month].late++;
        }
        if (record.analysis.isOvertime) {
            years[year].overtimeDays++;
            years[year].months[month].overtime++;
        }
        if (record.analysis.isUndertime) years[year].undertimeDays++;
    });
    
    return years;
});
