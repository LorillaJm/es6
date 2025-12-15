// src/lib/ai/predictiveInsights.js
// Phase 3 - Predictive Insights Engine
// Analyzes attendance patterns to provide proactive suggestions and predictions

import { browser } from '$app/environment';

/**
 * Attendance Pattern Types
 */
export const PATTERN_TYPES = {
    CONSISTENT_EARLY: 'consistent_early',
    CONSISTENT_LATE: 'consistent_late',
    IMPROVING: 'improving',
    DECLINING: 'declining',
    IRREGULAR: 'irregular',
    STABLE: 'stable',
    AT_RISK: 'at_risk'
};

/**
 * Insight Categories
 */
export const INSIGHT_CATEGORIES = {
    ATTENDANCE_TREND: 'attendance_trend',
    LATE_PATTERN: 'late_pattern',
    ABSENCE_RISK: 'absence_risk',
    PERFORMANCE_ALERT: 'performance_alert',
    POSITIVE_RECOGNITION: 'positive_recognition',
    SCHEDULE_SUGGESTION: 'schedule_suggestion',
    DEPARTMENT_INSIGHT: 'department_insight'
};

/**
 * Predictive Insights Engine
 */
export class PredictiveInsightsEngine {
    constructor() {
        this.insightCache = new Map();
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Analyze user attendance patterns
     */
    analyzeUserPatterns(attendanceRecords, userProfile = {}) {
        if (!attendanceRecords?.length) {
            return { pattern: PATTERN_TYPES.STABLE, confidence: 0, insights: [] };
        }

        const sorted = [...attendanceRecords].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );

        const stats = this.calculateStats(sorted);
        const trend = this.detectTrend(sorted);
        const pattern = this.classifyPattern(stats, trend);
        const insights = this.generateUserInsights(stats, trend, pattern, userProfile);

        return { pattern, confidence: trend.confidence, stats, trend, insights };
    }

    /**
     * Calculate attendance statistics
     */
    calculateStats(records) {
        const total = records.length;
        if (total === 0) return null;

        let present = 0, late = 0, absent = 0, totalMinutesLate = 0;
        const checkInTimes = [];
        const dayOfWeekStats = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

        records.forEach(record => {
            const status = record.status || record.currentStatus;
            if (status === 'present' || status === 'checkedIn' || status === 'checkedOut') present++;
            else if (status === 'late') { late++; if (record.minutesLate) totalMinutesLate += record.minutesLate; }
            else if (status === 'absent') absent++;

            if (record.checkIn?.timestamp) {
                const checkInDate = new Date(record.checkIn.timestamp);
                const minutes = checkInDate.getHours() * 60 + checkInDate.getMinutes();
                checkInTimes.push(minutes);
                dayOfWeekStats[checkInDate.getDay()].push(minutes);
            }
        });

        const avgCheckInTime = checkInTimes.length > 0 
            ? checkInTimes.reduce((a, b) => a + b, 0) / checkInTimes.length 
            : null;

        const checkInVariance = checkInTimes.length > 1
            ? Math.sqrt(checkInTimes.reduce((sum, t) => sum + Math.pow(t - avgCheckInTime, 2), 0) / checkInTimes.length)
            : 0;

        return {
            total,
            present,
            late,
            absent,
            attendanceRate: ((present + late) / total * 100).toFixed(1),
            lateRate: (late / total * 100).toFixed(1),
            absentRate: (absent / total * 100).toFixed(1),
            avgMinutesLate: late > 0 ? (totalMinutesLate / late).toFixed(1) : 0,
            avgCheckInTime,
            avgCheckInTimeFormatted: avgCheckInTime ? this.minutesToTime(avgCheckInTime) : null,
            checkInConsistency: checkInVariance < 15 ? 'high' : checkInVariance < 30 ? 'medium' : 'low',
            dayOfWeekStats: this.analyzeDayOfWeek(dayOfWeekStats)
        };
    }

