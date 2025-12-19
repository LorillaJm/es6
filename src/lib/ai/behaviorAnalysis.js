// src/lib/ai/behaviorAnalysis.js
// AI Behavior Analysis: Detect fake attendance, abnormal patterns, proxy scanning
import { browser } from '$app/environment';
import { db } from '$lib/firebase';
import { ref, get, set, update, query, orderByChild, limitToLast } from 'firebase/database';

/**
 * Risk levels for behavior analysis
 */
export const RiskLevel = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

/**
 * Anomaly types
 */
export const AnomalyType = {
    FAKE_ATTENDANCE: 'fake_attendance',
    PROXY_SCAN: 'proxy_scan',
    LOCATION_SPOOFING: 'location_spoofing',
    DEVICE_ANOMALY: 'device_anomaly',
    TIME_ANOMALY: 'time_anomaly',
    PATTERN_DEVIATION: 'pattern_deviation',
    RAPID_CHECKINS: 'rapid_checkins',
    IMPOSSIBLE_TRAVEL: 'impossible_travel'
};

/**
 * Analysis thresholds
 */
const THRESHOLDS = {
    minTimeBetweenCheckins: 4 * 60 * 60 * 1000, // 4 hours minimum
    maxSpeedKmh: 120, // Max travel speed
    patternDeviationStdDev: 2, // Standard deviations for anomaly
    minDataPointsForPattern: 10,
    suspiciousDeviceChangeFrequency: 3, // Max device changes per day
    faceMatchThreshold: 0.7 // Face similarity threshold
};


/**
 * Analyze attendance behavior for anomalies
 * @param {string} userId - User ID
 * @param {object} currentAction - Current attendance action
 * @returns {Promise<object>} Analysis result
 */
export async function analyzeAttendanceBehavior(userId, currentAction) {
    if (!browser || !db) return { risk: RiskLevel.LOW, anomalies: [] };
    
    const anomalies = [];
    let riskScore = 0;
    
    try {
        // Get user's attendance history
        const historyRef = ref(db, `attendance/${userId}`);
        const historyQuery = query(historyRef, limitToLast(30));
        const snapshot = await get(historyQuery);
        
        const history = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                history.push({ id: child.key, ...child.val() });
            });
        }
        
        // Run all analysis checks
        const timeAnalysis = analyzeTimePatterns(history, currentAction);
        if (timeAnalysis.anomaly) {
            anomalies.push(timeAnalysis);
            riskScore += timeAnalysis.riskScore;
        }
        
        const locationAnalysis = analyzeLocationPatterns(history, currentAction);
        if (locationAnalysis.anomaly) {
            anomalies.push(locationAnalysis);
            riskScore += locationAnalysis.riskScore;
        }
        
        const deviceAnalysis = analyzeDevicePatterns(history, currentAction);
        if (deviceAnalysis.anomaly) {
            anomalies.push(deviceAnalysis);
            riskScore += deviceAnalysis.riskScore;
        }
        
        const rapidCheckinAnalysis = detectRapidCheckins(history, currentAction);
        if (rapidCheckinAnalysis.anomaly) {
            anomalies.push(rapidCheckinAnalysis);
            riskScore += rapidCheckinAnalysis.riskScore;
        }
        
        const proxyAnalysis = detectProxyScanning(history, currentAction);
        if (proxyAnalysis.anomaly) {
            anomalies.push(proxyAnalysis);
            riskScore += proxyAnalysis.riskScore;
        }
        
        // Determine overall risk level
        const riskLevel = calculateRiskLevel(riskScore);
        
        // Log analysis result
        await logBehaviorAnalysis(userId, {
            action: currentAction,
            anomalies,
            riskScore,
            riskLevel,
            timestamp: new Date().toISOString()
        });
        
        return {
            risk: riskLevel,
            riskScore,
            anomalies,
            requiresReview: riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL,
            blocked: riskLevel === RiskLevel.CRITICAL
        };
    } catch (error) {
        console.error('Error analyzing behavior:', error);
        return { risk: RiskLevel.LOW, anomalies: [], error: error.message };
    }
}

/**
 * Analyze time patterns for anomalies
 */
