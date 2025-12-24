// src/routes/api/ai/chat/+server.js
// Enterprise-Grade AI Chat API Endpoint
// Combines Gemini AI reasoning with role-based access control and intelligent fallbacks

import { json } from '@sveltejs/kit';
import { generateGeminiResponse, getQuickResponse } from '$lib/services/geminiService';
import { 
    classifyIntent, 
    determineResponsePriority,
    generateContextualSuggestions,
    INTENT_TYPES,
    PRIORITY 
} from '$lib/ai/enterprisePromptEngine';

// Rate limiting store (in production, use Redis)
const rateLimits = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60000;

// Request logging for analytics
const requestLog = [];
const MAX_LOG_SIZE = 1000;

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

function logRequest(data) {
    requestLog.push({ ...data, timestamp: Date.now() });
    if (requestLog.length > MAX_LOG_SIZE) requestLog.shift();
}

export async function POST({ request, getClientAddress }) {
    const startTime = Date.now();
    
    try {
        const clientId = getClientAddress();
        
        // Rate limiting
        if (!checkRateLimit(clientId)) {
            return json({
                response: "You're sending requests too quickly. Please wait a moment before trying again.",
                success: false,
                rateLimited: true
            }, { status: 429 });
        }

        const { message, intent: providedIntent, context } = await request.json();

        // Validate input
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return json({
                response: "Please provide a valid message.",
                success: false
            }, { status: 400 });
        }

        const trimmedMessage = message.trim();
        const userRole = context?.userRole || 'user';
        const userName = context?.userProfile?.name?.split(' ')[0] || '';

        // Step 1: Classify intent
        const intentAnalysis = providedIntent 
            ? { intent: providedIntent, confidence: 1 }
            : classifyIntent(trimmedMessage, userRole);
        
        const priority = determineResponsePriority(intentAnalysis.intent, trimmedMessage);

        // Step 2: Security - Validate role access for admin intents
        if (intentAnalysis.intent === INTENT_TYPES.ADMIN_ACTION && userRole !== 'admin') {
            logRequest({ 
                type: 'access_denied', 
                intent: intentAnalysis.intent, 
                userRole 
            });
            
            return json({
                response: "This action requires administrator privileges. Please contact your system administrator if you need access to this functionality.",
                success: false,
                accessDenied: true,
                suggestions: [
                    { label: '✅ My Status', query: 'Check my attendance' },
                    { label: '❓ Help', query: 'What can you help me with?' }
                ]
            }, { status: 403 });
        }

        // Step 3: Try quick response for simple queries (faster)
        const quickResponse = getQuickResponse(trimmedMessage, userRole);
        if (quickResponse) {
            logRequest({ 
                type: 'quick_response', 
                intent: intentAnalysis.intent,
                processingTime: Date.now() - startTime 
            });
            
            return json({
                response: quickResponse.response,
                success: true,
                suggestions: quickResponse.suggestions,
                actions: quickResponse.actions,
                intent: intentAnalysis.intent,
                isQuickResponse: true
            });
        }

        // Step 4: Process through Gemini AI
        console.log(`[AI Chat] Processing: "${trimmedMessage.substring(0, 50)}..." | Role: ${userRole} | Intent: ${intentAnalysis.intent}`);
        
        let result = null;
        
        try {
            const geminiContext = {
                userRole,
                userProfile: context?.userProfile,
                conversationHistory: context?.conversationHistory || [],
                intent: intentAnalysis.intent
            };
            
            result = await generateGeminiResponse(trimmedMessage, geminiContext);
            
            if (result?.response) {
                console.log(`[AI Chat] ✓ Gemini success (${result.processingTime || 0}ms)`);
            }
        } catch (geminiError) {
            console.error('[AI Chat] Gemini error:', geminiError.message);
            result = null;
        }

        // Step 5: Fallback to rule-based response if Gemini fails
        if (!result || !result.response) {
            console.log(`[AI Chat] Using fallback for intent: ${intentAnalysis.intent}`);
            result = getFallbackResponse(trimmedMessage, intentAnalysis.intent, context);
        }

        // Step 6: Final safety check
        if (!result || !result.response) {
            result = {
                response: `I'm here to help${userName ? `, ${userName}` : ''}! Could you please rephrase your question? I can assist with attendance, policies, navigation, and troubleshooting.`,
                suggestions: generateContextualSuggestions(userRole, INTENT_TYPES.GENERAL),
                actions: []
            };
        }

        const processingTime = Date.now() - startTime;
        
        logRequest({ 
            type: 'success', 
            intent: intentAnalysis.intent,
            priority,
            processingTime,
            usedGemini: !!result.processingTime
        });

        return json({
            response: result.response,
            success: true,
            suggestions: result.suggestions || [],
            actions: result.actions || [],
            requiresConfirmation: result.requiresConfirmation || false,
            intent: intentAnalysis.intent,
            confidence: intentAnalysis.confidence,
            priority,
            processingTime
        });

    } catch (error) {
        console.error('[AI Chat API] Error:', error);
        
        logRequest({ type: 'error', error: error.message });
        
        return json({
            response: "I encountered an unexpected error. Please try again, or use the navigation to access features directly.",
            success: false,
            error: error.message,
            suggestions: [
                { label: '🏠 Dashboard', query: 'Go to dashboard' },
                { label: '🔄 Try Again', query: 'Help' }
            ]
        }, { status: 500 });
    }
}

