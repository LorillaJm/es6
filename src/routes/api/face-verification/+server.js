// src/routes/api/face-verification/+server.js
// Face Verification API Endpoint
import { json } from '@sveltejs/kit';
import { 
    verifyFace, 
    isFaceRecognitionEnabled, 
    getFaceRecognitionStatus 
} from '$lib/server/faceRecognitionService.js';

/**
 * POST - Verify face similarity between two images
 */
export async function POST({ request }) {
    try {
        const { sourceImage, targetImage, userId } = await request.json();

        if (!sourceImage || !targetImage) {
            return json({ 
                error: 'Missing required images',
                success: false,
                matched: false,
                similarity: 0,
                confidence: 'none'
            }, { status: 400 });
        }

        // Validate image sizes (max 5MB each)
        const maxSize = 5 * 1024 * 1024;
        const sourceSize = Buffer.byteLength(sourceImage, 'base64');
        const targetSize = Buffer.byteLength(targetImage, 'base64');

        if (sourceSize > maxSize || targetSize > maxSize) {
            return json({ 
                error: 'Image size exceeds 5MB limit',
                success: false,
                matched: false,
                similarity: 0,
                confidence: 'none'
            }, { status: 400 });
        }

        const result = await verifyFace(sourceImage, targetImage, userId);
        return json(result);
    } catch (error) {
        console.error('Face verification API error:', error);
        return json({ 
            error: error.message || 'Face verification failed',
            success: false,
            matched: false,
            similarity: 0,
            confidence: 'none'
        }, { status: 500 });
    }
}

/**
 * GET - Get face recognition status/configuration
 */
export async function GET() {
    try {
        const status = getFaceRecognitionStatus();
        return json({
            enabled: status.enabled,
            provider: status.provider,
            configured: status.configured,
            similarityThreshold: status.similarityThreshold
        });
    } catch (error) {
        console.error('Face recognition status error:', error);
        return json({ 
            error: error.message,
            enabled: false 
        }, { status: 500 });
    }
}
