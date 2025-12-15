// src/routes/api/auth/verify-email/send/+server.js
// API endpoint to send verification OTP

import { json } from '@sveltejs/kit';
import { sendVerificationOTP, getVerificationStatus } from '$lib/server/emailVerificationService.js';

export async function POST({ request }) {
    try {
        const { userId, email, userName } = await request.json();

        if (!userId || !email) {
            return json({ 
                success: false, 
                error: 'User ID and email are required' 
            }, { status: 400 });
        }

        // Check current verification status
        const status = await getVerificationStatus(userId);
        
        if (status.verified) {
            return json({ 
                success: true, 
                verified: true,
                message: 'Email is already verified' 
            });
        }

        // Send OTP
        const result = await sendVerificationOTP(userId, email, userName);

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
    } catch (error) {
        console.error('Error in send verification endpoint:', error);
        return json({ 
            success: false, 
            error: 'Failed to send verification code' 
        }, { status: 500 });
    }
}
