// src/lib/server/faceRecognitionService.js
// Face Recognition Service - Production-ready implementation
// Supports multiple providers: AWS Rekognition, Azure Face API, or local fallback

import { adminDb } from './firebase-admin.js';

/**
 * Face recognition configuration
 * Set via environment variables
 */
const config = {
    provider: process.env.FACE_RECOGNITION_PROVIDER || 'none', // 'aws', 'azure', 'none'
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    azureEndpoint: process.env.AZURE_FACE_ENDPOINT,
    azureApiKey: process.env.AZURE_FACE_API_KEY,
    similarityThreshold: parseFloat(process.env.FACE_SIMILARITY_THRESHOLD || '0.8'),
    maxFaceSize: 5 * 1024 * 1024, // 5MB max
    supportedFormats: ['image/jpeg', 'image/png', 'image/webp']
};

/**
 * @typedef {Object} FaceVerificationResult
 * @property {boolean} success - Whether verification completed
 * @property {boolean} matched - Whether faces match
 * @property {number} similarity - Similarity score (0-1)
 * @property {string} confidence - Confidence level (high, medium, low)
 * @property {string} provider - Provider used
 * @property {string} [error] - Error message if failed
 * @property {Object} [details] - Additional details
 */

/**
 * Verify face similarity between two images
 * @param {string} sourceImage - Base64 encoded source image (current capture)
 * @param {string} targetImage - Base64 encoded target image (reference photo)
 * @param {string} [userId] - Optional user ID for logging
 * @returns {Promise<FaceVerificationResult>}
 */
export async function verifyFace(sourceImage, targetImage, userId = null) {
    // Validate inputs
    if (!sourceImage || !targetImage) {
        return {
            success: false,
            matched: false,
            similarity: 0,
            confidence: 'none',
            provider: 'none',
            error: 'Missing source or target image'
        };
    }

    // Check provider configuration
    if (config.provider === 'none') {
        return {
            success: true,
            matched: true,
            similarity: 1.0,
            confidence: 'none',
            provider: 'none',
            error: 'Face recognition not configured - verification bypassed',
            details: {
                message: 'Set FACE_RECOGNITION_PROVIDER environment variable to enable'
            }
        };
    }

    try {
        let result;

        switch (config.provider) {
            case 'aws':
                result = await verifyWithAWS(sourceImage, targetImage);
                break;
            case 'azure':
                result = await verifyWithAzure(sourceImage, targetImage);
                break;
            default:
                return {
                    success: false,
                    matched: false,
                    similarity: 0,
                    confidence: 'none',
                    provider: config.provider,
                    error: `Unknown provider: ${config.provider}`
                };
        }

        // Log verification attempt
        if (userId && adminDb) {
            await logVerificationAttempt(userId, result);
        }

        return result;
    } catch (error) {
        console.error('Face verification error:', error);
        return {
            success: false,
            matched: false,
            similarity: 0,
            confidence: 'none',
            provider: config.provider,
            error: error.message
        };
    }
}

/**
 * Verify faces using AWS Rekognition
 */
