// src/lib/server/paginationService.js
// Phase 9.1 - Performance Optimization: Pagination Service

import { adminDb } from './firebase-admin.js';

/**
 * Pagination configuration
 */
export const PaginationConfig = {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    MIN_PAGE_SIZE: 5
};

/**
 * Paginated query result
 * @typedef {Object} PaginatedResult
 * @property {Array} data - The paginated data
 * @property {Object} pagination - Pagination metadata
 * @property {number} pagination.page - Current page
 * @property {number} pagination.limit - Items per page
 * @property {number} pagination.total - Total items
 * @property {number} pagination.totalPages - Total pages
 * @property {boolean} pagination.hasNext - Has next page
 * @property {boolean} pagination.hasPrev - Has previous page
 * @property {string|null} pagination.nextCursor - Cursor for next page
 * @property {string|null} pagination.prevCursor - Cursor for previous page
 */

/**
 * Paginate Firebase Realtime Database query
 * @param {string} path - Database path
 * @param {Object} options - Pagination options
 * @returns {Promise<PaginatedResult>}
 */
export async function paginateQuery(path, options = {}) {
    const {
        page = 1,
        limit = PaginationConfig.DEFAULT_PAGE_SIZE,
        orderBy = null,
        orderDirection = 'desc',
        filterBy = null,
        filterValue = null,
        cursor = null
    } = options;

    // Validate and clamp limit
    const safeLimit = Math.min(
        Math.max(limit, PaginationConfig.MIN_PAGE_SIZE),
        PaginationConfig.MAX_PAGE_SIZE
    );

    if (!adminDb) {
        return createEmptyResult(page, safeLimit);
    }

    try {
        let query = adminDb.ref(path);

        // Apply ordering
        if (orderBy) {
            query = query.orderByChild(orderBy);
        } else {
            query = query.orderByKey();
        }

        // Apply filter if provided
        if (filterBy && filterValue !== null) {
            query = query.equalTo(filterValue, filterBy);
        }

        // Fetch all data (Firebase RTDB doesn't support offset)
        const snapshot = await query.once('value');
        
        if (!snapshot.exists()) {
            return createEmptyResult(page, safeLimit);
        }

        // Convert to array
        let items = [];
        snapshot.forEach((child) => {
            items.push({
                id: child.key,
                ...child.val()
            });
        });

        // Sort if needed
        if (orderBy) {
            items.sort((a, b) => {
                const aVal = a[orderBy] || '';
                const bVal = b[orderBy] || '';
                
                if (orderDirection === 'desc') {
                    return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
                }
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            });
        }

        const total = items.length;
        const totalPages = Math.ceil(total / safeLimit);
        const safePage = Math.min(Math.max(page, 1), totalPages || 1);
        
        // Calculate offset
        const offset = (safePage - 1) * safeLimit;
        
        // Slice for current page
        const paginatedData = items.slice(offset, offset + safeLimit);

        return {
            data: paginatedData,
            pagination: {
                page: safePage,
                limit: safeLimit,
                total,
                totalPages,
                hasNext: safePage < totalPages,
                hasPrev: safePage > 1,
                nextCursor: safePage < totalPages ? items[offset + safeLimit]?.id || null : null,
                prevCursor: safePage > 1 ? items[offset - 1]?.id || null : null
            }
        };
    } catch (error) {
        console.error(`Pagination error for ${path}:`, error);
        return createEmptyResult(page, safeLimit);
    }
}

/**
 * Paginate users with search and filters
 * @param {Object} options 
 * @returns {Promise<PaginatedResult>}
 */
export async function paginateUsers(options = {}) {
    const {
        page = 1,
        limit = PaginationConfig.DEFAULT_PAGE_SIZE,
        search = '',
        department = null,
        status = null,
        sortBy = 'name',
        sortOrder = 'asc'
    } = options;

    if (!adminDb) {
        return createEmptyResult(page, limit);
    }

    try {
        const snapshot = await adminDb.ref('users').once('value');
        
        if (!snapshot.exists()) {
            return createEmptyResult(page, limit);
        }

        let users = [];
        snapshot.forEach((child) => {
            users.push({
                uid: child.key,
                ...child.val()
            });
        });

        // Apply search filter
        if (search) {
            const searchLower = search.toLowerCase();
            users = users.filter(user => 
                (user.name || '').toLowerCase().includes(searchLower) ||
                (user.email || '').toLowerCase().includes(searchLower) ||
                (user.studentId || '').toLowerCase().includes(searchLower)
            );
        }

        // Apply department filter
        if (department) {
            users = users.filter(user => 
                (user.department || user.course) === department
            );
        }

        // Apply status filter
        if (status) {
            users = users.filter(user => user.status === status);
        }

        // Sort
        users.sort((a, b) => {
            const aVal = (a[sortBy] || '').toString().toLowerCase();
            const bVal = (b[sortBy] || '').toString().toLowerCase();
            
            if (sortOrder === 'desc') {
                return bVal.localeCompare(aVal);
            }
            return aVal.localeCompare(bVal);
        });

        // Paginate
        const total = users.length;
        const safeLimit = Math.min(Math.max(limit, PaginationConfig.MIN_PAGE_SIZE), PaginationConfig.MAX_PAGE_SIZE);
        const totalPages = Math.ceil(total / safeLimit);
        const safePage = Math.min(Math.max(page, 1), totalPages || 1);
        const offset = (safePage - 1) * safeLimit;

        return {
            data: users.slice(offset, offset + safeLimit),
            pagination: {
                page: safePage,
                limit: safeLimit,
                total,
                totalPages,
                hasNext: safePage < totalPages,
                hasPrev: safePage > 1
            }
        };
    } catch (error) {
        console.error('User pagination error:', error);
        return createEmptyResult(page, limit);
    }
}

