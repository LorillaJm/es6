// src/routes/admin/+layout.server.js
// Server-side admin route protection - CRITICAL SECURITY LAYER
// This ensures admin pages cannot be accessed without valid authentication
// even if client-side JavaScript is disabled or bypassed

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
            serverSideAuth: true 
        };
    }
    
    // Get access token from cookie
    const accessToken = cookies.get('admin_access_token');
    
    // No token - redirect to login
    if (!accessToken) {
        const redirectUrl = `/admin/login?redirect=${encodeURIComponent(pathname)}`;
        throw redirect(303, redirectUrl);
    }
    
    try {
        // Dynamically import to avoid issues during build
        const { verifyAccessToken } = await import('$lib/server/mongodb/services/adminAuthService.js');
        
        const admin = await verifyAccessToken(accessToken);
        
        if (!admin) {
            // Invalid or expired token - clear cookie and redirect
            cookies.delete('admin_access_token', { path: '/' });
            throw redirect(303, '/admin/login?error=session_expired');
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
        
        // Log error but don't expose details to client
        console.error('[Admin Auth] Server-side verification failed:', error.message);
        
        // Clear potentially invalid cookie
        cookies.delete('admin_access_token', { path: '/' });
        throw redirect(303, '/admin/login?error=auth_failed');
    }
}
