// src/lib/server/emailService.js
// Email Service - Send real emails using Nodemailer

import { adminDb } from './firebase-admin.js';

// Email configuration from environment variables with fallback defaults
let EMAIL_HOST = 'smtp.gmail.com';
let EMAIL_PORT = '587';
let EMAIL_USER = 'crocsweb7@gmail.com';
let EMAIL_PASS = 'kamx zkop wwye eumv';
let EMAIL_FROM = 'Attendance System <crocsweb7@gmail.com>';

try {
    const { env } = await import('$env/dynamic/private');
    EMAIL_HOST = env.EMAIL_HOST || EMAIL_HOST;
    EMAIL_PORT = env.EMAIL_PORT || EMAIL_PORT;
    EMAIL_USER = env.EMAIL_USER || EMAIL_USER;
    EMAIL_PASS = env.EMAIL_PASS || EMAIL_PASS;
    EMAIL_FROM = env.EMAIL_FROM || EMAIL_FROM;
} catch (e) {
    console.warn('Email environment variables not available, using defaults');
}

/**
 * Create email transporter dynamically (to avoid import issues)
 */
async function createTransporter() {
    try {
        const nodemailer = await import('nodemailer');
        
        return nodemailer.default.createTransport({
            host: EMAIL_HOST,
            port: parseInt(EMAIL_PORT),
            secure: EMAIL_PORT === '465',
            auth: {
                user: EMAIL_USER,
                pass: EMAIL_PASS
            }
        });
    } catch (error) {
        console.error('Failed to create email transporter:', error);
        return null;
    }
}

/**
 * Send an email
 */
