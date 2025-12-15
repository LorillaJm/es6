// src/routes/api/ai/chat/+server.js
// Hybrid AI Chat API Endpoint
// Combines rule-based logic with AI reasoning for trustworthy responses

import { json } from '@sveltejs/kit';
import { INTENT_CATEGORIES } from '$lib/ai/hybridEngine';

// Rate limiting store (in production, use Redis)
const rateLimits = new Map();
const RATE_LIMIT = 30; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

// Check rate limit
function checkRateLimit(clientId) {
    const now = Date.now();
    const clientData = rateLimits.get(clientId) || { count: 0, resetTime: now + RATE_WINDOW };
    
    if (now > clientData.resetTime) {
        clientData.count = 1;
        clientData.resetTime = now + RATE_WINDOW;
    } else {
        clientData.count++;
    }
    
    rateLimits.set(clientId, clientData);
    return clientData.count <= RATE_LIMIT;
}

// Intent-specific response handlers
const intentHandlers = {
    [INTENT_CATEGORIES.ATTENDANCE_QUERY]: handleAttendanceQuery,
    [INTENT_CATEGORIES.POLICY_QUESTION]: handlePolicyQuestion,
    [INTENT_CATEGORIES.ANALYTICS_REQUEST]: handleAnalyticsRequest,
    [INTENT_CATEGORIES.TROUBLESHOOTING]: handleTroubleshooting,
    [INTENT_CATEGORIES.NAVIGATION]: handleNavigation,
    [INTENT_CATEGORIES.ADMIN_COMMAND]: handleAdminCommand,
    [INTENT_CATEGORIES.GENERAL_CHAT]: handleGeneralChat
};

