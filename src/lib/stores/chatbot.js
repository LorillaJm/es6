// src/lib/stores/chatbot.js
// Professional Chatbot Store - Role-based Productivity Assistant
// Enterprise-grade chatbot for Attendance System

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// Message types
export const MESSAGE_TYPES = {
    TEXT: 'text',
    CARD: 'card',
    ACTION: 'action',
    QUICK_REPLIES: 'quick_replies',
    STATS: 'stats',
    GUIDE: 'guide',
    ERROR: 'error',
    LOADING: 'loading',
    SYSTEM: 'system',
    ONBOARDING: 'onboarding',
    ALERT: 'alert',
    LIST: 'list',
    CONFIRMATION: 'confirmation'
};

// Chatbot roles
export const CHATBOT_ROLES = {
    USER: 'user',
    ADMIN: 'admin'
};

// Onboarding steps for first-time users
export const ONBOARDING_STEPS = {
    WELCOME: 'welcome',
    QR_INTRO: 'qr_intro',
    BIOMETRICS_INTRO: 'biometrics_intro',
    DASHBOARD_INTRO: 'dashboard_intro',
    EPASS_INTRO: 'epass_intro',
    COMPLETE: 'complete'
};

// Query categories for analytics
export const QUERY_CATEGORIES = {
    ATTENDANCE: 'attendance',
    POLICY: 'policy',
    TECHNICAL: 'technical',
    NAVIGATION: 'navigation',
    ANALYTICS: 'analytics',
    MANAGEMENT: 'management',
    SYSTEM: 'system',
    OTHER: 'other'
};

