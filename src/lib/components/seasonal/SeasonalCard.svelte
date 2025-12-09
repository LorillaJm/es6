<script>
    import { activeHoliday, seasonalConfig } from '$lib/stores/seasonalTheme.js';
    
    export let variant = 'default';  // default, stat, feature
    export let hoverable = true;
    
    $: showDecorations = $seasonalConfig?.intensity?.decorations ?? false;
    $: borderGradient = $activeHoliday ? 
        `linear-gradient(135deg, ${$activeHoliday.colors.primary}, ${$activeHoliday.colors.secondary})` : 
        null;
</script>

<div 
    class="seasonal-card {variant}"
    class:hoverable
    class:decorated={showDecorations && $activeHoliday}
    style={showDecorations && borderGradient ? `--border-gradient: ${borderGradient}; --glow-color: ${$activeHoliday?.colors.glow}` : ''}
>
    {#if showDecorations && $activeHoliday}
        <div class="card-corner-decoration top-left">{$activeHoliday.emoji}</div>
    {/if}
    
    <div class="card-content">
        <slot />
    </div>
</div>

<style>
    .seasonal-card {
        position: relative;
        background: var(--theme-card-bg, white);
        border-radius: var(--apple-radius-xl, 22px);
        box-shadow: var(--apple-shadow-md);
        padding: 24px;
        transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
        overflow: hidden;
    }
    
    .seasonal-card.hoverable:hover {
        transform: translateY(-2px);
        box-shadow: var(--apple-shadow-lg);
    }
    
    /* Decorated state with gradient border */
    .seasonal-card.decorated {
        background: 
            linear-gradient(var(--theme-card-bg, white), var(--theme-card-bg, white)) padding-box,
            var(--border-gradient) border-box;
        border: 2px solid transparent;
    }
    
    .seasonal-card.decorated:hover {
        box-shadow: 0 8px 32px var(--glow-color, rgba(0, 0, 0, 0.1));
    }
    
    /* Variants */
    .seasonal-card.stat {
        padding: 20px;
    }
    
    .seasonal-card.feature {
        padding: 28px;
    }
    
    /* Corner decoration */
    .card-corner-decoration {
        position: absolute;
        font-size: 16px;
        opacity: 0.6;
        animation: corner-sparkle 3s ease-in-out infinite;
    }
    
    .card-corner-decoration.top-left {
        top: 8px;
        left: 8px;
    }
    
    .card-content {
        position: relative;
        z-index: 1;
    }
    
    @keyframes corner-sparkle {
        0%, 100% { 
            opacity: 0.4;
            transform: scale(1) rotate(0deg);
        }
        50% { 
            opacity: 0.8;
            transform: scale(1.1) rotate(10deg);
        }
    }
    
    /* Responsive */
    @media (max-width: 480px) {
        .seasonal-card {
            padding: 16px;
            border-radius: var(--apple-radius-lg, 18px);
        }
        
        .card-corner-decoration {
            font-size: 12px;
        }
    }
    
    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
        .seasonal-card {
            transition: none;
        }
        
        .card-corner-decoration {
            animation: none;
            opacity: 0.5;
        }
    }
</style>
