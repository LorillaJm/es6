// src/routes/api/admin/auth/verify-email/+server.js
// API endpoint for admin email verification

import { json } from '@sveltejs/kit';
import { 
    verifyAdminOTP, 
    sendAdminVerificationOTP,
    isAdminEmailVerified 
} from '$lib/server/emailVerificationService.js';
import { generateAuthTokens, getAdminById, logAuditEvent } from '$lib/server/adminAuth.js';

/**
 * POST - Verify admin email with OTP
 */
export async function POST({ request, getClientAddress }) {
    try {
        const { adminId, code, sessionToken, action } = await request.json();
        const ipAddress = getClientAddress();

        // Handle resend action
        if (action === 'resend') {
            if (!adminId) {
                return json({ success: false, error: 'Admin ID is required' }, { status: 400 });
            }

            const admin = await getAdminById(adminId);
            if (!admin) {
                return json({ success: false, error: 'Admin not found' }, { status: 404 });
            }

            const result = await sendAdminVerificationOTP(adminId, admin.email, admin.name);
            
            if (!result.success) {
                return json({ 
                    success: false, 
                    error: result.error,
                    retryAfter: result.retryAfter
                }, { status: result.retryAfter ? 429 : 400 });
            }

            return json({
                success: true,
                sessionToken: result.sessionToken,
                expiresIn: result.expiresIn,
                message: result.message
            });
        }

        // Verify OTP
        if (!adminId || !code || !sessionToken) {
            return json({ 
                success: false, 
                error: 'Admin ID, code, and session token are required' 
            }, { status: 400 });
        }

        // Validate code format
        if (!/^\d{6}$/.test(code)) {
            return json({ 
                success: false, 
                error: 'Invalid code format. Please enter a 6-digit code.' 
            }, { status: 400 });
        }

        const result = await verifyAdminOTP(adminId, code, sessionToken);

        if (!result.success) {
            await logAuditEvent({
                action: 'ADMIN_EMAIL_VERIFICATION_FAILED',
                adminId,
                details: { error: result.error },
                ipAddress
            });

            return json({ 
                success: false, 
                error: result.error,
                remainingAttempts: result.remainingAttempts
            }, { status: 400 });
        }

        // Generate auth tokens after successful verification
        const tokens = await generateAuthTokens(adminId);
        const admin = await getAdminById(adminId);

        await logAuditEvent({
            action: 'ADMIN_EMAIL_VERIFIED',
            adminId,
            details: { email: admin?.email },
            ipAddress
        });

        // Return admin without sensitive data
        const { passwordHash, passwordSalt, mfaSecret, ...safeAdmin } = admin;

        return json({
            success: true,
            verified: true,
            message: 'Email verified successfully',
            admin: safeAdmin,
            ...tokens
        });
    } catch (error) {
        console.error('Error in admin email verification:', error);
        return json({ 
            success: false, 
            error: 'Verification failed' 
        }, { status: 500 });
    }
}

/**
 * GET - Check admin email verification status
 */
export async function GET({ url }) {
    try {
        const adminId = url.searchParams.get('adminId');

        if (!adminId) {
            return json({ success: false, error: 'Admin ID is required' }, { status: 400 });
        }

        const verified = await isAdminEmailVerified(adminId);

        return json({
            success: true,
            verified
        });
    } catch (error) {
        console.error('Error checking admin email verification:', error);
        return json({ 
            success: false, 
            error: 'Failed to check verification status' 
        }, { status: 500 });
    }
}
