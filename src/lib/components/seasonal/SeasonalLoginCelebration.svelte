<script>
    import { onMount } from 'svelte';
    import { activeHoliday, seasonalConfig } from '$lib/stores/seasonalTheme.js';
    import { browser } from '$app/environment';
    
    export let show = false;
    export let userName = '';
    
    let visible = false;
    let particles = [];
    
    // Holiday-specific greetings
    const greetings = {
        christmas: { title: 'Merry Christmas!', subtitle: '🎄 Wishing you joy and happiness' },
        halloween: { title: 'Happy Halloween!', subtitle: '🎃 Have a spooky day' },
        newYear: { title: 'Happy New Year!', subtitle: '🎆 Cheers to new beginnings' },
        valentine: { title: 'Happy Valentine\'s!', subtitle: '❤️ Spread the love' },
        independence: { title: 'Happy Independence Day!', subtitle: '🇵🇭 Mabuhay!' },
        eid: { title: 'Eid Mubarak!', subtitle: '🌙 Blessed celebrations' }
    };
    
    $: greeting = $activeHoliday ? greetings[$activeHoliday.id] : null;
    
    function createBurstParticles() {
        if (!browser || !$activeHoliday) return;
        
        const colors = [
            $activeHoliday.colors.primary,
            $activeHoliday.colors.secondary,
            $activeHoliday.colors.accent
        ];
        
        particles = [];
        for (let i = 0; i < 30; i++) {
            const angle = (i / 30) * Math.PI * 2;
            const velocity = 3 + Math.random() * 4;
            particles.push({
                id: i,
                x: 50,
                y: 50,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 4 + Math.random() * 6,
                rotation: Math.random() * 360
            });
        }
    }
    
    function dismiss() {
        visible = false;
        setTimeout(() => {
            show = false;
        }, 300);
    }
    
    $: if (show && $activeHoliday && browser) {
        visible = true;
        createBurstParticles();
        // Auto dismiss after 4 seconds
        setTimeout(dismiss, 4000);
    }
</script>

{#if show && $activeHoliday && greeting}
    <div 
        class="celebration-overlay"
        class:visible
        on:click={dismiss}
        on:keydown={(e) => e.key === 'Escape' && dismiss()}
        role="button"
        tabindex="0"
        aria-label="Dismiss celebration"
    >
        <!-- Particle Burst -->
        <div class="particle-container">
            {#each particles as particle (particle.id)}
                <div 
                    class="burst-particle"
                    style="
                        --x: {particle.x}%;
                        --y: {particle.y}%;
                        --vx: {particle.vx}vw;
                        --vy: {particle.vy}vh;
                        --color: {particle.color};
                        --size: {particle.size}px;
                        --rotation: {particle.rotation}deg;
                    "
                ></div>
            {/each}
        </div>
        
        <!-- Celebration Card -->
        <div 
            class="celebration-card"
            style="
                --primary: {$activeHoliday.colors.primary};
                --secondary: {$activeHoliday.colors.secondary};
                --glow: {$activeHoliday.colors.glow};
            "
        >
            <div class="celebration-emoji">{$activeHoliday.emoji}</div>
            <h2 class="celebration-title">{greeting.title}</h2>
            <p class="celebration-subtitle">{greeting.subtitle}</p>
            {#if userName}
                <p class="celebration-user">Welcome back, {userName}!</p>
            {/if}
            <button class="celebration-btn" on:click={dismiss}>
                Continue
            </button>
        </div>
    </div>
{/if}

<style>
    .celebration-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    
    .celebration-overlay.visible {
        opacity: 1;
    }
    
    /* Particle Container */
    .particle-container {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
    }
    
    .burst-particle {
        position: absolute;
        left: var(--x);
        top: var(--y);
        width: var(--size);
        height: var(--size);
        background: var(--color);
        border-radius: 2px;
        transform: rotate(var(--rotation));
        animation: burst 1.5s ease-out forwards;
    }
    
    @keyframes burst {
        0% {
            transform: translate(0, 0) rotate(var(--rotation)) scale(1);
            opacity: 1;
        }
        100% {
            transform: translate(var(--vx), var(--vy)) rotate(calc(var(--rotation) + 360deg)) scale(0);
            opacity: 0;
        }
    }
    
    /* Celebration Card */
    .celebration-card {
        background: var(--theme-card-bg, white);
        border-radius: 28px;
        padding: 40px 48px;
        text-align: center;
        box-shadow: 
            0 25px 80px rgba(0, 0, 0, 0.3),
            0 0 60px var(--glow);
        animation: card-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        position: relative;
        overflow: hidden;
    }
    
    .celebration-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, var(--primary), var(--secondary));
    }
    
    @keyframes card-pop {
        0% {
            transform: scale(0.8);
            opacity: 0;
        }
        100% {
            transform: scale(1);
            opacity: 1;
        }
    }
    
    .celebration-emoji {
        font-size: 64px;
        margin-bottom: 16px;
        animation: emoji-bounce 1s ease-in-out infinite;
    }
    
    @keyframes emoji-bounce {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-10px) scale(1.1); }
    }
    
    .celebration-title {
        font-size: 28px;
        font-weight: 700;
        color: var(--theme-text, #0A0A0A);
        margin: 0 0 8px;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }
    
    .celebration-subtitle {
        font-size: 16px;
        color: var(--theme-text-secondary, #8E8E93);
        margin: 0 0 16px;
    }
    
    .celebration-user {
        font-size: 14px;
        font-weight: 500;
        color: var(--theme-text, #0A0A0A);
        margin: 0 0 24px;
    }
    
    .celebration-btn {
        padding: 12px 32px;
        border-radius: 12px;
        border: none;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        color: white;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    
    .celebration-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 8px 24px var(--glow);
    }
    
    /* Responsive */
    @media (max-width: 480px) {
        .celebration-card {
            margin: 20px;
            padding: 32px 24px;
        }
        
        .celebration-emoji {
            font-size: 48px;
        }
        
        .celebration-title {
            font-size: 24px;
        }
    }
    
    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
        .celebration-overlay,
        .celebration-card,
        .celebration-emoji,
        .burst-particle {
            animation: none;
        }
        
        .celebration-card {
            transform: scale(1);
        }
    }
</style>
