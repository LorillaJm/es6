// src/lib/ai/enterprisePromptEngine.js
// Enterprise-Grade AI Prompt Engine
// Senior IT Assistant behavior - grounded, accurate, helpful

/**
 * Intent Classification System
 */
export const INTENT_TYPES = {
    QUESTION: 'question',
    INSTRUCTION: 'instruction',
    ERROR_REPORT: 'error_report',
    FEATURE_EXPLAIN: 'feature_explain',
    ADMIN_ACTION: 'admin_action',
    SYSTEM_ISSUE: 'system_issue',
    NAVIGATION: 'navigation',
    DATA_QUERY: 'data_query',
    CONFIRMATION: 'confirmation',
    GENERAL: 'general'
};

export const PRIORITY = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
};

/**
 * Build prompt for Senior IT Assistant behavior
 */
export function buildEnterprisePrompt(options = {}) {
    const {
        userRole = 'user',
        userName = '',
        department = '',
        currentTime = new Date().toISOString(),
        conversationHistory = [],
        intent = null
    } = options;

    const isAdmin = userRole === 'admin';
    const displayName = userName ? userName.split(' ')[0] : '';
    
    return `You are a Senior IT Assistant for an attendance management system. You behave like a trusted technical advisor - professional, accurate, and solution-oriented.

CRITICAL RULES - NEVER BREAK THESE:
1. NEVER invent or fabricate data (attendance counts, user numbers, statistics)
2. NEVER pretend to have access to live database information
3. If asked for real-time data, explain WHERE to find it in the system
4. Be honest: "I don't have direct access to the database, but here's how you can check..."
5. Guide users to the correct pages/features instead of making up numbers

YOUR ROLE:
- Senior IT Assistant & System Guide
- Problem Solver for technical issues
- Trusted Advisor for system usage
- You know the system inside-out but DON'T have live data access

CURRENT CONTEXT:
- User: ${displayName || 'User'}
- Role: ${isAdmin ? 'Administrator' : 'Regular User'}
- Time: ${new Date(currentTime).toLocaleString()}

SYSTEM KNOWLEDGE (use this for guidance):
- Schedule: Monday-Friday, 8:00 AM - 5:00 PM
- Grace Period: 15 minutes after start time
- Check-in Methods: QR Code scan, Face Recognition
- ${isAdmin ? `Admin Features: User management, Reports, Settings, Audit logs` : `User Features: Dashboard, Attendance, History, E-Pass, Profile`}

HOW TO RESPOND:

For DATA REQUESTS (attendance summary, counts, statistics):
- DON'T make up numbers
- DO guide them: "To view today's attendance summary, go to /admin/dashboard where you'll see real-time statistics including present, late, and absent counts."

For HOW-TO QUESTIONS:
- Give clear, numbered steps
- Include the exact navigation path

For TROUBLESHOOTING:
- Acknowledge the issue
- Provide practical solutions
- Offer alternatives

For NAVIGATION:
- Give the exact path: /app/dashboard, /admin/reports, etc.
- Briefly explain what they'll find there

TONE:
- Professional but friendly
- Confident and knowledgeable
- Concise - respect their time
- Helpful - anticipate follow-up needs

${isAdmin ? `
ADMIN PATHS:
- Dashboard & Live Stats: /admin/dashboard
- User Management: /admin/users
- Reports & Export: /admin/reports
- System Settings: /admin/settings
- Audit Logs: /admin/audit-logs
- Security: /admin/security
` : `
USER PATHS:
- Your Dashboard: /app/dashboard
- Check In/Out: /app/attendance
- Attendance History: /app/history
- Your Profile: /app/profile
- Digital ID (E-Pass): /app/epass
`}

Remember: You're a knowledgeable guide, not a database. Direct users to where they can find real data.`;
}

/**
 * Classify user intent from message
 */
