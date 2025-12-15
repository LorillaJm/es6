<script>
    // Phase 9.2 - UI Polish: Elegant Transition Wrapper
    import { onMount } from 'svelte';
    import { fade, fly, scale, slide } from 'svelte/transition';
    import { cubicOut, elasticOut, backOut } from 'svelte/easing';

    export let type = 'fade'; // fade, fly, scale, slide, spring, stagger
    export let direction = 'up'; // up, down, left, right
    export let duration = 400;
    export let delay = 0;
    export let staggerDelay = 50;
    export let index = 0;
    export let visible = true;
    export let once = true; // Only animate once on mount

    let hasAnimated = false;
    let shouldAnimate = true;

    onMount(() => {
        if (once) {
            hasAnimated = true;
        }
    });

    $: actualDelay = delay + (type === 'stagger' ? index * staggerDelay : 0);

    const flyParams = {
        up: { y: 20, x: 0 },
        down: { y: -20, x: 0 },
        left: { x: 20, y: 0 },
        right: { x: -20, y: 0 }
    };

    function getTransition(node, params) {
        switch (type) {
            case 'fly':
            case 'stagger':
                return fly(node, {
                    ...flyParams[direction],
                    duration,
                    delay: actualDelay,
                    easing: cubicOut
                });
            case 'scale':
                return scale(node, {
                    start: 0.9,
                    duration,
                    delay: actualDelay,
                    easing: backOut
                });
            case 'slide':
                return slide(node, {
                    duration,
                    delay: actualDelay,
                    easing: cubicOut
                });
            case 'spring':
                return scale(node, {
                    start: 0.85,
                    duration: duration * 1.5,
                    delay: actualDelay,
                    easing: elasticOut
                });
            default:
                return fade(node, {
                    duration,
                    delay: actualDelay,
                    easing: cubicOut
                });
        }
    }
</script>

{#if visible}
    <div 
        class="transition-wrapper"
        in:getTransition
        out:fade={{ duration: 200 }}
    >
        <slot />
    </div>
{/if}

<style>
    .transition-wrapper {
        width: 100%;
    }
</style>