/**
 * Paginate attendance records
 * @param {Object} options 
 * @returns {Promise<PaginatedResult>}
 */
export async function paginateAttendance(options = {}) {
    const {
        page = 1,
        limit = PaginationConfig.DEFAULT_PAGE_SIZE,
        date = null,
        userId = null,
        status = null,
        sortBy = 'timestamp',
        sortOrder = 'desc'
    } = options;

    if (!adminDb) {
        return createEmptyResult(page, limit);
    }

    try {
        const attendanceSnapshot = await adminDb.ref('attendance').once('value');
        const usersSnapshot = await adminDb.ref('users').once('value');
        
        if (!attendanceSnapshot.exists()) {
            return createEmptyResult(page, limit);
        }

        const users = usersSnapshot.exists() ? usersSnapshot.val() : {};
        let records = [];

        const allAttendance = attendanceSnapshot.val();
        for (const [uid, userAttendance] of Object.entries(allAttendance)) {
            if (userId && uid !== userId) continue;
            if (typeof userAttendance !== 'object') continue;

            const user = users[uid] || {};

            for (const [recordId, record] of Object.entries(userAttendance)) {
                if (typeof record !== 'object') continue;

                const recordDate = record.date ? new Date(record.date) : 
                    (record.checkIn?.timestamp ? new Date(record.checkIn.timestamp) : null);

                // Date filter
                if (date && recordDate) {
                    const filterDate = new Date(date).toDateString();
                    if (recordDate.toDateString() !== filterDate) continue;
                }

                // Status filter
                if (status) {
                    const checkInTime = record.checkIn?.timestamp || record.checkIn;
                    const isLate = checkInTime && new Date(checkInTime).getHours() >= 8;
                    
                    if (status === 'late' && !isLate) continue;
                    if (status === 'on_time' && isLate) continue;
                }

                records.push({
                    id: recordId,
                    uid,
                    userName: user.name || user.displayName || 'Unknown',
                    userEmail: user.email || '',
                    department: user.department || user.course || 'Other',
                    date: recordDate?.toISOString() || null,
                    checkIn: record.checkIn,
                    checkOut: record.checkOut,
                    location: record.location,
                    device: record.device,
                    timestamp: record.checkIn?.timestamp || record.checkIn || record.date
                });
            }
        }

        // Sort
        records.sort((a, b) => {
            const aVal = a[sortBy] || '';
            const bVal = b[sortBy] || '';
            
            if (sortOrder === 'desc') {
                return new Date(bVal) - new Date(aVal);
            }
            return new Date(aVal) - new Date(bVal);
        });

        // Paginate
        const total = records.length;
        const safeLimit = Math.min(Math.max(limit, PaginationConfig.MIN_PAGE_SIZE), PaginationConfig.MAX_PAGE_SIZE);
        const totalPages = Math.ceil(total / safeLimit);
        const safePage = Math.min(Math.max(page, 1), totalPages || 1);
        const offset = (safePage - 1) * safeLimit;

        return {
            data: records.slice(offset, offset + safeLimit),
            pagination: {
                page: safePage,
                limit: safeLimit,
                total,
                totalPages,
                hasNext: safePage < totalPages,
                hasPrev: safePage > 1
            }
        };
    } catch (error) {
        console.error('Attendance pagination error:', error);
        return createEmptyResult(page, limit);
    }
}

/**
 * Paginate audit logs
 * @param {Object} options 
 * @returns {Promise<PaginatedResult>}
 */
export async function paginateAuditLogs(options = {}) {
    const {
        page = 1,
        limit = PaginationConfig.DEFAULT_PAGE_SIZE,
        action = null,
        adminId = null,
        startDate = null,
        endDate = null
    } = options;

    if (!adminDb) {
        return createEmptyResult(page, limit);
    }

    try {
        const snapshot = await adminDb.ref('auditLogs').once('value');
        
        if (!snapshot.exists()) {
            return createEmptyResult(page, limit);
        }

        let logs = [];
        snapshot.forEach((child) => {
            logs.push({
                id: child.key,
                ...child.val()
            });
        });

        // Apply filters
        if (action) {
            logs = logs.filter(log => log.action === action);
        }

        if (adminId) {
            logs = logs.filter(log => log.adminId === adminId);
        }

        if (startDate) {
            const start = new Date(startDate).getTime();
            logs = logs.filter(log => new Date(log.timestamp).getTime() >= start);
        }

        if (endDate) {
            const end = new Date(endDate).getTime();
            logs = logs.filter(log => new Date(log.timestamp).getTime() <= end);
        }

        // Sort by timestamp descending
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Paginate
        const total = logs.length;
        const safeLimit = Math.min(Math.max(limit, PaginationConfig.MIN_PAGE_SIZE), PaginationConfig.MAX_PAGE_SIZE);
        const totalPages = Math.ceil(total / safeLimit);
        const safePage = Math.min(Math.max(page, 1), totalPages || 1);
        const offset = (safePage - 1) * safeLimit;

        return {
            data: logs.slice(offset, offset + safeLimit),
            pagination: {
                page: safePage,
                limit: safeLimit,
                total,
                totalPages,
                hasNext: safePage < totalPages,
                hasPrev: safePage > 1
            }
        };
    } catch (error) {
        console.error('Audit logs pagination error:', error);
        return createEmptyResult(page, limit);
    }
}

/**
 * Create empty paginated result
 */
function createEmptyResult(page, limit) {
    return {
        data: [],
        pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
            nextCursor: null,
            prevCursor: null
        }
    };
}

export default {
    paginateQuery,
    paginateUsers,
    paginateAttendance,
    paginateAuditLogs,
    PaginationConfig
};