async function verifyWithAWS(sourceImage, targetImage) {
    if (!config.awsAccessKeyId || !config.awsSecretAccessKey) {
        return {
            success: false,
            matched: false,
            similarity: 0,
            confidence: 'none',
            provider: 'aws',
            error: 'AWS credentials not configured'
        };
    }

    try {
        // Dynamic import to avoid loading AWS SDK if not needed
        const { RekognitionClient, CompareFacesCommand } = await import('@aws-sdk/client-rekognition');

        const client = new RekognitionClient({
            region: config.awsRegion,
            credentials: {
                accessKeyId: config.awsAccessKeyId,
                secretAccessKey: config.awsSecretAccessKey
            }
        });

        // Convert base64 to buffer
        const sourceBuffer = Buffer.from(sourceImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const targetBuffer = Buffer.from(targetImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');

        const command = new CompareFacesCommand({
            SourceImage: { Bytes: sourceBuffer },
            TargetImage: { Bytes: targetBuffer },
            SimilarityThreshold: config.similarityThreshold * 100
        });

        const response = await client.send(command);

        if (response.FaceMatches && response.FaceMatches.length > 0) {
            const match = response.FaceMatches[0];
            const similarity = match.Similarity / 100;

            return {
                success: true,
                matched: similarity >= config.similarityThreshold,
                similarity,
                confidence: getConfidenceLevel(similarity),
                provider: 'aws',
                details: {
                    faceMatchCount: response.FaceMatches.length,
                    unmatchedFaces: response.UnmatchedFaces?.length || 0,
                    boundingBox: match.Face?.BoundingBox
                }
            };
        }

        return {
            success: true,
            matched: false,
            similarity: 0,
            confidence: 'low',
            provider: 'aws',
            details: {
                unmatchedFaces: response.UnmatchedFaces?.length || 0,
                message: 'No matching faces found'
            }
        };
    } catch (error) {
        console.error('AWS Rekognition error:', error);
        return {
            success: false,
            matched: false,
            similarity: 0,
            confidence: 'none',
            provider: 'aws',
            error: error.message
        };
    }
}

/**
 * Verify faces using Azure Face API
 */
async function verifyWithAzure(sourceImage, targetImage) {
    if (!config.azureEndpoint || !config.azureApiKey) {
        return {
            success: false,
            matched: false,
            similarity: 0,
            confidence: 'none',
            provider: 'azure',
            error: 'Azure Face API credentials not configured'
        };
    }

    try {
        // Detect faces in both images first
        const [sourceFaceId, targetFaceId] = await Promise.all([
            detectFaceAzure(sourceImage),
            detectFaceAzure(targetImage)
        ]);

        if (!sourceFaceId || !targetFaceId) {
            return {
                success: true,
                matched: false,
                similarity: 0,
                confidence: 'low',
                provider: 'azure',
                details: {
                    message: 'Could not detect face in one or both images',
                    sourceFaceDetected: !!sourceFaceId,
                    targetFaceDetected: !!targetFaceId
                }
            };
        }

        // Verify the two faces
        const verifyResponse = await fetch(`${config.azureEndpoint}/face/v1.0/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': config.azureApiKey
            },
            body: JSON.stringify({
                faceId1: sourceFaceId,
                faceId2: targetFaceId
            })
        });

        if (!verifyResponse.ok) {
            throw new Error(`Azure verify failed: ${verifyResponse.status}`);
        }

        const verifyResult = await verifyResponse.json();
        const similarity = verifyResult.confidence || 0;

        return {
            success: true,
            matched: verifyResult.isIdentical && similarity >= config.similarityThreshold,
            similarity,
            confidence: getConfidenceLevel(similarity),
            provider: 'azure',
            details: {
                isIdentical: verifyResult.isIdentical
            }
        };
    } catch (error) {
        console.error('Azure Face API error:', error);
        return {
            success: false,
            matched: false,
            similarity: 0,
            confidence: 'none',
            provider: 'azure',
            error: error.message
        };
    }
}

/**
 * Detect face using Azure and return faceId
 */
async function detectFaceAzure(imageBase64) {
    const imageBuffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');

    const response = await fetch(`${config.azureEndpoint}/face/v1.0/detect?returnFaceId=true`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            'Ocp-Apim-Subscription-Key': config.azureApiKey
        },
        body: imageBuffer
    });

    if (!response.ok) {
        throw new Error(`Azure detect failed: ${response.status}`);
    }

    const faces = await response.json();
    return faces.length > 0 ? faces[0].faceId : null;
}

/**
 * Get confidence level from similarity score
 */
function getConfidenceLevel(similarity) {
    if (similarity >= 0.95) return 'very_high';
    if (similarity >= 0.85) return 'high';
    if (similarity >= 0.70) return 'medium';
    if (similarity >= 0.50) return 'low';
    return 'very_low';
}

/**
 * Log verification attempt to database
 */
async function logVerificationAttempt(userId, result) {
    if (!adminDb) return;

    try {
        const logRef = adminDb.ref(`faceVerificationLogs/${userId}`).push();
        await logRef.set({
            timestamp: new Date().toISOString(),
            success: result.success,
            matched: result.matched,
            similarity: result.similarity,
            confidence: result.confidence,
            provider: result.provider,
            error: result.error || null
        });
    } catch (error) {
        console.error('Failed to log verification attempt:', error);
    }
}

/**
 * Store reference face for a user
 * @param {string} userId - User ID
 * @param {string} imageBase64 - Base64 encoded face image
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function storeReferenceFace(userId, imageBase64) {
    if (!adminDb) {
        return { success: false, error: 'Database not available' };
    }

    try {
        // Validate image
        if (!imageBase64) {
            return { success: false, error: 'No image provided' };
        }

        // Store reference face
        await adminDb.ref(`users/${userId}/referenceFace`).set({
            image: imageBase64,
            updatedAt: new Date().toISOString(),
            verified: false
        });

        return { success: true };
    } catch (error) {
        console.error('Failed to store reference face:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get reference face for a user
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} Base64 encoded face image or null
 */
export async function getReferenceFace(userId) {
    if (!adminDb) return null;

    try {
        const snapshot = await adminDb.ref(`users/${userId}/referenceFace/image`).once('value');
        return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
        console.error('Failed to get reference face:', error);
        return null;
    }
}

/**
 * Verify attendance with face recognition
 * @param {string} userId - User ID
 * @param {string} capturedImage - Base64 encoded captured image
 * @returns {Promise<FaceVerificationResult>}
 */
export async function verifyAttendanceFace(userId, capturedImage) {
    const referenceFace = await getReferenceFace(userId);

    if (!referenceFace) {
        return {
            success: true,
            matched: true,
            similarity: 1.0,
            confidence: 'none',
            provider: 'none',
            error: 'No reference face stored - verification bypassed',
            details: {
                message: 'User should upload a reference photo for face verification'
            }
        };
    }

    return verifyFace(capturedImage, referenceFace, userId);
}

/**
 * Check if face recognition is enabled
 * @returns {boolean}
 */
export function isFaceRecognitionEnabled() {
    return config.provider !== 'none' && 
           ((config.provider === 'aws' && config.awsAccessKeyId && config.awsSecretAccessKey) ||
            (config.provider === 'azure' && config.azureEndpoint && config.azureApiKey));
}

/**
 * Get face recognition configuration status
 * @returns {Object}
 */
export function getFaceRecognitionStatus() {
    return {
        enabled: isFaceRecognitionEnabled(),
        provider: config.provider,
        configured: {
            aws: !!(config.awsAccessKeyId && config.awsSecretAccessKey),
            azure: !!(config.azureEndpoint && config.azureApiKey)
        },
        similarityThreshold: config.similarityThreshold
    };
}
