<script>
    import { onMount, onDestroy } from 'svelte';
    import { holidayStore, getHolidayTheme } from '$lib/services/holidayService.js';
    import { IconX, IconSnowflake, IconConfetti } from '@tabler/icons-svelte';
    import { browser } from '$app/environment';

    export let dismissible = true;

    let dismissed = false;
    let theme = null;

    $: if ($holidayStore.todayHoliday) {
        theme = getHolidayTheme($holidayStore.todayHoliday);
    } else {
        theme = null;
    }

    onMount(() => {
        holidayStore.init();
        
        // Check if already dismissed today
        if (browser) {
            const dismissedDate = localStorage.getItem('holiday-banner-dismissed');
            const today = new Date().toISOString().split('T')[0];
            if (dismissedDate === today) {
                dismissed = true;
            }
        }
    });

    onDestroy(() => {
        holidayStore.destroy();
    });

    function dismiss() {
        dismissed = true;
        if (browser) {
            const today = new Date().toISOString().split('T')[0];
            localStorage.setItem('holiday-banner-dismissed', today);
        }
    }
</script>

{#if theme && !dismissed && $holidayStore.todayHoliday?.showBanner !== false}
    <div 
        class="holiday-banner"
        style="
            --holiday-primary: {theme.colors.primary};
            --holiday-secondary: {theme.colors.secondary};
            --holiday-accent: {theme.colors.accent};
        "
    >
        <div class="banner-bg">
            {#if theme.effects.includes('snowfall')}
                <div class="snow-particles">
                    {#each Array(15) as _, i}
                        <span class="snowflake" style="--delay: {i * 0.3}s; --left: {Math.random() * 100}%">❄</span>
                    {/each}
                </div>
            {/if}
            {#if theme.effects.includes('confetti')}
                <div class="confetti-particles">
                    {#each Array(20) as _, i}
                        <span class="confetti" style="--delay: {i * 0.2}s; --left: {Math.random() * 100}%"></span>
                    {/each}
                </div>
            {/if}
            {#if theme.effects.includes('hearts')}
                <div class="heart-particles">
                    {#each Array(10) as _, i}
                        <span class="heart" style="--delay: {i * 0.4}s; --left: {Math.random() * 100}%">❤</span>
                    {/each}
                </div>
            {/if}
        </div>

        <div class="banner-content">
            <span class="banner-emoji">{theme.emoji}</span>
            <div class="banner-text">
                <h3>{theme.banner.title}</h3>
                <p>{theme.banner.subtitle}</p>
            </div>
            {#if $holidayStore.todayHoliday?.freezeAttendance !== false}
                <span class="freeze-badge">
                    <IconSnowflake size={14} />
                    Attendance Frozen
                </span>
            {/if}
        </div>

        {#if dismissible}
            <button class="dismiss-btn" on:click={dismiss} aria-label="Dismiss banner">
                <IconX size={18} />
            </button>
        {/if}
    </div>
{/if}

<style>
    .holiday-banner {
        position: relative;
        background: linear-gradient(135deg, var(--holiday-primary), var(--holiday-secondary));
        color: white;
        padding: 16px 24px;
        border-radius: var(--apple-radius-lg);
        margin-bottom: 20px;
        overflow: hidden;
    }

    .banner-bg {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
    }

    .banner-content {
        position: relative;
        display: flex;
        align-items: center;
        gap: 16px;
        z-index: 1;
    }

    .banner-emoji {
        font-size: 40px;
        line-height: 1;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
    }

    .banner-text {
        flex: 1;
    }

    .banner-text h3 {
        font-size: 18px;
        font-weight: 700;
        margin: 0 0 4px;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }

    .banner-text p {
        font-size: 14px;
        margin: 0;
        opacity: 0.9;
    }

    .freeze-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.2);
        padding: 8px 14px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        backdrop-filter: blur(4px);
    }

    .dismiss-btn {
        position: absolute;
        top: 12px;
        right: 12px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.2s;
        z-index: 2;
    }

    .dismiss-btn:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    /* Snow Animation */
    .snow-particles {
        position: absolute;
        inset: 0;
    }

    .snowflake {
        position: absolute;
        top: -20px;
        left: var(--left);
        font-size: 16px;
        opacity: 0.6;
        animation: snowfall 4s linear infinite;
        animation-delay: var(--delay);
    }

    @keyframes snowfall {
        0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 0;
        }
        10% {
            opacity: 0.6;
        }
        90% {
            opacity: 0.6;
        }
        100% {
            transform: translateY(100px) rotate(360deg);
            opacity: 0;
        }
    }

    /* Confetti Animation */
    .confetti-particles {
        position: absolute;
        inset: 0;
    }

    .confetti {
        position: absolute;
        top: -10px;
        left: var(--left);
        width: 8px;
        height: 8px;
        background: var(--holiday-accent);
        animation: confetti-fall 3s linear infinite;
        animation-delay: var(--delay);
    }

    .confetti:nth-child(odd) {
        background: white;
        border-radius: 50%;
    }

    @keyframes confetti-fall {
        0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 0;
        }
        10% {
            opacity: 0.8;
        }
        100% {
            transform: translateY(100px) rotate(720deg);
            opacity: 0;
        }
    }

    /* Hearts Animation */
    .heart-particles {
        position: absolute;
        inset: 0;
    }

    .heart {
        position: absolute;
        bottom: -20px;
        left: var(--left);
        font-size: 14px;
        opacity: 0.5;
        animation: hearts-rise 5s ease-out infinite;
        animation-delay: var(--delay);
    }

    @keyframes hearts-rise {
        0% {
            transform: translateY(0) scale(0.5);
            opacity: 0;
        }
        20% {
            opacity: 0.5;
        }
        100% {
            transform: translateY(-120px) scale(1);
            opacity: 0;
        }
    }

    @media (max-width: 600px) {
        .holiday-banner {
            padding: 14px 18px;
        }

        .banner-content {
            flex-wrap: wrap;
            gap: 12px;
        }

        .banner-emoji {
            font-size: 32px;
        }

        .banner-text h3 {
            font-size: 16px;
        }

        .banner-text p {
            font-size: 13px;
        }

        .freeze-badge {
            width: 100%;
            justify-content: center;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .snowflake, .confetti, .heart {
            animation: none;
            display: none;
        }
    }
</style>