function analyzeTimePatterns(history, currentAction) {
    if (history.length < THRESHOLDS.minDataPointsForPattern) {
        return { anomaly: false };
    }
    
    // Extract check-in times
    const checkInTimes = history
        .filter(h => h.checkIn?.timestamp)
        .map(h => {
            const date = new Date(h.checkIn.timestamp);
            return date.getHours() * 60 + date.getMinutes();
        });
    
    if (checkInTimes.length < 5) return { anomaly: false };
    
    // Calculate mean and standard deviation
    const mean = checkInTimes.reduce((a, b) => a + b, 0) / checkInTimes.length;
    const variance = checkInTimes.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / checkInTimes.length;
    const stdDev = Math.sqrt(variance);
    
    // Check current action time
    const currentTime = new Date(currentAction.timestamp);
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const deviation = Math.abs(currentMinutes - mean) / (stdDev || 1);
    
    if (deviation > THRESHOLDS.patternDeviationStdDev) {
        return {
            anomaly: true,
            type: AnomalyType.TIME_ANOMALY,
            riskScore: Math.min(deviation * 10, 30),
            message: `Unusual check-in time: ${deviation.toFixed(1)} standard deviations from normal`,
            details: { mean, stdDev, currentMinutes, deviation }
        };
    }
    
    return { anomaly: false };
}

/**
 * Analyze location patterns for anomalies
 */
function analyzeLocationPatterns(history, currentAction) {
    if (!currentAction.location) return { anomaly: false };
    
    const recentWithLocation = history
        .filter(h => h.checkIn?.location?.latitude)
        .slice(-5);
    
    if (recentWithLocation.length === 0) return { anomaly: false };
    
    // Check for impossible travel
    const lastRecord = recentWithLocation[recentWithLocation.length - 1];
    if (lastRecord.checkIn?.timestamp && lastRecord.checkIn?.location) {
        const timeDiff = new Date(currentAction.timestamp) - new Date(lastRecord.checkIn.timestamp);
        const distance = calculateDistance(
            currentAction.location.latitude,
            currentAction.location.longitude,
            lastRecord.checkIn.location.latitude,
            lastRecord.checkIn.location.longitude
        );
        
        const speedKmh = (distance / 1000) / (timeDiff / 3600000);
        
        if (speedKmh > THRESHOLDS.maxSpeedKmh && timeDiff < 24 * 60 * 60 * 1000) {
            return {
                anomaly: true,
                type: AnomalyType.IMPOSSIBLE_TRAVEL,
                riskScore: 50,
                message: `Impossible travel detected: ${Math.round(distance/1000)}km in ${Math.round(timeDiff/60000)} minutes`,
                details: { distance, timeDiff, speedKmh }
            };
        }
    }
    
    return { anomaly: false };
}

/**
 * Calculate distance between coordinates (Haversine)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/**
 * Analyze device patterns for anomalies
 */
function analyzeDevicePatterns(history, currentAction) {
    if (!currentAction.device) return { anomaly: false };
    
    const today = new Date().toDateString();
    const todayRecords = history.filter(h => h.date === today);
    
    // Count unique devices today
    const uniqueDevices = new Set();
    todayRecords.forEach(h => {
        if (h.checkIn?.device?.fingerprint) {
            uniqueDevices.add(h.checkIn.device.fingerprint);
        }
    });
    
    if (currentAction.device.fingerprint) {
        uniqueDevices.add(currentAction.device.fingerprint);
    }
    
    if (uniqueDevices.size > THRESHOLDS.suspiciousDeviceChangeFrequency) {
        return {
            anomaly: true,
            type: AnomalyType.DEVICE_ANOMALY,
            riskScore: 40,
            message: `Multiple devices detected today: ${uniqueDevices.size} different devices`,
            details: { deviceCount: uniqueDevices.size }
        };
    }
    
    return { anomaly: false };
}

/**
 * Detect rapid check-ins (potential fake attendance)
 */
function detectRapidCheckins(history, currentAction) {
    const recentCheckins = history
        .filter(h => h.checkIn?.timestamp)
        .map(h => new Date(h.checkIn.timestamp).getTime())
        .sort((a, b) => b - a);
    
    if (recentCheckins.length === 0) return { anomaly: false };
    
    const currentTime = new Date(currentAction.timestamp).getTime();
    const lastCheckin = recentCheckins[0];
    const timeDiff = currentTime - lastCheckin;
    
    if (timeDiff < THRESHOLDS.minTimeBetweenCheckins && timeDiff > 0) {
        return {
            anomaly: true,
            type: AnomalyType.RAPID_CHECKINS,
            riskScore: 35,
            message: `Check-in too soon after previous: ${Math.round(timeDiff/60000)} minutes`,
            details: { timeDiff, minRequired: THRESHOLDS.minTimeBetweenCheckins }
        };
    }
    
    return { anomaly: false };
}

/**
 * Detect proxy scanning patterns
 */