    /**
     * Detect attendance trend over time
     */
    detectTrend(records) {
        if (records.length < 5) {
            return { direction: 'stable', confidence: 0.3, slope: 0 };
        }

        // Split into two halves and compare
        const mid = Math.floor(records.length / 2);
        const firstHalf = records.slice(0, mid);
        const secondHalf = records.slice(mid);

        const firstScore = this.calculatePeriodScore(firstHalf);
        const secondScore = this.calculatePeriodScore(secondHalf);
        const diff = secondScore - firstScore;

        let direction = 'stable';
        if (diff > 10) direction = 'improving';
        else if (diff < -10) direction = 'declining';

        // Calculate confidence based on sample size and consistency
        const confidence = Math.min(0.9, 0.3 + (records.length / 30) * 0.6);

        return { direction, confidence, slope: diff, firstScore, secondScore };
    }

    /**
     * Calculate period attendance score (0-100)
     */
    calculatePeriodScore(records) {
        if (!records.length) return 50;
        let score = 0;
        records.forEach(r => {
            const status = r.status || r.currentStatus;
            if (status === 'present' || status === 'checkedIn' || status === 'checkedOut') score += 100;
            else if (status === 'late') score += 70;
            else score += 0;
        });
        return score / records.length;
    }

    /**
     * Classify overall attendance pattern
     */
    classifyPattern(stats, trend) {
        if (!stats) return PATTERN_TYPES.STABLE;

        const { attendanceRate, lateRate, checkInConsistency } = stats;
        const rate = parseFloat(attendanceRate);
        const lRate = parseFloat(lateRate);

        if (rate < 70 || (trend.direction === 'declining' && rate < 85)) {
            return PATTERN_TYPES.AT_RISK;
        }
        if (trend.direction === 'improving') return PATTERN_TYPES.IMPROVING;
        if (trend.direction === 'declining') return PATTERN_TYPES.DECLINING;
        if (lRate > 30) return PATTERN_TYPES.CONSISTENT_LATE;
        if (rate > 95 && checkInConsistency === 'high') return PATTERN_TYPES.CONSISTENT_EARLY;
        if (checkInConsistency === 'low') return PATTERN_TYPES.IRREGULAR;
        return PATTERN_TYPES.STABLE;
    }

    /**
     * Generate personalized insights for user
     */
    generateUserInsights(stats, trend, pattern, userProfile) {
        const insights = [];
        if (!stats) return insights;

        // Positive recognition
        if (parseFloat(stats.attendanceRate) >= 95) {
            insights.push({
                category: INSIGHT_CATEGORIES.POSITIVE_RECOGNITION,
                priority: 'low',
                icon: '🌟',
                title: 'Excellent Attendance!',
                message: `Your ${stats.attendanceRate}% attendance rate is outstanding. Keep it up!`,
                actionable: false
            });
        }

        // Trend insights
        if (trend.direction === 'improving') {
            insights.push({
                category: INSIGHT_CATEGORIES.ATTENDANCE_TREND,
                priority: 'low',
                icon: '📈',
                title: 'Improving Trend',
                message: 'Your attendance has been improving recently. Great progress!',
                actionable: false
            });
        } else if (trend.direction === 'declining') {
            insights.push({
                category: INSIGHT_CATEGORIES.ATTENDANCE_TREND,
                priority: 'high',
                icon: '📉',
                title: 'Attention Needed',
                message: 'Your attendance has been declining. Consider reviewing your schedule.',
                actionable: true,
                action: { label: 'View History', href: '/app/history' }
            });
        }

        // Late pattern insights
        if (parseFloat(stats.lateRate) > 20) {
            const suggestion = stats.dayOfWeekStats?.worstDay 
                ? `You tend to arrive later on ${stats.dayOfWeekStats.worstDay.name}s.`
                : 'Consider setting an earlier alarm.';
            insights.push({
                category: INSIGHT_CATEGORIES.LATE_PATTERN,
                priority: 'medium',
                icon: '⏰',
                title: 'Late Arrival Pattern',
                message: `You've been late ${stats.lateRate}% of the time. ${suggestion}`,
                actionable: true,
                action: { label: 'View Late Policy', query: 'What is the late policy?' }
            });
        }

        // Absence risk prediction
        if (pattern === PATTERN_TYPES.AT_RISK) {
            insights.push({
                category: INSIGHT_CATEGORIES.ABSENCE_RISK,
                priority: 'critical',
                icon: '⚠️',
                title: 'Attendance Alert',
                message: 'Your attendance pattern suggests you may be at risk. Please reach out if you need support.',
                actionable: true,
                action: { label: 'Get Help', query: 'I need help with my attendance' }
            });
        }

        // Schedule suggestion based on check-in consistency
        if (stats.checkInConsistency === 'low' && stats.avgCheckInTimeFormatted) {
            insights.push({
                category: INSIGHT_CATEGORIES.SCHEDULE_SUGGESTION,
                priority: 'medium',
                icon: '📅',
                title: 'Consistency Tip',
                message: `Your check-in times vary a lot. Try arriving consistently around ${stats.avgCheckInTimeFormatted}.`,
                actionable: false
            });
        }

        return insights.sort((a, b) => {
            const priority = { critical: 0, high: 1, medium: 2, low: 3 };
            return priority[a.priority] - priority[b.priority];
        });
    }

