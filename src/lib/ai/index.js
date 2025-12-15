// src/lib/ai/index.js
// AI Behavior Analysis Module - Central exports

export {
    RiskLevel,
    AnomalyType,
    analyzeAttendanceBehavior,
    getUserBehaviorProfile,
    flagUserForReview,
    getFlaggedUsers,
    resolveFlaggedUser,
    analyzeFaceSimilarity,
    generateBehaviorReport
} from './behaviorAnalysis.js';

// Smart Leave Suggestions
export {
    SuggestionType,
    SuggestionPriority,
    SmartLeaveSuggestionsEngine,
    getUserLeaveBalance,
    dismissSuggestion,
    getDismissedSuggestions,
    logSuggestionAction,
    getSmartSuggestions
} from './smartLeaveSuggestions.js';

// Phase 8.1: Smart Recommendations
export {
    InterventionType,
    StudentRiskLevel,
    SmartRecommendationsEngine,
    recommendationsEngine,
    getFrequentlyLateStudents,
    getStudentsNeedingIntervention,
    getAttendancePredictions
} from './smartRecommendations.js';

// Hybrid AI Chatbot Engine
export {
    AI_STATES,
    INTENT_CATEGORIES,
    HybridAIEngine,
    getHybridEngine
} from './hybridEngine.js';

// Phase 3: Predictive Insights Engine
export {
    PATTERN_TYPES,
    INSIGHT_CATEGORIES,
    PredictiveInsightsEngine,
    getPredictiveEngine
} from './predictiveInsights.js';
