// src/routes/api/ai/chat/+server.js
// Hybrid AI Chat API Endpoint - Now powered by Google Gemini
// Combines Gemini AI reasoning with rule-based fallbacks for reliable responses

import { json } from '@sveltejs/kit';
import { INTENT_CATEGORIES } from '$lib/ai/hybridEngine';
import { generateGeminiResponse } from '$lib/services/geminiService';

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

// Fallback intent handlers (used when Gemini is unavailable)
const fallbackHandlers = {
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

        // Try Gemini AI first for intelligent responses
        let result = null;
        let usedGemini = false;
        
        console.log(`[AI Chat] Processing message: "${message.substring(0, 50)}..."`);
        
        try {
            const geminiContext = {
                userRole,
                userProfile: context?.userProfile,
                conversationHistory: context?.conversationHistory || [],
                intent
            };
            
            console.log('[AI Chat] Calling Gemini...');
            result = await generateGeminiResponse(message, geminiContext);
            console.log('[AI Chat] Gemini result:', result ? 'Got response' : 'No response');
            
            if (result && result.response) {
                usedGemini = true;
                console.log(`[AI Chat] ✓ Gemini success! Response: ${result.response.substring(0, 100)}...`);
            } else {
                console.warn('[AI Chat] ✗ Gemini returned empty/null');
                result = null;
            }
        } catch (geminiError) {
            console.error('[AI Chat] ✗ Gemini error:', geminiError.message, geminiError.stack);
            result = null;
        }

        // Fallback to rule-based response if Gemini fails or returns empty
        if (!result || !result.response) {
            const handler = fallbackHandlers[intent] || handleGeneralChat;
            result = await handler(message, context);
            console.log(`[AI Chat] Fallback response for intent: ${intent}`);
        }
        
        // Final safety check - never return empty response
        if (!result || !result.response) {
            result = {
                response: "I'm here to help! Could you please rephrase your question? I can assist with attendance, policies, system navigation, or answer general questions.",
                suggestions: [
                    { label: '✅ My Status', query: 'Check my attendance' },
                    { label: '❓ Help', query: 'What can you help with?' }
                ],
                actions: []
            };
        }

        // Log for audit
        console.log(`[AI Chat] User: ${context?.userProfile?.name || 'Anonymous'}, Intent: ${intent}`);

        return json({
            response: result.response,
            success: true,
            suggestions: result.suggestions || [],
            actions: result.actions || [],
            requiresConfirmation: result.requiresConfirmation || false,
            aiPowered: !!result.response // Indicates if Gemini was used
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

// ============================================
// FALLBACK HANDLER FUNCTIONS
// Used when Gemini AI is unavailable
// ============================================

async function handleAttendanceQuery(message, context) {
    const userName = context?.userProfile?.name?.split(' ')[0] || '';
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('status') || lowerMessage.includes('present') || lowerMessage.includes('today')) {
        return {
            response: `${userName ? `${userName}, ` : ''}I can help you check your attendance status. You can view your current status in the Attendance section.`,
            actions: [
                { label: '✅ View Attendance', href: '/app/attendance' },
                { label: '📜 View History', href: '/app/history' }
            ],
            suggestions: [
                { label: '📊 My Summary', query: 'Show my attendance summary' },
                { label: '⏰ Check-in Time', query: 'What time did I check in?' }
            ]
        };
    }

    if (lowerMessage.includes('late') || lowerMessage.includes('tardy')) {
        return {
            response: `The system tracks check-in times against your scheduled start time (8:00 AM). If you arrived after the 15-minute grace period, you may be marked as late.`,
            actions: [{ label: '📋 View Late Policy', href: '/app/dashboard' }],
            suggestions: [
                { label: '📋 Late Policy', query: 'What is the late policy?' },
                { label: '📝 Request Correction', query: 'How do I request a correction?' }
            ]
        };
    }

    return {
        response: `I can help you with attendance-related questions. What would you like to know?`,
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
            response: `**Late Policy:**\n• Grace Period: 15 minutes after 8:00 AM\n• Late Threshold: Arrivals beyond grace period are marked late\n• All late arrivals are recorded in your history`,
            suggestions: [
                { label: '📊 My Late Count', query: 'How many times was I late?' },
                { label: '📝 Request Correction', query: 'How to request a correction?' }
            ]
        };
    }

    if (lowerMessage.includes('schedule') || lowerMessage.includes('hours')) {
        return {
            response: `**Standard Schedule:**\n• Work Days: Monday - Friday\n• Start Time: 8:00 AM\n• End Time: 5:00 PM\n• Break: 1 hour lunch`,
            actions: [{ label: '📅 View Calendar', href: '/app/dashboard' }]
        };
    }

    return {
        response: `I can explain attendance policies. What would you like to know?`,
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
            response: `I can help you access attendance analytics. The Reports section provides comprehensive data including daily/weekly/monthly summaries, department comparisons, and trend analysis.`,
            actions: [
                { label: '📈 View Reports', href: '/admin/reports' },
                { label: '📊 Dashboard', href: '/admin/dashboard' }
            ],
            suggestions: [
                { label: "📊 Today's Summary", query: "Show today's attendance summary" },
                { label: '📈 Weekly Trends', query: 'Show attendance trends this week' }
            ]
        };
    }

    return {
        response: `You can view your personal attendance analytics in your dashboard.`,
        actions: [
            { label: '📊 View Dashboard', href: '/app/dashboard' },
            { label: '📜 View History', href: '/app/history' }
        ]
    };
}

