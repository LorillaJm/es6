// src/lib/ai/hybridEngine.js
// Hybrid AI Engine - Combines LLM reasoning with rule-based logic and real data access
// Enterprise-grade AI for trustworthy, hallucination-free responses

import { browser } from '$app/environment';
import { getPredictiveEngine } from './predictiveInsights.js';

// AI Assistant States for 3D animation triggers
export const AI_STATES = {
    IDLE: 'idle',
    LISTENING: 'listening',
    THINKING: 'thinking',
    RESPONDING: 'responding',
    ERROR: 'error',
    SUCCESS: 'success'
};

// Intent categories for routing
export const INTENT_CATEGORIES = {
    ATTENDANCE_QUERY: 'attendance_query',
    POLICY_QUESTION: 'policy_question',
    SYSTEM_ACTION: 'system_action',
    ANALYTICS_REQUEST: 'analytics_request',
    TROUBLESHOOTING: 'troubleshooting',
    NAVIGATION: 'navigation',
    GENERAL_CHAT: 'general_chat',
    ADMIN_COMMAND: 'admin_command'
};

// System prompt for AI reasoning
const SYSTEM_PROMPT = `You are an intelligent AI assistant powered by Google Gemini for an enterprise attendance management system.

CRITICAL RULES:
- Use ONLY the real system data provided in the context
- NEVER fabricate or guess attendance records, times, or statistics
- Respect user roles strictly (admin vs regular user)
- Explain clearly and professionally
- Ask for confirmation before performing any actions
- If data is unavailable, say so honestly

PERSONALITY:
- Professional, friendly, and helpful
- Clear and solution-oriented
- Knowledgeable about the entire system
- Encouraging and supportive

CAPABILITIES:
- Answer ANY question about the attendance system
- Explain attendance records and policies
- Provide system guidance and navigation help
- Troubleshoot common issues
- For admins: analytics insights and management guidance
- Understand context and provide smart suggestions`;

