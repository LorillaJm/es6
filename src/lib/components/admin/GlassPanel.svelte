<script>
    // Phase 9.2 - UI Polish: Apple-Style Glassmorphism Panel
    export let variant = 'default'; // default, elevated, subtle, dark
    export let padding = 'md'; // sm, md, lg, xl
    export let rounded = 'lg'; // sm, md, lg, xl
    export let hover = true;
    export let animate = true;
    export let glow = false;
    export let border = true;

    const paddingMap = {
        sm: '12px',
        md: '20px',
        lg: '28px',
        xl: '36px'
    };

    const radiusMap = {
        sm: '12px',
        md: '16px',
        lg: '20px',
        xl: '28px'
    };
</script>

<div 
    class="glass-panel {variant}"
    class:hover-effect={hover}
    class:animate-in={animate}
    class:glow-effect={glow}
    class:with-border={border}
    style="--panel-padding: {paddingMap[padding]}; --panel-radius: {radiusMap[rounded]};"
>
    <slot />
</div>

<style>
    .glass-panel {
        position: relative;
        padding: var(--panel-padding);
        border-radius: var(--panel-radius);
        transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
        overflow: hidden;
    }

    /* Default variant - Light glass */
    .glass-panel.default {
        background: rgba(255, 255, 255, 0.72);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        box-shadow: 
            0 4px 24px rgba(0, 0, 0, 0.06),
            0 1px 2px rgba(0, 0, 0, 0.04),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
    }

    .glass-panel.default.with-border {
        border: 1px solid rgba(255, 255, 255, 0.5);
    }

    /* Elevated variant - More prominent */
    .glass-panel.elevated {
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(24px) saturate(200%);
        -webkit-backdrop-filter: blur(24px) saturate(200%);
        box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.08),
            0 2px 8px rgba(0, 0, 0, 0.04),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
    }

    .glass-panel.elevated.with-border {
        border: 1px solid rgba(255, 255, 255, 0.7);
    }

    /* Subtle variant - Minimal glass */
    .glass-panel.subtle {
        background: rgba(255, 255, 255, 0.5);
        backdrop-filter: blur(12px) saturate(150%);
        -webkit-backdrop-filter: blur(12px) saturate(150%);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
    }

    .glass-panel.subtle.with-border {
        border: 1px solid rgba(255, 255, 255, 0.3);
    }

    /* Dark variant - For dark themes */
    .glass-panel.dark {
        background: rgba(28, 28, 30, 0.75);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        box-shadow: 
            0 4px 24px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }

    .glass-panel.dark.with-border {
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* Hover effect */
    .glass-panel.hover-effect:hover {
        transform: translateY(-2px);
        box-shadow: 
            0 12px 40px rgba(0, 0, 0, 0.1),
            0 4px 12px rgba(0, 0, 0, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
    }

    .glass-panel.dark.hover-effect:hover {
        box-shadow: 
            0 12px 40px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
    }

    /* Glow effect */
    .glass-panel.glow-effect {
        box-shadow: 
            0 4px 24px rgba(0, 0, 0, 0.06),
            0 0 40px rgba(0, 122, 255, 0.08);
    }

    .glass-panel.glow-effect:hover {
        box-shadow: 
            0 12px 40px rgba(0, 0, 0, 0.1),
            0 0 60px rgba(0, 122, 255, 0.12);
    }

    /* Animate in */
    .glass-panel.animate-in {
        animation: glassSlideIn 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
    }

    @keyframes glassSlideIn {
        from {
            opacity: 0;
            transform: translateY(12px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    /* Dark theme support */
    :global([data-theme="dark"]) .glass-panel.default,
    :global([data-theme="amethyst"]) .glass-panel.default,
    :global([data-theme="oled"]) .glass-panel.default {
        background: rgba(28, 28, 30, 0.75);
        border-color: rgba(255, 255, 255, 0.1);
        box-shadow: 
            0 4px 24px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }

    :global([data-theme="dark"]) .glass-panel.elevated,
    :global([data-theme="amethyst"]) .glass-panel.elevated,
    :global([data-theme="oled"]) .glass-panel.elevated {
        background: rgba(44, 44, 46, 0.85);
        border-color: rgba(255, 255, 255, 0.15);
    }

    :global([data-theme="dark"]) .glass-panel.subtle,
    :global([data-theme="amethyst"]) .glass-panel.subtle,
    :global([data-theme="oled"]) .glass-panel.subtle {
        background: rgba(28, 28, 30, 0.5);
        border-color: rgba(255, 255, 255, 0.08);
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
        .glass-panel {
            transition: none;
        }
        .glass-panel.animate-in {
            animation: none;
        }
    }

    /* Mobile optimization */
    @media (max-width: 768px) {
        .glass-panel {
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
        }
    }
</style>