export function classifyIntent(message, userRole = 'user') {
    const lowerMessage = message.toLowerCase();
    
    const patterns = {
        [INTENT_TYPES.ERROR_REPORT]: {
            patterns: [
                /\b(error|failed|not working|broken|issue|problem|bug|crash|stuck)\b/i,
                /\b(can't|cannot|unable|won't|doesn't work)\b/i
            ],
            weight: 1.8
        },
        [INTENT_TYPES.INSTRUCTION]: {
            patterns: [
                /\b(how (do|can|to)|steps to|guide|show me how)\b/i,
                /\b(walk me through|explain how)\b/i
            ],
            weight: 1.5
        },
        [INTENT_TYPES.ADMIN_ACTION]: {
            patterns: [
                /\b(deactivate|suspend|remove|delete|disable|configure|set|change|update)\b/i,
                /\b(user management|system settings|policy|permissions)\b/i
            ],
            weight: 1.7
        },
        [INTENT_TYPES.DATA_QUERY]: {
            patterns: [
                /\b(show|display|get|what('s| is|'re| are))\b.*\b(summary|data|stats|count|rate|attendance)\b/i,
                /\b(how many|total|today's|this week)\b/i,
                /\b(report|analytics|who is late|who is absent)\b/i
            ],
            weight: 1.6
        },
        [INTENT_TYPES.SYSTEM_ISSUE]: {
            patterns: [
                /\b(system|server|database)\b.*\b(down|slow|error)\b/i,
                /\b(is the system|is everything)\b.*\b(working|ok)\b/i
            ],
            weight: 1.9
        },
        [INTENT_TYPES.NAVIGATION]: {
            patterns: [
                /\b(where|find|go to|navigate|access|open)\b/i,
                /\b(dashboard|profile|settings|history|reports|e-?pass)\b/i
            ],
            weight: 1.3
        },
        [INTENT_TYPES.FEATURE_EXPLAIN]: {
            patterns: [
                /\b(what (is|does)|explain|tell me about)\b/i,
                /\b(feature|function|how does)\b/i
            ],
            weight: 1.4
        },
        [INTENT_TYPES.QUESTION]: {
            patterns: [
                /\b(am i|was i|did i|have i)\b/i,
                /\?$/
            ],
            weight: 1.2
        },
        [INTENT_TYPES.GENERAL]: {
            patterns: [
                /\b(hi|hello|hey|thanks|thank you|bye)\b/i,
                /\b(who are you|what can you|help)\b/i
            ],
            weight: 1.0
        }
    };

    const scores = {};
    for (const [intent, config] of Object.entries(patterns)) {
        let score = 0;
        for (const pattern of config.patterns) {
            if (pattern.test(lowerMessage)) {
                score += config.weight;
            }
        }
        scores[intent] = score;
    }

    const sortedIntents = Object.entries(scores)
        .filter(([, score]) => score > 0)
        .sort(([, a], [, b]) => b - a);

    if (sortedIntents.length === 0) {
        return { intent: INTENT_TYPES.GENERAL, confidence: 0.5, allScores: scores };
    }

    const [topIntent, topScore] = sortedIntents[0];
    return {
        intent: topIntent,
        confidence: Math.min(topScore / 3, 1),
        allScores: scores,
        isAdminIntent: topIntent === INTENT_TYPES.ADMIN_ACTION
    };
}

export function determineResponsePriority(intent, message) {
    if (/\b(security|breach|unauthorized|emergency)\b/i.test(message)) {
        return PRIORITY.CRITICAL;
    }
    if (intent === INTENT_TYPES.ERROR_REPORT || intent === INTENT_TYPES.SYSTEM_ISSUE) {
        return PRIORITY.HIGH;
    }
    if ([INTENT_TYPES.INSTRUCTION, INTENT_TYPES.DATA_QUERY, INTENT_TYPES.ADMIN_ACTION].includes(intent)) {
        return PRIORITY.MEDIUM;
    }
    return PRIORITY.LOW;
}

export function generateContextualSuggestions(userRole, intent, recentTopics = []) {
    const isAdmin = userRole === 'admin';
    
    const pools = {
        admin: {
            [INTENT_TYPES.DATA_QUERY]: [
                { label: '📊 Open Dashboard', query: 'Go to admin dashboard' },
                { label: '📈 View Reports', query: 'How to generate reports?' },
                { label: '👥 Check Users', query: 'Go to user management' }
            ],
            default: [
                { label: '📊 Dashboard', query: 'Go to admin dashboard' },
                { label: '📈 Reports', query: 'How to export reports?' },
                { label: '⚙️ Settings', query: 'Go to system settings' }
            ]
        },
        user: {
            [INTENT_TYPES.QUESTION]: [
                { label: '✅ Check Status', query: 'How do I check my status?' },
                { label: '📜 View History', query: 'Go to my history' },
                { label: '🎫 My E-Pass', query: 'Show my E-Pass' }
            ],
            default: [
                { label: '🏠 Dashboard', query: 'Go to dashboard' },
                { label: '✅ Check In', query: 'How do I check in?' },
                { label: '❓ Help', query: 'What can you help with?' }
            ]
        }
    };

    const pool = isAdmin ? pools.admin : pools.user;
    return (pool[intent] || pool.default).filter(s => 
        !recentTopics.some(t => s.query.toLowerCase().includes(t.toLowerCase()))
    ).slice(0, 3);
}

export function formatRoleResponse(response, userRole, intent) {
    return response;
}

export default {
    buildEnterprisePrompt,
    classifyIntent,
    determineResponsePriority,
    generateContextualSuggestions,
    formatRoleResponse,
    INTENT_TYPES,
    PRIORITY
};
