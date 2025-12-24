// src/lib/services/geminiService.js
// Enterprise-Grade Google Gemini AI Service
// Professional AI assistant with step-by-step reasoning and role-based responses

import { GoogleGenAI } from '@google/genai';
import { env } from '$env/dynamic/private';
import { 
    buildEnterprisePrompt, 
    classifyIntent, 
    generateContextualSuggestions,
    formatRoleResponse,
    INTENT_TYPES 
} from '$lib/ai/enterprisePromptEngine';

// Initialize the AI client (singleton)
let aiClient = null;

function getAIClient() {
    if (!aiClient) {
        const apiKey = env.GEMINI_API_KEY;
        
        if (!apiKey) {
            console.error('[Gemini] No API key found - set GEMINI_API_KEY in environment');
            return null;
        }
        
        console.log('[Gemini] Initializing with API key:', apiKey.substring(0, 15) + '...');
        aiClient = new GoogleGenAI({ apiKey });
    }
    return aiClient;
}

/**
 * Enterprise AI Response Generator
 * Implements step-by-step reasoning with role-based access control
 */
export async function generateGeminiResponse(message, context = {}) {
    const ai = getAIClient();
    
    if (!ai) {
        console.error('[Gemini] AI client not initialized - no API key');
        return null;
    }

    const startTime = Date.now();

    try {
        const { 
            userRole = 'user', 
            userProfile = {}, 
            conversationHistory = [],
            intent: providedIntent = null
        } = context;
        
        // Step 1: Classify intent if not provided
        const intentAnalysis = providedIntent 
            ? { intent: providedIntent, confidence: 1 }
            : classifyIntent(message, userRole);
        
        console.log(`[Gemini] Intent: ${intentAnalysis.intent} (confidence: ${intentAnalysis.confidence.toFixed(2)})`);

        // Step 2: Check role-based access for admin intents
        if (intentAnalysis.isAdminIntent && userRole !== 'admin') {
            return {
                response: "I understand you're asking about an administrative function. This action requires administrator privileges. Please contact your system administrator for assistance.",
                suggestions: [
                    { label: '✅ My Status', query: 'Check my attendance status' },
                    { label: '❓ Help', query: 'What can you help me with?' }
                ],
                actions: [],
                intent: intentAnalysis.intent,
                accessDenied: true
            };
        }

        // Step 3: Build enterprise-grade prompt
        const systemPrompt = buildEnterprisePrompt({
            userRole,
            userName: userProfile?.name || '',
            department: userProfile?.departmentOrCourse || '',
            currentTime: new Date().toISOString(),
            conversationHistory,
            intent: intentAnalysis.intent
        });

        // Step 4: Construct the full prompt
        const fullPrompt = `${systemPrompt}

---
USER MESSAGE: ${message}
---

Provide a helpful, accurate response:`;

        console.log('[Gemini] Calling API...');
        
        // Step 5: Call Gemini API - using the correct SDK format
        const response = await ai.models.generateContent({
            model: 'models/gemini-flash-latest',
            contents: fullPrompt
        });

        // Get the response text
        const responseText = response.text;
        
        if (!responseText) {
            console.error('[Gemini] Empty response from API');
            return null;
        }

        const processingTime = Date.now() - startTime;
        console.log(`[Gemini] ✓ Response generated in ${processingTime}ms`);
        console.log(`[Gemini] Response preview: ${responseText.substring(0, 100)}...`);

        // Step 6: Format response for role
        const formattedResponse = formatRoleResponse(responseText, userRole, intentAnalysis.intent);

        // Step 7: Extract navigation actions from response
        const actions = extractNavigationActions(formattedResponse, userRole);

        // Step 8: Generate contextual suggestions
        const recentTopics = conversationHistory
            .filter(m => m.sender === 'user')
            .slice(-3)
            .map(m => typeof m.content === 'string' ? m.content : '');
        
        const suggestions = generateContextualSuggestions(
            userRole, 
            intentAnalysis.intent, 
            recentTopics
        );

        return {
            response: formattedResponse,
            suggestions,
            actions,
            intent: intentAnalysis.intent,
            confidence: intentAnalysis.confidence,
            processingTime
        };

    } catch (error) {
        console.error('[Gemini] Error:', error.message);
        console.error('[Gemini] Stack:', error.stack);
        
        // Handle specific error types
        if (error.message?.includes('429') || error.message?.includes('quota')) {
            return createRateLimitResponse(message, context.userRole);
        }
        
        return null;
    }
}

