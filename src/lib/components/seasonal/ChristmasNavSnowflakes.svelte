<script>
    import { activeHoliday, seasonalConfig } from '$lib/stores/seasonalTheme.js';
    
    // Fewer, simpler snowflakes
    const snowflakes = Array.from({ length: 6 }, (_, i) => ({
        id: i,
        left: 10 + (i * 15),
        delay: i * 0.5,
        duration: 4 + (i % 2),
        size: 12 + (i % 3) * 2
    }));
    
    $: isChristmas = $activeHoliday?.id === 'christmas';
    $: showDecorations = $seasonalConfig?.intensity?.decorations ?? false;
</script>

{#if isChristmas && showDecorations}
    <div class="nav-snowflakes" aria-hidden="true">
        {#each snowflakes as flake (flake.id)}
            <span 
                class="nav-snowflake"
                style="
                    left: {flake.left}%;
                    animation-delay: {flake.delay}s;
                    animation-duration: {flake.duration}s;
                    font-size: {flake.size}px;
                "
            >❄</span>
        {/each}
    </div>
{/if}

<style>
    .nav-snowflakes {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 1;
    }
    
    .nav-snowflake {
        position: absolute;
        top: -15px;
        color: white;
        opacity: 0.5;
        text-shadow: 0 0 3px rgba(255, 255, 255, 0.5);
        animation: nav-snow-fall linear infinite;
        will-change: transform;
    }
    
    @keyframes nav-snow-fall {
        0% {
            transform: translateY(0);
            opacity: 0;
        }
        10% {
            opacity: 0.5;
        }
        90% {
            opacity: 0.5;
        }
        100% {
            transform: translateY(75px);
            opacity: 0;
        }
    }
    
    @media (prefers-reduced-motion: reduce) {
        .nav-snowflake {
            animation: none;
            opacity: 0.3;
            top: 30px;
        }
    }
</style>
