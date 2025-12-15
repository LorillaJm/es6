// src/lib/server/emailVerificationService.js
// Professional Email Verification Service with OTP

import { adminDb } from './firebase-admin.js';
import { sendEmail } from './emailService.js';
import crypto from 'crypto';

// Configuration
const OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes
const MAX_RESEND_ATTEMPTS = 3;
const RESEND_COOLDOWN = 60 * 1000; // 1 minute between resends
const MAX_VERIFY_ATTEMPTS = 5;

/**
 * Generate a 6-digit OTP
 */
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash OTP for secure storage
 */
function hashOTP(otp) {
    return crypto.createHash('sha256').update(otp).digest('hex');
}

/**
 * Generate a secure session token
 */
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Send verification OTP to user's email
 * @param {string} userId - User ID
 * @param {string} email - User's email address
 * @param {string} userName - User's display name
 * @returns {Promise<{success: boolean, sessionToken?: string, error?: string}>}
 */
export async function sendVerificationOTP(userId, email, userName = 'User') {
    if (!adminDb) {
        return { success: false, error: 'Database not available' };
    }

    try {
        // Check for existing pending verification and rate limiting
        const existingRef = adminDb.ref(`emailVerifications/${userId}`);
        const existingSnapshot = await existingRef.once('value');
        const existing = existingSnapshot.val();

        if (existing) {
            // Check resend cooldown
            const lastSentAt = existing.lastSentAt ? new Date(existing.lastSentAt).getTime() : 0;
            const timeSinceLastSend = Date.now() - lastSentAt;
            
            if (timeSinceLastSend < RESEND_COOLDOWN) {
                const waitSeconds = Math.ceil((RESEND_COOLDOWN - timeSinceLastSend) / 1000);
                return { 
                    success: false, 
                    error: `Please wait ${waitSeconds} seconds before requesting a new code`,
                    retryAfter: waitSeconds
                };
            }

            // Check max resend attempts
            if (existing.resendCount >= MAX_RESEND_ATTEMPTS) {
                return { 
                    success: false, 
                    error: 'Maximum resend attempts reached. Please contact support.' 
                };
            }
        }

        // Generate OTP and session token
        const otp = generateOTP();
        const otpHash = hashOTP(otp);
        const sessionToken = generateSessionToken();
        const now = Date.now();

        // Store verification data
        await existingRef.set({
            otpHash,
            sessionToken,
            email,
            createdAt: new Date(now).toISOString(),
            expiresAt: new Date(now + OTP_EXPIRY).toISOString(),
            lastSentAt: new Date(now).toISOString(),
            resendCount: (existing?.resendCount || 0) + 1,
            verifyAttempts: 0,
            verified: false
        });

        // Send email with OTP
        const emailResult = await sendVerificationEmail(email, otp, userName);
        
        if (!emailResult.success) {
            return { success: false, error: 'Failed to send verification email' };
        }

        return { 
            success: true, 
            sessionToken,
            expiresIn: OTP_EXPIRY / 1000, // seconds
            message: 'Verification code sent to your email'
        };
    } catch (error) {
        console.error('Error sending verification OTP:', error);
        return { success: false, error: 'Failed to send verification code' };
    }
}

/**
 * Verify OTP code
 * @param {string} userId - User ID
 * @param {string} code - 6-digit OTP code
 * @param {string} sessionToken - Session token from sendVerificationOTP
 * @returns {Promise<{success: boolean, verified?: boolean, error?: string}>}
 */
export async function verifyOTP(userId, code, sessionToken) {
    if (!adminDb) {
        return { success: false, error: 'Database not available' };
    }

    try {
        const verificationRef = adminDb.ref(`emailVerifications/${userId}`);
        const snapshot = await verificationRef.once('value');
        
        if (!snapshot.exists()) {
            return { success: false, error: 'No pending verification found' };
        }

        const verification = snapshot.val();

        // Validate session token
        if (verification.sessionToken !== sessionToken) {
            return { success: false, error: 'Invalid session' };
        }

        // Check if already verified
        if (verification.verified) {
            return { success: true, verified: true, message: 'Email already verified' };
        }

        // Check expiry
        if (new Date(verification.expiresAt) < new Date()) {
            return { success: false, error: 'Verification code has expired. Please request a new one.' };
        }

        // Check max verify attempts
        if (verification.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
            return { success: false, error: 'Too many failed attempts. Please request a new code.' };
        }

        // Increment verify attempts
        await verificationRef.update({
            verifyAttempts: (verification.verifyAttempts || 0) + 1
        });

        // Verify OTP
        const inputHash = hashOTP(code);
        if (inputHash !== verification.otpHash) {
            const remainingAttempts = MAX_VERIFY_ATTEMPTS - (verification.verifyAttempts + 1);
            return { 
                success: false, 
                error: `Invalid code. ${remainingAttempts} attempts remaining.`,
                remainingAttempts
            };
        }

        // Mark as verified
        await verificationRef.update({
            verified: true,
            verifiedAt: new Date().toISOString()
        });

        // Update user's emailVerified status
        await adminDb.ref(`users/${userId}`).update({
            emailVerified: true,
            emailVerifiedAt: new Date().toISOString()
        });

        // Clean up verification data after successful verification
        setTimeout(async () => {
            try {
                await verificationRef.remove();
            } catch (e) {
                console.warn('Failed to cleanup verification data:', e);
            }
        }, 5000);

        return { 
            success: true, 
            verified: true, 
            message: 'Email verified successfully' 
        };
    } catch (error) {
        console.error('Error verifying OTP:', error);
        return { success: false, error: 'Verification failed' };
    }
}

