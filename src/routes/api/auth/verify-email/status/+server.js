// src/routes/api/auth/verify-email/status/+server.js
// API endpoint to check verification status

import { json } from '@sveltejs/kit';
import { getVerificationStatus, isEmailVerified } from '$lib/server/emailVerificationService.js';

export async function POST({ request }) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return json({ 
                success: false, 
                error: 'User ID is required' 
            }, { status: 400 });
        }

        const status = await getVerificationStatus(userId);

        return json({
            success: true,
            ...status
        });
    } catch (error) {
        console.error('Error in verification status endpoint:', error);
        return json({ 
            success: false, 
            error: 'Failed to get verification status' 
        }, { status: 500 });
    }
}

export async function GET({ url }) {
    try {
        const userId = url.searchParams.get('userId');

        if (!userId) {
            return json({ 
                success: false, 
                error: 'User ID is required' 
            }, { status: 400 });
        }

        const verified = await isEmailVerified(userId);

        return json({
            success: true,
            verified
        });
    } catch (error) {
        console.error('Error in verification status endpoint:', error);
        return json({ 
            success: false, 
            error: 'Failed to get verification status' 
        }, { status: 500 });
    }
}