    /**
     * Generate admin/department insights
     */
    generateAdminInsights(departmentData, allUsersData) {
        const insights = [];

        // Department comparison
        if (departmentData?.length > 1) {
            const sorted = [...departmentData].sort((a, b) => a.rate - b.rate);
            const lowest = sorted[0];
            const highest = sorted[sorted.length - 1];

            if (lowest.rate < 70) {
                insights.push({
                    category: INSIGHT_CATEGORIES.DEPARTMENT_INSIGHT,
                    priority: 'high',
                    icon: '🏢',
                    title: 'Department Alert',
                    message: `${lowest.name} has the lowest attendance at ${lowest.rate.toFixed(1)}%. Consider investigating.`,
                    actionable: true,
                    action: { label: 'View Department', href: '/admin/reports' }
                });
            }

            if (highest.rate > 95) {
                insights.push({
                    category: INSIGHT_CATEGORIES.POSITIVE_RECOGNITION,
                    priority: 'low',
                    icon: '🏆',
                    title: 'Top Performer',
                    message: `${highest.name} leads with ${highest.rate.toFixed(1)}% attendance!`,
                    actionable: false
                });
            }
        }

        // At-risk users count
        const atRiskUsers = allUsersData?.filter(u => u.pattern === PATTERN_TYPES.AT_RISK) || [];
        if (atRiskUsers.length > 0) {
            insights.push({
                category: INSIGHT_CATEGORIES.PERFORMANCE_ALERT,
                priority: 'high',
                icon: '👥',
                title: 'Users Need Attention',
                message: `${atRiskUsers.length} user${atRiskUsers.length > 1 ? 's' : ''} showing at-risk attendance patterns.`,
                actionable: true,
                action: { label: 'View Users', href: '/admin/users?filter=at-risk' }
            });
        }

        // Day of week trends
        const dayTrends = this.analyzeDayOfWeekTrends(allUsersData);
        if (dayTrends?.worstDay && dayTrends.worstDay.avgRate < 80) {
            insights.push({
                category: INSIGHT_CATEGORIES.ATTENDANCE_TREND,
                priority: 'medium',
                icon: '📊',
                title: 'Weekly Pattern',
                message: `${dayTrends.worstDay.name} has the lowest attendance (${dayTrends.worstDay.avgRate.toFixed(1)}%).`,
                actionable: false
            });
        }

        return insights;
    }

