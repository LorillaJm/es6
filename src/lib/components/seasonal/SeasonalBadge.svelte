<script>
    import { activeHoliday } from '$lib/stores/seasonalTheme.js';
    
    export let earned = false;
    export let size = 'md';  // sm, md, lg
    
    // Holiday-specific badge designs
    const badges = {
        christmas: { 
            emoji: '🎄', 
            name: 'Holiday Spirit', 
            description: 'Used the app during Christmas season',
            rarity: 'seasonal'
        },
        halloween: { 
            emoji: '🎃', 
            name: 'Spooky Attendee', 
            description: 'Checked in during Halloween week',
            rarity: 'seasonal'
        },
        newYear: { 
            emoji: '🎆', 
            name: 'Fresh Start', 
            description: 'First attendance of the new year',
            rarity: 'rare'
        },
        valentine: { 
            emoji: '💝', 
            name: 'Heart of Gold', 
            description: 'Perfect attendance during Valentine\'s week',
            rarity: 'seasonal'
        },
        independence: { 
            emoji: '🇵🇭', 
            name: 'Patriot', 
            description: 'Attended on Independence Day',
            rarity: 'rare'
        },
        eid: { 
            emoji: '🌙', 
            name: 'Blessed', 
            description: 'Celebrated Eid with the team',
            rarity: 'seasonal'
        }
    };
    
    const rarityColors = {
        seasonal: 'linear-gradient(135deg, #FF9500, #FF2D55)',
        rare: 'linear-gradient(135deg, #AF52DE, #5856D6)',
        legendary: 'linear-gradient(135deg, #FFD700, #FF9500)'
    };
    
    $: badge = $activeHoliday ? badges[$activeHoliday.id] : null;
    $: gradient = badge ? rarityColors[badge.rarity] : rarityColors.seasonal;
</script>

{#if badge}
    <div 
        class="seasonal-badge {size}"
        class:earned
        style="--gradient: {gradient}; --primary: {$activeHoliday?.colors.primary}"
    >
        <div class="badge-icon">
            <span class="badge-emoji">{badge.emoji}</span>
            {#if earned}
                <div class="earned-check">✓</div>
            {/if}
        </div>
        
        {#if size !== 'sm'}
            <div class="badge-info">
                <span class="badge-name">{badge.name}</span>
                {#if size === 'lg'}
                    <span class="badge-desc">{badge.description}</span>
                {/if}
            </div>
        {/if}
        
        {#if !earned}
            <div class="badge-lock">🔒</div>
        {/if}
    </div>
{/if}

<style>
    .seasonal-badge {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: var(--theme-card-bg, white);
        border-radius: var(--apple-radius-lg, 18px);
        border: 2px solid var(--theme-border-light, #E5E5EA);
        position: relative;
        transition: all 0.3s ease;
    }
    
    .seasonal-badge.earned {
        border-color: transparent;
        background: 
            linear-gradient(var(--theme-card-bg, white), var(--theme-card-bg, white)) padding-box,
            var(--gradient) border-box;
        box-shadow: 0 4px 16px color-mix(in srgb, var(--primary) 20%, transparent);
    }
    
    .seasonal-badge:not(.earned) {
        opacity: 0.6;
        filter: grayscale(0.5);
    }
    
    /* Size variants */
    .seasonal-badge.sm {
        padding: 8px;
        gap: 0;
    }
    
    .seasonal-badge.lg {
        padding: 16px 20px;
        gap: 16px;
    }
    
    /* Badge Icon */
    .badge-icon {
        position: relative;
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--theme-border-light, #F2F2F7);
        border-radius: 12px;
    }
    
    .sm .badge-icon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
    }
    
    .lg .badge-icon {
        width: 56px;
        height: 56px;
        border-radius: 14px;
    }
    
    .earned .badge-icon {
        background: var(--gradient);
    }
    
    .badge-emoji {
        font-size: 22px;
    }
    
    .sm .badge-emoji {
        font-size: 18px;
    }
    
    .lg .badge-emoji {
        font-size: 28px;
    }
    
    .earned-check {
        position: absolute;
        bottom: -4px;
        right: -4px;
        width: 18px;
        height: 18px;
        background: var(--apple-green, #34C759);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: white;
        font-weight: bold;
        border: 2px solid var(--theme-card-bg, white);
    }
    
    /* Badge Info */
    .badge-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    
    .badge-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--theme-text, #0A0A0A);
    }
    
    .lg .badge-name {
        font-size: 16px;
    }
    
    .badge-desc {
        font-size: 12px;
        color: var(--theme-text-secondary, #8E8E93);
    }
    
    /* Lock indicator */
    .badge-lock {
        position: absolute;
        top: 8px;
        right: 8px;
        font-size: 12px;
        opacity: 0.5;
    }
    
    /* Hover effect for earned badges */
    .seasonal-badge.earned:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px color-mix(in srgb, var(--primary) 30%, transparent);
    }
    
    /* Animation for newly earned */
    @keyframes badge-shine {
        0% { background-position: -100% 0; }
        100% { background-position: 200% 0; }
    }
    
    .seasonal-badge.earned::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.3) 50%,
            transparent 100%
        );
        background-size: 200% 100%;
        animation: badge-shine 3s ease-in-out infinite;
        pointer-events: none;
    }
    
    @media (prefers-reduced-motion: reduce) {
        .seasonal-badge.earned::after {
            animation: none;
        }
    }
</style>
