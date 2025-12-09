<script>
    import { activeHoliday, seasonalConfig } from '$lib/stores/seasonalTheme.js';
    
    export let size = 44;  // Avatar size in pixels
    export let src = '';   // Profile image source
    export let fallback = 'U';  // Fallback letter
    
    // Holiday-specific hat/decoration overlays
    const hatDecorations = {
        christmas: { emoji: '🎅', position: 'top', offset: -8 },
        halloween: { emoji: '🎃', position: 'top', offset: -6 },
        newYear: { emoji: '🎩', position: 'top', offset: -10 },
        valentine: { emoji: '💕', position: 'top-right', offset: -4 },
        independence: { emoji: '🇵🇭', position: 'top-right', offset: -4 },
        eid: { emoji: '🌙', position: 'top-right', offset: -4 }
    };
    
    // Frame styles per holiday
    const frameStyles = {
        christmas: 'linear-gradient(135deg, #C41E3A, #228B22)',
        halloween: 'linear-gradient(135deg, #FF6600, #6B2D8B)',
        newYear: 'linear-gradient(135deg, #FFD700, #C0C0C0)',
        valentine: 'linear-gradient(135deg, #E91E63, #F8BBD9)',
        independence: 'linear-gradient(135deg, #0038A8, #CE1126, #FCD116)',
        eid: 'linear-gradient(135deg, #C9A227, #1B4D3E)'
    };
    
    $: hat = $activeHoliday ? hatDecorations[$activeHoliday.id] : null;
    $: frame = $activeHoliday ? frameStyles[$activeHoliday.id] : null;
    $: showDecorations = $seasonalConfig?.intensity?.decorations ?? false;
</script>

<div 
    class="profile-badge-wrapper" 
    style="--size: {size}px; --frame: {frame || 'transparent'}"
    class:has-frame={showDecorations && frame}
>
    <!-- Profile Avatar -->
    <div class="avatar-container">
        {#if src}
            <img {src} alt="Profile" class="avatar-image" />
        {:else}
            <div class="avatar-fallback">
                {fallback}
            </div>
        {/if}
    </div>
    
    <!-- Holiday Hat/Decoration -->
    {#if showDecorations && hat}
        <div 
            class="hat-decoration {hat.position}"
            style="--offset: {hat.offset}px"
        >
            {hat.emoji}
        </div>
    {/if}
    
    <!-- Animated Glow Ring -->
    {#if showDecorations && $activeHoliday}
        <div class="glow-ring"></div>
    {/if}
</div>

<style>
    .profile-badge-wrapper {
        position: relative;
        width: var(--size);
        height: var(--size);
        flex-shrink: 0;
    }
    
    .avatar-container {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        overflow: hidden;
        position: relative;
        z-index: 2;
    }
    
    .has-frame .avatar-container {
        padding: 3px;
        background: var(--frame);
    }
    
    .avatar-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
    }
    
    .has-frame .avatar-image {
        border: 2px solid var(--theme-card-bg, white);
    }
    
    .avatar-fallback {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--apple-accent), #5856D6);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: calc(var(--size) * 0.4);
    }
    
    /* Hat Decorations */
    .hat-decoration {
        position: absolute;
        z-index: 3;
        font-size: calc(var(--size) * 0.45);
        animation: hat-bounce 2s ease-in-out infinite;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
    }
    
    .hat-decoration.top {
        top: var(--offset);
        left: 50%;
        transform: translateX(-50%);
    }
    
    .hat-decoration.top-right {
        top: var(--offset);
        right: var(--offset);
    }
    
    /* Glow Ring */
    .glow-ring {
        position: absolute;
        inset: -4px;
        border-radius: 50%;
        background: var(--frame);
        z-index: 1;
        opacity: 0.5;
        animation: glow-pulse 2s ease-in-out infinite;
        filter: blur(4px);
    }
    
    @keyframes hat-bounce {
        0%, 100% { transform: translateX(-50%) translateY(0) rotate(-5deg); }
        50% { transform: translateX(-50%) translateY(-2px) rotate(5deg); }
    }
    
    .hat-decoration.top-right {
        animation: hat-bounce-right 2s ease-in-out infinite;
    }
    
    @keyframes hat-bounce-right {
        0%, 100% { transform: translateY(0) rotate(-5deg); }
        50% { transform: translateY(-2px) rotate(5deg); }
    }
    
    @keyframes glow-pulse {
        0%, 100% { opacity: 0.3; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.05); }
    }
    
    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
        .hat-decoration,
        .glow-ring {
            animation: none;
        }
        
        .hat-decoration.top {
            transform: translateX(-50%);
        }
        
        .glow-ring {
            opacity: 0.4;
        }
    }
</style>