    /**
     * Predict next week's attendance
     */
    predictNextWeek(userRecords, userProfile) {
        const analysis = this.analyzeUserPatterns(userRecords, userProfile);
        if (!analysis.stats) return null;

        const baseRate = parseFloat(analysis.stats.attendanceRate);
        const trendAdjustment = analysis.trend.direction === 'improving' ? 2 
            : analysis.trend.direction === 'declining' ? -3 : 0;

        const predictedRate = Math.min(100, Math.max(0, baseRate + trendAdjustment));
        const confidence = analysis.trend.confidence * 0.8;

        return {
            predictedAttendanceRate: predictedRate.toFixed(1),
            confidence: (confidence * 100).toFixed(0),
            basedOn: `${userRecords.length} records`,
            riskLevel: predictedRate < 70 ? 'high' : predictedRate < 85 ? 'medium' : 'low',
            recommendation: this.getRecommendation(analysis.pattern, predictedRate)
        };
    }

    /**
     * Get personalized recommendation
     */
    getRecommendation(pattern, predictedRate) {
        const recommendations = {
            [PATTERN_TYPES.AT_RISK]: 'Consider speaking with your supervisor about any challenges you may be facing.',
            [PATTERN_TYPES.DECLINING]: 'Your attendance is trending down. Try to identify and address any obstacles.',
            [PATTERN_TYPES.CONSISTENT_LATE]: 'Setting your alarm 15 minutes earlier could help improve your punctuality.',
            [PATTERN_TYPES.IRREGULAR]: 'Establishing a consistent routine may help stabilize your attendance.',
            [PATTERN_TYPES.IMPROVING]: 'Great progress! Keep up the momentum.',
            [PATTERN_TYPES.CONSISTENT_EARLY]: 'Excellent consistency! You\'re a role model for attendance.',
            [PATTERN_TYPES.STABLE]: 'Your attendance is stable. Maintain your current routine.'
        };
        return recommendations[pattern] || recommendations[PATTERN_TYPES.STABLE];
    }

    // Helper methods
    minutesToTime(minutes) {
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        const period = h >= 12 ? 'PM' : 'AM';
        const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
        return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
    }

    analyzeDayOfWeek(dayStats) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const analysis = Object.entries(dayStats)
            .filter(([, times]) => times.length > 0)
            .map(([day, times]) => ({
                day: parseInt(day),
                name: days[parseInt(day)],
                avgTime: times.reduce((a, b) => a + b, 0) / times.length,
                count: times.length
            }))
            .sort((a, b) => b.avgTime - a.avgTime);

        return {
            worstDay: analysis[0] || null,
            bestDay: analysis[analysis.length - 1] || null,
            byDay: analysis
        };
    }

    analyzeDayOfWeekTrends(allUsersData) {
        if (!allUsersData?.length) return null;
        // Aggregate day-of-week stats across all users
        const dayRates = { 1: [], 2: [], 3: [], 4: [], 5: [] }; // Mon-Fri
        allUsersData.forEach(user => {
            if (user.stats?.dayOfWeekStats?.byDay) {
                user.stats.dayOfWeekStats.byDay.forEach(d => {
                    if (d.day >= 1 && d.day <= 5) dayRates[d.day].push(d.count);
                });
            }
        });
        const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const analysis = Object.entries(dayRates)
            .map(([day, counts]) => ({
                day: parseInt(day),
                name: days[parseInt(day)],
                avgRate: counts.length > 0 ? (counts.reduce((a, b) => a + b, 0) / counts.length) * 20 : 0
            }))
            .sort((a, b) => a.avgRate - b.avgRate);
        return { worstDay: analysis[0], bestDay: analysis[analysis.length - 1] };
    }
}

// Singleton instance
let insightsEngine = null;

export function getPredictiveEngine() {
    if (!insightsEngine) {
        insightsEngine = new PredictiveInsightsEngine();
    }
    return insightsEngine;
}

export default PredictiveInsightsEngine;
