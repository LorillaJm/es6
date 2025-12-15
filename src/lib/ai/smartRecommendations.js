// src/lib/ai/smartRecommendations.js
// Smart Recommendations Engine - Phase 8.1
// Detect frequently late students, predict patterns, suggest interventions

import { browser } from '$app/environment';
import { db } from '$lib/firebase';
import { ref, get, query, orderByChild, limitToLast } from 'firebase/database';

/**
 * Intervention types
 */
export const InterventionType = {
    COUNSELING: 'counseling',
    SCHEDULE_ADJUSTMENT: 'schedule_adjustment',
    PARENT_NOTIFICATION: 'parent_notification',
    MENTOR_ASSIGNMENT: 'mentor_assignment',
    WARNING_NOTICE: 'warning_notice',
    RECOGNITION: 'recognition'
};

/**
 * Risk levels for students
 */
export const StudentRiskLevel = {
    LOW: 'low',
    MODERATE: 'moderate',
    HIGH: 'high',
    CRITICAL: 'critical'
};

/**
 * Thresholds for recommendations
 */
const THRESHOLDS = {
    frequentlyLateCount: 5,        // Late arrivals in last 30 days
    frequentlyLateStreak: 3,       // Consecutive late days
    absentWarning: 3,              // Absences in last 30 days
    absentCritical: 5,             // Critical absence threshold
    attendanceDropPercent: 15,     // % drop from average
    improvementPercent: 10,        // % improvement to recognize
    analysisWindowDays: 30
};

/**
 * Smart Recommendations Engine
 */
export class SmartRecommendationsEngine {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Analyze all students and generate recommendations
     */
    async analyzeAllStudents() {
        if (!browser || !db) return { students: [], summary: {} };

        try {
            const usersRef = ref(db, 'users');
            const usersSnapshot = await get(usersRef);
            
            if (!usersSnapshot.exists()) return { students: [], summary: {} };

            const students = [];
            const promises = [];

            usersSnapshot.forEach(child => {
                const user = { id: child.key, ...child.val() };
                if (user.role === 'student' || !user.role) {
                    promises.push(this.analyzeStudent(user));
                }
            });

            const results = await Promise.all(promises);
            
            // Filter students with recommendations
            const studentsWithRecommendations = results.filter(r => 
                r && (r.recommendations.length > 0 || r.riskLevel !== StudentRiskLevel.LOW)
            );

            // Generate summary
            const summary = this.generateSummary(results.filter(r => r));

            return {
                students: studentsWithRecommendations,
                summary
            };
        } catch (error) {
            console.error('Error analyzing students:', error);
            return { students: [], summary: {} };
        }
    }