// Create chatbot store
function createChatbotStore() {
    const initialState = {
        isOpen: false,
        isMinimized: false,
        messages: [],
        isTyping: false,
        role: CHATBOT_ROLES.USER,
        sessionId: null,
        unreadCount: 0,
        context: {},
        rateLimit: {
            count: 0,
            lastReset: Date.now()
        },
        onboardingStep: null,
        isOnboarding: false,
        hasCompletedOnboarding: false,
        suggestedQueries: [],
        lastActivity: null,
        conversationHistory: [],
        queryStats: {
            total: 0,
            byCategory: {}
        },
        pendingAction: null,
        feedbackPending: null
    };

    const { subscribe, set, update } = writable(initialState);

    // Rate limiting: 30 messages per minute
    const RATE_LIMIT = 30;
    const RATE_WINDOW = 60000;

    // Session timeout: 30 minutes of inactivity
    const SESSION_TIMEOUT = 30 * 60 * 1000;

    // Max conversation history for context
    const MAX_HISTORY = 10;

    function checkRateLimit(state) {
        const now = Date.now();
        if (now - state.rateLimit.lastReset > RATE_WINDOW) {
            return { count: 1, lastReset: now };
        }
        if (state.rateLimit.count >= RATE_LIMIT) {
            return null; // Rate limited
        }
        return { ...state.rateLimit, count: state.rateLimit.count + 1 };
    }

    function generateSessionId() {
        return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    function getWelcomeMessage(role, context) {
        const userName = context.userProfile?.name?.split(' ')[0] || '';
        const greeting = getTimeBasedGreeting();
        
        if (role === CHATBOT_ROLES.ADMIN) {
            return `${greeting}${userName ? `, ${userName}` : ''}! I'm your Admin Assistant. I can help you with:\n\n• **Real-time attendance insights** - Today's summary, late arrivals, rates\n• **Analytics & reports** - Export data, department analysis\n• **System health** - Monitor QR, biometrics, database\n• **User management** - Guidance on user operations\n• **Policy configuration** - Grace periods, holidays, rules\n\nWhat would you like to know?`;
        }
        return `${greeting}${userName ? `, ${userName}` : ''}! I'm your Attendance Assistant. I can help you:\n\n• **Check your attendance** - Status, check-in time, history\n• **Understand policies** - Late rules, absence limits\n• **Navigate the system** - Dashboard, E-Pass, profile\n• **Troubleshoot issues** - QR problems, face scan help\n\nHow can I help you today?`;
    }

    function getTimeBasedGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    }

    function getSuggestedQueries(role) {
        if (role === CHATBOT_ROLES.ADMIN) {
            return [
                { label: "📊 Today's summary", query: "Show today's attendance summary" },
                { label: '⚠️ Late arrivals', query: 'How many users are late today?' },
                { label: '🔧 System health', query: 'Is the system working properly?' },
                { label: '📈 Weekly rate', query: 'Attendance rate this week?' }
            ];
        }
        return [
            { label: '✅ My status', query: 'Am I present today?' },
            { label: '⏰ Check-in time', query: 'What time did I check in?' },
            { label: '📋 Late policy', query: 'What is the late policy?' },
            { label: '❓ Help', query: 'What can you help me with?' }
        ];
    }

    function addToHistory(state, message, sender) {
        const history = [...state.conversationHistory, { message, sender, timestamp: Date.now() }];
        return history.slice(-MAX_HISTORY);
    }

    return {
        subscribe,

        // Initialize chatbot
        init: (role = CHATBOT_ROLES.USER, context = {}) => {
            const sessionId = generateSessionId();
            const storageKey = `chatbot_onboarding_${role}`;
            const hasCompletedOnboarding = browser ? localStorage.getItem(storageKey) === 'true' : true;
            
            // Load previous stats if available
            let queryStats = { total: 0, byCategory: {} };
            if (browser) {
                try {
                    const savedStats = localStorage.getItem(`chatbot_stats_${context.userId || 'anon'}`);
                    if (savedStats) queryStats = JSON.parse(savedStats);
                } catch (e) {}
            }
            
            update(state => ({
                ...state,
                role,
                sessionId,
                context,
                hasCompletedOnboarding,
                isOnboarding: !hasCompletedOnboarding && role === CHATBOT_ROLES.USER,
                onboardingStep: !hasCompletedOnboarding && role === CHATBOT_ROLES.USER ? ONBOARDING_STEPS.WELCOME : null,
                suggestedQueries: getSuggestedQueries(role),
                lastActivity: Date.now(),
                queryStats,
                messages: [{
                    id: `msg_${Date.now()}`,
                    type: MESSAGE_TYPES.TEXT,
                    content: getWelcomeMessage(role, context),
                    sender: 'bot',
                    timestamp: new Date().toISOString()
                }]
            }));

            // Log session start
            if (browser) {
                console.log(`[Chatbot] Session started: ${sessionId}, Role: ${role}`);
            }
        },

        // Toggle chatbot visibility
        toggle: () => {
            update(state => {
                const newIsOpen = !state.isOpen;
                return {
                    ...state,
                    isOpen: newIsOpen,
                    isMinimized: false,
                    unreadCount: newIsOpen ? 0 : state.unreadCount
                };
            });
        },

        // Open chatbot
        open: () => {
            update(state => ({
                ...state,
                isOpen: true,
                isMinimized: false,
                unreadCount: 0
            }));
        },

        // Close chatbot
        close: () => {
            update(state => ({
                ...state,
                isOpen: false,
                isMinimized: false
            }));
        },

        // Minimize chatbot
        minimize: () => {
            update(state => ({
                ...state,
                isMinimized: true
            }));
        },

        // Restore from minimized
        restore: () => {
            update(state => ({
                ...state,
                isMinimized: false
            }));
        },

        // Add user message
        addUserMessage: (content, category = QUERY_CATEGORIES.OTHER) => {
            update(state => {
                const rateLimit = checkRateLimit(state);
                if (!rateLimit) {
                    return {
                        ...state,
                        messages: [...state.messages, {
                            id: `msg_${Date.now()}`,
                            type: MESSAGE_TYPES.ERROR,
                            content: "You're sending messages too quickly. Please wait a moment.",
                            sender: 'bot',
                            timestamp: new Date().toISOString()
                        }]
                    };
                }

                // Update query stats
                const newStats = {
                    total: state.queryStats.total + 1,
                    byCategory: {
                        ...state.queryStats.byCategory,
                        [category]: (state.queryStats.byCategory[category] || 0) + 1
                    }
                };

                // Save stats
                if (browser) {
                    try {
                        localStorage.setItem(
                            `chatbot_stats_${state.context.userId || 'anon'}`,
                            JSON.stringify(newStats)
                        );
                    } catch (e) {}
                }

                return {
                    ...state,
                    rateLimit,
                    queryStats: newStats,
                    conversationHistory: addToHistory(state, content, 'user'),
                    messages: [...state.messages, {
                        id: `msg_${Date.now()}`,
                        type: MESSAGE_TYPES.TEXT,
                        content,
                        sender: 'user',
                        timestamp: new Date().toISOString()
                    }],
                    isTyping: true,
                    lastActivity: Date.now()
                };
            });
        },

        // Add bot message
        addBotMessage: (message) => {
            update(state => ({
                ...state,
                conversationHistory: addToHistory(state, 
                    typeof message.content === 'string' ? message.content : JSON.stringify(message.content), 
                    'bot'
                ),
                messages: [...state.messages, {
                    id: `msg_${Date.now()}`,
                    ...message,
                    sender: 'bot',
                    timestamp: new Date().toISOString()
                }],
                isTyping: false,
                unreadCount: state.isOpen ? 0 : state.unreadCount + 1,
                lastActivity: Date.now()
            }));
        },

        // Set typing indicator
        setTyping: (isTyping) => {
            update(state => ({ ...state, isTyping }));
        },

        // Update context
        updateContext: (newContext) => {
            update(state => ({
                ...state,
                context: { ...state.context, ...newContext }
            }));
        },

        // Clear messages
        clearMessages: () => {
            update(state => ({
                ...state,
                messages: [{
                    id: `msg_${Date.now()}`,
                    type: MESSAGE_TYPES.TEXT,
                    content: state.role === CHATBOT_ROLES.ADMIN 
                        ? "Chat cleared. How can I assist you?"
                        : "Chat cleared. What would you like to know?",
                    sender: 'bot',
                    timestamp: new Date().toISOString()
                }],
                conversationHistory: [],
                lastActivity: Date.now()
            }));
        },

        // Set pending action (for confirmations)
        setPendingAction: (action) => {
            update(state => ({ ...state, pendingAction: action }));
        },

        // Clear pending action
        clearPendingAction: () => {
            update(state => ({ ...state, pendingAction: null }));
        },

        // Request feedback for a message
        requestFeedback: (messageId) => {
            update(state => ({ ...state, feedbackPending: messageId }));
        },

        // Submit feedback
        submitFeedback: (messageId, helpful) => {
            update(state => {
                // Log feedback (in production, send to server)
                console.log(`[Chatbot Feedback] Message ${messageId}: ${helpful ? 'Helpful' : 'Not helpful'}`);
                return { ...state, feedbackPending: null };
            });
        },

        // Start onboarding flow
        startOnboarding: () => {
            update(state => ({
                ...state,
                isOnboarding: true,
                onboardingStep: ONBOARDING_STEPS.WELCOME,
                messages: [...state.messages, {
                    id: `msg_${Date.now()}`,
                    type: MESSAGE_TYPES.ONBOARDING,
                    content: {
                        step: ONBOARDING_STEPS.WELCOME,
                        title: 'Welcome to the Attendance System! 👋',
                        description: "Let me give you a quick tour of how everything works. This will only take a minute!",
                        progress: 1,
                        totalSteps: 5,
                        actions: [
                            { label: "Let's go!", action: 'next' },
                            { label: 'Skip tour', action: 'skip' }
                        ]
                    },
                    sender: 'bot',
                    timestamp: new Date().toISOString()
                }]
            }));
        },

        // Progress onboarding
        progressOnboarding: (action) => {
            update(state => {
                if (action === 'skip') {
                    if (browser) {
                        localStorage.setItem(`chatbot_onboarding_${state.role}`, 'true');
                    }
                    return {
                        ...state,
                        isOnboarding: false,
                        hasCompletedOnboarding: true,
                        onboardingStep: null,
                        messages: [...state.messages, {
                            id: `msg_${Date.now()}`,
                            type: MESSAGE_TYPES.TEXT,
                            content: "No problem! Feel free to ask me anything whenever you need help. Just type **'help'** to see what I can do.",
                            sender: 'bot',
                            timestamp: new Date().toISOString()
                        }]
                    };
                }

                const steps = Object.values(ONBOARDING_STEPS);
                const currentIndex = steps.indexOf(state.onboardingStep);
                const nextStep = steps[currentIndex + 1];

                if (!nextStep || nextStep === ONBOARDING_STEPS.COMPLETE) {
                    if (browser) {
                        localStorage.setItem(`chatbot_onboarding_${state.role}`, 'true');
                    }
                    return {
                        ...state,
                        isOnboarding: false,
                        hasCompletedOnboarding: true,
                        onboardingStep: null,
                        messages: [...state.messages, {
                            id: `msg_${Date.now()}`,
                            type: MESSAGE_TYPES.CARD,
                            content: {
                                icon: '🎉',
                                title: "You're All Set!",
                                description: "You now know the basics of the attendance system. Feel free to ask me anything anytime!",
                                status: 'success',
                                actions: [
                                    { label: 'Go to Dashboard', href: '/app/dashboard' },
                                    { label: 'Check Attendance', href: '/app/attendance' }
                                ]
                            },
                            sender: 'bot',
                            timestamp: new Date().toISOString()
                        }]
                    };
                }

                const onboardingContent = {
                    [ONBOARDING_STEPS.QR_INTRO]: {
                        title: 'QR Code Check-in 📱',
                        description: "The fastest way to mark attendance! Just scan the QR code displayed on the attendance screen. Make sure your camera has good lighting for best results.",
                        progress: 2,
                        totalSteps: 5,
                        actions: [{ label: 'Next', action: 'next' }, { label: 'Skip', action: 'skip' }]
                    },
                    [ONBOARDING_STEPS.BIOMETRICS_INTRO]: {
                        title: 'Face Recognition 👤',
                        description: "For extra security, you can use face recognition. Go to your **Profile** to set it up. It works best with good lighting and a clear view of your face.",
                        progress: 3,
                        totalSteps: 5,
                        actions: [{ label: 'Next', action: 'next' }, { label: 'Skip', action: 'skip' }]
                    },
                    [ONBOARDING_STEPS.DASHBOARD_INTRO]: {
                        title: 'Your Dashboard 📊',
                        description: "Your dashboard shows your attendance summary, recent activity, and achievements. Check it regularly to stay on top of your attendance record!",
                        progress: 4,
                        totalSteps: 5,
                        actions: [{ label: 'Next', action: 'next' }, { label: 'Skip', action: 'skip' }]
                    },
                    [ONBOARDING_STEPS.EPASS_INTRO]: {
                        title: 'Digital E-Pass 🎫',
                        description: "Your E-Pass is a digital ID that shows your attendance status. You can show it for verification purposes. Access it anytime from the E-Pass section!",
                        progress: 5,
                        totalSteps: 5,
                        actions: [{ label: 'Finish', action: 'next' }]
                    }
                };

                return {
                    ...state,
                    onboardingStep: nextStep,
                    messages: [...state.messages, {
                        id: `msg_${Date.now()}`,
                        type: MESSAGE_TYPES.ONBOARDING,
                        content: {
                            step: nextStep,
                            ...onboardingContent[nextStep]
                        },
                        sender: 'bot',
                        timestamp: new Date().toISOString()
                    }]
                };
            });
        },

        // Update suggested queries
        updateSuggestions: (queries) => {
            update(state => ({
                ...state,
                suggestedQueries: queries
            }));
        },

        // Check session validity
        checkSession: () => {
            let isValid = true;
            update(state => {
                const now = Date.now();
                if (state.lastActivity && (now - state.lastActivity) > SESSION_TIMEOUT) {
                    isValid = false;
                    return {
                        ...state,
                        sessionId: generateSessionId(),
                        lastActivity: now,
                        conversationHistory: [],
                        messages: [{
                            id: `msg_${Date.now()}`,
                            type: MESSAGE_TYPES.SYSTEM,
                            content: 'Session refreshed due to inactivity. How can I help you?',
                            sender: 'bot',
                            timestamp: new Date().toISOString()
                        }]
                    };
                }
                return { ...state, lastActivity: now };
            });
            return isValid;
        },

        // Get conversation context for AI
        getConversationContext: () => {
            let context = [];
            const unsubscribe = subscribe(state => {
                context = state.conversationHistory;
            });
            unsubscribe();
            return context;
        },

        // Reset store
        reset: () => {
            set(initialState);
        }
    };
}

export const chatbotStore = createChatbotStore();

// Derived store for message count
export const messageCount = derived(chatbotStore, $store => $store.messages.length);

// Derived store for unread messages
export const unreadMessages = derived(chatbotStore, $store => $store.unreadCount);

// Derived store for onboarding status
export const isOnboarding = derived(chatbotStore, $store => $store.isOnboarding);

// Derived store for current role
export const chatbotRole = derived(chatbotStore, $store => $store.role);

// Derived store for typing status
export const isTyping = derived(chatbotStore, $store => $store.isTyping);

// Derived store for session info
export const sessionInfo = derived(chatbotStore, $store => ({
    sessionId: $store.sessionId,
    role: $store.role,
    messageCount: $store.messages.length,
    queryStats: $store.queryStats
}));
