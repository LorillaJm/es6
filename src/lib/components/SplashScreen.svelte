<script>
    import { onMount } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    import { cubicOut, elasticOut, backOut } from 'svelte/easing';
    import { browser } from '$app/environment';
    import { TIMING, prefersReducedMotion } from '$lib/motion/motionSystem.js';

    export let onComplete = () => {};
    export let duration = 2800; // Slightly longer for premium feel
    export let appName = 'Attendance';
    export let tagline = 'Enterprise Attendance System';

    let visible = true;
    let showLogo = false;
    let showText = false;
    let showTagline = false;
    let showProgress = false;
    let progress = 0;
    let reducedMotion = false;
    let logoScale = 0;
    let logoRotation = 0;

    onMount(() => {
        reducedMotion = prefersReducedMotion();
        
        if (reducedMotion) {
            // Simplified animation for reduced motion
            showLogo = true;
            showText = true;
            showTagline = true;
            showProgress = true;
            progress = 100;
            setTimeout(() => {
                visible = false;
                setTimeout(onComplete, 100);
            }, 1000);
            return;
        }
        
        // WWDC-quality staggered animation sequence
        // Phase 1: Logo entrance (0-600ms)
        setTimeout(() => {
            showLogo = true;
            animateLogoEntrance();
        }, 150);
        
        // Phase 2: Text reveal (400-800ms)
        setTimeout(() => showText = true, 500);
        
        // Phase 3: Tagline fade (700-1000ms)
        setTimeout(() => showTagline = true, 800);
        
        // Phase 4: Progress bar (900ms+)
        setTimeout(() => showProgress = true, 1000);
        
        // Animate progress bar with easing
        const progressDuration = duration - 1400;
        const progressStart = Date.now();
        const animateProgress = () => {
            const elapsed = Date.now() - progressStart;
            const t = Math.min(1, elapsed / progressDuration);
            // Ease out cubic for natural deceleration
            progress = Math.round(easeOutCubic(t) * 100);
            
            if (t < 1) {
                requestAnimationFrame(animateProgress);
            }
        };
        setTimeout(animateProgress, 1100);

        // Complete and fade out
        setTimeout(() => {
            visible = false;
            setTimeout(onComplete, 500);
        }, duration);
    });
    
    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
    
    function animateLogoEntrance() {
        // Smooth scale animation
        const startTime = Date.now();
        const animDuration = 600;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const t = Math.min(1, elapsed / animDuration);
            
            // Spring-like scale
            logoScale = elasticOut(t);
            
            // Subtle rotation
            logoRotation = (1 - t) * -10;
            
            if (t < 1) {
                requestAnimationFrame(animate);
            }
        };
        animate();
    }
</script>

