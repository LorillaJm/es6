<script>
	/**
	 * Performance Indicator Component
	 * Shows real-time performance metrics (dev mode only)
	 */
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { performanceMetrics } from '$lib/performance/metrics/performanceTracker.js';
	import { networkState, connectionQuality } from '$lib/performance/network/networkMonitor.js';
	import { IconActivity, IconWifi, IconWifiOff, IconChevronDown, IconChevronUp } from '@tabler/icons-svelte';

	export let show = false; // Only show in dev mode
	export let position = 'bottom-right'; // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

	let expanded = false;
	let metrics = {};
	let network = {};
	let quality = 'fast';

	$: if (browser) {
		metrics = $performanceMetrics;
		network = $networkState;
		quality = $connectionQuality;
	}

	function getScoreColor(score) {
		if (score >= 90) return 'green';
		if (score >= 70) return 'orange';
		return 'red';
	}

	function getScore() {
		let score = 100;
		if (metrics.lcp > 2500) score -= 25;
		else if (metrics.lcp > 1500) score -= 10;
		if (metrics.cls > 0.1) score -= 20;
		else if (metrics.cls > 0.05) score -= 8;
		if (metrics.avgApiLatency > 500) score -= 15;
		else if (metrics.avgApiLatency > 200) score -= 5;
		return Math.max(0, score);
	}

	$: score = getScore();
	$: scoreColor = getScoreColor(score);
</script>

{#if show && browser}
	<div class="perf-indicator {position}" class:expanded>
		<button class="perf-toggle" on:click={() => (expanded = !expanded)}>
			<div class="perf-summary">
				{#if network.online}
					<IconWifi size={14} stroke={2} />
				{:else}
					<IconWifiOff size={14} stroke={2} />
				{/if}
				<span class="perf-score score-{scoreColor}">{score}</span>
				<IconActivity size={14} stroke={2} />
			</div>
			{#if expanded}
				<IconChevronDown size={14} />
			{:else}
				<IconChevronUp size={14} />
			{/if}
		</button>

		{#if expanded}
			<div class="perf-details">
				<div class="perf-section">
					<h4>Core Web Vitals</h4>
					<div class="perf-row">
						<span>LCP</span>
						<span class:warning={metrics.lcp > 2500} class:good={metrics.lcp <= 1500}>
							{metrics.lcp || '-'}ms
						</span>
					</div>
					<div class="perf-row">
						<span>FCP</span>
						<span class:warning={metrics.fcp > 1800} class:good={metrics.fcp <= 1000}>
							{metrics.fcp || '-'}ms
						</span>
					</div>
					<div class="perf-row">
						<span>CLS</span>
						<span class:warning={metrics.cls > 0.1} class:good={metrics.cls <= 0.05}>
							{metrics.cls?.toFixed(3) || '-'}
						</span>
					</div>
					<div class="perf-row">
						<span>FID</span>
						<span class:warning={metrics.fid > 100} class:good={metrics.fid <= 50}>
							{metrics.fid || '-'}ms
						</span>
					</div>
				</div>

				<div class="perf-section">
					<h4>Network</h4>
					<div class="perf-row">
						<span>Status</span>
						<span class:good={network.online} class:warning={!network.online}>
							{network.online ? 'Online' : 'Offline'}
						</span>
					</div>
					<div class="perf-row">
						<span>Type</span>
						<span>{network.effectiveType || '-'}</span>
					</div>
					<div class="perf-row">
						<span>RTT</span>
						<span>{network.rtt || '-'}ms</span>
					</div>
					<div class="perf-row">
						<span>Quality</span>
						<span class="quality-{quality}">{quality}</span>
					</div>
				</div>

				<div class="perf-section">
					<h4>API</h4>
					<div class="perf-row">
						<span>Avg Latency</span>
						<span class:warning={metrics.avgApiLatency > 500} class:good={metrics.avgApiLatency <= 200}>
							{metrics.avgApiLatency || '-'}ms
						</span>
					</div>
					<div class="perf-row">
						<span>Calls</span>
						<span>{metrics.apiCalls?.length || 0}</span>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.perf-indicator {
		position: fixed;
		z-index: 9999;
		font-family: 'SF Mono', Monaco, monospace;
		font-size: 11px;
		background: rgba(0, 0, 0, 0.85);
		color: white;
		border-radius: 8px;
		overflow: hidden;
		backdrop-filter: blur(10px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.bottom-right {
		bottom: 16px;
		right: 16px;
	}
	.bottom-left {
		bottom: 16px;
		left: 16px;
	}
	.top-right {
		top: 16px;
		right: 16px;
	}
	.top-left {
		top: 16px;
		left: 16px;
	}

	.perf-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 12px;
		background: transparent;
		border: none;
		color: white;
		cursor: pointer;
		width: 100%;
	}

	.perf-summary {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.perf-score {
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 4px;
	}

	.score-green {
		background: rgba(52, 199, 89, 0.3);
		color: #34c759;
	}
	.score-orange {
		background: rgba(255, 149, 0, 0.3);
		color: #ff9500;
	}
	.score-red {
		background: rgba(255, 59, 48, 0.3);
		color: #ff3b30;
	}

	.perf-details {
		padding: 0 12px 12px;
		max-height: 300px;
		overflow-y: auto;
	}

	.perf-section {
		margin-bottom: 12px;
	}

	.perf-section:last-child {
		margin-bottom: 0;
	}

	.perf-section h4 {
		font-size: 10px;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.5);
		margin: 0 0 6px;
		letter-spacing: 0.5px;
	}

	.perf-row {
		display: flex;
		justify-content: space-between;
		padding: 3px 0;
	}

	.good {
		color: #34c759;
	}
	.warning {
		color: #ff9500;
	}

	.quality-fast {
		color: #34c759;
	}
	.quality-moderate {
		color: #ff9500;
	}
	.quality-slow {
		color: #ff3b30;
	}
	.quality-offline {
		color: #ff3b30;
	}

	@media (max-width: 480px) {
		.perf-indicator {
			bottom: 80px;
			right: 8px;
		}
	}
</style>