export async function sendEmail(options) {
    const { to, subject, html, text, attachments = [] } = options;

    if (!EMAIL_USER || !EMAIL_PASS) {
        console.error('Email credentials not configured');
        return { success: false, error: 'Email not configured' };
    }

    try {
        const transporter = await createTransporter();
        if (!transporter) {
            return { success: false, error: 'Failed to create transporter' };
        }

        const mailOptions = {
            from: EMAIL_FROM,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, ''),
            attachments
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent:', info.messageId);

        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send work habit report via email
 */
export async function sendReportEmail(to, report) {
    const subject = `📊 Work Habit Report - ${report.meta.period.label}`;
    
    const html = generateReportEmailHTML(report);

    return await sendEmail({
        to,
        subject,
        html
    });
}

/**
 * Generate HTML email content for report
 */
function generateReportEmailHTML(report) {
    const { meta, summary } = report;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f5;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 24px;">📊 Work Habit Report</h1>
            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">${meta.period.label}</p>
        </div>

        <!-- Main Content -->
        <div style="background: white; padding: 32px; border-radius: 0 0 16px 16px;">
            <!-- User Info -->
            <p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
                Hello <strong style="color: #1f2937;">${meta.userName}</strong>,<br>
                Here's your attendance summary for the period.
            </p>

            <!-- Score Card -->
            <div style="text-align: center; margin-bottom: 32px;">
                <div style="display: inline-block; width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; line-height: 100px; font-size: 32px; font-weight: bold;">
                    ${summary.score}
                </div>
                <p style="margin: 8px 0 0; color: #6b7280; font-size: 12px;">Overall Score</p>
            </div>

            <!-- Stats Grid -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr>
                    <td style="padding: 16px; text-align: center; background: #f9fafb; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #4f46e5;">${summary.presentDays}/${summary.totalDays}</div>
                        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Days Present</div>
                    </td>
                    <td style="width: 16px;"></td>
                    <td style="padding: 16px; text-align: center; background: #f9fafb; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #059669;">${summary.punctualityRate}%</div>
                        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Punctuality</div>
                    </td>
                </tr>
                <tr><td colspan="3" style="height: 16px;"></td></tr>
                <tr>
                    <td style="padding: 16px; text-align: center; background: #f9fafb; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #1f2937;">${summary.totalHours}h</div>
                        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Total Hours</div>
                    </td>
                    <td style="width: 16px;"></td>
                    <td style="padding: 16px; text-align: center; background: #f9fafb; border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: #d97706;">${summary.totalOvertime}h</div>
                        <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Overtime</div>
                    </td>
                </tr>
            </table>

            <!-- Quick Stats -->
            <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h3 style="margin: 0 0 16px; font-size: 14px; color: #374151;">Quick Summary</h3>
                <table style="width: 100%; font-size: 13px;">
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280;">On-time arrivals</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #059669;">${summary.onTimeDays} days</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Late arrivals</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #d97706;">${summary.lateDays} days</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Early leaves</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #6b7280;">${summary.earlyLeaveDays} days</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Average hours/day</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1f2937;">${summary.avgHoursPerDay}h</td>
                    </tr>
                </table>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center;">
                <a href="#" style="display: inline-block; padding: 12px 32px; background: #4f46e5; color: white; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
                    View Full Report
                </a>
            </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 24px; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">This report was automatically generated by the Attendance System.</p>
            <p style="margin: 8px 0 0;">Report ID: ${meta.reportId}</p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Process email queue (call this from a cron job or scheduled function)
 */
export async function processEmailQueue() {
    if (!adminDb) {
        console.error('Admin DB not available');
        return { processed: 0, failed: 0 };
    }

    try {
        const snapshot = await adminDb.ref('emailQueue')
            .orderByChild('status')
            .equalTo('pending')
            .limitToFirst(10)
            .once('value');

        if (!snapshot.exists()) {
            return { processed: 0, failed: 0 };
        }

        let processed = 0;
        let failed = 0;

        const promises = [];
        snapshot.forEach((child) => {
            const emailData = child.val();
            const emailId = child.key;

            promises.push(
                (async () => {
                    try {
                        // Update status to processing
                        await adminDb.ref(`emailQueue/${emailId}/status`).set('processing');

                        // Send the email
                        let result;
                        if (emailData.type === 'work_habit_report') {
                            result = await sendReportEmail(emailData.email, emailData.reportData);
                        } else {
                            result = await sendEmail({
                                to: emailData.email,
                                subject: emailData.subject,
                                html: emailData.html || emailData.body
                            });
                        }

                        if (result.success) {
                            await adminDb.ref(`emailQueue/${emailId}`).update({
                                status: 'sent',
                                sentAt: new Date().toISOString(),
                                messageId: result.messageId
                            });
                            processed++;
                        } else {
                            await adminDb.ref(`emailQueue/${emailId}`).update({
                                status: 'failed',
                                error: result.error,
                                failedAt: new Date().toISOString()
                            });
                            failed++;
                        }
                    } catch (error) {
                        await adminDb.ref(`emailQueue/${emailId}`).update({
                            status: 'failed',
                            error: error.message,
                            failedAt: new Date().toISOString()
                        });
                        failed++;
                    }
                })()
            );
        });

        await Promise.all(promises);

        return { processed, failed };
    } catch (error) {
        console.error('Error processing email queue:', error);
        return { processed: 0, failed: 0, error: error.message };
    }
}

/**
 * Send notification email
 */
export async function sendNotificationEmail(to, notification) {
    const { title, message, type = 'info' } = notification;
    
    const typeColors = {
        info: '#3b82f6',
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626'
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f5;">
    <div style="max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="height: 4px; background: ${typeColors[type] || typeColors.info};"></div>
            <div style="padding: 32px;">
                <h2 style="margin: 0 0 16px; font-size: 18px; color: #1f2937;">${title}</h2>
                <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">${message}</p>
            </div>
        </div>
        <p style="text-align: center; margin-top: 16px; color: #9ca3af; font-size: 12px;">
            Attendance System Notification
        </p>
    </div>
</body>
</html>`;

    return await sendEmail({
        to,
        subject: title,
        html
    });
}
