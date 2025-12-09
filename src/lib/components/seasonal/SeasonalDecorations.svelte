<script>
    import { activeHoliday, seasonalConfig } from '$lib/stores/seasonalTheme.js';
    
    // Decoration positions
    const cornerDecorations = {
        christmas: { topLeft: '❄️', topRight: '🎄', bottomLeft: '🎁', bottomRight: '⭐' },
        halloween: { topLeft: '🕸️', topRight: '🎃', bottomLeft: '🦇', bottomRight: '👻' },
        newYear: { topLeft: '🎆', topRight: '✨', bottomLeft: '🥂', bottomRight: '🎊' },
        valentine: { topLeft: '💕', topRight: '💝', bottomLeft: '🌹', bottomRight: '💖' },
        independence: { topLeft: '🇵🇭', topRight: '⭐', bottomLeft: '🎌', bottomRight: '🇵🇭' },
        eid: { topLeft: '🌙', topRight: '✨', bottomLeft: '🕌', bottomRight: '⭐' }
    };
    
    $: decorations = $activeHoliday ? cornerDecorations[$activeHoliday.id] : null;
    $: showDecorations = $seasonalConfig?.intensity?.decorations ?? false;
</script>

{#if $activeHoliday && showDecorations}
    <div class="seasonal-decorations" style={Object.entries($seasonalConfig?.cssVars || {}).map(([k, v]) => `${k}:${v}`).join(';')}>
        <!-- Top Banner -->
        <div class="seasonal-banner">
            <span class="banner-emoji">{$activeHoliday.emoji}</span>
            <span class="banner-text">{$activeHoliday.name}</span>
            <span class="banner-emoji">{$activeHoliday.emoji}</span>
        </div>
        
        <!-- Corner Emojis - only on larger screens -->
        {#if decorations}
            <div class="corner-decoration top-left">{decorations.topLeft}</div>
            <div class="corner-decoration top-right">{decorations.topRight}</div>
        {/if}
    </div>
{/if}

<style>
    .seasonal-decorations {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 9998;
        overflow: hidden;
    }
    
    /* Top Banner */
    .seasonal-banner {
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 20px;
        background: linear-gradient(135deg, 
            var(--seasonal-primary, #007AFF) 0%, 
            var(--seasonal-secondary, #5856D6) 100%
        );
        border-radius: 0 0 14px 14px;
        box-shadow: 0 2px 12px var(--seasonal-glow, rgba(0, 122, 255, 0.25));
    }
    
    .banner-emoji {
        font-size: 16px;
    }
    
    .banner-text {
        font-size: 12px;
        font-weight: 600;
        color: white;
        letter-spacing: 0.3px;
    }
    
    /* Corner Decorations */
    .corner-decoration {
        position: absolute;
        font-size: 24px;
        opacity: 0.5;
        will-change: transform;
        animation: corner-float 4s ease-in-out infinite;
    }
    
    .top-left {
        top: 75px;
        left: 16px;
    }
    
    .top-right {
        top: 75px;
        right: 16px;
        animation-delay: 2s;
    }
    
    @keyframes corner-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
    }
    
    /* Responsive */
    @media (max-width: 768px) {
        .seasonal-banner {
            padding: 5px 14px;
            gap: 6px;
        }
        
        .banner-emoji {
            font-size: 13px;
        }
        
        .banner-text {
            font-size: 10px;
        }
        
        .corner-decoration {
            display: none;
        }
    }
    
    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
        .corner-decoration {
            animation: none;
        }
    }
</style>
