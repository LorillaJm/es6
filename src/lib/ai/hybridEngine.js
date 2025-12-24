// src/lib/ai/hybridEngine.js
// Hybrid AI Engine - Combines LLM reasoning with rule-based logic and real data access
// Enterprise-grade AI for trustworthy, hallucination-free responses

import { browser } from '$app/environment';
import { getPredictiveEngine } from './predictiveInsights.js';
import { classifyIntent, INTENT_TYPES } from './enterprisePromptEngine.js';

// AI Assistant States for 3D animation triggers
export const AI_STATES = {
    IDLE: 'idle',
    LISTENING: 'listening',
    THINKING: 'thinking',
    RESPONDING: 'responding',
    ERROR: 'error',
    SUCCESS: 'success'
};

// Intent categories for routing (mapped to enterprise engine)
export const INTENT_CATEGORIES = {
    ATTENDANCE_QUERY: INTENT_TYPES.DATA_QUERY,
    POLICY_QUESTION: INTENT_TYPES.QUESTION,
    SYSTEM_ACTION: INTENT_TYPES.ADMIN_ACTION,
    ANALYTICS_REQUEST: INTENT_TYPES.DATA_QUERY,
    TROUBLESHOOTING: INTENT_TYPES.ERROR_REPORT,
    NAVIGATION: INTENT_TYPES.NAVIGATION,
    GENERAL_CHAT: INTENT_TYPES.GENERAL,
    ADMIN_COMMAND: INTENT_TYPES.ADMIN_ACTION
};

// Re-export INTENT_TYPES for backward compatibility
export { INTENT_TYPES } from './enterprisePromptEngine.js';

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
     * Now uses the enterprise prompt engine for consistent classification
     */
    detectIntent(message) {
        const result = classifyIntent(message, 'user');
        return {
            intent: result.intent,
            confidence: result.confidence,
            allScores: result.allScores
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