{#if visible}
    <div class="splash-screen" transition:fade={{ duration: 500, easing: cubicOut }}>
        <!-- Animated Background -->
        <div class="splash-bg">
            <div class="gradient-orb orb-1"></div>
            <div class="gradient-orb orb-2"></div>
            <div class="gradient-orb orb-3"></div>
        </div>

        <div class="splash-content">
            <!-- Logo Animation -->
            {#if showLogo}
                <div 
                    class="logo-container" 
                    style="transform: scale({logoScale}) rotate({logoRotation}deg)"
                    transition:scale={{ duration: 600, easing: elasticOut, start: 0.5 }}
                >
                    <div class="logo-ring ring-outer"></div>
                    <div class="logo-ring ring-middle"></div>
                    <div class="logo-ring ring-inner"></div>
                    <div class="logo-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 12l2 2 4-4" class="checkmark" />
                            <circle cx="12" cy="12" r="10" class="circle" />
                        </svg>
                    </div>
                    <!-- Ambient glow -->
                    <div class="logo-glow"></div>
                </div>
            {/if}

            <!-- App Name -->
            {#if showText}
                <h1 class="app-name" transition:fade={{ duration: 400 }}>
                    {#each appName.split('') as char, i}
                        <span class="char" style="animation-delay: {i * 50}ms">{char}</span>
                    {/each}
                </h1>
            {/if}

            <!-- Tagline -->
            {#if showTagline}
                <p class="tagline" transition:fade={{ duration: 400 }}>{tagline}</p>
            {/if}

            <!-- Progress Bar -->
            {#if showProgress}
                <div class="progress-container" transition:fade={{ duration: 300 }}>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: {progress}%"></div>
                    </div>
                    <span class="progress-text">Loading...</span>
                </div>
            {/if}
        </div>

        <!-- Bottom Branding -->
        <div class="splash-footer">
            <span class="powered-by">Powered by</span>
            <span class="brand-name">EDNEL</span>
        </div>
    </div>
{/if}

<style>
    .splash-screen {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
        overflow: hidden;
    }

    /* Animated Background Orbs */
    .splash-bg {
        position: absolute;
        inset: 0;
        overflow: hidden;
    }

    .gradient-orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(80px);
        opacity: 0.5;
        animation: float 8s ease-in-out infinite;
    }

    .orb-1 {
        width: 400px;
        height: 400px;
        background: linear-gradient(135deg, #007AFF, #5856D6);
        top: -100px;
        left: -100px;
        animation-delay: 0s;
    }

    .orb-2 {
        width: 300px;
        height: 300px;
        background: linear-gradient(135deg, #34C759, #30D158);
        bottom: -50px;
        right: -50px;
        animation-delay: -3s;
    }

    .orb-3 {
        width: 250px;
        height: 250px;
        background: linear-gradient(135deg, #FF9500, #FF375F);
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        animation-delay: -5s;
        opacity: 0.3;
    }

    @keyframes float {
        0%, 100% { transform: translate(0, 0) scale(1); }
        33% { transform: translate(30px, -30px) scale(1.05); }
        66% { transform: translate(-20px, 20px) scale(0.95); }
    }

    /* Content */
    .splash-content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
    }

    /* Logo Container */
    .logo-container {
        position: relative;
        width: 120px;
        height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .logo-ring {
        position: absolute;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.1);
    }

    .ring-outer {
        width: 120px;
        height: 120px;
        animation: pulse-ring 2s ease-out infinite;
    }

    .ring-inner {
        width: 100px;
        height: 100px;
        animation: pulse-ring 2.5s ease-out infinite 0.3s;
    }
    
    .ring-middle {
        width: 110px;
        height: 110px;
        animation: pulse-ring 2.5s ease-out infinite 0.15s;
    }

    @keyframes pulse-ring {
        0% { transform: scale(1); opacity: 0.4; }
        50% { transform: scale(1.08); opacity: 0.15; }
        100% { transform: scale(1); opacity: 0.4; }
    }
    
    .logo-glow {
        position: absolute;
        width: 160px;
        height: 160px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(0, 122, 255, 0.3) 0%, transparent 70%);
        animation: glow-pulse 3s ease-in-out infinite;
        pointer-events: none;
    }
    
    @keyframes glow-pulse {
        0%, 100% { opacity: 0.5; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.1); }
    }

    .logo-icon {
        width: 80px;
        height: 80px;
        background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
        border-radius: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 
            0 20px 40px rgba(0, 122, 255, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
        animation: glow 2s ease-in-out infinite alternate;
    }

    @keyframes glow {
        from { box-shadow: 0 20px 40px rgba(0, 122, 255, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset; }
        to { box-shadow: 0 25px 60px rgba(0, 122, 255, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.2) inset; }
    }

    .logo-icon svg {
        width: 44px;
        height: 44px;
        color: white;
    }

    .logo-icon .circle {
        stroke-dasharray: 63;
        stroke-dashoffset: 63;
        animation: draw-circle 1s ease-out 0.3s forwards;
    }

    .logo-icon .checkmark {
        stroke-dasharray: 20;
        stroke-dashoffset: 20;
        animation: draw-check 0.5s ease-out 1s forwards;
    }

    @keyframes draw-circle {
        to { stroke-dashoffset: 0; }
    }

    @keyframes draw-check {
        to { stroke-dashoffset: 0; }
    }

    /* App Name */
    .app-name {
        font-size: clamp(32px, 8vw, 48px);
        font-weight: 700;
        color: white;
        letter-spacing: -1px;
        margin: 0;
        display: flex;
    }

    .char {
        display: inline-block;
        opacity: 0;
        transform: translateY(20px);
        animation: char-appear 0.4s ease-out forwards;
    }

    @keyframes char-appear {
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    /* Tagline */
    .tagline {
        font-size: 16px;
        color: rgba(255, 255, 255, 0.6);
        margin: 0;
        letter-spacing: 0.5px;
    }

    /* Progress Bar */
    .progress-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        margin-top: 20px;
    }

    .progress-bar {
        width: 200px;
        height: 4px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #007AFF, #5856D6, #34C759);
        background-size: 200% 100%;
        border-radius: 2px;
        transition: width 0.1s ease-out;
        animation: shimmer 1.5s ease-in-out infinite;
    }

    @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }

    .progress-text {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.4);
        letter-spacing: 1px;
        text-transform: uppercase;
    }

    /* Footer */
    .splash-footer {
        position: absolute;
        bottom: 40px;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .powered-by {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.3);
    }

    .brand-name {
        font-size: 14px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.6);
        letter-spacing: 2px;
    }

    /* Mobile Adjustments */
    @media (max-width: 480px) {
        .logo-container {
            width: 100px;
            height: 100px;
        }

        .ring-outer { width: 100px; height: 100px; }
        .ring-inner { width: 84px; height: 84px; }

        .logo-icon {
            width: 68px;
            height: 68px;
            border-radius: 20px;
        }

        .logo-icon svg {
            width: 36px;
            height: 36px;
        }

        .progress-bar {
            width: 160px;
        }
    }
</style>
