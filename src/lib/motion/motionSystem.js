// src/lib/motion/motionSystem.js
// Apple WWDC-Quality Motion Design System
// Designed for enterprise attendance app with premium feel

/**
 * MOTION PHILOSOPHY
 * -----------------
 * 1. Motion guides attention, never distracts
 * 2. Every animation has purpose and meaning
 * 3. Slower is better than faster (perceived quality)
 * 4. Motion should feel "alive" but calm
 * 5. Respect user preferences (reduced motion)
 */

// ============================================
// TIMING CONSTANTS (in milliseconds)
// ============================================

export const TIMING = {
    // Micro-interactions (instant feedback)
    INSTANT: 100,
    QUICK: 150,
    
    // Standard interactions
    FAST: 200,
    NORMAL: 300,
    MODERATE: 400,
    
    // Deliberate animations
    SLOW: 500,
    GENTLE: 600,
    
    // Dramatic reveals
    DRAMATIC: 800,
    CINEMATIC: 1000,
    
    // Stagger delays
    STAGGER_MICRO: 30,
    STAGGER_SMALL: 50,
    STAGGER_NORMAL: 80,
    STAGGER_LARGE: 120
};

// ============================================
// EASING CURVES (Apple-style)
// ============================================

export const EASING = {
    // Standard Apple curves
    APPLE_EASE: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
    APPLE_EASE_IN: 'cubic-bezier(0.42, 0, 1, 1)',
    APPLE_EASE_OUT: 'cubic-bezier(0, 0, 0.58, 1)',
    APPLE_EASE_IN_OUT: 'cubic-bezier(0.42, 0, 0.58, 1)',
    
    // Premium curves for special moments
    SPRING: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    SPRING_GENTLE: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    SPRING_BOUNCY: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    
    // Smooth deceleration (for entrances)
    DECELERATE: 'cubic-bezier(0, 0, 0.2, 1)',
    DECELERATE_STRONG: 'cubic-bezier(0, 0.7, 0.3, 1)',
    
    // Smooth acceleration (for exits)
    ACCELERATE: 'cubic-bezier(0.4, 0, 1, 1)',
    
    // Linear for continuous animations
    LINEAR: 'linear',
    
    // Breathing/organic feel
    BREATHE: 'cubic-bezier(0.37, 0, 0.63, 1)'
};

// ============================================
// ANIMATION PRESETS
// ============================================

export const PRESETS = {
    // Page transitions
    PAGE_ENTER: {
        duration: TIMING.MODERATE,
        easing: EASING.DECELERATE,
        transform: { from: 'translateY(20px)', to: 'translateY(0)' },
        opacity: { from: 0, to: 1 }
    },
    
    PAGE_EXIT: {
        duration: TIMING.FAST,
        easing: EASING.ACCELERATE,
        transform: { from: 'translateY(0)', to: 'translateY(-10px)' },
        opacity: { from: 1, to: 0 }
    },
    
    // Modal/overlay
    MODAL_ENTER: {
        duration: TIMING.NORMAL,
        easing: EASING.SPRING_GENTLE,
        transform: { from: 'scale(0.95) translateY(10px)', to: 'scale(1) translateY(0)' },
        opacity: { from: 0, to: 1 }
    },
    
    MODAL_EXIT: {
        duration: TIMING.FAST,
        easing: EASING.ACCELERATE,
        transform: { from: 'scale(1)', to: 'scale(0.95)' },
        opacity: { from: 1, to: 0 }
    },
    
    // Cards and elements
    CARD_HOVER: {
        duration: TIMING.FAST,
        easing: EASING.APPLE_EASE,
        transform: 'translateY(-4px)',
        shadow: '0 12px 40px rgba(0, 0, 0, 0.12)'
    },
    
    CARD_PRESS: {
        duration: TIMING.INSTANT,
        easing: EASING.APPLE_EASE,
        transform: 'scale(0.98)'
    },
    
    // Notifications
    NOTIFICATION_ENTER: {
        duration: TIMING.NORMAL,
        easing: EASING.SPRING,
        transform: { from: 'translateX(100%)', to: 'translateX(0)' },
        opacity: { from: 0, to: 1 }
    },
    
    // Success celebration
    SUCCESS_BURST: {
        duration: TIMING.GENTLE,
        easing: EASING.SPRING_BOUNCY,
        scale: { from: 0.8, to: 1.1, settle: 1 }
    },
    
    // AI Assistant states
    AI_IDLE: {
        duration: 3000,
        easing: EASING.BREATHE,
        scale: { min: 0.98, max: 1.02 }
    },
    
    AI_THINKING: {
        duration: 800,
        easing: EASING.LINEAR,
        rotation: 360
    },
    
    AI_LISTENING: {
        duration: 1200,
        easing: EASING.BREATHE,
        scale: { min: 0.95, max: 1.08 }
    }
};

// ============================================
// SPRING PHYSICS CONFIGURATION
// ============================================