// ============================================
// FALLBACK HANDLERS
// Used when Gemini AI is unavailable
// ============================================

function getFallbackResponse(message, intent, context) {
    const userRole = context?.userRole || 'user';
    const userName = context?.userProfile?.name?.split(' ')[0] || '';
    const isAdmin = userRole === 'admin';
    
    const handlers = {
        [INTENT_TYPES.QUESTION]: () => handleQuestion(message, userName, isAdmin),
        [INTENT_TYPES.INSTRUCTION]: () => handleInstruction(message, isAdmin),
        [INTENT_TYPES.ERROR_REPORT]: () => handleErrorReport(message),
        [INTENT_TYPES.FEATURE_EXPLAIN]: () => handleFeatureExplain(message, isAdmin),
        [INTENT_TYPES.ADMIN_ACTION]: () => handleAdminAction(message),
        [INTENT_TYPES.SYSTEM_ISSUE]: () => handleSystemIssue(message, isAdmin),
        [INTENT_TYPES.NAVIGATION]: () => handleNavigation(message, isAdmin),
        [INTENT_TYPES.DATA_QUERY]: () => handleDataQuery(message, isAdmin),
        [INTENT_TYPES.GENERAL]: () => handleGeneral(message, userName, isAdmin)
    };
    
    const handler = handlers[intent] || handlers[INTENT_TYPES.GENERAL];
    return handler();
}

function handleQuestion(message, userName, isAdmin) {
    const lowerMessage = message.toLowerCase();
    
    if (/\b(status|present|checked in|today)\b/i.test(lowerMessage)) {
        return {
            response: `${userName ? `${userName}, ` : ''}I can help you check your attendance status. Navigate to the Attendance section to view your current status and check-in time.`,
            actions: [
                { label: '✅ View Attendance', href: '/app/attendance' },
                { label: '📜 View History', href: '/app/history' }
            ],
            suggestions: [
                { label: '⏰ Check-in Time', query: 'What time did I check in?' },
                { label: '📊 My Summary', query: 'Show my attendance summary' }
            ]
        };
    }
    
    if (/\b(late|tardy|grace)\b/i.test(lowerMessage)) {
        return {
            response: `**Late Policy Information:**
• **Grace Period**: 15 minutes after 8:00 AM
• **Late Threshold**: Arrivals beyond grace period are marked late
• **Records**: All late arrivals are logged in your attendance history

If you believe you were marked late incorrectly, you can submit a correction request.`,
            actions: [{ label: '📝 Request Correction', href: '/app/attendance?action=correction' }],
            suggestions: [
                { label: '📊 My Late Count', query: 'How many times was I late?' },
                { label: '📋 Full Policy', query: 'Explain all attendance policies' }
            ]
        };
    }
    
    return {
        response: `I can answer questions about attendance, policies, and system features. What would you like to know?`,
        suggestions: [
            { label: '✅ My Status', query: 'Am I checked in today?' },
            { label: '📋 Policies', query: 'What are the attendance policies?' },
            { label: '❓ Help', query: 'What can you help me with?' }
        ]
    };
}