/**
 * Check if user's email is verified
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
export async function isEmailVerified(userId) {
    if (!adminDb) return false;

    try {
        const snapshot = await adminDb.ref(`users/${userId}/emailVerified`).once('value');
        return snapshot.val() === true;
    } catch (error) {
        console.error('Error checking email verification:', error);
        return false;
    }
}

/**
 * Get verification status for a user
 * @param {string} userId - User ID
 * @returns {Promise<{verified: boolean, pending: boolean, canResend: boolean, resendIn?: number}>}
 */
export async function getVerificationStatus(userId) {
    if (!adminDb) {
        return { verified: false, pending: false, canResend: true };
    }

    try {
        // Check user's verified status
        const userSnapshot = await adminDb.ref(`users/${userId}/emailVerified`).once('value');
        const isVerified = userSnapshot.val() === true;

        if (isVerified) {
            return { verified: true, pending: false, canResend: false };
        }

        // Check pending verification
        const verificationSnapshot = await adminDb.ref(`emailVerifications/${userId}`).once('value');
        
        if (!verificationSnapshot.exists()) {
            return { verified: false, pending: false, canResend: true };
        }

        const verification = verificationSnapshot.val();
        const lastSentAt = verification.lastSentAt ? new Date(verification.lastSentAt).getTime() : 0;
        const timeSinceLastSend = Date.now() - lastSentAt;
        const canResend = timeSinceLastSend >= RESEND_COOLDOWN && verification.resendCount < MAX_RESEND_ATTEMPTS;
        const resendIn = canResend ? 0 : Math.ceil((RESEND_COOLDOWN - timeSinceLastSend) / 1000);

        return {
            verified: false,
            pending: true,
            canResend,
            resendIn: resendIn > 0 ? resendIn : undefined,
            expiresAt: verification.expiresAt,
            resendCount: verification.resendCount,
            maxResends: MAX_RESEND_ATTEMPTS
        };
    } catch (error) {
        console.error('Error getting verification status:', error);
        return { verified: false, pending: false, canResend: true };
    }
}

/**
 * Send verification email with OTP
 */
