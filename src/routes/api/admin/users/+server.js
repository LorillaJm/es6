// src/routes/api/admin/users/+server.js
import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, PERMISSIONS } from '$lib/server/adminAuth.js';
import { getAllUsers, createUser, getDepartments, exportUsersToCSV } from '$lib/server/userManagement.js';
import { sanitizeInput, validateRequestBody } from '$lib/server/adminSecurityMiddleware.js';

// Validation schema for user creation
const CREATE_USER_SCHEMA = {
    name: { required: true, type: 'string', minLength: 2, maxLength: 100 },
    email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    department: { required: false, type: 'string', maxLength: 100 },
    role: { required: false, type: 'string', enum: ['user', 'admin', 'manager', 'student', 'teacher', 'staff'] },
    position: { required: false, type: 'string', maxLength: 100 }
};

// Allowed filter parameters
const ALLOWED_FILTERS = ['role', 'department', 'section', 'search', 'isActive'];

export async function GET({ request, url }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const admin = await verifyAccessToken(authHeader.substring(7));
        if (!admin || !checkPermission(admin, PERMISSIONS.MANAGE_USERS)) {
            return json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        
        // Parse and sanitize filters from query params
        const filters = {};
        for (const key of ALLOWED_FILTERS) {
            const value = url.searchParams.get(key);
            if (value !== null) {
                if (key === 'isActive') {
                    filters[key] = value === 'true';
                } else if (key === 'search') {
                    // Sanitize search input to prevent injection
                    filters[key] = sanitizeInput(value.substring(0, 100));
                } else {
                    filters[key] = sanitizeInput(value.substring(0, 50));
                }
            }
        }
        
        // Check if export is requested
        const exportFormat = url.searchParams.get('export');
        
        const users = await getAllUsers(filters);
        
        if (exportFormat === 'csv') {
            const csv = exportUsersToCSV(users);
            return new Response(csv, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="users-${new Date().toISOString().split('T')[0]}.csv"`,
                    'X-Content-Type-Options': 'nosniff'
                }
            });
        }
        
        const departments = await getDepartments();
        
        return json({ 
            success: true,
            users, 
            departments, 
            total: users.length 
        });
    } catch (error) {
        console.error('[Admin Users] GET error:', error.message);
        return json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}

export async function POST({ request }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const admin = await verifyAccessToken(authHeader.substring(7));
        if (!admin || !checkPermission(admin, PERMISSIONS.MANAGE_USERS)) {
            return json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        
        let body;
        try {
            body = await request.json();
        } catch {
            return json({ error: 'Invalid request body' }, { status: 400 });
        }
        
        // Validate request body against schema
        const validation = validateRequestBody(body, CREATE_USER_SCHEMA);
        if (!validation.valid) {
            return json({ 
                error: 'Validation failed', 
                details: validation.errors 
            }, { status: 422 });
        }
        
        const user = await createUser(validation.data, admin.id);
        
        return json({ success: true, user });
    } catch (error) {
        console.error('[Admin Users] POST error:', error.message);
        
        // Handle duplicate email error
        if (error.message?.includes('already exists')) {
            return json({ error: 'A user with this email already exists' }, { status: 409 });
        }
        
        return json({ error: 'Failed to create user' }, { status: 500 });
    }
}