function detectProxyScanning(history, currentAction) {
    // Check for patterns indicating someone else is scanning
    const recentRecords = history.slice(-10);
    
    // Pattern 1: Same device, different locations in short time
    const deviceLocationPairs = recentRecords
        .filter(h => h.checkIn?.device?.fingerprint && h.checkIn?.location)
        .map(h => ({
            device: h.checkIn.device.fingerprint,
            location: `${h.checkIn.location.latitude?.toFixed(4)},${h.checkIn.location.longitude?.toFixed(4)}`,
            time: new Date(h.checkIn.timestamp).getTime()
        }));
    
    // Check if same device appears at very different locations
    const deviceLocations = {};
    deviceLocationPairs.forEach(pair => {
        if (!deviceLocations[pair.device]) {
            deviceLocations[pair.device] = [];
        }
        deviceLocations[pair.device].push(pair);
    });
    
    for (const device in deviceLocations) {
        const locations = deviceLocations[device];
        if (locations.length >= 2) {
            const uniqueLocations = new Set(locations.map(l => l.location));
            if (uniqueLocations.size >= 3) {
                return {
                    anomaly: true,
                    type: AnomalyType.PROXY_SCAN,
                    riskScore: 60,
                    message: 'Potential proxy scanning: Same device at multiple locations',
                    details: { locationCount: uniqueLocations.size }
                };
            }
        }
    }
    
    return { anomaly: false };
}

/**
 * Calculate overall risk level from score
 */
function calculateRiskLevel(score) {
    if (score >= 80) return RiskLevel.CRITICAL;
    if (score >= 50) return RiskLevel.HIGH;
    if (score >= 25) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
}

/**
 * Log behavior analysis result
 */
async function logBehaviorAnalysis(userId, analysis) {
    if (!browser || !db) return;
    
    try {
        const logRef = ref(db, `behavior_logs/${userId}/${Date.now()}`);
        await set(logRef, analysis);
    } catch (error) {
        console.error('Error logging behavior analysis:', error);
    }
}


/**
 * Get user's behavior score and history
 * @param {string} userId - User ID
 * @returns {Promise<object>} Behavior profile
 */
export async function getUserBehaviorProfile(userId) {
    if (!browser || !db) return null;
    
    try {
        const logsRef = ref(db, `behavior_logs/${userId}`);
        const logsQuery = query(logsRef, limitToLast(100));
        const snapshot = await get(logsQuery);
        
        if (!snapshot.exists()) {
            return {
                trustScore: 100,
                totalAnalyses: 0,
                anomalyCount: 0,
                riskHistory: [],
                lastAnalysis: null
            };
        }
        
        const logs = [];
        snapshot.forEach(child => logs.push(child.val()));
        
        // Calculate trust score
        const anomalyCount = logs.filter(l => l.anomalies?.length > 0).length;
        const criticalCount = logs.filter(l => l.riskLevel === RiskLevel.CRITICAL).length;
        const highCount = logs.filter(l => l.riskLevel === RiskLevel.HIGH).length;
        
        let trustScore = 100;
        trustScore -= criticalCount * 15;
        trustScore -= highCount * 8;
        trustScore -= anomalyCount * 2;
        trustScore = Math.max(0, Math.min(100, trustScore));
        
        return {
            trustScore,
            totalAnalyses: logs.length,
            anomalyCount,
            criticalCount,
            highCount,
            riskHistory: logs.slice(-10).map(l => ({
                timestamp: l.timestamp,
                riskLevel: l.riskLevel,
                anomalyTypes: l.anomalies?.map(a => a.type) || []
            })),
            lastAnalysis: logs[logs.length - 1]
        };
    } catch (error) {
        console.error('Error getting behavior profile:', error);
        return null;
    }
}

/**
 * Flag user for manual review
 * @param {string} userId - User ID
 * @param {string} reason - Flag reason
 * @param {object} evidence - Supporting evidence
 */
export async function flagUserForReview(userId, reason, evidence = {}) {
    if (!browser || !db) return false;
    
    try {
        const flagRef = ref(db, `flagged_users/${userId}`);
        await set(flagRef, {
            flaggedAt: new Date().toISOString(),
            reason,
            evidence,
            status: 'pending_review',
            reviewedBy: null,
            reviewedAt: null
        });
        
        // Also add to admin notifications
        const adminNotifRef = ref(db, `admin_notifications/${Date.now()}`);
        await set(adminNotifRef, {
            type: 'user_flagged',
            userId,
            reason,
            timestamp: new Date().toISOString(),
            read: false
        });
        
        return true;
    } catch (error) {
        console.error('Error flagging user:', error);
        return false;
    }
}

/**
 * Get all flagged users (admin function)
 * @returns {Promise<Array>} Flagged users
 */
export async function getFlaggedUsers() {
    if (!browser || !db) return [];
    
    try {
        const flagsRef = ref(db, 'flagged_users');
        const snapshot = await get(flagsRef);
        
        if (!snapshot.exists()) return [];
        
        const flagged = [];
        snapshot.forEach(child => {
            flagged.push({ userId: child.key, ...child.val() });
        });
        
        return flagged.filter(f => f.status === 'pending_review');
    } catch (error) {
        console.error('Error getting flagged users:', error);
        return [];
    }
}