/**
 * Extract navigation actions from AI response
 */
function extractNavigationActions(response, userRole) {
    const actions = [];
    const isAdmin = userRole === 'admin';
    
    const linkPattern = /\/(app|admin)\/[\w-]+/g;
    const links = [...new Set(response.match(linkPattern) || [])];
    
    const labelMap = {
        '/app/dashboard': { label: '🏠 Dashboard', priority: 1 },
        '/app/attendance': { label: '✅ Attendance', priority: 2 },
        '/app/history': { label: '📜 History', priority: 3 },
        '/app/profile': { label: '👤 Profile', priority: 4 },
        '/app/epass': { label: '🎫 E-Pass', priority: 5 },
        '/admin/dashboard': { label: '📊 Admin Dashboard', priority: 1 },
        '/admin/users': { label: '👥 User Management', priority: 2 },
        '/admin/reports': { label: '📈 Reports', priority: 3 },
        '/admin/settings': { label: '⚙️ Settings', priority: 4 },
        '/admin/audit-logs': { label: '📋 Audit Logs', priority: 5 }
    };
    
    links.forEach(link => {
        if (!isAdmin && link.startsWith('/admin')) return;
        const config = labelMap[link];
        if (config) {
            actions.push({ label: config.label, href: link, priority: config.priority });
        }
    });
    
    return actions.sort((a, b) => a.priority - b.priority).slice(0, 3)
        .map(({ label, href }) => ({ label, href }));
}

/**
 * Create rate limit response with helpful fallback
 */
function createRateLimitResponse(originalMessage, userRole) {
    const isAdmin = userRole === 'admin';
    
    return {
        response: `I'm experiencing high demand. Here's quick info while you wait:

**Schedule**: Monday-Friday, 8:00 AM - 5:00 PM
**Grace Period**: 15 minutes

Please try again in a moment.`,
        suggestions: [{ label: '🔄 Try Again', query: originalMessage }],
        actions: isAdmin 
            ? [{ label: '📊 Dashboard', href: '/admin/dashboard' }]
            : [{ label: '🏠 Dashboard', href: '/app/dashboard' }],
        rateLimited: true
    };
}

/**
 * Quick response for simple queries (bypasses full AI for speed)
 */
export function getQuickResponse(message, userRole) {
    const lowerMessage = message.toLowerCase().trim();
    
    if (/^(hi|hello|hey|good\s*(morning|afternoon|evening))[\s!.]*$/i.test(lowerMessage)) {
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        
        if (userRole === 'admin') {
            return {
                response: `${greeting}! I'm your IT Assistant. I can help you navigate the admin panel, explain features, or troubleshoot issues.\n\nWhat do you need?`,
                suggestions: [
                    { label: '📊 Dashboard', query: 'Go to admin dashboard' },
                    { label: '📈 Reports', query: 'How to generate reports?' }
                ],
                actions: [],
                isQuickResponse: true
            };
        }
        
        return {
            response: `${greeting}! I'm your Attendance Assistant. I can help you check in, navigate the app, or answer questions about policies.\n\nHow can I help?`,
            suggestions: [
                { label: '✅ Check In', query: 'How do I check in?' },
                { label: '🏠 Dashboard', query: 'Go to my dashboard' }
            ],
            actions: [],
            isQuickResponse: true
        };
    }
    
    if (/^(thanks?|thank\s*you)[\s!.]*$/i.test(lowerMessage)) {
        return {
            response: "You're welcome! Let me know if you need anything else.",
            suggestions: [{ label: '❓ More Help', query: 'What else can you help with?' }],
            actions: [],
            isQuickResponse: true
        };
    }
    
    return null;
}

export default { generateGeminiResponse, getQuickResponse };