    /**
     * Analyze individual student
     */
    async analyzeStudent(user) {
        if (!browser || !db) return null;

        const cacheKey = `student-${user.id}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }

        try {
            // Get attendance records
            const attendanceRef = ref(db, `attendance/${user.id}`);
            const attendanceQuery = query(attendanceRef, limitToLast(60));
            const snapshot = await get(attendanceQuery);

            const records = [];
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    records.push({ id: child.key, ...child.val() });
                });
            }

            // Analyze patterns
            const analysis = this.analyzeAttendancePatterns(records);
            const recommendations = this.generateRecommendations(user, analysis);
            const riskLevel = this.calculateRiskLevel(analysis);
            const predictions = this.predictFutureAttendance(analysis);

            const result = {
                userId: user.id,
                userName: user.name || user.displayName || 'Unknown',
                userEmail: user.email,
                department: user.department,
                year: user.year,
                section: user.section,
                analysis,
                recommendations,
                riskLevel,
                predictions,
                lastUpdated: new Date().toISOString()
            };

            this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result;
        } catch (error) {
            console.error(`Error analyzing student ${user.id}:`, error);
            return null;
        }
    }

    /**
     * Analyze attendance patterns
     */
    analyzeAttendancePatterns(records) {
        const now = new Date();
        const windowStart = new Date(now);
        windowStart.setDate(now.getDate() - THRESHOLDS.analysisWindowDays);

        const recentRecords = records.filter(r => {
            const recordDate = new Date(r.date || r.checkIn?.timestamp);
            return recordDate >= windowStart;
        });

        // Sort by date descending
        recentRecords.sort((a, b) => {
            const dateA = new Date(a.date || a.checkIn?.timestamp);
            const dateB = new Date(b.date || b.checkIn?.timestamp);
            return dateB - dateA;
        });

        // Calculate metrics
        let lateCount = 0;
        let absentCount = 0;
        let presentCount = 0;
        let consecutiveLate = 0;
        let maxConsecutiveLate = 0;
        let totalMinutesLate = 0;
        const lateByDayOfWeek = [0, 0, 0, 0, 0, 0, 0];
        const lateTimes = [];

        recentRecords.forEach((record, index) => {
            if (record.status === 'absent' || (!record.checkIn && !record.status)) {
                absentCount++;
                consecutiveLate = 0;
            } else if (record.status === 'late' || record.isLate) {
                lateCount++;
                presentCount++;
                consecutiveLate++;
                maxConsecutiveLate = Math.max(maxConsecutiveLate, consecutiveLate);
                
                if (record.minutesLate) {
                    totalMinutesLate += record.minutesLate;
                }
                
                const recordDate = new Date(record.date || record.checkIn?.timestamp);
                lateByDayOfWeek[recordDate.getDay()]++;
                
                if (record.checkIn?.timestamp) {
                    const checkInTime = new Date(record.checkIn.timestamp);
                    lateTimes.push(checkInTime.getHours() * 60 + checkInTime.getMinutes());
                }
            } else {
                presentCount++;
                consecutiveLate = 0;
            }
        });

        // Calculate trends
        const totalDays = recentRecords.length || 1;
        const attendanceRate = ((presentCount / totalDays) * 100).toFixed(1);
        const lateRate = ((lateCount / totalDays) * 100).toFixed(1);
        const avgMinutesLate = lateCount > 0 ? Math.round(totalMinutesLate / lateCount) : 0;

        // Find worst day
        const worstDayIndex = lateByDayOfWeek.indexOf(Math.max(...lateByDayOfWeek));
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        // Calculate trend (comparing first half vs second half)
        const midpoint = Math.floor(recentRecords.length / 2);
        const firstHalf = recentRecords.slice(midpoint);
        const secondHalf = recentRecords.slice(0, midpoint);
        
        const firstHalfLate = firstHalf.filter(r => r.status === 'late' || r.isLate).length;
        const secondHalfLate = secondHalf.filter(r => r.status === 'late' || r.isLate).length;
        
        let trend = 'stable';
        if (secondHalfLate > firstHalfLate + 2) trend = 'worsening';
        else if (secondHalfLate < firstHalfLate - 2) trend = 'improving';

        return {
            totalRecords: recentRecords.length,
            presentCount,
            lateCount,
            absentCount,
            attendanceRate: parseFloat(attendanceRate),
            lateRate: parseFloat(lateRate),
            consecutiveLateStreak: maxConsecutiveLate,
            currentLateStreak: consecutiveLate,
            avgMinutesLate,
            worstDay: dayNames[worstDayIndex],
            worstDayCount: lateByDayOfWeek[worstDayIndex],
            lateByDayOfWeek,
            trend,
            lateTimes
        };
    }


    /**
     * Generate recommendations based on analysis
     */
    generateRecommendations(user, analysis) {
        const recommendations = [];

        // Frequently late detection
        if (analysis.lateCount >= THRESHOLDS.frequentlyLateCount) {
            recommendations.push({
                type: InterventionType.COUNSELING,
                priority: 'high',
                title: 'Frequently Late Student',
                message: `${user.name || 'Student'} has been late ${analysis.lateCount} times in the last 30 days.`,
                suggestedAction: 'Schedule a meeting to discuss punctuality and identify underlying issues.',
                data: { lateCount: analysis.lateCount, avgMinutesLate: analysis.avgMinutesLate }
            });
        }

        // Consecutive late streak
        if (analysis.consecutiveLateStreak >= THRESHOLDS.frequentlyLateStreak) {
            recommendations.push({
                type: InterventionType.PARENT_NOTIFICATION,
                priority: 'high',
                title: 'Consecutive Late Arrivals',
                message: `${analysis.consecutiveLateStreak} consecutive late arrivals detected.`,
                suggestedAction: 'Consider notifying parents/guardians about the pattern.',
                data: { streak: analysis.consecutiveLateStreak }
            });
        }

        // High absence rate
        if (analysis.absentCount >= THRESHOLDS.absentCritical) {
            recommendations.push({
                type: InterventionType.WARNING_NOTICE,
                priority: 'critical',
                title: 'Critical Absence Level',
                message: `${analysis.absentCount} absences recorded. This may affect academic standing.`,
                suggestedAction: 'Issue formal warning and schedule intervention meeting.',
                data: { absentCount: analysis.absentCount }
            });
        } else if (analysis.absentCount >= THRESHOLDS.absentWarning) {
            recommendations.push({
                type: InterventionType.MENTOR_ASSIGNMENT,
                priority: 'medium',
                title: 'Absence Warning',
                message: `${analysis.absentCount} absences in the last 30 days.`,
                suggestedAction: 'Consider assigning a peer mentor for support.',
                data: { absentCount: analysis.absentCount }
            });
        }

        // Day-specific pattern
        if (analysis.worstDayCount >= 3) {
            recommendations.push({
                type: InterventionType.SCHEDULE_ADJUSTMENT,
                priority: 'medium',
                title: `${analysis.worstDay} Pattern Detected`,
                message: `Student is frequently late on ${analysis.worstDay}s (${analysis.worstDayCount} times).`,
                suggestedAction: 'Investigate if there are scheduling conflicts on this day.',
                data: { day: analysis.worstDay, count: analysis.worstDayCount }
            });
        }

        // Worsening trend
        if (analysis.trend === 'worsening') {
            recommendations.push({
                type: InterventionType.COUNSELING,
                priority: 'high',
                title: 'Worsening Attendance Trend',
                message: 'Attendance pattern is deteriorating over the past weeks.',
                suggestedAction: 'Early intervention recommended to prevent further decline.',
                data: { trend: analysis.trend }
            });
        }

        // Recognition for improvement
        if (analysis.trend === 'improving' && analysis.attendanceRate >= 90) {
            recommendations.push({
                type: InterventionType.RECOGNITION,
                priority: 'low',
                title: 'Attendance Improvement',
                message: 'Student shows significant improvement in attendance.',
                suggestedAction: 'Consider positive recognition to reinforce good behavior.',
                data: { trend: analysis.trend, rate: analysis.attendanceRate }
            });
        }

        return recommendations;
    }

    /**
     * Calculate student risk level
     */
    calculateRiskLevel(analysis) {
        let riskScore = 0;

        // Late frequency
        if (analysis.lateCount >= 10) riskScore += 30;
        else if (analysis.lateCount >= 5) riskScore += 15;
        else if (analysis.lateCount >= 3) riskScore += 5;

        // Absence count
        if (analysis.absentCount >= 5) riskScore += 40;
        else if (analysis.absentCount >= 3) riskScore += 20;
        else if (analysis.absentCount >= 1) riskScore += 5;

        // Consecutive late streak
        if (analysis.consecutiveLateStreak >= 5) riskScore += 20;
        else if (analysis.consecutiveLateStreak >= 3) riskScore += 10;

        // Trend
        if (analysis.trend === 'worsening') riskScore += 15;
        else if (analysis.trend === 'improving') riskScore -= 10;

        // Attendance rate
        if (analysis.attendanceRate < 70) riskScore += 25;
        else if (analysis.attendanceRate < 80) riskScore += 10;

        // Determine level
        if (riskScore >= 60) return StudentRiskLevel.CRITICAL;
        if (riskScore >= 40) return StudentRiskLevel.HIGH;
        if (riskScore >= 20) return StudentRiskLevel.MODERATE;
        return StudentRiskLevel.LOW;
    }

    /**
     * Predict future attendance patterns
     */
    predictFutureAttendance(analysis) {
        const predictions = {
            nextWeekLateProb: 0,
            likelyLateDays: [],
            expectedAttendanceRate: analysis.attendanceRate,
            confidence: 'medium'
        };

        // Calculate probability based on current patterns
        if (analysis.lateRate > 30) {
            predictions.nextWeekLateProb = 80;
            predictions.confidence = 'high';
        } else if (analysis.lateRate > 15) {
            predictions.nextWeekLateProb = 50;
        } else {
            predictions.nextWeekLateProb = 20;
        }

        // Identify likely late days
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        analysis.lateByDayOfWeek.forEach((count, index) => {
            if (count >= 2) {
                predictions.likelyLateDays.push(dayNames[index]);
            }
        });

        // Adjust expected rate based on trend
        if (analysis.trend === 'worsening') {
            predictions.expectedAttendanceRate = Math.max(0, analysis.attendanceRate - 5);
        } else if (analysis.trend === 'improving') {
            predictions.expectedAttendanceRate = Math.min(100, analysis.attendanceRate + 5);
        }

        return predictions;
    }

    /**
     * Generate summary statistics
     */
    generateSummary(results) {
        const total = results.length;
        const riskCounts = {
            [StudentRiskLevel.LOW]: 0,
            [StudentRiskLevel.MODERATE]: 0,
            [StudentRiskLevel.HIGH]: 0,
            [StudentRiskLevel.CRITICAL]: 0
        };

        let totalLate = 0;
        let totalAbsent = 0;
        const interventionsNeeded = [];

        results.forEach(r => {
            riskCounts[r.riskLevel]++;
            totalLate += r.analysis.lateCount;
            totalAbsent += r.analysis.absentCount;
            
            if (r.recommendations.length > 0) {
                interventionsNeeded.push({
                    userId: r.userId,
                    userName: r.userName,
                    riskLevel: r.riskLevel,
                    recommendationCount: r.recommendations.length,
                    topPriority: r.recommendations[0]?.priority
                });
            }
        });

        return {
            totalStudents: total,
            riskDistribution: riskCounts,
            avgLatePerStudent: total > 0 ? (totalLate / total).toFixed(1) : 0,
            avgAbsentPerStudent: total > 0 ? (totalAbsent / total).toFixed(1) : 0,
            studentsNeedingIntervention: interventionsNeeded.length,
            criticalCases: riskCounts[StudentRiskLevel.CRITICAL],
            highRiskCases: riskCounts[StudentRiskLevel.HIGH],
            topInterventions: interventionsNeeded
                .sort((a, b) => {
                    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                    return (priorityOrder[a.topPriority] || 3) - (priorityOrder[b.topPriority] || 3);
                })
                .slice(0, 10)
        };
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
}

// Singleton instance
export const recommendationsEngine = new SmartRecommendationsEngine();

/**
 * Get frequently late students
 */
export async function getFrequentlyLateStudents(limit = 20) {
    const { students } = await recommendationsEngine.analyzeAllStudents();
    
    return students
        .filter(s => s.analysis.lateCount >= 3)
        .sort((a, b) => b.analysis.lateCount - a.analysis.lateCount)
        .slice(0, limit);
}

/**
 * Get students needing intervention
 */
export async function getStudentsNeedingIntervention() {
    const { students } = await recommendationsEngine.analyzeAllStudents();
    
    return students
        .filter(s => s.riskLevel === StudentRiskLevel.HIGH || s.riskLevel === StudentRiskLevel.CRITICAL)
        .sort((a, b) => {
            const levelOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
            return levelOrder[a.riskLevel] - levelOrder[b.riskLevel];
        });
}

/**
 * Get attendance predictions for dashboard
 */
export async function getAttendancePredictions() {
    const { students, summary } = await recommendationsEngine.analyzeAllStudents();
    
    // Calculate overall prediction
    const avgAttendance = students.length > 0
        ? students.reduce((sum, s) => sum + s.analysis.attendanceRate, 0) / students.length
        : 85;

    const worseningCount = students.filter(s => s.analysis.trend === 'worsening').length;
    const improvingCount = students.filter(s => s.analysis.trend === 'improving').length;

    let trendAdjustment = 0;
    if (worseningCount > improvingCount) trendAdjustment = -2;
    else if (improvingCount > worseningCount) trendAdjustment = 2;

    return {
        tomorrowAttendance: Math.round(Math.min(100, Math.max(0, avgAttendance + trendAdjustment))),
        confidence: students.length >= 10 ? 85 : 60,
        insights: [
            `${summary.criticalCases || 0} students need immediate attention`,
            `${summary.studentsNeedingIntervention || 0} students flagged for intervention`,
            worseningCount > 0 ? `${worseningCount} students showing declining attendance` : 'Overall attendance trend is stable'
        ]
    };
}
