<!-- 
  PageTransition.svelte
  Apple WWDC-Quality Page Transitions
  
  MOTION PHILOSOPHY:
  - Transitions should feel like natural navigation
  - Content reveals progressively, guiding the eye
  - Exit animations are faster than entrances
  - Staggered elements create depth and hierarchy
-->
<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { page } from '$app/stores';
    import { fly, fade } from 'svelte/transition';
    import { cubicOut, quintOut } from 'svelte/easing';
    import { TIMING, prefersReducedMotion } from '$lib/motion/motionSystem.js';
    
    export let variant = 'default'; // 'default' | 'slide' | 'fade' | 'scale' | 'none'
    export let direction = 'up'; // 'up' | 'down' | 'left' | 'right'
    export let stagger = true;
    export let delay = 0;
    
    let mounted = false;
    let key = '';
    let reducedMotion = false;
    
    // Direction mappings
    const directionMap = {
        up: { x: 0, y: 20 },
        down: { x: 0, y: -20 },
        left: { x: 20, y: 0 },
        right: { x: -20, y: 0 }
    };
    
    // Transition configurations
    const transitions = {
        default: {
            in: { duration: TIMING.MODERATE, easing: cubicOut },
            out: { duration: TIMING.FAST, easing: cubicOut }
        },
        slide: {
            in: { duration: TIMING.SLOW, easing: quintOut },
            out: { duration: TIMING.FAST, easing: cubicOut }
        },
        fade: {
            in: { duration: TIMING.NORMAL, easing: cubicOut },
            out: { duration: TIMING.FAST, easing: cubicOut }
        },
        scale: {
            in: { duration: TIMING.MODERATE, easing: cubicOut },
            out: { duration: TIMING.FAST, easing: cubicOut }
        }
    };
    
    $: config = transitions[variant] || transitions.default;
    $: offset = directionMap[direction] || directionMap.up;
    
    onMount(() => {
        reducedMotion = prefersReducedMotion();
        mounted = true;
    });
    
    // Update key when route changes
    $: if (browser) {
        key = $page.url.pathname;
    }
    
    function getInTransition(node) {
        if (reducedMotion || variant === 'none') {
            return fade(node, { duration: 0 });
        }
        
        if (variant === 'fade') {
            return fade(node, { 
                duration: config.in.duration, 
                delay,
                easing: config.in.easing 
            });
        }
        
        return fly(node, {
            x: offset.x,
            y: offset.y,
            duration: config.in.duration,
            delay,
            easing: config.in.easing
        });
    }
    
    function getOutTransition(node) {
        if (reducedMotion || variant === 'none') {
            return fade(node, { duration: 0 });
        }
        
        return fade(node, {
            duration: config.out.duration,
            easing: config.out.easing
        });
    }
</script>

{#if mounted}
    {#key key}
        <div 
            class="page-transition-wrapper"
            class:stagger-children={stagger}
            in:getInTransition
            out:getOutTransition
        >
            <slot />
        </div>
    {/key}
{:else}
    <div class="page-transition-wrapper">
        <slot />
    </div>
{/if}

<style>
    .page-transition-wrapper {
        width: 100%;
        min-height: 100%;
    }
    
    /* Staggered children animation */
    .stagger-children :global(> *) {
        opacity: 0;
        animation: stagger-reveal 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
    }
    
    .stagger-children :global(> *:nth-child(1)) { animation-delay: 0ms; }
    .stagger-children :global(> *:nth-child(2)) { animation-delay: 50ms; }
    .stagger-children :global(> *:nth-child(3)) { animation-delay: 100ms; }
    .stagger-children :global(> *:nth-child(4)) { animation-delay: 150ms; }
    .stagger-children :global(> *:nth-child(5)) { animation-delay: 200ms; }
    .stagger-children :global(> *:nth-child(6)) { animation-delay: 250ms; }
    .stagger-children :global(> *:nth-child(7)) { animation-delay: 300ms; }
    .stagger-children :global(> *:nth-child(8)) { animation-delay: 350ms; }
    
    @keyframes stagger-reveal {
        from {
            opacity: 0;
            transform: translateY(12px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
        .stagger-children :global(> *) {
            animation: none;
            opacity: 1;
        }
    }
</style>