function handleInstruction(message, isAdmin) {
    const lowerMessage = message.toLowerCase();
    
    if (/\b(check.?in|scan|qr)\b/i.test(lowerMessage)) {
        return {
            response: `**How to Check In:**

1. Go to **Attendance** section
2. Choose your method:
   - **QR Code**: Point camera at the QR code displayed
   - **Face Recognition**: Position your face in the frame
3. Wait for confirmation
4. Your status will update automatically

**Tips for Success:**
• Ensure good lighting
• Hold device steady
• Face the camera directly`,
            actions: [{ label: '✅ Go to Attendance', href: '/app/attendance' }],
            suggestions: [
                { label: '🔧 QR Issues', query: 'QR scan not working' },
                { label: '👤 Face Issues', query: 'Face recognition help' }
            ]
        };
    }
    
    if (isAdmin && /\b(report|export|generate)\b/i.test(lowerMessage)) {
        return {
            response: `**How to Generate Reports:**

1. Navigate to **Admin > Reports**
2. Select report type (Daily, Weekly, Monthly)
3. Choose date range and filters
4. Click **Generate Report**
5. Export as PDF or Excel if needed

**Available Reports:**
• Attendance Summary
• Late Arrivals Analysis
• Department Comparison
• Individual User Reports`,
            actions: [{ label: '📈 Go to Reports', href: '/admin/reports' }],
            suggestions: [
                { label: '📊 Quick Summary', query: "Show today's summary" },
                { label: '📉 Trends', query: 'Show attendance trends' }
            ]
        };
    }
    
    return {
        response: `I can provide step-by-step instructions for various tasks. What would you like to learn how to do?`,
        suggestions: isAdmin 
            ? [
                { label: '📈 Generate Reports', query: 'How to generate reports?' },
                { label: '👥 Manage Users', query: 'How to manage users?' }
            ]
            : [
                { label: '✅ Check In', query: 'How do I check in?' },
                { label: '📝 Correction', query: 'How to request correction?' }
            ]
    };
}

function handleErrorReport(message) {
    const lowerMessage = message.toLowerCase();
    
    if (/\b(qr|scan)\b/i.test(lowerMessage)) {
        return {
            response: `**QR Scan Troubleshooting:**

**Common Solutions:**
1. Clean your camera lens
2. Ensure adequate lighting (avoid glare)
3. Hold device 6-12 inches from QR code
4. Keep device steady while scanning
5. Check QR code isn't damaged or obscured

**Still Not Working?**
Try face recognition as an alternative, or submit a manual correction request.`,
            actions: [
                { label: '👤 Try Face Scan', href: '/app/attendance?method=face' },
                { label: '📝 Request Correction', href: '/app/attendance?action=correction' }
            ],
            suggestions: [
                { label: '👤 Face Scan Help', query: 'Face recognition not working' },
                { label: '📞 Contact Support', query: 'How to contact support?' }
            ]
        };
    }
    
    if (/\b(face|biometric|recognition)\b/i.test(lowerMessage)) {
        return {
            response: `**Face Recognition Troubleshooting:**

**Optimization Tips:**
1. Face a light source (window, lamp)
2. Remove sunglasses, hats, or masks
3. Look directly at the camera
4. Keep a neutral expression
5. Ensure face is fully visible in frame

**Re-registration:**
If issues persist, re-register your face in Profile settings.`,
            actions: [
                { label: '👤 Go to Profile', href: '/app/profile' },
                { label: '📱 Try QR Scan', href: '/app/attendance?method=qr' }
            ],
            suggestions: [
                { label: '🔄 Re-register Face', query: 'How to re-register face?' },
                { label: '📱 QR Alternative', query: 'Use QR code instead' }
            ]
        };
    }
    
    return {
        response: `I understand you're experiencing an issue. Could you provide more details about what's not working? Common issues I can help with:

• QR code scanning problems
• Face recognition failures
• Check-in/out errors
• Missing attendance records`,
        suggestions: [
            { label: '📱 QR Issues', query: 'QR scan not working' },
            { label: '👤 Face Issues', query: 'Face recognition failed' },
            { label: '📝 Missing Record', query: 'I forgot to check in' }
        ]
    };
}

function handleFeatureExplain(message, isAdmin) {
    const lowerMessage = message.toLowerCase();
    
    if (/\b(e.?pass|digital.?id|badge)\b/i.test(lowerMessage)) {
        return {
            response: `**E-Pass (Digital ID)**

Your E-Pass is a digital identification card that displays:
• Your profile photo and name
• Department/Course information
• Current attendance status
• QR code for verification

**Uses:**
• Quick identity verification
• Attendance status proof
• Access to facilities (if configured)

Access your E-Pass anytime from the main menu.`,
            actions: [{ label: '🎫 View E-Pass', href: '/app/epass' }],
            suggestions: [
                { label: '👤 Update Profile', query: 'How to update my profile?' },
                { label: '📱 Share E-Pass', query: 'Can I share my E-Pass?' }
            ]
        };
    }
    
    return {
        response: `I can explain any feature of the attendance system. What would you like to know about?`,
        suggestions: isAdmin
            ? [
                { label: '📊 Analytics', query: 'Explain analytics features' },
                { label: '🔒 Security', query: 'Explain security features' }
            ]
            : [
                { label: '🎫 E-Pass', query: 'What is E-Pass?' },
                { label: '👤 Face Scan', query: 'How does face recognition work?' }
            ]
    };
}