export const SPRING_CONFIG = {
    // Gentle spring (most common)
    GENTLE: { stiffness: 120, damping: 14, mass: 1 },
    
    // Snappy spring (buttons, toggles)
    SNAPPY: { stiffness: 300, damping: 20, mass: 1 },
    
    // Bouncy spring (celebrations, success)
    BOUNCY: { stiffness: 180, damping: 12, mass: 1 },
    
    // Slow spring (page transitions)
    SLOW: { stiffness: 80, damping: 15, mass: 1 },
    
    // Wobbly spring (playful elements)
    WOBBLY: { stiffness: 150, damping: 8, mass: 1 }
};

// ============================================
// COLOR TRANSITIONS
// ============================================

export const COLOR_TRANSITIONS = {
    // State colors with smooth transitions
    SUCCESS: {
        primary: '#34C759',
        glow: 'rgba(52, 199, 89, 0.4)',
        duration: TIMING.NORMAL
    },
    
    ERROR: {
        primary: '#FF3B30',
        glow: 'rgba(255, 59, 48, 0.4)',
        duration: TIMING.FAST
    },
    
    WARNING: {
        primary: '#FF9500',
        glow: 'rgba(255, 149, 0, 0.4)',
        duration: TIMING.NORMAL
    },
    
    INFO: {
        primary: '#007AFF',
        glow: 'rgba(0, 122, 255, 0.4)',
        duration: TIMING.NORMAL
    },
    
    THINKING: {
        primary: '#AF52DE',
        glow: 'rgba(175, 82, 222, 0.5)',
        duration: TIMING.SLOW
    }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get adjusted timing based on user preferences
 */
export function getAdjustedTiming(timing) {
    if (prefersReducedMotion()) {
        return Math.min(timing, TIMING.INSTANT);
    }
    return timing;
}

/**
 * Create CSS transition string
 */
export function createTransition(properties, duration = TIMING.NORMAL, easing = EASING.APPLE_EASE) {
    const adjustedDuration = getAdjustedTiming(duration);
    if (Array.isArray(properties)) {
        return properties.map(p => `${p} ${adjustedDuration}ms ${easing}`).join(', ');
    }
    return `${properties} ${adjustedDuration}ms ${easing}`;
}

/**
 * Create staggered animation delays
 */
export function createStaggerDelays(count, baseDelay = TIMING.STAGGER_NORMAL) {
    return Array.from({ length: count }, (_, i) => i * baseDelay);
}

/**
 * Interpolate between two values
 */
export function lerp(start, end, progress) {
    return start + (end - start) * progress;
}

/**
 * Clamp value between min and max
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Map value from one range to another
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

// ============================================
// SVELTE TRANSITION HELPERS
// ============================================

/**
 * Custom fly transition with Apple easing
 */
export function appleFly(node, { delay = 0, duration = TIMING.NORMAL, y = 20, x = 0 }) {
    const adjustedDuration = getAdjustedTiming(duration);
    return {
        delay,
        duration: adjustedDuration,
        css: (t) => {
            const eased = cubicOut(t);
            return `
                transform: translate(${(1 - eased) * x}px, ${(1 - eased) * y}px);
                opacity: ${eased};
            `;
        }
    };
}

/**
 * Custom scale transition with spring feel
 */
export function appleScale(node, { delay = 0, duration = TIMING.NORMAL, start = 0.95 }) {
    const adjustedDuration = getAdjustedTiming(duration);
    return {
        delay,
        duration: adjustedDuration,
        css: (t) => {
            const eased = elasticOut(t);
            const scale = start + (1 - start) * eased;
            return `
                transform: scale(${scale});
                opacity: ${t};
            `;
        }
    };
}

// Easing functions for custom transitions
function cubicOut(t) {
    const f = t - 1;
    return f * f * f + 1;
}

function elasticOut(t) {
    return Math.sin(-13 * (t + 1) * Math.PI / 2) * Math.pow(2, -10 * t) + 1;
}

// ============================================
// ANIMATION ORCHESTRATION
// ============================================

/**
 * Orchestrate multiple animations with timing
 */
export class AnimationOrchestrator {
    constructor() {
        this.animations = [];
        this.isPlaying = false;
    }
    
    add(callback, delay = 0) {
        this.animations.push({ callback, delay });
        return this;
    }
    
    async play() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        
        const sorted = [...this.animations].sort((a, b) => a.delay - b.delay);
        const startTime = Date.now();
        
        for (const anim of sorted) {
            const elapsed = Date.now() - startTime;
            const wait = Math.max(0, anim.delay - elapsed);
            
            if (wait > 0) {
                await new Promise(resolve => setTimeout(resolve, wait));
            }
            
            anim.callback();
        }
        
        this.isPlaying = false;
    }
    
    reset() {
        this.animations = [];
        this.isPlaying = false;
    }
}

export default {
    TIMING,
    EASING,
    PRESETS,
    SPRING_CONFIG,
    COLOR_TRANSITIONS,
    prefersReducedMotion,
    getAdjustedTiming,
    createTransition,
    createStaggerDelays,
    lerp,
    clamp,
    mapRange,
    appleFly,
    appleScale,
    AnimationOrchestrator
};
