// src/routes/api/face-verification/attendance/+server.js
// Attendance Face Verification API Endpoint
import { json } from '@sveltejs/kit';
import { verifyAttendanceFace, storeReferenceFace, getReferenceFace } from '$lib/server/faceRecognitionService.js';

/**
 * POST - Verify face for attendance check-in
 */
export async function POST({ request }) {
    try {
        const { userId, capturedImage } = await request.json();

        if (!userId) {
            return json({ 
                error: 'User ID is required',
                success: false,
                matched: false
            }, { status: 400 });
        }

        if (!capturedImage) {
            return json({ 
                error: 'Captured image is required',
                success: false,
                matched: false
            }, { status: 400 });
        }

        // Validate image size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        const imageSize = Buffer.byteLength(capturedImage, 'base64');

        if (imageSize > maxSize) {
            return json({ 
                error: 'Image size exceeds 5MB limit',
                success: false,
                matched: false
            }, { status: 400 });
        }

        const result = await verifyAttendanceFace(userId, capturedImage);
        return json(result);
    } catch (error) {
        console.error('Attendance face verification error:', error);
        return json({ 
            error: error.message || 'Verification failed',
            success: false,
            matched: false
        }, { status: 500 });
    }
}

/**
 * PUT - Store/update reference face for a user
 */
export async function PUT({ request }) {
    try {
        const { userId, imageBase64 } = await request.json();

        if (!userId || !imageBase64) {
            return json({ 
                error: 'User ID and image are required',
                success: false
            }, { status: 400 });
        }

        // Validate image size
        const maxSize = 5 * 1024 * 1024;
        const imageSize = Buffer.byteLength(imageBase64, 'base64');

        if (imageSize > maxSize) {
            return json({ 
                error: 'Image size exceeds 5MB limit',
                success: false
            }, { status: 400 });
        }

        const result = await storeReferenceFace(userId, imageBase64);
        return json(result);
    } catch (error) {
        console.error('Store reference face error:', error);
        return json({ 
            error: error.message || 'Failed to store reference face',
            success: false
        }, { status: 500 });
    }
}

/**
 * GET - Check if user has reference face stored
 */
export async function GET({ url }) {
    try {
        const userId = url.searchParams.get('userId');

        if (!userId) {
            return json({ 
                error: 'User ID is required',
                hasReferenceFace: false
            }, { status: 400 });
        }

        const referenceFace = await getReferenceFace(userId);
        return json({
            hasReferenceFace: !!referenceFace,
            userId
        });
    } catch (error) {
        console.error('Get reference face error:', error);
        return json({ 
            error: error.message,
            hasReferenceFace: false
        }, { status: 500 });
    }
}
