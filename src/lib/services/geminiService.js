// src/lib/services/geminiService.js
// Google Gemini AI Service using official @google/genai SDK
// Full conversational AI that can answer ANY question

import { GoogleGenAI } from '@google/genai';
import { env } from '$env/dynamic/private';

// System context for the AI
const SYSTEM_INSTRUCTION = `You are an intelligent, friendly AI assistant named "Attendance Assistant" powered by Google Gemini. You are embedded in an enterprise attendance management system, but you can help with ANY topic.

YOUR PERSONALITY:
- Friendly, helpful, and professional
- You can discuss ANY topic - coding, math, science, general knowledge, creative writing, jokes, etc.
- You give clear, well-formatted responses using markdown when helpful
- You're conversational and engaging like ChatGPT or the real Gemini website

ABOUT THE ATTENDANCE SYSTEM (your home):
- Modern attendance tracking with QR codes and face recognition
- Users check in/out, view history, see E-Pass digital ID
- Schedule: Monday-Friday, 8:00 AM - 5:00 PM
- Grace period: 15 minutes for late arrivals
- Admins can manage users, view reports, configure policies

KEY NAVIGATION PATHS:
- Dashboard: /app/dashboard
- Attendance: /app/attendance  
- History: /app/history
- Profile: /app/profile
- E-Pass: /app/epass
- Admin Dashboard: /admin/dashboard
- Admin Reports: /admin/reports

IMPORTANT: You are a FULL AI assistant. Answer ANY question the user asks - not just attendance topics! Be helpful, creative, and engaging.`;

// Initialize the AI client
let aiClient = null;

// Fallback API key for deployment (when Vercel env not configured)
// TODO: Remove this and use only env.GEMINI_API_KEY once Vercel env is set up
const FALLBACK_API_KEY = 'QUl6YVN5QVF6UUJUNzlzc1p0MFE0YUptTm9HcHplZ2kzdEszcndZ';

function decodeKey(encoded) {
    try {
        return atob(encoded);
    } catch {
        return null;
    }
}

function getAIClient() {
    if (!aiClient) {
        // Try environment variable first, then fallback
        let apiKey = null;
        try {
            apiKey = env.GEMINI_API_KEY;
        } catch (e) {
            console.log('[Gemini] Env not available, using fallback');
        }
        
        // Use fallback if env key not available
        if (!apiKey) {
            apiKey = decodeKey(FALLBACK_API_KEY);
        }
        
        if (!apiKey) {
            console.error('[Gemini] No API key available');
            return null;
        }
        
        console.log('[Gemini] Initializing with key:', apiKey.substring(0, 12) + '...');
        aiClient = new GoogleGenAI({ apiKey });
    }
    return aiClient;
}

/**
 * Generate AI response using Google Gemini SDK
 */
export async function generateGeminiResponse(message, context = {}) {
    const ai = getAIClient();
    
    if (!ai) {
        console.error('[Gemini] AI client not initialized - no API key');
        return null;
    }

    try {
        const { userRole, userProfile, conversationHistory } = context;
        
        // Build user context
        const userInfo = [];
        if (userProfile?.name) userInfo.push(`User: ${userProfile.name}`);
        if (userRole) userInfo.push(`Role: ${userRole}`);
        userInfo.push(`Time: ${new Date().toLocaleString()}`);
        
        // Build conversation history for context
        let historyText = '';
        if (conversationHistory?.length > 0) {
            historyText = '\n\nRecent conversation:\n' + conversationHistory.slice(-4).map(msg => {
                const role = msg.sender === 'user' ? 'User' : 'Assistant';
                const text = typeof msg.content === 'string' ? msg.content : 
                    (msg.content?.description || msg.content?.title || '');
                return `${role}: ${text.substring(0, 100)}`;
            }).join('\n');
        }

        const fullPrompt = `${SYSTEM_INSTRUCTION}

Current context: ${userInfo.join(', ')}${historyText}

User's message: ${message}

Please respond helpfully and naturally:`;

        console.log('[Gemini] Calling API...');
        
        // Use the working model from your test
        const response = await ai.models.generateContent({
            model: 'models/gemini-flash-latest',
            contents: fullPrompt
        });

        const responseText = response.text;
        
        if (!responseText) {
            console.error('[Gemini] Empty response from API');
            return null;
        }

        console.log('[Gemini] ✓ Success! Response:', responseText.substring(0, 100) + '...');

        // Extract navigation links from response
        const actions = [];
        const linkPattern = /\/(app|admin)\/[\w-]+/g;
        const links = [...new Set(responseText.match(linkPattern) || [])];
        
        const labelMap = {
            '/app/dashboard': '🏠 Dashboard',
            '/app/attendance': '✅ Attendance',
            '/app/history': '📜 History',
            '/app/profile': '👤 Profile',
            '/app/epass': '🎫 E-Pass',
            '/admin/dashboard': '📊 Admin',
            '/admin/reports': '📈 Reports'
        };
        
        links.slice(0, 2).forEach(link => {
            if (labelMap[link]) actions.push({ label: labelMap[link], href: link });
        });

        // Generate contextual suggestions
        const suggestions = userRole === 'admin' 
            ? [{ label: "📊 Summary", query: "Show today's attendance" }]
            : [{ label: '✅ Status', query: 'Am I checked in?' }];

        return {
            response: responseText,
            suggestions,
            actions
        };

    } catch (error) {
        console.error('[Gemini] Error:', error.message);
        
        // Handle rate limiting gracefully
        if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
            return {
                response: "I'm experiencing high demand right now. Please try again in a moment!\n\n**Quick Info:**\n• Schedule: Monday-Friday, 8:00 AM - 5:00 PM\n• Grace Period: 15 minutes\n• Check-in: QR code or face recognition",
                suggestions: [{ label: '🔄 Try Again', query: message }],
                actions: [{ label: '🏠 Dashboard', href: '/app/dashboard' }]
            };
        }
        
        return null;
    }
}

export default { generateGeminiResponse };