// Intent detection patterns with confidence scoring
const INTENT_PATTERNS = {
    [INTENT_CATEGORIES.ATTENDANCE_QUERY]: {
        patterns: [
            /\b(attendance|check.?in|check.?out|present|absent|late|status|record|time|hours)\b/i,
            /\b(am i|was i|did i|my|today|yesterday|this week|this month)\b/i,
            /\b(when|what time|how many|how long)\b/i
        ],
        weight: 1.5
    },
    [INTENT_CATEGORIES.POLICY_QUESTION]: {
        patterns: [
            /\b(policy|rule|allowed|limit|grace|threshold|requirement)\b/i,
            /\b(what is|what are|explain|tell me about|how does)\b/i,
            /\b(late policy|absence policy|work hours|schedule)\b/i
        ],
        weight: 1.3
    },
    [INTENT_CATEGORIES.ANALYTICS_REQUEST]: {
        patterns: [
            /\b(analytics|report|statistics|summary|trend|rate|percentage)\b/i,
            /\b(department|team|overall|compare|analysis)\b/i,
            /\b(show me|generate|export|download)\b/i
        ],
        weight: 1.4
    },
    [INTENT_CATEGORIES.TROUBLESHOOTING]: {
        patterns: [
            /\b(not working|failed|error|issue|problem|help|fix|can't|cannot)\b/i,
            /\b(qr|scan|face|biometric|camera|recognition)\b/i,
            /\b(forgot|missed|correction|wrong)\b/i
        ],
        weight: 1.6
    },
    [INTENT_CATEGORIES.NAVIGATION]: {
        patterns: [
            /\b(where|how to|go to|find|navigate|access|open)\b/i,
            /\b(dashboard|profile|settings|history|e.?pass|reports)\b/i
        ],
        weight: 1.2
    },
    [INTENT_CATEGORIES.ADMIN_COMMAND]: {
        patterns: [
            /\b(deactivate|suspend|remove|configure|set|change|update)\b/i,
            /\b(user|users|all|everyone|system|settings)\b/i,
            /\b(approve|reject|review|manage)\b/i
        ],
        weight: 1.7
    },
    [INTENT_CATEGORIES.GENERAL_CHAT]: {
        patterns: [
            /\b(hi|hello|hey|thanks|thank you|bye|goodbye)\b/i,
            /\b(who are you|what can you|help me)\b/i
        ],
        weight: 1.0
    }
};

/**
 * Hybrid AI Engine Class
 * Orchestrates LLM reasoning with rule-based logic and real data
 */
export class HybridAIEngine {
    constructor(options = {}) {
        this.apiEndpoint = options.apiEndpoint || '/api/ai/chat';
        this.contextMemory = [];
        this.maxContextLength = options.maxContextLength || 10;
        this.currentState = AI_STATES.IDLE;
        this.stateChangeCallback = options.onStateChange || null;
        this.predictiveEngine = getPredictiveEngine();
        this.cachedInsights = null;
        this.insightsCacheTime = 0;
    }

    /**
     * Set the AI state and trigger animation callback
     */
    setState(state) {
        this.currentState = state;
        if (this.stateChangeCallback) {
            this.stateChangeCallback(state);
        }
    }

    /**
     * Detect intent from user message with confidence scoring
     */
    detectIntent(message) {
        const scores = {};
        
        for (const [category, config] of Object.entries(INTENT_PATTERNS)) {
            let score = 0;
            for (const pattern of config.patterns) {
                if (pattern.test(message)) {
                    score += config.weight;
                }
            }
            scores[category] = score;
        }

        // Find highest scoring intent
        const sortedIntents = Object.entries(scores)
            .sort(([, a], [, b]) => b - a);
        
        const topIntent = sortedIntents[0];
        const confidence = topIntent[1] > 0 ? Math.min(topIntent[1] / 5, 1) : 0;

        return {
            intent: topIntent[1] > 0 ? topIntent[0] : INTENT_CATEGORIES.GENERAL_CHAT,
            confidence,
            allScores: scores
        };
    }

    /**
     * Add message to context memory
     */
    addToContext(role, content) {
        this.contextMemory.push({ role, content, timestamp: Date.now() });
        if (this.contextMemory.length > this.maxContextLength) {
            this.contextMemory.shift();
        }
    }

    /**
     * Build context for AI reasoning
     */
    buildContext(systemData, userRole, userProfile) {
        return {
            systemPrompt: SYSTEM_PROMPT,
            userRole,
            userProfile: {
                name: userProfile?.name || 'User',
                department: userProfile?.departmentOrCourse || 'Unknown',
                id: userProfile?.studentId || userProfile?.employeeId || null
            },
            conversationHistory: this.contextMemory.slice(-5),
            systemData,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Process user message through hybrid pipeline
     */
    async processMessage(message, options = {}) {
        const { role, userId, userProfile, systemData } = options;
        
        this.setState(AI_STATES.LISTENING);
        
        try {
            // Step 1: Intent Detection
            const { intent, confidence } = this.detectIntent(message);
            
            this.setState(AI_STATES.THINKING);
            
            // Step 2: Role-based access check
            if (intent === INTENT_CATEGORIES.ADMIN_COMMAND && role !== 'admin') {
                return {
                    response: "I'm sorry, but that action requires administrator privileges.",
                    intent,
                    state: AI_STATES.ERROR,
                    requiresConfirmation: false
                };
            }

            // Step 3: Build context with real data
            const context = this.buildContext(systemData, role, userProfile);
            
            // Step 4: Add to conversation memory
            this.addToContext('user', message);

            // Step 5: Process through AI endpoint
            const response = await this.callAIEndpoint(message, intent, context);
            
            // Step 6: Add response to memory
            this.addToContext('assistant', response.content);
            
            this.setState(response.success ? AI_STATES.SUCCESS : AI_STATES.ERROR);
            
            // Brief delay then return to responding state
            setTimeout(() => this.setState(AI_STATES.RESPONDING), 500);
            
            return {
                ...response,
                intent,
                confidence
            };
            
        } catch (error) {
            console.error('[HybridAI] Processing error:', error);
            this.setState(AI_STATES.ERROR);
            
            return {
                response: "I encountered an issue processing your request. Please try again.",
                intent: INTENT_CATEGORIES.GENERAL_CHAT,
                state: AI_STATES.ERROR,
                error: error.message
            };
        }
    }

    /**
     * Call AI API endpoint
     */
    async callAIEndpoint(message, intent, context) {
        if (!browser) {
            return { content: "AI processing unavailable.", success: false };
        }

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    intent,
                    context
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            return {
                content: data.response,
                success: true,
                suggestions: data.suggestions || [],
                actions: data.actions || [],
                requiresConfirmation: data.requiresConfirmation || false
            };
        } catch (error) {
            console.error('[HybridAI] API call failed:', error);
            // Fallback to rule-based response
            return this.getFallbackResponse(message, intent, context);
        }
    }

    /**
     * Fallback rule-based response when AI is unavailable
     */
    getFallbackResponse(message, intent, context) {
        const responses = {
            [INTENT_CATEGORIES.GENERAL_CHAT]: {
                content: `Hello${context.userProfile?.name ? `, ${context.userProfile.name}` : ''}! I'm your attendance assistant. How can I help you today?`,
                success: true
            },
            [INTENT_CATEGORIES.ATTENDANCE_QUERY]: {
                content: "I can help you check your attendance. Please navigate to the Attendance section to view your records, or ask me a specific question about your status.",
                success: true,
                actions: [{ label: 'View Attendance', href: '/app/attendance' }]
            },
            [INTENT_CATEGORIES.POLICY_QUESTION]: {
                content: "For detailed policy information, please check with your administrator or view the system guidelines. I can explain general attendance rules if you have specific questions.",
                success: true
            },
            [INTENT_CATEGORIES.TROUBLESHOOTING]: {
                content: "I understand you're having an issue. Common solutions include:\n• Ensure good lighting for QR/face scans\n• Check your internet connection\n• Try refreshing the page\n\nIf the problem persists, please contact support.",
                success: true
            },
            [INTENT_CATEGORIES.NAVIGATION]: {
                content: "I can help you navigate the system. What section are you looking for?",
                success: true,
                suggestions: [
                    { label: 'Dashboard', query: 'Go to dashboard' },
                    { label: 'Profile', query: 'Open my profile' },
                    { label: 'History', query: 'View attendance history' }
                ]
            }
        };

        return responses[intent] || responses[INTENT_CATEGORIES.GENERAL_CHAT];
    }

    /**
     * Get smart suggestions based on context
     */
    getSmartSuggestions(role, recentTopics = []) {
        const baseSuggestions = role === 'admin' ? [
            { label: "📊 Today's Summary", query: "Show today's attendance summary" },
            { label: '⚠️ Late Arrivals', query: 'Who arrived late today?' },
            { label: '📈 Weekly Trends', query: 'Show attendance trends this week' },
            { label: '🔧 System Status', query: 'Is the system healthy?' }
        ] : [
            { label: '✅ My Status', query: 'Am I checked in today?' },
            { label: '⏰ Check-in Time', query: 'What time did I check in?' },
            { label: '📋 My Summary', query: 'Show my attendance this month' },
            { label: '❓ Get Help', query: 'What can you help me with?' }
        ];

        // Filter out recently asked topics
        return baseSuggestions.filter(s => 
            !recentTopics.some(t => s.query.toLowerCase().includes(t.toLowerCase()))
        );
    }

    /**
     * Reset conversation context
     */
    resetContext() {
        this.contextMemory = [];
        this.cachedInsights = null;
        this.setState(AI_STATES.IDLE);
    }

    /**
     * Get current state
     */
    getState() {
        return this.currentState;
    }

    /**
     * Get predictive insights for user
     */
    async getPredictiveInsights(attendanceRecords, userProfile, forceRefresh = false) {
        const now = Date.now();
        const cacheValid = this.cachedInsights && (now - this.insightsCacheTime) < 5 * 60 * 1000;
        
        if (cacheValid && !forceRefresh) {
            return this.cachedInsights;
        }

        try {
            const analysis = this.predictiveEngine.analyzeUserPatterns(attendanceRecords, userProfile);
            const prediction = this.predictiveEngine.predictNextWeek(attendanceRecords, userProfile);
            
            this.cachedInsights = {
                pattern: analysis.pattern,
                stats: analysis.stats,
                trend: analysis.trend,
                insights: analysis.insights,
                prediction,
                generatedAt: new Date().toISOString()
            };
            this.insightsCacheTime = now;
            
            return this.cachedInsights;
        } catch (error) {
            console.error('[HybridAI] Predictive insights error:', error);
            return null;
        }
    }

    /**
     * Get proactive suggestions based on insights
     */
    getProactiveSuggestions(insights, role) {
        if (!insights?.insights?.length) {
            return this.getSmartSuggestions(role);
        }

        const suggestions = [];
        
        // Add insight-based suggestions
        insights.insights.slice(0, 2).forEach(insight => {
            if (insight.actionable && insight.action) {
                suggestions.push({
                    label: insight.icon + ' ' + insight.title,
                    query: insight.action.query || `Tell me about ${insight.title.toLowerCase()}`,
                    priority: insight.priority
                });
            }
        });

        // Fill remaining with smart suggestions
        const baseSuggestions = this.getSmartSuggestions(role);
        const remaining = 4 - suggestions.length;
        suggestions.push(...baseSuggestions.slice(0, remaining));

        return suggestions;
    }

    /**
     * Get admin predictive insights
     */
    async getAdminInsights(departmentData, allUsersData) {
        try {
            return this.predictiveEngine.generateAdminInsights(departmentData, allUsersData);
        } catch (error) {
            console.error('[HybridAI] Admin insights error:', error);
            return [];
        }
    }
}

// Singleton instance
let engineInstance = null;

export function getHybridEngine(options = {}) {
    if (!engineInstance) {
        engineInstance = new HybridAIEngine(options);
    }
    return engineInstance;
}

export default HybridAIEngine;