function handleAdminAction(message) {
    const lowerMessage = message.toLowerCase();
    
    if (/\b(deactivate|suspend|disable)\b/i.test(lowerMessage)) {
        return {
            response: `**User Deactivation Process:**

⚠️ **Important**: This action will be logged in the audit trail.

**Steps:**
1. Navigate to **Admin > Users**
2. Search for the user
3. Click on their profile
4. Select **Deactivate User**
5. Confirm the action

**Impact:**
• User cannot log in
• Attendance records preserved
• Can be reactivated later

**Note:** Consider suspension for temporary restrictions.`,
            actions: [{ label: '👥 Go to Users', href: '/admin/users' }],
            suggestions: [
                { label: '🔄 Reactivate User', query: 'How to reactivate a user?' },
                { label: '📋 View Audit Log', query: 'Show recent audit logs' }
            ],
            requiresConfirmation: true
        };
    }
    
    if (/\b(configure|settings|policy|grace)\b/i.test(lowerMessage)) {
        return {
            response: `**System Configuration:**

You can configure the following in **Admin > Settings**:

**Attendance Policies:**
• Grace period duration
• Late threshold
• Absence limits

**System Settings:**
• Working hours
• Holiday calendar
• Notification preferences

**Security:**
• Session timeout
• IP restrictions
• Two-factor authentication

⚠️ All configuration changes are logged.`,
            actions: [{ label: '⚙️ Go to Settings', href: '/admin/settings' }],
            suggestions: [
                { label: '📅 Holidays', query: 'How to add holidays?' },
                { label: '🔒 Security', query: 'Configure security settings' }
            ]
        };
    }
    
    return {
        response: `As an administrator, you have access to user management, system configuration, and analytics. What would you like to manage?`,
        suggestions: [
            { label: '👥 User Management', query: 'How to manage users?' },
            { label: '⚙️ System Settings', query: 'Configure system settings' },
            { label: '📊 Reports', query: 'Generate attendance reports' }
        ]
    };
}

function handleSystemIssue(message, isAdmin) {
    if (isAdmin) {
        return {
            response: `**System Health Check:**

I can help diagnose system issues. Current status indicators:

**Quick Checks:**
• Database connectivity
• Authentication service
• QR code generation
• Face recognition service

For detailed diagnostics, check the **Admin > Security** dashboard or system logs.`,
            actions: [
                { label: '🔒 Security Dashboard', href: '/admin/security' },
                { label: '📋 Audit Logs', href: '/admin/audit-logs' }
            ],
            suggestions: [
                { label: '📊 Performance', query: 'Check system performance' },
                { label: '🔧 Troubleshoot', query: 'Common system issues' }
            ]
        };
    }
    
    return {
        response: `If you're experiencing system issues, here are some steps:

1. **Refresh the page** - Clears temporary issues
2. **Check your connection** - Ensure stable internet
3. **Try a different browser** - Rules out browser issues
4. **Clear cache** - Removes outdated data

If problems persist, please contact your administrator.`,
        suggestions: [
            { label: '🔄 Refresh', query: 'How to refresh?' },
            { label: '📞 Contact Admin', query: 'How to contact administrator?' }
        ]
    };
}

function handleNavigation(message, isAdmin) {
    const lowerMessage = message.toLowerCase();
    
    const navMap = {
        dashboard: { 
            title: 'Dashboard', 
            href: isAdmin ? '/admin/dashboard' : '/app/dashboard', 
            desc: isAdmin ? 'View system-wide attendance overview and analytics' : 'View your attendance overview and quick actions' 
        },
        profile: { title: 'Profile', href: '/app/profile', desc: 'Manage your profile, photo, and settings' },
        history: { title: 'History', href: '/app/history', desc: 'View your complete attendance history' },
        epass: { title: 'E-Pass', href: '/app/epass', desc: 'Access your digital ID card' },
        attendance: { title: 'Attendance', href: '/app/attendance', desc: 'Check in or out' },
        reports: { title: 'Reports', href: '/admin/reports', desc: 'Generate and export attendance reports' },
        users: { title: 'User Management', href: '/admin/users', desc: 'Manage user accounts and permissions' },
        settings: { title: 'Settings', href: '/admin/settings', desc: 'Configure system policies and preferences' }
    };

    for (const [key, nav] of Object.entries(navMap)) {
        if (lowerMessage.includes(key)) {
            if (!isAdmin && nav.href.startsWith('/admin')) continue;
            return {
                response: `**${nav.title}**\n\n${nav.desc}`,
                actions: [{ label: `🔗 Go to ${nav.title}`, href: nav.href }],
                suggestions: [
                    { label: '🏠 Dashboard', query: 'Go to dashboard' },
                    { label: '❓ Help', query: 'What else can you help with?' }
                ]
            };
        }
    }

    return {
        response: `Where would you like to go? I can help you navigate to any section of the ${isAdmin ? 'admin panel or ' : ''}application.`,
        suggestions: isAdmin
            ? [
                { label: '📊 Dashboard', query: 'Go to admin dashboard' },
                { label: '👥 Users', query: 'Go to user management' },
                { label: '📈 Reports', query: 'Go to reports' }
            ]
            : [
                { label: '🏠 Dashboard', query: 'Go to dashboard' },
                { label: '✅ Attendance', query: 'Go to attendance' },
                { label: '🎫 E-Pass', query: 'Show my E-Pass' }
            ]
    };
}

