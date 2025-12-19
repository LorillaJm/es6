// src/lib/server/leaveRequestService.js
// Leave Request Management Service - Production-ready implementation
import { adminDb } from './firebase-admin.js';
import { logAuditEvent } from './adminAuth.js';

/**
 * Leave request types
 */
export const LeaveTypes = {
    SICK: 'sick',
    PERSONAL: 'personal',
    FAMILY: 'family',
    MEDICAL: 'medical',
    EMERGENCY: 'emergency',
    OTHER: 'other'
};

/**
 * Leave request status
 */
export const LeaveStatus = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled'
};

/**
 * @typedef {Object} LeaveRequest
 * @property {string} id - Request ID
 * @property {string} userId - User ID
 * @property {string} type - Leave type
 * @property {string} startDate - Start date (ISO)
 * @property {string} endDate - End date (ISO)
 * @property {string} reason - Reason for leave
 * @property {string} status - Request status
 * @property {string} [documentUrl] - Supporting document URL
 * @property {string} createdAt - Creation timestamp
 * @property {string} [reviewedBy] - Admin who reviewed
 * @property {string} [reviewedAt] - Review timestamp
 * @property {string} [reviewNotes] - Admin notes
 */

/**
 * Submit a leave request
 * @param {string} userId - User ID
 * @param {Object} requestData - Leave request data
 * @returns {Promise<{success: boolean, request?: LeaveRequest, error?: string}>}
 */
