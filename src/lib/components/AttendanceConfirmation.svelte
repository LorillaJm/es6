<!-- 
  AttendanceConfirmation.svelte
  Apple WWDC-Quality Attendance Success Animation
  
  MOTION PHILOSOPHY:
  - Celebration should feel earned and satisfying
  - Motion builds anticipation then releases
  - Particles add delight without overwhelming
  - Sound and haptics sync with visual (when available)
-->
<script>
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { fade, scale } from 'svelte/transition';
    import { cubicOut, elasticOut, backOut } from 'svelte/easing';
    import { TIMING, EASING, prefersReducedMotion } from '$lib/motion/motionSystem.js';
    
    export let show = false;
    export let type = 'check-in'; // 'check-in' | 'check-out'
    export let time = '';
    export let onComplete = () => {};
    export let duration = 3000;
    
    let canvas;
    let ctx;
    let particles = [];
    let animationFrame;
    let phase = 0; // 0: anticipation, 1: burst, 2: settle
    let checkProgress = 0;
    let ringProgress = 0;
    let glowIntensity = 0;
    let showContent = false;
    let showTime = false;
    let showMessage = false;
    
    const PARTICLE_COUNT = 40;
    const COLORS = type === 'check-in' 
        ? ['#34C759', '#30D158', '#5AC8FA', '#007AFF']
        : ['#FF9500', '#FF6B00', '#FFD60A', '#FF375F'];
    
    class Particle {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            this.originX = x;
            this.originY = y;
            this.color = color;
            this.size = 3 + Math.random() * 4;
            this.angle = Math.random() * Math.PI * 2;
            this.speed = 2 + Math.random() * 4;
            this.friction = 0.96 + Math.random() * 0.02;
            this.gravity = 0.08 + Math.random() * 0.04;
            this.opacity = 1;
            this.rotation = Math.random() * Math.PI * 2;
            this.rotationSpeed = (Math.random() - 0.5) * 0.2;
            this.vx = Math.cos(this.angle) * this.speed;
            this.vy = Math.sin(this.angle) * this.speed;
            this.life = 1;
            this.decay = 0.008 + Math.random() * 0.008;
            this.shape = Math.random() > 0.5 ? 'circle' : 'star';
        }
        
        update() {
            this.vx *= this.friction;
            this.vy *= this.friction;
            this.vy += this.gravity;
            this.x += this.vx;
            this.y += this.vy;
            this.rotation += this.rotationSpeed;
            this.life -= this.decay;
            this.opacity = this.life;
            this.size *= 0.995;
        }
        
        draw(ctx) {
            if (this.life <= 0) return;
            
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            ctx.globalAlpha = this.opacity;
            ctx.fillStyle = this.color;
            
            if (this.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Star shape
                this.drawStar(ctx, 0, 0, 5, this.size, this.size / 2);
            }
            
            ctx.restore();
        }
        
        drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
            let rot = Math.PI / 2 * 3;
            let step = Math.PI / spikes;
            
            ctx.beginPath();
            ctx.moveTo(cx, cy - outerRadius);
            
            for (let i = 0; i < spikes; i++) {
                ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
                rot += step;
                ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
                rot += step;
            }
            
            ctx.lineTo(cx, cy - outerRadius);
            ctx.closePath();
            ctx.fill();
        }
    }
    
    function initParticles() {
        if (!canvas) return;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2 - 40;
        
        particles = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const color = COLORS[Math.floor(Math.random() * COLORS.length)];
            particles.push(new Particle(centerX, centerY, color));
        }
    }
    
    function animate() {
        if (!ctx || !canvas) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Update and draw particles
        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => {
            p.update();
            p.draw(ctx);
        });
        
        if (particles.length > 0 || phase < 2) {
            animationFrame = requestAnimationFrame(animate);
        }
    }
    
    function triggerHaptic() {
        if (browser && navigator.vibrate) {
            navigator.vibrate([50, 30, 100]);
        }
    }
    
    async function runAnimation() {
        if (prefersReducedMotion()) {
            // Simplified animation for reduced motion
            showContent = true;
            showTime = true;
            showMessage = true;
            checkProgress = 1;
            ringProgress = 1;
            glowIntensity = 1;
            setTimeout(onComplete, duration);
            return;
        }
        
        // Phase 0: Anticipation (0-400ms)
        phase = 0;
        
        // Ring draws in
        const ringDuration = 400;
        const ringStart = Date.now();
        const animateRing = () => {
            const elapsed = Date.now() - ringStart;
            ringProgress = Math.min(1, elapsed / ringDuration);
            if (ringProgress < 1) {
                requestAnimationFrame(animateRing);
            }
        };
        animateRing();
        
        await new Promise(r => setTimeout(r, 300));
        
        // Phase 1: Burst (400-800ms)
        phase = 1;
        showContent = true;
        
        // Checkmark draws
        const checkDuration = 350;
        const checkStart = Date.now();
        const animateCheck = () => {
            const elapsed = Date.now() - checkStart;
            checkProgress = Math.min(1, elapsed / checkDuration);
            if (checkProgress < 1) {
                requestAnimationFrame(animateCheck);
            }
        };
        animateCheck();
        
        await new Promise(r => setTimeout(r, 150));
        
        // Particle burst
        initParticles();
        animate();
        triggerHaptic();
        
        // Glow pulse
        glowIntensity = 1;
        
        await new Promise(r => setTimeout(r, 200));
        
        // Phase 2: Settle (800ms+)
        phase = 2;
        showTime = true;
        
        await new Promise(r => setTimeout(r, 300));
        showMessage = true;
        
        // Fade glow
        const glowFade = () => {
            glowIntensity *= 0.95;
            if (glowIntensity > 0.1) {
                requestAnimationFrame(glowFade);
            } else {
                glowIntensity = 0;
            }
        };
        setTimeout(glowFade, 500);
        
        // Complete
        setTimeout(onComplete, duration - 1000);
    }
    
    onMount(() => {
        if (browser && show) {
            if (canvas) {
                ctx = canvas.getContext('2d');
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
            runAnimation();
        }
    });
    
    onDestroy(() => {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
    });
    
    $: if (browser && show && canvas && !ctx) {
        ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        runAnimation();
    }
</script>

{#if show}
    <div 
        class="confirmation-overlay"
        class:check-in={type === 'check-in'}
        class:check-out={type === 'check-out'}
        transition:fade={{ duration: 300 }}
    >
        <!-- Particle Canvas -->
        <canvas bind:this={canvas} class="particle-canvas"></canvas>
        
        <!-- Glow Background -->
        <div 
            class="glow-bg"
            style="opacity: {glowIntensity * 0.6}"
        ></div>
        
        <!-- Main Content -->
        <div class="confirmation-content">
            <!-- Success Icon -->
            <div 
                class="icon-container"
                class:visible={showContent}
            >
                <!-- Outer Ring -->
                <svg class="ring-svg" viewBox="0 0 120 120">
                    <circle 
                        class="ring-track"
                        cx="60" cy="60" r="54"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                        opacity="0.2"
                    />
                    <circle 
                        class="ring-progress"
                        cx="60" cy="60" r="54"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-dasharray="339.292"
                        stroke-dashoffset={339.292 * (1 - ringProgress)}
                        transform="rotate(-90 60 60)"
                    />
                </svg>
                
                <!-- Inner Circle with Checkmark -->
                <div class="icon-circle" style="transform: scale({0.8 + checkProgress * 0.2})">
                    <svg class="check-svg" viewBox="0 0 24 24">
                        <path 
                            class="check-path"
                            d="M5 12l5 5L19 7"
                            fill="none"
                            stroke="white"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-dasharray="24"
                            stroke-dashoffset={24 * (1 - checkProgress)}
                        />
                    </svg>
                </div>
            </div>
            
            <!-- Time Display -->
            {#if showTime}
                <div 
                    class="time-display"
                    in:scale={{ duration: 400, easing: backOut, start: 0.8 }}
                >
                    <span class="time-value">{time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            {/if}
            
            <!-- Message -->
            {#if showMessage}
                <div 
                    class="message"
                    in:fade={{ duration: 300, delay: 100 }}
                >
                    <h2 class="message-title">
                        {type === 'check-in' ? 'Checked In!' : 'Checked Out!'}
                    </h2>
                    <p class="message-subtitle">
                        {type === 'check-in' 
                            ? 'Have a productive day!' 
                            : 'See you tomorrow!'}
                    </p>
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .confirmation-overlay {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
    }
    
    .particle-canvas {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }
    
    .glow-bg {
        position: absolute;
        width: 300px;
        height: 300px;
        border-radius: 50%;
        pointer-events: none;
        transition: opacity 0.3s ease;
    }
    
    .check-in .glow-bg {
        background: radial-gradient(circle, rgba(52, 199, 89, 0.4) 0%, transparent 70%);
    }
    
    .check-out .glow-bg {
        background: radial-gradient(circle, rgba(255, 149, 0, 0.4) 0%, transparent 70%);
    }
    
    .confirmation-content {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
        z-index: 1;
    }
    
    .icon-container {
        position: relative;
        width: 120px;
        height: 120px;
        opacity: 0;
        transform: scale(0.8);
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    .icon-container.visible {
        opacity: 1;
        transform: scale(1);
    }
    
    .ring-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
    }
    
    .check-in .ring-svg {
        color: #34C759;
    }
    
    .check-out .ring-svg {
        color: #FF9500;
    }
    
    .ring-progress {
        transition: stroke-dashoffset 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
    }
    
    .icon-circle {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 80px;
        height: 80px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    .check-in .icon-circle {
        background: linear-gradient(135deg, #34C759 0%, #30D158 100%);
        box-shadow: 0 8px 32px rgba(52, 199, 89, 0.4);
    }
    
    .check-out .icon-circle {
        background: linear-gradient(135deg, #FF9500 0%, #FF6B00 100%);
        box-shadow: 0 8px 32px rgba(255, 149, 0, 0.4);
    }
    
    .check-svg {
        width: 36px;
        height: 36px;
    }
    
    .check-path {
        transition: stroke-dashoffset 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
    }
    
    .time-display {
        text-align: center;
    }
    
    .time-value {
        font-size: 48px;
        font-weight: 700;
        color: white;
        letter-spacing: -1px;
        font-variant-numeric: tabular-nums;
    }
    
    .message {
        text-align: center;
    }
    
    .message-title {
        font-size: 28px;
        font-weight: 700;
        color: white;
        margin: 0 0 8px;
        letter-spacing: -0.5px;
    }
    
    .message-subtitle {
        font-size: 16px;
        color: rgba(255, 255, 255, 0.7);
        margin: 0;
    }
    
    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
        .icon-container,
        .ring-progress,
        .check-path {
            transition: none;
        }
        
        .icon-container.visible {
            transform: scale(1);
        }
    }
    
    /* Mobile adjustments */
    @media (max-width: 480px) {
        .icon-container {
            width: 100px;
            height: 100px;
        }
        
        .icon-circle {
            width: 68px;
            height: 68px;
        }
        
        .check-svg {
            width: 30px;
            height: 30px;
        }
        
        .time-value {
            font-size: 40px;
        }
        
        .message-title {
            font-size: 24px;
        }
    }
</style>
