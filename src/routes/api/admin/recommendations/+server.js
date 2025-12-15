// src/routes/api/admin/recommendations/+server.js
// Smart Recommendations API - Phase 8.1

import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin.js';

/**
 * GET - Get smart recommendations and at-risk students
 */
export async function GET({ request, url }) {
    try {
        // Verify admin token
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const type = url.searchParams.get('type') || 'all';
        const limit = parseInt(url.searchParams.get('limit') || '20');

        // Get all users
        const usersSnapshot = await adminDb.ref('users').once('value');
        const users = [];
        
        if (usersSnapshot.exists()) {
            usersSnapshot.forEach(child => {
                const user = child.val();
                if (user.role === 'student' || !user.role) {
                    users.push({ id: child.key, ...user });
                }
            });
        }

        // Analyze each user
        const analysisResults = [];
        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - 30);

        for (const user of users) {
            const attendanceSnapshot = await adminDb
                .ref(`attendance/${user.id}`)
                .orderByChild('date')
                .limitToLast(60)
                .once('value');

            const records = [];
            if (attendanceSnapshot.exists()) {
                attendanceSnapshot.forEach(child => {
                    records.push({ id: child.key, ...child.val() });
                });
            }

            // Filter to last 30 days
            const recentRecords = records.filter(r => {
                const recordDate = new Date(r.date || r.checkIn?.timestamp);
                return recordDate >= windowStart;
            });

            // Calculate metrics
            let lateCount = 0;
            let absentCount = 0;
            let presentCount = 0;
            let consecutiveLate = 0;
            let maxConsecutiveLate = 0;

            recentRecords.forEach(record => {
                if (record.status === 'absent' || (!record.checkIn && !record.status)) {
                    absentCount++;
                    consecutiveLate = 0;
                } else if (record.status === 'late' || record.isLate) {
                    lateCount++;
                    presentCount++;
                    consecutiveLate++;
                    maxConsecutiveLate = Math.max(maxConsecutiveLate, consecutiveLate);
                } else {
                    presentCount++;
                    consecutiveLate = 0;
                }
            });

            const totalDays = recentRecords.length || 1;
            const attendanceRate = ((presentCount / totalDays) * 100).toFixed(1);

            // Calculate risk level
            let riskScore = 0;
            if (lateCount >= 10) riskScore += 30;
            else if (lateCount >= 5) riskScore += 15;
            if (absentCount >= 5) riskScore += 40;
            else if (absentCount >= 3) riskScore += 20;
            if (maxConsecutiveLate >= 5) riskScore += 20;
            else if (maxConsecutiveLate >= 3) riskScore += 10;

            let riskLevel = 'low';
            if (riskScore >= 60) riskLevel = 'critical';
            else if (riskScore >= 40) riskLevel = 'high';
            else if (riskScore >= 20) riskLevel = 'moderate';

            // Generate recommendations
            const recommendations = [];
            
            if (lateCount >= 5) {
                recommendations.push({
                    type: 'counseling',
                    priority: 'high',
                    title: 'Frequently Late Student',
                    message: `${user.name || 'Student'} has been late ${lateCount} times in the last 30 days.`,
                    suggestedAction: 'Schedule a meeting to discuss punctuality.'
                });
            }

            if (maxConsecutiveLate >= 3) {
                recommendations.push({
                    type: 'parent_notification',
                    priority: 'high',
                    title: 'Consecutive Late Arrivals',
                    message: `${maxConsecutiveLate} consecutive late arrivals detected.`,
                    suggestedAction: 'Consider notifying parents/guardians.'
                });
            }

            if (absentCount >= 5) {
                recommendations.push({
                    type: 'warning_notice',
                    priority: 'critical',
                    title: 'Critical Absence Level',
                    message: `${absentCount} absences recorded.`,
                    suggestedAction: 'Issue formal warning and schedule intervention.'
                });
            }

            if (riskLevel !== 'low' || recommendations.length > 0) {
                analysisResults.push({
                    userId: user.id,
                    userName: user.name || user.displayName || 'Unknown',
                    userEmail: user.email,
                    department: user.department,
                    year: user.year,
                    section: user.section,
                    analysis: {
                        totalRecords: recentRecords.length,
                        presentCount,
                        lateCount,
                        absentCount,
                        attendanceRate: parseFloat(attendanceRate),
                        consecutiveLateStreak: maxConsecutiveLate
                    },
                    recommendations,
                    riskLevel
                });
            }
        }

        // Sort by risk level
        const riskOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
        analysisResults.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

        // Filter by type if specified
        let filteredResults = analysisResults;
        if (type === 'late') {
            filteredResults = analysisResults.filter(r => r.analysis.lateCount >= 3);
        } else if (type === 'at-risk') {
            filteredResults = analysisResults.filter(r => 
                r.riskLevel === 'high' || r.riskLevel === 'critical'
            );
        }

        // Generate summary
        const summary = {
            totalStudents: users.length,
            analyzedStudents: analysisResults.length,
            criticalCases: analysisResults.filter(r => r.riskLevel === 'critical').length,
            highRiskCases: analysisResults.filter(r => r.riskLevel === 'high').length,
            studentsNeedingIntervention: analysisResults.filter(r => r.recommendations.length > 0).length
        };

        return json({
            success: true,
            students: filteredResults.slice(0, limit),
            summary
        });

    } catch (error) {
        console.error('Recommendations API error:', error);
        return json({ error: 'Failed to get recommendations' }, { status: 500 });
    }
}