export async function submitLeaveRequest(userId, requestData) {
    if (!adminDb) {
        return { success: false, error: 'Database not available' };
    }

    try {
        // Validate dates
        const startDate = new Date(requestData.startDate);
        const endDate = new Date(requestData.endDate);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return { success: false, error: 'Invalid dates provided' };
        }

        if (endDate < startDate) {
            return { success: false, error: 'End date must be after start date' };
        }

        // Check for overlapping requests
        const existingRequests = await getUserLeaveRequests(userId);
        const hasOverlap = existingRequests.some(req => {
            if (req.status === LeaveStatus.CANCELLED || req.status === LeaveStatus.REJECTED) {
                return false;
            }
            const reqStart = new Date(req.startDate);
            const reqEnd = new Date(req.endDate);
            return (startDate <= reqEnd && endDate >= reqStart);
        });

        if (hasOverlap) {
            return { success: false, error: 'Leave request overlaps with existing request' };
        }

        const requestId = `leave_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        
        const leaveRequest = {
            id: requestId,
            userId,
            type: requestData.type || LeaveTypes.OTHER,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            reason: requestData.reason || '',
            status: LeaveStatus.PENDING,
            documentUrl: requestData.documentUrl || null,
            createdAt: new Date().toISOString(),
            reviewedBy: null,
            reviewedAt: null,
            reviewNotes: null
        };

        await adminDb.ref(`leaveRequests/${userId}/${requestId}`).set(leaveRequest);

        // Create notification for admins
        await adminDb.ref(`admin_notifications/${Date.now()}`).set({
            type: 'leave_request',
            userId,
            requestId,
            message: `New leave request from user`,
            timestamp: new Date().toISOString(),
            read: false
        });

        return { success: true, request: leaveRequest };
    } catch (error) {
        console.error('Submit leave request error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get leave requests for a user
 * @param {string} userId - User ID
 * @returns {Promise<LeaveRequest[]>}
 */
export async function getUserLeaveRequests(userId) {
    if (!adminDb) return [];

    try {
        const snapshot = await adminDb.ref(`leaveRequests/${userId}`).once('value');
        if (!snapshot.exists()) return [];

        const requests = [];
        snapshot.forEach(child => {
            requests.push({ id: child.key, ...child.val() });
        });

        return requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
        console.error('Get user leave requests error:', error);
        return [];
    }
}

/**
 * Get all pending leave requests (admin)
 * @param {number} limit - Max requests to return
 * @returns {Promise<LeaveRequest[]>}
 */
export async function getPendingLeaveRequests(limit = 50) {
    if (!adminDb) return [];

    try {
        const snapshot = await adminDb.ref('leaveRequests').once('value');
        if (!snapshot.exists()) return [];

        const requests = [];
        snapshot.forEach(userChild => {
            userChild.forEach(requestChild => {
                const request = requestChild.val();
                if (request.status === LeaveStatus.PENDING) {
                    requests.push({ id: requestChild.key, ...request });
                }
            });
        });

        return requests
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
            .slice(0, limit);
    } catch (error) {
        console.error('Get pending leave requests error:', error);
        return [];
    }
}

/**
 * Review a leave request (admin)
 * @param {string} userId - User ID
 * @param {string} requestId - Request ID
 * @param {string} status - New status (approved/rejected)
 * @param {string} adminId - Admin ID
 * @param {string} [notes] - Review notes
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function reviewLeaveRequest(userId, requestId, status, adminId, notes = '') {
    if (!adminDb) {
        return { success: false, error: 'Database not available' };
    }

    if (status !== LeaveStatus.APPROVED && status !== LeaveStatus.REJECTED) {
        return { success: false, error: 'Invalid status' };
    }

    try {
        const requestRef = adminDb.ref(`leaveRequests/${userId}/${requestId}`);
        const snapshot = await requestRef.once('value');

        if (!snapshot.exists()) {
            return { success: false, error: 'Leave request not found' };
        }

        const request = snapshot.val();
        if (request.status !== LeaveStatus.PENDING) {
            return { success: false, error: 'Request has already been reviewed' };
        }

        await requestRef.update({
            status,
            reviewedBy: adminId,
            reviewedAt: new Date().toISOString(),
            reviewNotes: notes
        });

        // If approved, create excused absence records
        if (status === LeaveStatus.APPROVED) {
            await createExcusedAbsenceRecords(userId, request);
        }

        await logAuditEvent({
            action: status === LeaveStatus.APPROVED ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
            adminId,
            targetId: userId,
            details: { requestId, type: request.type, startDate: request.startDate, endDate: request.endDate }
        });

        return { success: true };
    } catch (error) {
        console.error('Review leave request error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Create excused absence records for approved leave
 */
async function createExcusedAbsenceRecords(userId, request) {
    if (!adminDb) return;

    try {
        const startDate = new Date(request.startDate);
        const endDate = new Date(request.endDate);
        
        // Create record for each day in the leave period
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateStr = currentDate.toDateString();
            const absenceId = `absence_${currentDate.getTime()}`;
            
            await adminDb.ref(`excusedAbsences/${userId}/${absenceId}`).set({
                date: dateStr,
                dateISO: currentDate.toISOString(),
                type: request.type,
                reason: request.reason,
                leaveRequestId: request.id,
                approved: true,
                createdAt: new Date().toISOString()
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }
    } catch (error) {
        console.error('Create excused absence records error:', error);
    }
}

/**
 * Cancel a leave request (user)
 * @param {string} userId - User ID
 * @param {string} requestId - Request ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function cancelLeaveRequest(userId, requestId) {
    if (!adminDb) {
        return { success: false, error: 'Database not available' };
    }

    try {
        const requestRef = adminDb.ref(`leaveRequests/${userId}/${requestId}`);
        const snapshot = await requestRef.once('value');

        if (!snapshot.exists()) {
            return { success: false, error: 'Leave request not found' };
        }

        const request = snapshot.val();
        if (request.status !== LeaveStatus.PENDING) {
            return { success: false, error: 'Only pending requests can be cancelled' };
        }

        await requestRef.update({
            status: LeaveStatus.CANCELLED,
            cancelledAt: new Date().toISOString()
        });

        return { success: true };
    } catch (error) {
        console.error('Cancel leave request error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get excused absences for a date range
 * @param {string} startDate - Start date (ISO)
 * @param {string} endDate - End date (ISO)
 * @returns {Promise<Object>} Map of userId to excused dates
 */
export async function getExcusedAbsencesForRange(startDate, endDate) {
    if (!adminDb) return {};

    try {
        const snapshot = await adminDb.ref('excusedAbsences').once('value');
        if (!snapshot.exists()) return {};

        const start = new Date(startDate);
        const end = new Date(endDate);
        const result = {};

        snapshot.forEach(userChild => {
            const userId = userChild.key;
            userChild.forEach(absenceChild => {
                const absence = absenceChild.val();
                const absenceDate = new Date(absence.dateISO || absence.date);
                
                if (absenceDate >= start && absenceDate <= end && absence.approved) {
                    if (!result[userId]) {
                        result[userId] = [];
                    }
                    result[userId].push({
                        date: absence.date,
                        type: absence.type,
                        reason: absence.reason
                    });
                }
            });
        });

        return result;
    } catch (error) {
        console.error('Get excused absences error:', error);
        return {};
    }
}

/**
 * Check if a user has excused absence for a specific date
 * @param {string} userId - User ID
 * @param {string} date - Date string (toDateString format)
 * @returns {Promise<boolean>}
 */
export async function isExcusedAbsence(userId, date) {
    if (!adminDb) return false;

    try {
        const snapshot = await adminDb.ref(`excusedAbsences/${userId}`).once('value');
        if (!snapshot.exists()) return false;

        let isExcused = false;
        snapshot.forEach(child => {
            const absence = child.val();
            if (absence.date === date && absence.approved) {
                isExcused = true;
            }
        });

        return isExcused;
    } catch (error) {
        console.error('Check excused absence error:', error);
        return false;
    }
}

/**
 * Get leave statistics for a user
 * @param {string} userId - User ID
 * @param {number} year - Year to get stats for
 * @returns {Promise<Object>}
 */
export async function getUserLeaveStats(userId, year = new Date().getFullYear()) {
    if (!adminDb) {
        return {
            totalRequests: 0,
            approved: 0,
            rejected: 0,
            pending: 0,
            totalDays: 0,
            byType: {}
        };
    }

    try {
        const requests = await getUserLeaveRequests(userId);
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31);

        const yearRequests = requests.filter(req => {
            const reqDate = new Date(req.createdAt);
            return reqDate >= yearStart && reqDate <= yearEnd;
        });

        const stats = {
            totalRequests: yearRequests.length,
            approved: 0,
            rejected: 0,
            pending: 0,
            cancelled: 0,
            totalDays: 0,
            byType: {}
        };

        for (const req of yearRequests) {
            stats[req.status] = (stats[req.status] || 0) + 1;

            if (req.status === LeaveStatus.APPROVED) {
                const start = new Date(req.startDate);
                const end = new Date(req.endDate);
                const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                stats.totalDays += days;

                stats.byType[req.type] = (stats.byType[req.type] || 0) + days;
            }
        }

        return stats;
    } catch (error) {
        console.error('Get user leave stats error:', error);
        return {
            totalRequests: 0,
            approved: 0,
            rejected: 0,
            pending: 0,
            totalDays: 0,
            byType: {}
        };
    }
}
