<script>
    // Phase 9.2 - UI Polish: Dynamic Chart with Apple-style animations
    import { onMount, afterUpdate } from 'svelte';
    import { tweened } from 'svelte/motion';
    import { cubicOut } from 'svelte/easing';

    export let data = [];
    export let type = 'bar'; // bar, line, area, donut
    export let height = 200;
    export let showLabels = true;
    export let showValues = true;
    export let showGrid = true;
    export let animate = true;
    export let colors = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF3B30', '#5AC8FA'];
    export let gradientFill = true;

    let chartContainer;
    let mounted = false;
    let animatedData = [];

    // Initialize animated values
    $: if (data.length > 0 && mounted) {
        animatedData = data.map((item, i) => ({
            ...item,
            animatedValue: tweened(0, { duration: animate ? 600 + i * 100 : 0, easing: cubicOut })
        }));
        
        // Trigger animations
        setTimeout(() => {
            animatedData.forEach((item, i) => {
                item.animatedValue.set(data[i].value);
            });
        }, 50);
    }

    $: maxValue = Math.max(...data.map(d => d.value), 1);
    $: chartWidth = chartContainer?.clientWidth || 400;

    onMount(() => {
        mounted = true;
    });

    function getBarHeight(value) {
        return (value / maxValue) * (height - 40);
    }

    function getLinePoints() {
        if (!data.length) return '';
        const segmentWidth = (chartWidth - 60) / (data.length - 1 || 1);
        return data.map((d, i) => {
            const x = 30 + i * segmentWidth;
            const y = height - 20 - getBarHeight(d.value);
            return `${x},${y}`;
        }).join(' ');
    }

    function getAreaPath() {
        if (!data.length) return '';
        const segmentWidth = (chartWidth - 60) / (data.length - 1 || 1);
        let path = `M 30 ${height - 20}`;
        
        data.forEach((d, i) => {
            const x = 30 + i * segmentWidth;
            const y = height - 20 - getBarHeight(d.value);
            path += ` L ${x} ${y}`;
        });
        
        path += ` L ${30 + (data.length - 1) * segmentWidth} ${height - 20} Z`;
        return path;
    }

    function getDonutPath(startAngle, endAngle, radius, innerRadius) {
        const startOuter = polarToCartesian(radius, startAngle);
        const endOuter = polarToCartesian(radius, endAngle);
        const startInner = polarToCartesian(innerRadius, endAngle);
        const endInner = polarToCartesian(innerRadius, startAngle);
        
        const largeArc = endAngle - startAngle > 180 ? 1 : 0;
        
        return [
            `M ${startOuter.x} ${startOuter.y}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
            `L ${startInner.x} ${startInner.y}`,
            `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
            'Z'
        ].join(' ');
    }

    function polarToCartesian(radius, angle) {
        const rad = (angle - 90) * Math.PI / 180;
        return {
            x: 100 + radius * Math.cos(rad),
            y: 100 + radius * Math.sin(rad)
        };
    }

    $: donutSegments = (() => {
        if (type !== 'donut' || !data.length) return [];
        const total = data.reduce((sum, d) => sum + d.value, 0);
        let currentAngle = 0;
        
        return data.map((d, i) => {
            const angle = (d.value / total) * 360;
            const segment = {
                ...d,
                startAngle: currentAngle,
                endAngle: currentAngle + angle,
                color: colors[i % colors.length]
            };
            currentAngle += angle;
            return segment;
        });
    })();
</script>

