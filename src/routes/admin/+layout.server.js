// src/routes/admin/+layout.server.js
// Server-side admin route protection - SECURITY LAYER
// This provides server-side auth verification when cookies are available
// Falls back to client-side auth for backward compatibility

import { redirect } from '@sveltejs/kit';

// Public admin pages that don't require authentication
const PUBLIC_ADMIN_PAGES = ['/admin/login', '/admin/setup'];

/** @type {import('./$types').LayoutServerLoad} */
export async function load({ url, cookies, request }) {
    const pathname = url.pathname;
    
    // Allow public admin pages without authentication
    if (PUBLIC_ADMIN_PAGES.some(page => pathname.startsWith(page))) {
        return { 
            isAuthenticated: false,
            serverSideAuth: false 
        };
    }
    
    // Get access token from cookie (if set by login)
    const accessToken = cookies.get('admin_access_token');
    
    // If no cookie, let client-side handle auth (backward compatibility)
    // The client-side layout.svelte will redirect if not authenticated
    if (!accessToken) {
        return { 
            isAuthenticated: false,
            serverSideAuth: false,
            message: 'No server-side token, client-side auth will handle'
        };
    }
    
    try {
        // Dynamically import to avoid issues during build
        const { verifyAccessToken } = await import('$lib/server/mongodb/services/adminAuthService.js');
        
        const admin = await verifyAccessToken(accessToken);
        
        if (!admin) {
            // Invalid or expired token - clear cookie, let client retry
            cookies.delete('admin_access_token', { path: '/' });
            return { 
                isAuthenticated: false,
                serverSideAuth: false,
                message: 'Token invalid, client-side will handle'
            };
        }
        
        if (!admin.isActive) {
            // Account disabled - clear cookie and redirect
            cookies.delete('admin_access_token', { path: '/' });
            throw redirect(303, '/admin/login?error=account_disabled');
        }
        
        // Return safe admin data to client (no sensitive fields)
        return {
            isAuthenticated: true,
            serverSideAuth: true,
            admin: {
                id: admin._id?.toString() || admin.id,
                email: admin.email,
                name: admin.name,
                role: admin.role,
                permissions: admin.permissions || []
            }
        };
    } catch (error) {
        // Re-throw redirects
        if (error.status === 303) throw error;
        
        // Log error but don't block - let client-side handle
        console.error('[Admin Auth] Server-side verification error:', error.message);
        
        return { 
            isAuthenticated: false,
            serverSideAuth: false,
            message: 'Server auth error, client-side will handle'
        };
    }
}
