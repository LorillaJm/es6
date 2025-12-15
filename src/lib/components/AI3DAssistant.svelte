<script>
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { AI_STATES } from '$lib/ai/hybridEngine';

    export let state = AI_STATES.IDLE;
    export let size = 80;
    export let position = 'fixed';
    export let showLabel = true;
    export let variant = 'default'; // default, minimal, hologram

    const stateLabels = {
        [AI_STATES.IDLE]: '',
        [AI_STATES.LISTENING]: 'Listening...',
        [AI_STATES.THINKING]: 'Processing...',
        [AI_STATES.RESPONDING]: 'Speaking',
        [AI_STATES.ERROR]: 'Error',
        [AI_STATES.SUCCESS]: 'Complete'
    };

    let animationFrame;
    let canvas;
    let ctx;
    let particles = [];
    let orbitalRings = [];
    let time = 0;
    let breathScale = 1;
    let targetBreathScale = 1;
    let waveOffset = 0;
    let glowIntensity = 1;
    let targetGlowIntensity = 1;

    // Enhanced Particle class with depth simulation
    class Particle {
        constructor(x, y, radius, index, layer = 0) {
            this.x = x;
            this.y = y;
            this.baseX = x;
            this.baseY = y;
            this.radius = radius;
            this.baseRadius = radius;
            this.index = index;
            this.layer = layer;
            this.angle = Math.random() * Math.PI * 2;
            this.speed = 0.015 + Math.random() * 0.015;
            this.amplitude = 4 + Math.random() * 8;
            this.opacity = 0.2 + Math.random() * 0.4;
            this.baseOpacity = this.opacity;
            this.phaseOffset = index * 0.4 + layer * 1.2;
            this.depth = 0.5 + Math.random() * 0.5; // Z-depth simulation
            this.hue = 0;
        }

        update(currentState, time, centerX, centerY) {
            const stateConfig = {
                [AI_STATES.IDLE]: { mult: 0.8, pattern: 'orbit' },
                [AI_STATES.LISTENING]: { mult: 1.5, pattern: 'pulse' },
                [AI_STATES.THINKING]: { mult: 2.5, pattern: 'spiral' },
                [AI_STATES.RESPONDING]: { mult: 1.8, pattern: 'wave' },
                [AI_STATES.ERROR]: { mult: 0.3, pattern: 'shake' },
                [AI_STATES.SUCCESS]: { mult: 2.2, pattern: 'burst' }
            };
            
            const config = stateConfig[currentState] || stateConfig[AI_STATES.IDLE];
            this.angle += this.speed * config.mult;
            
            // Depth-based size variation (3D effect)
            const depthScale = 0.6 + this.depth * 0.8;
            this.radius = this.baseRadius * depthScale;
            
            switch (config.pattern) {
                case 'spiral':
                    const spiralRadius = this.amplitude * config.mult * (1 + Math.sin(time * 2 + this.phaseOffset) * 0.4);
                    const spiralAngle = this.angle + time * 1.5;
                    this.x = this.baseX + Math.cos(spiralAngle) * spiralRadius;
                    this.y = this.baseY + Math.sin(spiralAngle) * spiralRadius;
                    this.depth = 0.5 + Math.sin(time * 3 + this.phaseOffset) * 0.5;
                    break;
                case 'pulse':
                    const pulseScale = 1 + Math.sin(time * 5 + this.phaseOffset) * 0.3;
                    this.x = this.baseX + Math.cos(this.angle) * this.amplitude * pulseScale;
                    this.y = this.baseY + Math.sin(this.angle) * this.amplitude * pulseScale;
                    this.opacity = this.baseOpacity * (0.7 + Math.sin(time * 5 + this.phaseOffset) * 0.3);
                    break;
                case 'wave':
                    this.x = this.baseX + Math.cos(this.angle) * this.amplitude;
                    this.y = this.baseY + Math.sin(time * 4 + this.phaseOffset) * this.amplitude * 0.6;
                    break;
                case 'shake':
                    this.x = this.baseX + (Math.random() - 0.5) * 3;
                    this.y = this.baseY + (Math.random() - 0.5) * 3;
                    this.opacity = this.baseOpacity * 0.4;
                    break;
                case 'burst':
                    const burstPhase = (time * 2 + this.phaseOffset) % (Math.PI * 2);
                    const burstRadius = this.amplitude * (1 + Math.sin(burstPhase) * 0.5);
                    this.x = this.baseX + Math.cos(this.angle + burstPhase * 0.5) * burstRadius;
                    this.y = this.baseY + Math.sin(this.angle + burstPhase * 0.5) * burstRadius;
                    break;
                default: // orbit
                    const floatY = Math.sin(time * 1.2 + this.phaseOffset) * 2;
                    this.x = this.baseX + Math.cos(this.angle) * this.amplitude * config.mult;
                    this.y = this.baseY + Math.sin(this.angle * 0.7) * this.amplitude * config.mult + floatY;
            }
        }

        draw(ctx, colors, currentState) {
            const depthAlpha = 0.3 + this.depth * 0.7;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            
            // Gradient fill for depth
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
            grad.addColorStop(0, colors.secondary);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.globalAlpha = this.opacity * depthAlpha;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    // Orbital ring class for holographic effect
    class OrbitalRing {
        constructor(radius, speed, tilt, opacity) {
            this.radius = radius;
            this.speed = speed;
            this.tilt = tilt;
            this.opacity = opacity;
            this.rotation = Math.random() * Math.PI * 2;
        }

        update(time) {
            this.rotation += this.speed;
        }

        draw(ctx, centerX, centerY, colors, currentState) {
            if (currentState === AI_STATES.ERROR) return;
            
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(this.rotation);
            ctx.scale(1, this.tilt);
            
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.strokeStyle = colors.secondary;
            ctx.lineWidth = 1;
            ctx.globalAlpha = this.opacity * (currentState === AI_STATES.THINKING ? 0.8 : 0.4);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.restore();
        }
    }

    function getStateColors(currentState) {
        const colors = {
            [AI_STATES.IDLE]: { 
                primary: '#007AFF', 
                secondary: '#5856D6', 
                tertiary: '#AF52DE',
                glow: 'rgba(0, 122, 255, 0.25)',
                innerGlow: 'rgba(88, 86, 214, 0.4)'
            },
            [AI_STATES.LISTENING]: { 
                primary: '#5AC8FA', 
                secondary: '#007AFF', 
                tertiary: '#34C759',
                glow: 'rgba(90, 200, 250, 0.4)',
                innerGlow: 'rgba(0, 122, 255, 0.5)'
            },
            [AI_STATES.THINKING]: { 
                primary: '#AF52DE', 
                secondary: '#5856D6', 
                tertiary: '#007AFF',
                glow: 'rgba(175, 82, 222, 0.5)',
                innerGlow: 'rgba(88, 86, 214, 0.6)'
            },
            [AI_STATES.RESPONDING]: { 
                primary: '#007AFF', 
                secondary: '#34C759', 
                tertiary: '#5AC8FA',
                glow: 'rgba(0, 122, 255, 0.4)',
                innerGlow: 'rgba(52, 199, 89, 0.5)'
            },
            [AI_STATES.ERROR]: { 
                primary: '#FF3B30', 
                secondary: '#FF6B6B', 
                tertiary: '#FF9500',
                glow: 'rgba(255, 59, 48, 0.4)',
                innerGlow: 'rgba(255, 107, 107, 0.3)'
            },
            [AI_STATES.SUCCESS]: { 
                primary: '#34C759', 
                secondary: '#30D158', 
                tertiary: '#5AC8FA',
                glow: 'rgba(52, 199, 89, 0.5)',
                innerGlow: 'rgba(48, 209, 88, 0.6)'
            }
        };
        return colors[currentState] || colors[AI_STATES.IDLE];
    }

    function initCanvas() {
        if (!canvas || !browser) return;
        ctx = canvas.getContext('2d');
        const centerX = size / 2;
        const centerY = size / 2;
        
        // Initialize particles in multiple layers
        particles = [];
        for (let layer = 0; layer < 2; layer++) {
            const count = layer === 0 ? 8 : 6;
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                const radius = size * (0.3 + layer * 0.1);
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                particles.push(new Particle(x, y, 1.5 + Math.random() * 1.5, i, layer));
            }
        }
        
        // Initialize orbital rings
        orbitalRings = [
            new OrbitalRing(size * 0.38, 0.008, 0.3, 0.3),
            new OrbitalRing(size * 0.42, -0.006, 0.5, 0.2),
            new OrbitalRing(size * 0.35, 0.01, 0.4, 0.25)
        ];
    }

    function lerp(start, end, factor) {
        return start + (end - start) * factor;
    }

    function animate() {
        if (!ctx || !canvas) return;
        const colors = getStateColors(state);
        const centerX = size / 2;
        const centerY = size / 2;
        const baseOrbRadius = size * 0.28;
        
        ctx.clearRect(0, 0, size, size);
        time += 0.016;

        // Smooth state transitions
        const breathConfigs = {
            [AI_STATES.IDLE]: { scale: 1 + Math.sin(time * 1.2) * 0.06, glow: 1 },
            [AI_STATES.LISTENING]: { scale: 1 + Math.sin(time * 3.5) * 0.12, glow: 1.3 },
            [AI_STATES.THINKING]: { scale: 1 + Math.sin(time * 2) * 0.04, glow: 1.5 },
            [AI_STATES.RESPONDING]: { scale: 1 + Math.sin(time * 2.5) * 0.08, glow: 1.2 },
            [AI_STATES.ERROR]: { scale: 1 + Math.sin(time * 0.8) * 0.02, glow: 0.7 },
            [AI_STATES.SUCCESS]: { scale: 1 + Math.sin(time * 5) * 0.15, glow: 1.6 }
        };
        
        const config = breathConfigs[state] || breathConfigs[AI_STATES.IDLE];
        targetBreathScale = config.scale;
        targetGlowIntensity = config.glow;
        
        // Smooth interpolation
        breathScale = lerp(breathScale, targetBreathScale, 0.1);
        glowIntensity = lerp(glowIntensity, targetGlowIntensity, 0.08);
        
        if (state === AI_STATES.RESPONDING) {
            waveOffset = Math.sin(time * 3) * 2;
        } else {
            waveOffset = lerp(waveOffset, 0, 0.1);
        }

        const orbRadius = baseOrbRadius * breathScale;
        const orbX = centerX + waveOffset;

        // === LAYER 1: Ambient glow (furthest back) ===
        const ambientSize = orbRadius * 2.5 * glowIntensity;
        const ambientGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, ambientSize);
        ambientGrad.addColorStop(0, colors.glow);
        ambientGrad.addColorStop(0.4, colors.glow.replace(/[\d.]+\)$/, '0.1)'));
        ambientGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = ambientGrad;
        ctx.fillRect(0, 0, size, size);

        // === LAYER 2: Orbital rings (holographic effect) ===
        orbitalRings.forEach(ring => {
            ring.update(time);
            ring.draw(ctx, centerX, centerY, colors, state);
        });

        // === LAYER 3: Particles ===
        particles.sort((a, b) => a.depth - b.depth); // Depth sorting
        particles.forEach(p => {
            p.update(state, time, centerX, centerY);
            p.draw(ctx, colors, state);
        });

        // === LAYER 4: Inner glow sphere ===
        const innerGlowSize = orbRadius * 1.4;
        const innerGlowGrad = ctx.createRadialGradient(orbX, centerY, orbRadius * 0.5, orbX, centerY, innerGlowSize);
        innerGlowGrad.addColorStop(0, colors.innerGlow);
        innerGlowGrad.addColorStop(0.6, colors.innerGlow.replace(/[\d.]+\)$/, '0.15)'));
        innerGlowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = innerGlowGrad;
        ctx.beginPath();
        ctx.arc(orbX, centerY, innerGlowSize, 0, Math.PI * 2);
        ctx.fill();

        // === LAYER 5: Main orb with glass effect ===
        // Outer edge glow
        ctx.beginPath();
        ctx.arc(orbX, centerY, orbRadius + 2, 0, Math.PI * 2);
        const edgeGrad = ctx.createRadialGradient(orbX, centerY, orbRadius - 2, orbX, centerY, orbRadius + 4);
        edgeGrad.addColorStop(0, 'transparent');
        edgeGrad.addColorStop(0.5, colors.primary + '40');
        edgeGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = edgeGrad;
        ctx.fill();

        // Main orb body
        const orbGrad = ctx.createRadialGradient(
            orbX - orbRadius * 0.3, centerY - orbRadius * 0.3, 0,
            orbX, centerY, orbRadius
        );
        orbGrad.addColorStop(0, colors.primary);
        orbGrad.addColorStop(0.5, colors.secondary);
        orbGrad.addColorStop(0.8, colors.tertiary);
        orbGrad.addColorStop(1, colors.primary);
        ctx.beginPath();
        ctx.arc(orbX, centerY, orbRadius, 0, Math.PI * 2);
        ctx.fillStyle = orbGrad;
        ctx.fill();

        // Glass highlight (top-left)
        const highlightGrad = ctx.createRadialGradient(
            orbX - orbRadius * 0.35, centerY - orbRadius * 0.35, 0,
            orbX - orbRadius * 0.1, centerY - orbRadius * 0.1, orbRadius * 0.6
        );
        highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        highlightGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
        highlightGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = highlightGrad;
        ctx.fill();

        // Secondary highlight (bottom-right reflection)
        const reflectGrad = ctx.createRadialGradient(
            orbX + orbRadius * 0.2, centerY + orbRadius * 0.25, 0,
            orbX + orbRadius * 0.2, centerY + orbRadius * 0.25, orbRadius * 0.4
        );
        reflectGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        reflectGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = reflectGrad;
        ctx.fill();

        // === STATE-SPECIFIC EFFECTS ===
        
        // THINKING: Rotating arc indicators
        if (state === AI_STATES.THINKING) {
            for (let i = 0; i < 3; i++) {
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(time * (1.5 + i * 0.5) * (i % 2 === 0 ? 1 : -1));
                ctx.strokeStyle = i === 0 ? colors.primary : colors.secondary;
                ctx.lineWidth = 2 - i * 0.5;
                ctx.lineCap = 'round';
                ctx.globalAlpha = 0.7 - i * 0.2;
                ctx.beginPath();
                ctx.arc(0, 0, orbRadius * (1.35 + i * 0.15), 0, Math.PI * (0.8 - i * 0.2));
                ctx.stroke();
                ctx.restore();
            }
            ctx.globalAlpha = 1;
        }

        // LISTENING: Sound wave rings
        if (state === AI_STATES.LISTENING) {
            for (let i = 0; i < 3; i++) {
                const phase = (time * 3 + i * 0.8) % (Math.PI * 2);
                const waveRadius = orbRadius * (1.15 + Math.sin(phase) * 0.15 + i * 0.12);
                const waveOpacity = (1 - (phase / (Math.PI * 2))) * 0.5;
                
                ctx.beginPath();
                ctx.arc(centerX, centerY, waveRadius, 0, Math.PI * 2);
                ctx.strokeStyle = colors.primary;
                ctx.lineWidth = 2 - i * 0.5;
                ctx.globalAlpha = waveOpacity;
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        // SUCCESS: Checkmark with glow
        if (state === AI_STATES.SUCCESS) {
            const checkScale = Math.min(1, (time % 2) * 2);
            ctx.save();
            ctx.translate(orbX, centerY);
            ctx.scale(checkScale, checkScale);
            
            // Glow
            ctx.shadowColor = 'white';
            ctx.shadowBlur = 8;
            
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(-6, 0);
            ctx.lineTo(-1, 5);
            ctx.lineTo(7, -5);
            ctx.stroke();
            
            ctx.shadowBlur = 0;
            ctx.restore();
            
            // Celebration particles
            const burstPhase = (time * 1.5) % 1;
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2 + time;
                const dist = orbRadius * (1.3 + burstPhase * 0.8);
                const px = centerX + Math.cos(angle) * dist;
                const py = centerY + Math.sin(angle) * dist;
                
                ctx.beginPath();
                ctx.arc(px, py, 2 * (1 - burstPhase), 0, Math.PI * 2);
                ctx.fillStyle = i % 2 === 0 ? colors.primary : colors.secondary;
                ctx.globalAlpha = (1 - burstPhase) * 0.8;
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        // ERROR: Subtle shake + warning indicator
        if (state === AI_STATES.ERROR) {
            ctx.save();
            ctx.translate(orbX, centerY);
            
            ctx.fillStyle = 'white';
            ctx.font = `bold ${orbRadius * 0.8}px -apple-system, BlinkMacSystemFont, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('!', 0, 0);
            ctx.restore();
        }

        // RESPONDING: Audio wave visualization
        if (state === AI_STATES.RESPONDING) {
            const barCount = 5;
            const barWidth = 2;
            const maxHeight = orbRadius * 0.4;
            const startX = orbX - (barCount * barWidth + (barCount - 1) * 2) / 2;
            
            for (let i = 0; i < barCount; i++) {
                const height = maxHeight * (0.3 + Math.sin(time * 6 + i * 0.8) * 0.7);
                const x = startX + i * (barWidth + 2);
                
                ctx.fillStyle = 'white';
                ctx.globalAlpha = 0.9;
                ctx.fillRect(x, centerY - height / 2, barWidth, height);
            }
            ctx.globalAlpha = 1;
        }

        animationFrame = requestAnimationFrame(animate);
    }

    onMount(() => { if (browser) { initCanvas(); animate(); } });
    onDestroy(() => { if (animationFrame) cancelAnimationFrame(animationFrame); });
    $: if (browser && canvas && size) initCanvas();
</script>

<div class="ai-assistant-container" class:fixed-position={position === 'fixed'} class:inline-position={position === 'inline'} class:variant-minimal={variant === 'minimal'} class:variant-hologram={variant === 'hologram'} style="--size: {size}px;">
    <canvas bind:this={canvas} width={size} height={size} class="ai-orb-canvas" class:error-state={state === AI_STATES.ERROR} class:success-state={state === AI_STATES.SUCCESS} class:thinking-state={state === AI_STATES.THINKING} class:listening-state={state === AI_STATES.LISTENING} />
    {#if showLabel && stateLabels[state]}
        <div class="state-label" class:error={state === AI_STATES.ERROR} class:success={state === AI_STATES.SUCCESS} class:thinking={state === AI_STATES.THINKING}>
            {stateLabels[state]}
        </div>
    {/if}
</div>

<style>
    .ai-assistant-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        pointer-events: none;
    }
    
    .fixed-position { position: fixed; z-index: 1000; }
    .inline-position { position: relative; }
    
    .ai-orb-canvas {
        width: var(--size);
        height: var(--size);
        border-radius: 50%;
        filter: drop-shadow(0 4px 24px rgba(0, 122, 255, 0.35));
        transition: filter 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
    }
    
    .ai-orb-canvas.listening-state {
        filter: drop-shadow(0 4px 28px rgba(90, 200, 250, 0.5));
    }
    
    .ai-orb-canvas.thinking-state {
        filter: drop-shadow(0 6px 32px rgba(175, 82, 222, 0.55));
    }
    
    .ai-orb-canvas.error-state {
        filter: drop-shadow(0 4px 24px rgba(255, 59, 48, 0.5));
    }
    
    .ai-orb-canvas.success-state {
        filter: drop-shadow(0 6px 32px rgba(52, 199, 89, 0.55));
    }
    
    .state-label {
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.02em;
        color: var(--theme-text-secondary, #86868b);
        background: var(--theme-card-bg, rgba(255, 255, 255, 0.95));
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        padding: 5px 12px;
        border-radius: 14px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5);
        animation: labelFadeIn 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
    }
    
    .state-label.error {
        color: var(--apple-red, #FF3B30);
        background: rgba(255, 59, 48, 0.12);
        box-shadow: 0 2px 12px rgba(255, 59, 48, 0.15);
    }
    
    .state-label.success {
        color: var(--apple-green, #34C759);
        background: rgba(52, 199, 89, 0.12);
        box-shadow: 0 2px 12px rgba(52, 199, 89, 0.15);
    }
    
    .state-label.thinking {
        color: var(--apple-purple, #AF52DE);
        background: rgba(175, 82, 222, 0.12);
        box-shadow: 0 2px 12px rgba(175, 82, 222, 0.15);
    }
    
    @keyframes labelFadeIn {
        from { opacity: 0; transform: translateY(6px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
    }
    
    /* Variant: Minimal */
    .variant-minimal .ai-orb-canvas {
        filter: drop-shadow(0 2px 12px rgba(0, 122, 255, 0.2));
    }
    
    .variant-minimal .state-label {
        display: none;
    }
    
    /* Variant: Hologram */
    .variant-hologram .ai-orb-canvas {
        filter: drop-shadow(0 0 20px rgba(0, 122, 255, 0.4)) drop-shadow(0 0 40px rgba(88, 86, 214, 0.2));
    }
    
    /* Dark mode */
    :global([data-theme="dark"]) .state-label,
    :global([data-theme="amethyst"]) .state-label,
    :global([data-theme="oled"]) .state-label {
        background: rgba(44, 44, 46, 0.9);
        color: rgba(255, 255, 255, 0.8);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }
    
    :global([data-theme="dark"]) .state-label.error,
    :global([data-theme="amethyst"]) .state-label.error,
    :global([data-theme="oled"]) .state-label.error {
        background: rgba(255, 59, 48, 0.2);
    }
    
    :global([data-theme="dark"]) .state-label.success,
    :global([data-theme="amethyst"]) .state-label.success,
    :global([data-theme="oled"]) .state-label.success {
        background: rgba(52, 199, 89, 0.2);
    }
    
    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
        .ai-orb-canvas { transition: none; }
        .state-label { animation: none; }
    }
</style>