async function handleTroubleshooting(message, context) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('qr') || lowerMessage.includes('scan')) {
        return {
            response: `**QR Scan Tips:**\n1. Clean your camera lens\n2. Ensure good lighting\n3. Hold steady while scanning\n4. Check QR code isn't damaged\n\nIf issues persist, try face recognition.`,
            actions: [
                { label: '👤 Try Face Scan', href: '/app/attendance?method=face' }
            ]
        };
    }

    if (lowerMessage.includes('face') || lowerMessage.includes('biometric')) {
        return {
            response: `**Face Recognition Tips:**\n1. Good lighting (face a light source)\n2. Face camera directly\n3. Remove sunglasses/hats\n4. Keep neutral expression\n\nYou can re-register in Profile settings.`,
            actions: [
                { label: '👤 Go to Profile', href: '/app/profile' },
                { label: '📱 Try QR Scan', href: '/app/attendance?method=qr' }
            ]
        };
    }

    if (lowerMessage.includes('forgot') || lowerMessage.includes('correction')) {
        return {
            response: `**Forgot to Check In?**\nSubmit a correction request:\n1. Go to Attendance\n2. Select "Request Correction"\n3. Provide date and time\n4. Add explanation\n\nRequests are reviewed within 1-2 days.`,
            actions: [{ label: '📝 Submit Request', href: '/app/attendance?action=correction' }]
        };
    }

    return {
        response: `I can help troubleshoot issues. What problem are you experiencing?`,
        suggestions: [
            { label: '📱 QR Issues', query: 'QR scan not working' },
            { label: '👤 Face Scan Issues', query: 'Face recognition failed' },
            { label: '📝 Forgot Check-in', query: 'I forgot to check in' }
        ]
    };
}

async function handleNavigation(message, context) {
    const lowerMessage = message.toLowerCase();

    const navMap = {
        dashboard: { title: 'Dashboard', href: '/app/dashboard', desc: 'View your attendance overview' },
        profile: { title: 'Profile', href: '/app/profile', desc: 'Manage your profile and settings' },
        history: { title: 'History', href: '/app/history', desc: 'View attendance history' },
        epass: { title: 'E-Pass', href: '/app/epass', desc: 'Your digital ID card' },
        attendance: { title: 'Attendance', href: '/app/attendance', desc: 'Check in/out' }
    };

    for (const [key, nav] of Object.entries(navMap)) {
        if (lowerMessage.includes(key)) {
            return {
                response: `**${nav.title}**\n${nav.desc}`,
                actions: [{ label: `🔗 Go to ${nav.title}`, href: nav.href }]
            };
        }
    }

    return {
        response: `Where would you like to go?`,
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

    if (lowerMessage.includes('deactivate') || lowerMessage.includes('suspend')) {
        return {
            response: `**User Management**\nTo deactivate/suspend a user:\n1. Go to Admin > Users\n2. Find the user\n3. Click their profile\n4. Select action\n\n⚠️ This requires confirmation and is logged.`,
            actions: [{ label: '👥 Go to Users', href: '/admin/users' }],
            requiresConfirmation: true
        };
    }

    if (lowerMessage.includes('configure') || lowerMessage.includes('settings')) {
        return {
            response: `**System Configuration**\nYou can configure grace periods, holidays, notifications, and security policies. All changes are logged.`,
            actions: [{ label: '⚙️ System Settings', href: '/admin/settings' }]
        };
    }

    return {
        response: `As an administrator, you have access to advanced controls. What would you like to manage?`,
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

    if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(lowerMessage)) {
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        return {
            response: `${greeting}${userName ? `, ${userName}` : ''}! I'm your AI attendance assistant powered by Gemini. I can help you with:\n\n• Checking attendance status\n• Understanding policies\n• Navigating the system\n• Troubleshooting issues\n\nHow can I assist you?`,
            suggestions: [
                { label: '✅ My Status', query: 'Am I checked in today?' },
                { label: '📋 Policies', query: 'Explain attendance policies' },
                { label: '❓ Help', query: 'What can you help me with?' }
            ]
        };
    }

    if (/\b(thank|thanks|appreciate)\b/i.test(lowerMessage)) {
        return {
            response: `You're welcome${userName ? `, ${userName}` : ''}! Is there anything else I can help you with?`,
            suggestions: [
                { label: '✅ Check Status', query: 'Check my attendance status' },
                { label: '📊 View Summary', query: 'Show my attendance summary' }
            ]
        };
    }

    if (/\b(help|what can you|how to)\b/i.test(lowerMessage)) {
        return {
            response: `I'm here to help! I can assist with:\n\n**📊 Attendance** - Check status, view history\n**📋 Policies** - Late rules, schedules\n**🔧 Support** - Troubleshoot issues\n**🧭 Navigation** - Find features\n\nJust ask me anything!`,
            suggestions: [
                { label: '✅ My Status', query: 'Am I present today?' },
                { label: '📋 Late Policy', query: 'What is the late policy?' },
                { label: '🔧 QR Help', query: 'QR scan not working' }
            ]
        };
    }

    return {
        response: `I'm not sure I understood that. Could you rephrase? I can help with attendance, policies, navigation, and troubleshooting.`,
        suggestions: [
            { label: '✅ My Status', query: 'Check my attendance' },
            { label: '❓ Help', query: 'What can you help me with?' }
        ]
    };
}
