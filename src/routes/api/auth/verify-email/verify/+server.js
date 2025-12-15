// src/routes/api/auth/verify-email/verify/+server.js
// API endpoint to verify OTP code

import { json } from '@sveltejs/kit';
import { verifyOTP } from '$lib/server/emailVerificationService.js';

export async function POST({ request }) {
    try {
        const { userId, code, sessionToken } = await request.json();

        if (!userId || !code || !sessionToken) {
            return json({ 
                success: false, 
                error: 'User ID, code, and session token are required' 
            }, { status: 400 });
        }

        // Validate code format (6 digits)
        if (!/^\d{6}$/.test(code)) {
            return json({ 
                success: false, 
                error: 'Invalid code format. Please enter a 6-digit code.' 
            }, { status: 400 });
        }

        const result = await verifyOTP(userId, code, sessionToken);

        if (!result.success) {
            return json({ 
                success: false, 
                error: result.error,
                remainingAttempts: result.remainingAttempts
            }, { status: 400 });
        }

        return json({
            success: true,
            verified: result.verified,
            message: result.message
        });
    } catch (error) {
        console.error('Error in verify OTP endpoint:', error);
        return json({ 
            success: false, 
            error: 'Verification failed' 
        }, { status: 500 });
    }
}
