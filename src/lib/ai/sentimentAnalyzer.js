// src/lib/ai/sentimentAnalyzer.js
// Emotion-aware sentiment analysis for AI assistant animations

export const EMOTIONS = {
    NEUTRAL: 'neutral',
    HAPPY: 'happy',
    FRUSTRATED: 'frustrated',
    CONFUSED: 'confused',
    URGENT: 'urgent',
    GRATEFUL: 'grateful'
};

// Emotion to AI state mapping
export const EMOTION_STATE_MAP = {
    [EMOTIONS.NEUTRAL]: 'idle',
    [EMOTIONS.HAPPY]: 'success',
    [EMOTIONS.FRUSTRATED]: 'error',
    [EMOTIONS.CONFUSED]: 'thinking',
    [EMOTIONS.URGENT]: 'listening',
    [EMOTIONS.GRATEFUL]: 'success'
};

// Sentiment patterns with weights
const SENTIMENT_PATTERNS = {
    [EMOTIONS.HAPPY]: {
        patterns: [
            /\b(thanks?|thank you|awesome|great|perfect|excellent|amazing|love|wonderful|fantastic)\b/i,
            /\b(worked|solved|fixed|helped|appreciate)\b/i,
            /[!]{1,}$/,
            /[:;]-?\)|😊|😄|🎉|👍|✅/
        ],
        weight: 1.5
    },
    [EMOTIONS.FRUSTRATED]: {
        patterns: [
            /\b(not working|broken|failed|error|wrong|bad|terrible|hate|annoying|frustrated)\b/i,
            /\b(still|again|keeps|always|never|can't|cannot|won't)\b/i,
            /\b(ugh|argh|damn|seriously)\b/i,
            /[!?]{2,}/,
            /😤|😡|😠|💢/
        ],
        weight: 1.8
    },
    [EMOTIONS.CONFUSED]: {
        patterns: [
            /\b(confused|don't understand|what do you mean|unclear|how|why|what)\b/i,
            /\b(huh|wait|sorry|pardon)\b/i,
            /\?{2,}/,
            /😕|🤔|❓/
        ],
        weight: 1.4
    },
    [EMOTIONS.URGENT]: {
        patterns: [
            /\b(urgent|asap|immediately|emergency|critical|important|now|quick|hurry)\b/i,
            /\b(deadline|late|missing|lost)\b/i,
            /[!]{2,}/,
            /🚨|⚠️|🔴/
        ],
        weight: 1.6
    },
    [EMOTIONS.GRATEFUL]: {
        patterns: [
            /\b(thank|thanks|appreciate|grateful|helpful|you're the best|lifesaver)\b/i,
            /🙏|❤️|💙|😇/
        ],
        weight: 1.3
    }
};

/**
 * Analyze sentiment from user message
 */
export function analyzeSentiment(message) {
    const scores = {};
    let totalMatches = 0;

    for (const [emotion, config] of Object.entries(SENTIMENT_PATTERNS)) {
        let score = 0;
        for (const pattern of config.patterns) {
            if (pattern.test(message)) {
                score += config.weight;
                totalMatches++;
            }
        }
        scores[emotion] = score;
    }

    // Find dominant emotion
    const sortedEmotions = Object.entries(scores)
        .sort(([, a], [, b]) => b - a);

    const topEmotion = sortedEmotions[0];
    const confidence = topEmotion[1] > 0 ? Math.min(topEmotion[1] / 4, 1) : 0;

    return {
        emotion: topEmotion[1] > 0 ? topEmotion[0] : EMOTIONS.NEUTRAL,
        confidence,
        scores,
        suggestedState: EMOTION_STATE_MAP[topEmotion[1] > 0 ? topEmotion[0] : EMOTIONS.NEUTRAL]
    };
}

/**
 * Get empathetic response prefix based on emotion
 */
export function getEmpatheticPrefix(emotion) {
    const prefixes = {
        [EMOTIONS.HAPPY]: ["Great to hear! ", "Wonderful! ", "That's fantastic! "],
        [EMOTIONS.FRUSTRATED]: ["I understand your frustration. ", "I'm sorry you're experiencing this. ", "Let me help resolve this. "],
        [EMOTIONS.CONFUSED]: ["Let me clarify. ", "I'll explain that better. ", "Good question! "],
        [EMOTIONS.URGENT]: ["I understand this is urgent. ", "Let's address this right away. ", "I'll help you immediately. "],
        [EMOTIONS.GRATEFUL]: ["You're welcome! ", "Happy to help! ", "Glad I could assist! "],
        [EMOTIONS.NEUTRAL]: ["", "", ""]
    };

    const options = prefixes[emotion] || prefixes[EMOTIONS.NEUTRAL];
    return options[Math.floor(Math.random() * options.length)];
}

/**
 * Adjust response tone based on emotion
 */
export function adjustResponseTone(response, emotion) {
    const prefix = getEmpatheticPrefix(emotion);
    
    // Add appropriate suffix for frustrated users
    if (emotion === EMOTIONS.FRUSTRATED && !response.includes('contact support')) {
        return prefix + response + " If this doesn't resolve your issue, please let me know and I'll escalate it.";
    }
    
    return prefix + response;
}

export default { analyzeSentiment, getEmpatheticPrefix, adjustResponseTone, EMOTIONS, EMOTION_STATE_MAP };