export async function POST({ request, getClientAddress }) {
    try {
        const clientId = getClientAddress();
        
        // Rate limiting
        if (!checkRateLimit(clientId)) {
            return json({
                response: "You're sending too many requests. Please wait a moment.",
                success: false,
                rateLimited: true
            }, { status: 429 });
        }

        const { message, intent, context } = await request.json();

        // Validate input
        if (!message || typeof message !== 'string') {
            return json({
                response: "Invalid message format.",
                success: false
            }, { status: 400 });
        }

        // Security: Validate role access
        const userRole = context?.userRole || 'user';
        if (intent === INTENT_CATEGORIES.ADMIN_COMMAND && userRole !== 'admin') {
            return json({
                response: "This action requires administrator privileges.",
                success: false,
                accessDenied: true
            }, { status: 403 });
        }

        // Process through appropriate handler
        const handler = intentHandlers[intent] || handleGeneralChat;
        const result = await handler(message, context);

        // Log for audit (in production, store in database)
        console.log(`[AI Chat] User: ${context?.userProfile?.name || 'Anonymous'}, Intent: ${intent}, Message: ${message.substring(0, 50)}...`);

        return json({
            response: result.response,
            success: true,
            suggestions: result.suggestions || [],
            actions: result.actions || [],
            requiresConfirmation: result.requiresConfirmation || false
        });

    } catch (error) {
        console.error('[AI Chat API] Error:', error);
        return json({
            response: "I encountered an error processing your request. Please try again.",
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

// Handler functions
async function handleAttendanceQuery(message, context) {
    const userName = context?.userProfile?.name?.split(' ')[0] || '';
    const lowerMessage = message.toLowerCase();

    // Check for specific attendance queries
    if (lowerMessage.includes('status') || lowerMessage.includes('present') || lowerMessage.includes('today')) {
        return {
            response: `${userName ? `${userName}, ` : ''}I can help you check your attendance status. Based on the system records, you can view your current status in the Attendance section. Would you like me to guide you there?`,
            actions: [
                { label: 'View Attendance', href: '/app/attendance' },
                { label: 'View History', href: '/app/history' }
            ],
            suggestions: [
                { label: '📊 My Summary', query: 'Show my attendance summary' },
                { label: '⏰ Check-in Time', query: 'What time did I check in?' }
            ]
        };
    }

    if (lowerMessage.includes('late') || lowerMessage.includes('tardy')) {
        return {
            response: `I understand you're asking about late arrivals. The system tracks check-in times against your scheduled start time. If you arrived after the grace period, you may be marked as late. Would you like to see the late policy details?`,
            actions: [
                { label: 'View Late Policy', href: '/app/dashboard' }
            ],
            suggestions: [
                { label: '📋 Late Policy', query: 'What is the late policy?' },
                { label: '📝 Request Correction', query: 'How do I request a correction?' }
            ]
        };
    }

    if (lowerMessage.includes('absent') || lowerMessage.includes('missed')) {
        return {
            response: `I can help you understand your absence records. The system tracks days when no check-in was recorded. You can view your complete attendance history for details.`,
            actions: [
                { label: 'View History', href: '/app/history' }
            ]
        };
    }

    return {
        response: `I can help you with attendance-related questions. What specific information would you like to know?`,
        suggestions: [
            { label: '✅ My Status', query: 'Am I checked in today?' },
            { label: '📊 Summary', query: 'Show my attendance summary' },
            { label: '📜 History', query: 'View my attendance history' }
        ]
    };
}

async function handlePolicyQuestion(message, context) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('late') || lowerMessage.includes('grace')) {
        return {
            response: `**Late Policy Overview:**\n\n• **Grace Period:** 15 minutes after scheduled start time\n• **Late Threshold:** Arrivals beyond the grace period are marked late\n• **Tracking:** All late arrivals are recorded in your attendance history\n\nConsistent punctuality helps maintain a good attendance record.`,
            suggestions: [
                { label: '📊 My Late Count', query: 'How many times was I late?' },
                { label: '📝 Request Correction', query: 'How to request a correction?' }
            ]
        };
    }

    if (lowerMessage.includes('absence') || lowerMessage.includes('absent')) {
        return {
            response: `**Absence Policy Overview:**\n\n• **Recording:** Days without check-in are marked as absent\n• **Notification:** Inform your supervisor in advance when possible\n• **Documentation:** Extended absences may require supporting documents\n\nCheck with your department for specific absence limits.`,
            suggestions: [
                { label: '📊 My Absences', query: 'How many absences do I have?' }
            ]
        };
    }

    if (lowerMessage.includes('schedule') || lowerMessage.includes('hours')) {
        return {
            response: `**Standard Schedule:**\n\n• **Work Days:** Monday - Friday\n• **Start Time:** 8:00 AM\n• **End Time:** 5:00 PM\n• **Break:** 1 hour lunch break\n\nYour specific schedule may vary based on your department.`,
            actions: [
                { label: 'View Calendar', href: '/app/dashboard' }
            ]
        };
    }

    return {
        response: `I can explain various attendance policies. What would you like to know about?`,
        suggestions: [
            { label: '⏰ Late Policy', query: 'What is the late policy?' },
            { label: '📋 Absence Policy', query: 'What is the absence policy?' },
            { label: '📅 Schedule', query: 'What are the work hours?' }
        ]
    };
}

async function handleAnalyticsRequest(message, context) {
    const userRole = context?.userRole || 'user';

    if (userRole === 'admin') {
        return {
            response: `I can help you access attendance analytics. The Reports section provides comprehensive data including:\n\n• Daily/Weekly/Monthly summaries\n• Department comparisons\n• Trend analysis\n• Export options\n\nWhat specific analytics would you like to see?`,
            actions: [
                { label: 'View Reports', href: '/admin/reports' },
                { label: 'View Dashboard', href: '/admin/dashboard' }
            ],
            suggestions: [
                { label: "📊 Today's Summary", query: "Show today's attendance summary" },
                { label: '📈 Weekly Trends', query: 'Show attendance trends this week' },
                { label: '📉 Department Stats', query: 'Show department attendance rates' }
            ]
        };
    }

    return {
        response: `I can show you your personal attendance analytics. You can view your attendance summary, trends, and history in your dashboard.`,
        actions: [
            { label: 'View Dashboard', href: '/app/dashboard' },
            { label: 'View History', href: '/app/history' }
        ]
    };
}

async function handleTroubleshooting(message, context) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('qr') || lowerMessage.includes('scan')) {
        return {
            response: `**QR Scan Troubleshooting:**\n\n1. **Clean your camera lens** - Smudges can affect scanning\n2. **Ensure good lighting** - Avoid glare and shadows\n3. **Hold steady** - Keep your phone stable while scanning\n4. **Check QR code** - Ensure it's not damaged or obscured\n\nIf issues persist, try using face recognition as an alternative.`,
            actions: [
                { label: 'Try Face Scan', href: '/app/attendance?method=face' },
                { label: 'Request Help', href: '/app/support' }
            ]
        };
    }

    if (lowerMessage.includes('face') || lowerMessage.includes('biometric') || lowerMessage.includes('recognition')) {
        return {
            response: `**Face Recognition Tips:**\n\n1. **Good lighting** - Face a light source, avoid backlighting\n2. **Face camera directly** - Center your face in the frame\n3. **Remove obstructions** - Take off sunglasses, hats\n4. **Neutral expression** - Keep a natural, relaxed face\n\nYou can re-register your face in Profile settings if needed.`,
            actions: [
                { label: 'Go to Profile', href: '/app/profile' },
                { label: 'Try QR Scan', href: '/app/attendance?method=qr' }
            ]
        };
    }

    if (lowerMessage.includes('forgot') || lowerMessage.includes('missed') || lowerMessage.includes('correction')) {
        return {
            response: `**Forgot to Check In?**\n\nYou can submit a correction request:\n\n1. Go to Attendance section\n2. Select "Request Correction"\n3. Provide the date and approximate time\n4. Add a brief explanation\n\nRequests are typically reviewed within 1-2 business days.`,
            actions: [
                { label: 'Submit Request', href: '/app/attendance?action=correction' }
            ]
        };
    }

    return {
        response: `I can help troubleshoot common issues. What problem are you experiencing?`,
        suggestions: [
            { label: '📱 QR Issues', query: 'QR scan not working' },
            { label: '👤 Face Scan Issues', query: 'Face recognition failed' },
            { label: '📝 Forgot Check-in', query: 'I forgot to check in' }
        ]
    };
}