/**
 * Resolve flagged user review
 * @param {string} userId - User ID
 * @param {string} resolution - Resolution (cleared, warned, suspended)
 * @param {string} reviewerId - Reviewer's user ID
 * @param {string} notes - Review notes
 */
export async function resolveFlaggedUser(userId, resolution, reviewerId, notes = '') {
    if (!browser || !db) return false;
    
    try {
        const flagRef = ref(db, `flagged_users/${userId}`);
        await update(flagRef, {
            status: resolution,
            reviewedBy: reviewerId,
            reviewedAt: new Date().toISOString(),
            reviewNotes: notes
        });
        
        return true;
    } catch (error) {
        console.error('Error resolving flagged user:', error);
        return false;
    }
}

/**
 * Analyze face similarity using server-side face recognition
 * This is a client-side wrapper that calls the server API
 * @param {string} currentImage - Current captured image (base64)
 * @param {string} referenceImage - Reference image (base64)
 * @param {string} [userId] - Optional user ID for logging
 * @returns {Promise<object>} Similarity result
 */
export async function analyzeFaceSimilarity(currentImage, referenceImage, userId = null) {
    if (!browser) {
        return {
            success: false,
            similarity: 0,
            matched: false,
            confidence: 'none',
            message: 'Face verification only available in browser'
        };
    }

    try {
        const response = await fetch('/api/face-verification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sourceImage: currentImage,
                targetImage: referenceImage,
                userId
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                similarity: 0,
                matched: false,
                confidence: 'none',
                message: errorData.error || `Server error: ${response.status}`
            };
        }

        const result = await response.json();
        return {
            success: result.success,
            similarity: result.similarity || 0,
            matched: result.matched || false,
            confidence: result.confidence || 'none',
            provider: result.provider || 'unknown',
            message: result.error || (result.matched ? 'Face verified successfully' : 'Face verification failed'),
            details: result.details || {}
        };
    } catch (error) {
        console.error('Face verification error:', error);
        return {
            success: false,
            similarity: 0,
            matched: false,
            confidence: 'none',
            message: error.message || 'Face verification request failed'
        };
    }
}

/**
 * Verify attendance with face recognition (convenience wrapper)
 * @param {string} userId - User ID
 * @param {string} capturedImage - Base64 encoded captured image
 * @returns {Promise<object>} Verification result
 */
export async function verifyAttendanceFace(userId, capturedImage) {
    if (!browser) {
        return {
            success: false,
            matched: false,
            message: 'Face verification only available in browser'
        };
    }

    try {
        const response = await fetch('/api/face-verification/attendance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                capturedImage
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return {
                success: false,
                matched: false,
                message: errorData.error || `Server error: ${response.status}`
            };
        }

        return await response.json();
    } catch (error) {
        console.error('Attendance face verification error:', error);
        return {
            success: false,
            matched: false,
            message: error.message || 'Verification request failed'
        };
    }
}

/**
 * Generate behavior report for a user
 * @param {string} userId - User ID
 * @param {string} startDate - Report start date
 * @param {string} endDate - Report end date
 * @returns {Promise<object>} Behavior report
 */
export async function generateBehaviorReport(userId, startDate, endDate) {
    if (!browser || !db) return null;
    
    try {
        const profile = await getUserBehaviorProfile(userId);
        
        // Get attendance data for the period
        const attendanceRef = ref(db, `attendance/${userId}`);
        const snapshot = await get(attendanceRef);
        
        const attendance = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const record = child.val();
                const recordDate = new Date(record.checkIn?.timestamp);
                if (recordDate >= new Date(startDate) && recordDate <= new Date(endDate)) {
                    attendance.push(record);
                }
            });
        }
        
        return {
            userId,
            period: { startDate, endDate },
            trustScore: profile?.trustScore || 100,
            totalCheckIns: attendance.length,
            anomalyCount: profile?.anomalyCount || 0,
            riskBreakdown: {
                critical: profile?.criticalCount || 0,
                high: profile?.highCount || 0,
                medium: 0,
                low: 0
            },
            recommendations: generateRecommendations(profile),
            generatedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error generating behavior report:', error);
        return null;
    }
}

/**
 * Generate recommendations based on behavior profile
 */
function generateRecommendations(profile) {
    const recommendations = [];
    
    if (!profile) return ['No behavior data available'];
    
    if (profile.trustScore < 50) {
        recommendations.push('User requires immediate review due to low trust score');
    }
    
    if (profile.criticalCount > 0) {
        recommendations.push('Critical anomalies detected - verify user identity');
    }
    
    if (profile.anomalyCount > 5) {
        recommendations.push('Multiple anomalies detected - consider additional verification');
    }
    
    if (recommendations.length === 0) {
        recommendations.push('No concerns - user behavior is within normal parameters');
    }
    
    return recommendations;
}