function handleDataQuery(message, isAdmin) {
    if (isAdmin) {
        return {
            response: `I don't have direct access to the live database, but I can guide you to the right place.

**To view today's attendance summary:**
Go to **Admin Dashboard** (/admin/dashboard) where you'll see:
• Real-time present/late/absent counts
• Check-in activity feed
• Department breakdown

**For detailed reports:**
Visit **Reports** (/admin/reports) to:
• Generate daily/weekly/monthly reports
• Filter by department or date range
• Export to PDF or Excel`,
            actions: [
                { label: '📊 Open Dashboard', href: '/admin/dashboard' },
                { label: '📈 Go to Reports', href: '/admin/reports' }
            ],
            suggestions: [
                { label: '📈 Export Report', query: 'How to export attendance report?' },
                { label: '👥 User List', query: 'Go to user management' }
            ]
        };
    }
    
    return {
        response: `To view your attendance data:

**Your Dashboard** (/app/dashboard) shows:
• Today's check-in status
• This week's summary
• Recent activity

**Attendance History** (/app/history) has:
• Complete attendance records
• Monthly summaries
• Late/absence details`,
        actions: [
            { label: '🏠 My Dashboard', href: '/app/dashboard' },
            { label: '📜 My History', href: '/app/history' }
        ],
        suggestions: [
            { label: '✅ Check In', query: 'How do I check in?' },
            { label: '🎫 E-Pass', query: 'Show my E-Pass' }
        ]
    };
}

function handleGeneral(message, userName, isAdmin) {
    const lowerMessage = message.toLowerCase();
    
    if (/\b(help|what can you|how to use)\b/i.test(lowerMessage)) {
        const intro = userName ? `Hi ${userName}! ` : '';
        
        if (isAdmin) {
            return {
                response: `${intro}I'm your IT Assistant. I can help you with:

**🧭 Navigation** - Guide you to any system feature
**📋 How-To** - Step-by-step instructions for tasks
**🔧 Troubleshooting** - Solve technical issues
**💡 System Info** - Explain features and policies

I don't have direct database access, but I know exactly where to find everything in the system.`,
                suggestions: [
                    { label: '📊 Dashboard', query: 'Go to admin dashboard' },
                    { label: '📈 Reports', query: 'How to generate reports?' },
                    { label: '👥 Users', query: 'Go to user management' }
                ]
            };
        }
        
        return {
            response: `${intro}I'm your Attendance Assistant. I can help you with:

**🧭 Navigation** - Find any feature quickly
**✅ Check-in Help** - QR code or face scan guidance
**🔧 Troubleshooting** - Fix common issues
**📋 Policies** - Explain attendance rules

What do you need help with?`,
            suggestions: [
                { label: '✅ Check In', query: 'How do I check in?' },
                { label: '🏠 Dashboard', query: 'Go to my dashboard' },
                { label: '📋 Policies', query: 'What is the late policy?' }
            ]
        };
    }
    
    // Default response
    const greeting = userName ? `${userName}, I` : 'I';
    return {
        response: `${greeting} didn't quite catch that. Could you rephrase? 

I can help with navigation, how-to questions, troubleshooting, and explaining system features.`,
        suggestions: isAdmin
            ? [
                { label: '📊 Dashboard', query: 'Go to admin dashboard' },
                { label: '❓ Help', query: 'What can you help with?' }
            ]
            : [
                { label: '🏠 Dashboard', query: 'Go to dashboard' },
                { label: '❓ Help', query: 'What can you help with?' }
            ]
    };
}
