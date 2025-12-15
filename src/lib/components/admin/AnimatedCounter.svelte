<script>
    // Phase 9.2 - UI Polish: Animated Counter with Apple-style transitions
    import { onMount } from 'svelte';
    import { tweened } from 'svelte/motion';
    import { cubicOut } from 'svelte/easing';

    export let value = 0;
    export let duration = 800;
    export let format = 'number'; // number, percent, currency, compact
    export let prefix = '';
    export let suffix = '';
    export let decimals = 0;
    export let animate = true;
    export let size = 'md'; // sm, md, lg, xl
    export let color = 'default'; // default, accent, success, warning, error

    const displayValue = tweened(0, {
        duration: animate ? duration : 0,
        easing: cubicOut
    });

    $: displayValue.set(value);

    $: formattedValue = formatValue($displayValue);

    function formatValue(val) {
        switch (format) {
            case 'percent':
                return `${val.toFixed(decimals)}%`;
            case 'currency':
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals
                }).format(val);
            case 'compact':
                if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
                return val.toFixed(decimals);
            default:
                return val.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        }
    }

    const sizeClasses = {
        sm: 'text-sm',
        md: 'text-md',
        lg: 'text-lg',
        xl: 'text-xl'
    };

    const colorClasses = {
        default: 'color-default',
        accent: 'color-accent',
        success: 'color-success',
        warning: 'color-warning',
        error: 'color-error'
    };
</script>

<span class="animated-counter {sizeClasses[size]} {colorClasses[color]}">
    {#if prefix}<span class="prefix">{prefix}</span>{/if}
    <span class="value">{formattedValue}</span>
    {#if suffix}<span class="suffix">{suffix}</span>{/if}
</span>

<style>
    .animated-counter {
        display: inline-flex;
        align-items: baseline;
        gap: 2px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.02em;
    }

    .prefix, .suffix {
        font-weight: 500;
        opacity: 0.7;
    }

    .value {
        transition: color 0.3s ease;
    }

    /* Sizes */
    .text-sm {
        font-size: 18px;
    }

    .text-sm .prefix, .text-sm .suffix {
        font-size: 14px;
    }

    .text-md {
        font-size: 28px;
    }

    .text-md .prefix, .text-md .suffix {
        font-size: 18px;
    }

    .text-lg {
        font-size: 36px;
    }

    .text-lg .prefix, .text-lg .suffix {
        font-size: 22px;
    }

    .text-xl {
        font-size: 48px;
    }

    .text-xl .prefix, .text-xl .suffix {
        font-size: 28px;
    }

    /* Colors */
    .color-default {
        color: var(--theme-text, var(--apple-black));
    }

    .color-accent {
        color: var(--apple-accent);
    }

    .color-success {
        color: var(--apple-green);
    }

    .color-warning {
        color: var(--apple-orange);
    }

    .color-error {
        color: var(--apple-red);
    }

    /* Responsive */
    @media (max-width: 768px) {
        .text-lg {
            font-size: 28px;
        }
        .text-xl {
            font-size: 36px;
        }
    }

    @media (max-width: 480px) {
        .text-md {
            font-size: 22px;
        }
        .text-lg {
            font-size: 24px;
        }
        .text-xl {
            font-size: 28px;
        }
    }
</style>
