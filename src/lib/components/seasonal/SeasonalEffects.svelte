<script>
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { seasonalConfig, activeHoliday } from '$lib/stores/seasonalTheme.js';
    
    let canvas;
    let ctx;
    let animationId;
    let particles = [];
    let stars = [];
    let time = 0;
    let lastTime = 0;
    
    // Pre-rendered snowflake canvas for performance
    let snowflakeCache = [];
    
    // Create cached snowflake images (draw once, reuse many times)
    function createSnowflakeCache() {
        snowflakeCache = [];
        const sizes = [6, 8, 10, 12]; // 4 size variants
        
        sizes.forEach(size => {
            const offscreen = document.createElement('canvas');
            offscreen.width = size * 3;
            offscreen.height = size * 3;
            const offCtx = offscreen.getContext('2d');
            
            const cx = size * 1.5;
            const cy = size * 1.5;
            
            offCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            offCtx.lineWidth = Math.max(1, size * 0.12);
            offCtx.lineCap = 'round';
            
            // Simple 6-pointed snowflake
            for (let i = 0; i < 6; i++) {
                offCtx.save();
                offCtx.translate(cx, cy);
                offCtx.rotate((i * Math.PI) / 3);
                
                // Main branch
                offCtx.beginPath();
                offCtx.moveTo(0, 0);
                offCtx.lineTo(0, -size);
                offCtx.stroke();
                
                // Two small side branches
                offCtx.beginPath();
                offCtx.moveTo(0, -size * 0.5);
                offCtx.lineTo(-size * 0.3, -size * 0.7);
                offCtx.moveTo(0, -size * 0.5);
                offCtx.lineTo(size * 0.3, -size * 0.7);
                offCtx.stroke();
                
                offCtx.restore();
            }
            
            snowflakeCache.push({ canvas: offscreen, size });
        });
    }
    
    // Particle configurations - OPTIMIZED
    const particleConfigs = {
        snowfall: {
            count: 35, // Reduced count
            create: (w, h) => ({
                x: Math.random() * w,
                y: Math.random() * h,
                sizeIndex: Math.floor(Math.random() * 4),
                speed: Math.random() * 0.6 + 0.2,
                drift: Math.random() * 0.2 - 0.1,
                opacity: Math.random() * 0.4 + 0.3,
                wobbleOffset: Math.random() * 1000
            }),
            update: (p, w, h, dt) => {
                p.y += p.speed * dt;
                p.x += p.drift + Math.sin((time + p.wobbleOffset) * 0.5) * 0.3;
                if (p.y > h + 15) { p.y = -15; p.x = Math.random() * w; }
                if (p.x > w + 15) p.x = -15;
                if (p.x < -15) p.x = w + 15;
            },
            draw: (ctx, p) => {
                if (snowflakeCache.length === 0) return;
                const cached = snowflakeCache[p.sizeIndex];
                ctx.globalAlpha = p.opacity;
                ctx.drawImage(cached.canvas, p.x - cached.size * 1.5, p.y - cached.size * 1.5);
                ctx.globalAlpha = 1;
            }
        },
        confetti: {
            count: 25,
            create: (w, h) => ({
                x: Math.random() * w,
                y: Math.random() * h - h,
                size: Math.random() * 6 + 3,
                speed: Math.random() * 1.5 + 0.8,
                rotation: Math.random() * 360,
                rotationSpeed: Math.random() * 6 - 3,
                color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'][Math.floor(Math.random() * 5)],
                opacity: Math.random() * 0.7 + 0.3
            }),
            update: (p, w, h, dt) => {
                p.y += p.speed * dt;
                p.x += Math.sin(p.rotation * 0.05) * 0.3;
                p.rotation += p.rotationSpeed * dt * 0.1;
                if (p.y > h) { p.y = -15; p.x = Math.random() * w; }
            },
            draw: (ctx, p) => {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation * Math.PI / 180);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.opacity;
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
                ctx.restore();
            }
        },
        hearts: {
            count: 15,
            create: (w, h) => ({
                x: Math.random() * w,
                y: Math.random() * h + h,
                size: Math.random() * 12 + 6,
                speed: Math.random() * 1 + 0.4,
                drift: Math.random() * 0.3 - 0.15,
                opacity: Math.random() * 0.4 + 0.2,
                color: ['#E91E63', '#F8BBD9', '#FF4081'][Math.floor(Math.random() * 3)],
                wobbleOffset: Math.random() * 1000
            }),
            update: (p, w, h, dt) => {
                p.y -= p.speed * dt;
                p.x += p.drift + Math.sin((time + p.wobbleOffset) * 0.8) * 0.3;
                if (p.y < -20) { p.y = h + 20; p.x = Math.random() * w; }
            },
            draw: (ctx, p) => {
                ctx.save();
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                const s = p.size;
                ctx.moveTo(p.x, p.y + s / 4);
                ctx.bezierCurveTo(p.x, p.y, p.x - s / 2, p.y, p.x - s / 2, p.y + s / 4);
                ctx.bezierCurveTo(p.x - s / 2, p.y + s / 2, p.x, p.y + s * 0.75, p.x, p.y + s);
                ctx.bezierCurveTo(p.x, p.y + s * 0.75, p.x + s / 2, p.y + s / 2, p.x + s / 2, p.y + s / 4);
                ctx.bezierCurveTo(p.x + s / 2, p.y, p.x, p.y, p.x, p.y + s / 4);
                ctx.fill();
                ctx.restore();
            }
        },
        ghosts: {
            count: 5,
            create: (w, h) => ({
                x: Math.random() * w,
                y: Math.random() * h,
                size: Math.random() * 15 + 12,
                speedX: Math.random() * 0.4 - 0.2,
                speedY: Math.random() * 0.2 - 0.1,
                opacity: Math.random() * 0.2 + 0.08,
                wobbleOffset: Math.random() * 1000
            }),
            update: (p, w, h, dt) => {
                p.x += (p.speedX + Math.sin((time + p.wobbleOffset) * 0.3) * 0.2) * dt;
                p.y += (p.speedY + Math.cos((time + p.wobbleOffset) * 0.2) * 0.15) * dt;
                if (p.x > w + 40) p.x = -40;
                if (p.x < -40) p.x = w + 40;
                if (p.y > h + 40) p.y = -40;
                if (p.y < -40) p.y = h + 40;
            },
            draw: (ctx, p) => {
                ctx.save();
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, Math.PI, 0);
                ctx.lineTo(p.x + p.size, p.y + p.size);
                ctx.lineTo(p.x - p.size, p.y + p.size);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.arc(p.x - p.size * 0.3, p.y, p.size * 0.12, 0, Math.PI * 2);
                ctx.arc(p.x + p.size * 0.3, p.y, p.size * 0.12, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        },
        fireworks: {
            count: 8,
            create: (w, h) => ({
                x: Math.random() * w,
                y: h,
                targetY: Math.random() * h * 0.4 + 50,
                speed: Math.random() * 2 + 3,
                exploded: false,
                sparks: [],
                color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#FF9500'][Math.floor(Math.random() * 4)]
            }),
            update: (p, w, h, dt) => {
                if (!p.exploded) {
                    p.y -= p.speed * dt;
                    if (p.y <= p.targetY) {
                        p.exploded = true;
                        for (let i = 0; i < 8; i++) {
                            const angle = (i / 8) * Math.PI * 2;
                            p.sparks.push({ x: p.x, y: p.y, vx: Math.cos(angle) * 1.5, vy: Math.sin(angle) * 1.5, life: 1 });
                        }
                    }
                } else {
                    p.sparks.forEach(s => {
                        s.x += s.vx * dt;
                        s.y += s.vy * dt;
                        s.vy += 0.03 * dt;
                        s.life -= 0.015 * dt;
                    });
                    p.sparks = p.sparks.filter(s => s.life > 0);
                    if (p.sparks.length === 0) {
                        p.x = Math.random() * w;
                        p.y = h;
                        p.targetY = Math.random() * h * 0.4 + 50;
                        p.exploded = false;
                    }
                }
            },
            draw: (ctx, p) => {
                if (!p.exploded) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
                    ctx.fillStyle = p.color;
                    ctx.fill();
                } else {
                    p.sparks.forEach(s => {
                        ctx.globalAlpha = s.life;
                        ctx.beginPath();
                        ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
                        ctx.fillStyle = p.color;
                        ctx.fill();
                    });
                    ctx.globalAlpha = 1;
                }
            }
        },
        sparkles: {
            count: 20,
            create: (w, h) => ({
                x: Math.random() * w,
                y: Math.random() * h,
                size: Math.random() * 2 + 1,
                twinkleOffset: Math.random() * 1000,
                twinkleSpeed: Math.random() * 1.5 + 0.5
            }),
            update: () => {},
            draw: (ctx, p) => {
                const opacity = (Math.sin((time + p.twinkleOffset) * p.twinkleSpeed) + 1) / 2 * 0.7;
                ctx.globalAlpha = opacity;
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }
    };
    
    // Optimized stars - simple dots with opacity variation
    function createStars(w, h, count) {
        stars = [];
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * w,
                y: Math.random() * h * 0.6,
                size: Math.random() * 1.5 + 0.5,
                twinkleOffset: Math.random() * 1000,
                twinkleSpeed: Math.random() * 0.8 + 0.3,
                baseBrightness: Math.random() * 0.3 + 0.2
            });
        }
    }
    
    function drawStar(ctx, star) {
        const twinkle = Math.sin((time + star.twinkleOffset) * star.twinkleSpeed);
        const brightness = star.baseBrightness + twinkle * 0.25;
        
        ctx.globalAlpha = Math.max(0.1, brightness);
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Small glow for brighter moments
        if (brightness > 0.4) {
            ctx.globalAlpha = (brightness - 0.4) * 0.3;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
    
    function getEffectType(holiday) {
        if (!holiday) return null;
        const effects = holiday.effects;
        if (effects.includes('snowfall')) return 'snowfall';
        if (effects.includes('confetti')) return 'confetti';
        if (effects.includes('hearts')) return 'hearts';
        if (effects.includes('ghosts')) return 'ghosts';
        if (effects.includes('fireworks')) return 'fireworks';
        if (effects.includes('sparkles')) return 'sparkles';
        return 'sparkles';
    }
    
    function initCanvas() {
        if (!canvas || !browser) return;
        ctx = canvas.getContext('2d', { alpha: true });
        resizeCanvas();
        createSnowflakeCache();
        window.addEventListener('resize', handleResize);
    }
    
    let resizeTimeout;
    function handleResize() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeCanvas, 100);
    }
    
    function resizeCanvas() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if ($activeHoliday?.id === 'christmas') {
            createStars(canvas.width, canvas.height, 25);
        }
    }
    
    function initParticles(config, effectType) {
        if (!config || !effectType) return;
        const particleConfig = particleConfigs[effectType];
        if (!particleConfig) return;
        
        const intensityMultiplier = config.intensity.particles / 30;
        const count = Math.floor(particleConfig.count * intensityMultiplier);
        particles = [];
        for (let i = 0; i < count; i++) {
            particles.push(particleConfig.create(canvas.width, canvas.height));
        }
        
        if (config.holiday?.id === 'christmas') {
            createStars(canvas.width, canvas.height, Math.floor(25 * intensityMultiplier));
        }
    }
    
    function animate(timestamp) {
        if (!ctx) return;
        
        // Delta time for smooth animation regardless of frame rate
        const dt = lastTime ? Math.min((timestamp - lastTime) / 16.67, 3) : 1;
        lastTime = timestamp;
        time += dt * 0.05;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const effectType = getEffectType($seasonalConfig?.holiday);
        const particleConfig = particleConfigs[effectType];
        
        // Draw stars first (Christmas only)
        if ($activeHoliday?.id === 'christmas') {
            for (let i = 0; i < stars.length; i++) {
                drawStar(ctx, stars[i]);
            }
        }
        
        // Draw particles
        if (particleConfig) {
            for (let i = 0; i < particles.length; i++) {
                particleConfig.update(particles[i], canvas.width, canvas.height, dt);
                particleConfig.draw(ctx, particles[i]);
            }
        }
        
        animationId = requestAnimationFrame(animate);
    }
    
    function startAnimation(config) {
        stopAnimation();
        if (!config || !browser) return;
        
        const effectType = getEffectType(config.holiday);
        initParticles(config, effectType);
        lastTime = 0;
        time = 0;
        animationId = requestAnimationFrame(animate);
    }
    
    function stopAnimation() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        particles = [];
        stars = [];
        if (ctx && canvas) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    
    $: if (browser && canvas) {
        if ($seasonalConfig) {
            startAnimation($seasonalConfig);
        } else {
            stopAnimation();
        }
    }
    
    onMount(() => {
        initCanvas();
    });
    
    onDestroy(() => {
        stopAnimation();
        if (browser) {
            window.removeEventListener('resize', handleResize);
            clearTimeout(resizeTimeout);
        }
    });
</script>

{#if $activeHoliday}
    <canvas 
        bind:this={canvas}
        class="seasonal-canvas"
        aria-hidden="true"
    ></canvas>
{/if}

<style>
    .seasonal-canvas {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 9999;
    }
    
    @media (prefers-reduced-motion: reduce) {
        .seasonal-canvas {
            display: none;
        }
    }
</style>