<div class="dynamic-chart" bind:this={chartContainer}>
    {#if type === 'bar'}
        <svg width="100%" {height} class="chart-svg">
            <!-- Gradient definitions -->
            {#if gradientFill}
                <defs>
                    {#each colors as color, i}
                        <linearGradient id="barGradient{i}" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style="stop-color:{color};stop-opacity:1" />
                            <stop offset="100%" style="stop-color:{color};stop-opacity:0.6" />
                        </linearGradient>
                    {/each}
                </defs>
            {/if}

            <!-- Grid lines -->
            {#if showGrid}
                {#each [0.25, 0.5, 0.75, 1] as ratio}
                    <line 
                        x1="30" 
                        y1={height - 20 - (height - 40) * ratio} 
                        x2={chartWidth - 10} 
                        y2={height - 20 - (height - 40) * ratio}
                        class="grid-line"
                    />
                {/each}
            {/if}

            <!-- Bars -->
            {#each animatedData as item, i}
                {@const barWidth = Math.max(20, (chartWidth - 60) / data.length - 8)}
                {@const x = 30 + i * ((chartWidth - 60) / data.length) + 4}
                <g class="bar-group">
                    <rect
                        {x}
                        y={height - 20 - getBarHeight($item.animatedValue)}
                        width={barWidth}
                        height={getBarHeight($item.animatedValue)}
                        rx="6"
                        fill={gradientFill ? `url(#barGradient${i % colors.length})` : colors[i % colors.length]}
                        class="bar"
                    />
                    {#if showValues}
                        <text
                            x={x + barWidth / 2}
                            y={height - 25 - getBarHeight($item.animatedValue)}
                            class="bar-value"
                        >
                            {Math.round($item.animatedValue)}
                        </text>
                    {/if}
                    {#if showLabels}
                        <text
                            x={x + barWidth / 2}
                            y={height - 4}
                            class="bar-label"
                        >
                            {item.label || ''}
                        </text>
                    {/if}
                </g>
            {/each}
        </svg>

    {:else if type === 'line' || type === 'area'}
        <svg width="100%" {height} class="chart-svg">
            <defs>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:{colors[0]};stop-opacity:0.3" />
                    <stop offset="100%" style="stop-color:{colors[0]};stop-opacity:0.02" />
                </linearGradient>
            </defs>

            <!-- Grid lines -->
            {#if showGrid}
                {#each [0.25, 0.5, 0.75, 1] as ratio}
                    <line 
                        x1="30" 
                        y1={height - 20 - (height - 40) * ratio} 
                        x2={chartWidth - 10} 
                        y2={height - 20 - (height - 40) * ratio}
                        class="grid-line"
                    />
                {/each}
            {/if}

            <!-- Area fill -->
            {#if type === 'area'}
                <path d={getAreaPath()} fill="url(#areaGradient)" class="area-path" />
            {/if}

            <!-- Line -->
            <polyline
                points={getLinePoints()}
                fill="none"
                stroke={colors[0]}
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="line-path"
            />

            <!-- Data points -->
            {#each data as item, i}
                {@const segmentWidth = (chartWidth - 60) / (data.length - 1 || 1)}
                {@const x = 30 + i * segmentWidth}
                {@const y = height - 20 - getBarHeight(item.value)}
                <circle
                    cx={x}
                    cy={y}
                    r="5"
                    fill="white"
                    stroke={colors[0]}
                    stroke-width="2"
                    class="data-point"
                />
                {#if showLabels}
                    <text x={x} y={height - 4} class="point-label">{item.label || ''}</text>
                {/if}
            {/each}
        </svg>

    {:else if type === 'donut'}
        <svg viewBox="0 0 200 200" class="donut-svg" style="height: {height}px;">
            {#each donutSegments as segment, i}
                <path
                    d={getDonutPath(segment.startAngle, segment.endAngle - 0.5, 80, 50)}
                    fill={segment.color}
                    class="donut-segment"
                    style="--delay: {i * 100}ms"
                />
            {/each}
            
            <!-- Center text -->
            <text x="100" y="95" class="donut-total-label">Total</text>
            <text x="100" y="115" class="donut-total-value">
                {data.reduce((sum, d) => sum + d.value, 0)}
            </text>
        </svg>

        <!-- Legend -->
        {#if showLabels}
            <div class="donut-legend">
                {#each donutSegments as segment}
                    <div class="legend-item">
                        <span class="legend-color" style="background: {segment.color}"></span>
                        <span class="legend-label">{segment.label}</span>
                        <span class="legend-value">{segment.value}</span>
                    </div>
                {/each}
            </div>
        {/if}
    {/if}
</div>

<style>
    .dynamic-chart {
        width: 100%;
        position: relative;
    }

    .chart-svg {
        display: block;
        overflow: visible;
    }

    .grid-line {
        stroke: var(--theme-border-light, var(--apple-gray-5));
        stroke-width: 1;
        stroke-dasharray: 4 4;
    }

    .bar {
        transition: opacity 0.2s ease;
    }

    .bar-group:hover .bar {
        opacity: 0.85;
    }

    .bar-value {
        font-size: 11px;
        font-weight: 600;
        fill: var(--theme-text, var(--apple-black));
        text-anchor: middle;
    }

    .bar-label, .point-label {
        font-size: 10px;
        fill: var(--theme-text-secondary, var(--apple-gray-1));
        text-anchor: middle;
    }

    .line-path {
        animation: drawLine 1s ease-out forwards;
        stroke-dasharray: 1000;
        stroke-dashoffset: 1000;
    }

    @keyframes drawLine {
        to {
            stroke-dashoffset: 0;
        }
    }

    .area-path {
        animation: fadeIn 0.8s ease-out forwards;
        opacity: 0;
    }

    @keyframes fadeIn {
        to {
            opacity: 1;
        }
    }

    .data-point {
        transition: transform 0.2s ease;
    }

    .data-point:hover {
        transform: scale(1.3);
    }

    .donut-svg {
        display: block;
        margin: 0 auto;
        max-width: 200px;
    }

    .donut-segment {
        animation: donutGrow 0.6s ease-out forwards;
        animation-delay: var(--delay);
        transform-origin: center;
        opacity: 0;
    }

    @keyframes donutGrow {
        from {
            opacity: 0;
            transform: scale(0.8);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }

    .donut-total-label {
        font-size: 12px;
        fill: var(--theme-text-secondary, var(--apple-gray-1));
        text-anchor: middle;
    }

    .donut-total-value {
        font-size: 24px;
        font-weight: 700;
        fill: var(--theme-text, var(--apple-black));
        text-anchor: middle;
    }

    .donut-legend {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 12px;
        margin-top: 16px;
    }

    .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
    }

    .legend-color {
        width: 10px;
        height: 10px;
        border-radius: 3px;
    }

    .legend-label {
        color: var(--theme-text-secondary, var(--apple-gray-1));
    }

    .legend-value {
        font-weight: 600;
        color: var(--theme-text, var(--apple-black));
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
        .line-path, .area-path, .donut-segment {
            animation: none;
            opacity: 1;
            stroke-dashoffset: 0;
        }
    }
</style>
