// src/routes/api/admin/users/[id]/send-verification/+server.js
// Admin endpoint to send email verification request to a user

import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, PERMISSIONS } from '$lib/server/adminAuth.js';
import { adminDb } from '$lib/server/firebase-admin.js';
import { sendEmail } from '$lib/server/emailService.js';
import crypto from 'crypto';

const OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashOTP(otp) {
    return crypto.createHash('sha256').update(otp).digest('hex');
}

function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

export async function POST({ request, params }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const admin = await verifyAccessToken(authHeader.substring(7));
        if (!admin || !checkPermission(admin, PERMISSIONS.MANAGE_USERS)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        const userId = params.id;
        if (!userId) {
            return json({ error: 'User ID required' }, { status: 400 });
        }

        // Get user data
        const userSnapshot = await adminDb.ref(`users/${userId}`).once('value');
        if (!userSnapshot.exists()) {
            return json({ error: 'User not found' }, { status: 404 });
        }

        const user = userSnapshot.val();
        
        if (!user.email) {
            return json({ error: 'User has no email address' }, { status: 400 });
        }

        if (user.emailVerified) {
            return json({ error: 'User email is already verified' }, { status: 400 });
        }

        // Generate OTP and session token
        const otp = generateOTP();
        const otpHash = hashOTP(otp);
        const sessionToken = generateSessionToken();
        const now = Date.now();

        // Store verification data
        await adminDb.ref(`emailVerifications/${userId}`).set({
            otpHash,
            sessionToken,
            email: user.email,
            createdAt: new Date(now).toISOString(),
            expiresAt: new Date(now + OTP_EXPIRY).toISOString(),
            lastSentAt: new Date(now).toISOString(),
            resendCount: 1,
            verifyAttempts: 0,
            verified: false,
            sentByAdmin: admin.id,
            sentByAdminName: admin.name
        });

        // Send verification email
        const emailResult = await sendVerificationEmailFromAdmin(
            user.email, 
            otp, 
            user.name || 'User',
            admin.name || 'Admin'
        );

        if (!emailResult.success) {
            return json({ error: 'Failed to send verification email: ' + emailResult.error }, { status: 500 });
        }

        // Log audit event
        await adminDb.ref('auditLogs').push({
            action: 'ADMIN_SENT_VERIFICATION_EMAIL',
            adminId: admin.id,
            adminName: admin.name,
            targetId: userId,
            targetEmail: user.email,
            targetName: user.name,
            timestamp: new Date().toISOString(),
            details: {
                userId,
                userEmail: user.email,
                userName: user.name
            }
        });

        return json({ 
            success: true, 
            message: `Verification email sent to ${user.email}`,
            email: user.email
        });

    } catch (error) {
        console.error('Send verification email error:', error);
        return json({ error: error.message || 'Failed to send verification email' }, { status: 500 });
    }
}

/**
 * Send verification email from admin
 */
async function sendVerificationEmailFromAdmin(email, otp, userName, adminName) {
    const subject = '🔐 Email Verification Required - Action Requested by Admin';
    
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
                    <span style="font-size: 32px;">📧</span>
                </div>
                <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">Verify Your Email</h1>
                <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">Requested by Administrator</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 32px;">
                <p style="margin: 0 0 16px; color: #1d1d1f; font-size: 16px; line-height: 1.5;">
                    Hi <strong>${userName}</strong>,
                </p>
                <p style="margin: 0 0 24px; color: #86868b; font-size: 15px; line-height: 1.6;">
                    An administrator (<strong>${adminName}</strong>) has requested that you verify your email address. Please use the code below to complete the verification process.
                </p>
                <p style="margin: 0 0 32px; color: #86868b; font-size: 15px; line-height: 1.6;">
                    This code will expire in <strong>5 minutes</strong>.
                </p>
                
                <!-- OTP Code -->
                <div style="background: #f5f5f7; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 32px;">
                    <p style="margin: 0 0 8px; color: #86868b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your verification code</p>
                    <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1d1d1f; font-family: 'SF Mono', Monaco, 'Courier New', monospace;">
                        ${otp}
                    </div>
                </div>

                <!-- Instructions -->
                <div style="background: #e8f4fd; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0; color: #0066cc; font-size: 13px; line-height: 1.5;">
                        📱 <strong>How to verify:</strong><br>
                        1. Log in to your account<br>
                        2. You'll be prompted to enter this code<br>
                        3. Enter the 6-digit code above<br>
                        4. Your email will be verified!
                    </p>
                </div>
                
                <!-- Security Note -->
                <div style="background: #fff3cd; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0; color: #856404; font-size: 13px; line-height: 1.5;">
                        ⚠️ <strong>Security tip:</strong> Never share this code with anyone. Our team will never ask for your verification code.
                    </p>
                </div>
                
                <p style="margin: 0; color: #86868b; font-size: 14px; line-height: 1.5;">
                    If you didn't expect this email or have any questions, please contact your administrator.
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