async function sendVerificationEmail(email, otp, userName) {
    const subject = '🔐 Your Verification Code';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
    <div style="max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <!-- Card -->
        <div style="background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%); padding: 40px 32px; text-align: center;">
                <div style="width: 64px; height: 64px; background: rgba(255,255,255,0.2); border-radius: 16px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 32px;">🔐</span>
                </div>
                <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">Verify Your Email</h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 32px;">
                <p style="margin: 0 0 24px; color: #1d1d1f; font-size: 16px; line-height: 1.5;">
                    Hi <strong>${userName}</strong>,
                </p>
                <p style="margin: 0 0 32px; color: #86868b; font-size: 15px; line-height: 1.6;">
                    Use the verification code below to complete your sign-in. This code will expire in <strong>5 minutes</strong>.
                </p>
                
                <!-- OTP Code -->
                <div style="background: #f5f5f7; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 32px;">
                    <p style="margin: 0 0 8px; color: #86868b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your verification code</p>
                    <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1d1d1f; font-family: 'SF Mono', Monaco, 'Courier New', monospace;">
                        ${otp}
                    </div>
                </div>
                
                <!-- Security Note -->
                <div style="background: #fff3cd; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0; color: #856404; font-size: 13px; line-height: 1.5;">
                        ⚠️ <strong>Security tip:</strong> Never share this code with anyone. Our team will never ask for your verification code.
                    </p>
                </div>
                
                <p style="margin: 0; color: #86868b; font-size: 14px; line-height: 1.5;">
                    If you didn't request this code, you can safely ignore this email.
                </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #f5f5f7; padding: 24px 32px; text-align: center;">
                <p style="margin: 0; color: #86868b; font-size: 12px;">
                    This is an automated message from the Attendance System.<br>
                    Please do not reply to this email.
                </p>
            </div>
        </div>
        
        <!-- Bottom Text -->
        <p style="text-align: center; margin-top: 24px; color: #86868b; font-size: 11px;">
            © ${new Date().getFullYear()} Attendance System. All rights reserved.
        </p>
    </div>
</body>
</html>`;

    return await sendEmail({
        to: email,
        subject,
        html
    });
}

/**
 * Admin: Send verification OTP for admin accounts
 */
export async function sendAdminVerificationOTP(adminId, email, adminName = 'Admin') {
    if (!adminDb) {
        return { success: false, error: 'Database not available' };
    }

    try {
        // Check for existing pending verification and rate limiting
        const existingRef = adminDb.ref(`adminEmailVerifications/${adminId}`);
        const existingSnapshot = await existingRef.once('value');
        const existing = existingSnapshot.val();

        if (existing) {
            const lastSentAt = existing.lastSentAt ? new Date(existing.lastSentAt).getTime() : 0;
            const timeSinceLastSend = Date.now() - lastSentAt;
            
            if (timeSinceLastSend < RESEND_COOLDOWN) {
                const waitSeconds = Math.ceil((RESEND_COOLDOWN - timeSinceLastSend) / 1000);
                return { 
                    success: false, 
                    error: `Please wait ${waitSeconds} seconds before requesting a new code`,
                    retryAfter: waitSeconds
                };
            }

            if (existing.resendCount >= MAX_RESEND_ATTEMPTS) {
                return { 
                    success: false, 
                    error: 'Maximum resend attempts reached. Please contact support.' 
                };
            }
        }

        const otp = generateOTP();
        const otpHash = hashOTP(otp);
        const sessionToken = generateSessionToken();
        const now = Date.now();

        await existingRef.set({
            otpHash,
            sessionToken,
            email,
            createdAt: new Date(now).toISOString(),
            expiresAt: new Date(now + OTP_EXPIRY).toISOString(),
            lastSentAt: new Date(now).toISOString(),
            resendCount: (existing?.resendCount || 0) + 1,
            verifyAttempts: 0,
            verified: false
        });

        const emailResult = await sendVerificationEmail(email, otp, adminName);
        
        if (!emailResult.success) {
            return { success: false, error: 'Failed to send verification email' };
        }

        return { 
            success: true, 
            sessionToken,
            expiresIn: OTP_EXPIRY / 1000,
            message: 'Verification code sent to your email'
        };
    } catch (error) {
        console.error('Error sending admin verification OTP:', error);
        return { success: false, error: 'Failed to send verification code' };
    }
}

/**
 * Admin: Verify OTP for admin accounts
 */
export async function verifyAdminOTP(adminId, code, sessionToken) {
    if (!adminDb) {
        return { success: false, error: 'Database not available' };
    }

    try {
        const verificationRef = adminDb.ref(`adminEmailVerifications/${adminId}`);
        const snapshot = await verificationRef.once('value');
        
        if (!snapshot.exists()) {
            return { success: false, error: 'No pending verification found' };
        }

        const verification = snapshot.val();

        if (verification.sessionToken !== sessionToken) {
            return { success: false, error: 'Invalid session' };
        }

        if (verification.verified) {
            return { success: true, verified: true, message: 'Email already verified' };
        }

        if (new Date(verification.expiresAt) < new Date()) {
            return { success: false, error: 'Verification code has expired. Please request a new one.' };
        }

        if (verification.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
            return { success: false, error: 'Too many failed attempts. Please request a new code.' };
        }

        await verificationRef.update({
            verifyAttempts: (verification.verifyAttempts || 0) + 1
        });

        const inputHash = hashOTP(code);
        if (inputHash !== verification.otpHash) {
            const remainingAttempts = MAX_VERIFY_ATTEMPTS - (verification.verifyAttempts + 1);
            return { 
                success: false, 
                error: `Invalid code. ${remainingAttempts} attempts remaining.`,
                remainingAttempts
            };
        }

        await verificationRef.update({
            verified: true,
            verifiedAt: new Date().toISOString()
        });

        await adminDb.ref(`admins/${adminId}`).update({
            emailVerified: true,
            emailVerifiedAt: new Date().toISOString()
        });

        setTimeout(async () => {
            try {
                await verificationRef.remove();
            } catch (e) {
                console.warn('Failed to cleanup admin verification data:', e);
            }
        }, 5000);

        return { 
            success: true, 
            verified: true, 
            message: 'Email verified successfully' 
        };
    } catch (error) {
        console.error('Error verifying admin OTP:', error);
        return { success: false, error: 'Verification failed' };
    }
}

/**
 * Check if admin's email is verified
 */
export async function isAdminEmailVerified(adminId) {
    if (!adminDb) return false;

    try {
        const snapshot = await adminDb.ref(`admins/${adminId}/emailVerified`).once('value');
        return snapshot.val() === true;
    } catch (error) {
        console.error('Error checking admin email verification:', error);
        return false;
    }
}