async function handleNavigation(message, context) {
    const lowerMessage = message.toLowerCase();

    const navigationMap = {
        dashboard: { title: 'Dashboard', href: '/app/dashboard', description: 'View your attendance overview and quick actions' },
        profile: { title: 'Profile', href: '/app/profile', description: 'Manage your profile and settings' },
        history: { title: 'History', href: '/app/history', description: 'View your complete attendance history' },
        epass: { title: 'E-Pass', href: '/app/epass', description: 'Access your digital ID card' },
        attendance: { title: 'Attendance', href: '/app/attendance', description: 'Check in/out and view status' },
        settings: { title: 'Settings', href: '/app/settings', description: 'Configure your preferences' }
    };

    for (const [key, nav] of Object.entries(navigationMap)) {
        if (lowerMessage.includes(key)) {
            return {
                response: `**${nav.title}**\n\n${nav.description}`,
                actions: [
                    { label: `Go to ${nav.title}`, href: nav.href }
                ]
            };
        }
    }

    return {
        response: `I can help you navigate the system. Where would you like to go?`,
        suggestions: [
            { label: '🏠 Dashboard', query: 'Go to dashboard' },
            { label: '👤 Profile', query: 'Open my profile' },
            { label: '📜 History', query: 'View attendance history' },
            { label: '🎫 E-Pass', query: 'Show my E-Pass' }
        ]
    };
}

async function handleAdminCommand(message, context) {
    const lowerMessage = message.toLowerCase();

    // Admin commands require confirmation
    if (lowerMessage.includes('deactivate') || lowerMessage.includes('suspend')) {
        return {
            response: `**User Management**\n\nTo deactivate or suspend a user:\n\n1. Go to Admin > Users\n2. Find the user\n3. Click on their profile\n4. Select "Deactivate" or "Suspend"\n\n⚠️ This action requires confirmation and will be logged.`,
            actions: [
                { label: 'Go to Users', href: '/admin/users' }
            ],
            requiresConfirmation: true
        };
    }

    if (lowerMessage.includes('configure') || lowerMessage.includes('policy') || lowerMessage.includes('settings')) {
        return {
            response: `**System Configuration**\n\nYou can configure:\n\n• Grace periods and thresholds\n• Holiday schedules\n• Notification settings\n• Security policies\n\nAll changes are logged for audit purposes.`,
            actions: [
                { label: 'System Settings', href: '/admin/settings' }
            ]
        };
    }

    return {
        response: `As an administrator, you have access to advanced system controls. What would you like to manage?`,
        suggestions: [
            { label: '👥 User Management', query: 'How to manage users?' },
            { label: '⚙️ System Settings', query: 'Configure system settings' },
            { label: '📊 Reports', query: 'Generate reports' }
        ]
    };
}

async function handleGeneralChat(message, context) {
    const lowerMessage = message.toLowerCase();
    const userName = context?.userProfile?.name?.split(' ')[0] || '';

    // Greetings
    if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(lowerMessage)) {
        const greeting = getTimeBasedGreeting();
        return {
            response: `${greeting}${userName ? `, ${userName}` : ''}! I'm your AI attendance assistant. I can help you with:\n\n• Checking your attendance status\n• Understanding policies\n• Navigating the system\n• Troubleshooting issues\n\nHow can I assist you today?`,
            suggestions: [
                { label: '✅ My Status', query: 'Am I checked in today?' },
                { label: '📋 Policies', query: 'Explain the attendance policies' },
                { label: '❓ Help', query: 'What can you help me with?' }
            ]
        };
    }

    // Thanks
    if (/\b(thank|thanks|appreciate)\b/i.test(lowerMessage)) {
        return {
            response: `You're welcome${userName ? `, ${userName}` : ''}! Is there anything else I can help you with?`,
            suggestions: [
                { label: '✅ Check Status', query: 'Check my attendance status' },
                { label: '📊 View Summary', query: 'Show my attendance summary' }
            ]
        };
    }

    // Help
    if (/\b(help|what can you|how to)\b/i.test(lowerMessage)) {
        return {
            response: `I'm here to help! Here's what I can assist you with:\n\n**📊 Attendance**\n• Check your status\n• View history and summaries\n\n**📋 Policies**\n• Late and absence rules\n• Schedule information\n\n**🔧 Support**\n• Troubleshoot issues\n• Navigate the system\n\nJust ask me anything!`,
            suggestions: [
                { label: '✅ My Status', query: 'Am I present today?' },
                { label: '📋 Late Policy', query: 'What is the late policy?' },
                { label: '🔧 QR Help', query: 'QR scan not working' }
            ]
        };
    }

    // Default response
    return {
        response: `I'm not sure I understood that. Could you rephrase your question? You can ask me about:\n\n• Your attendance status\n• Attendance policies\n• System navigation\n• Troubleshooting help`,
        suggestions: [
            { label: '✅ My Status', query: 'Check my attendance' },
            { label: '❓ Help', query: 'What can you help me with?' }
        ]
    };
}

function getTimeBasedGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}
