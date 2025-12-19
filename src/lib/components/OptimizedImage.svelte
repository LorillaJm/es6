<script>
	/**
	 * Optimized Image Component
	 * Lazy loads images with placeholder and network-aware quality
	 */
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { connectionQuality } from '$lib/performance/network/networkMonitor.js';

	export let src;
	export let alt = '';
	export let width = null;
	export let height = null;
	export let loading = 'lazy'; // 'lazy' | 'eager'
	export let placeholder = null;
	export let fallback = null;
	export let objectFit = 'cover';
	export let borderRadius = '0';

	let loaded = false;
	let error = false;
	let imgElement;
	let quality = 'high';

	$: if (browser) {
		quality = $connectionQuality === 'slow' ? 'low' : $connectionQuality === 'moderate' ? 'medium' : 'high';
	}

	$: actualSrc = getOptimizedSrc(src, quality);

	function getOptimizedSrc(originalSrc, q) {
		if (!originalSrc) return null;

		// If using a CDN with quality params, modify URL
		// This is a placeholder - implement based on your image CDN
		// Example for Cloudinary: return `${originalSrc}?q=${q === 'low' ? 30 : q === 'medium' ? 60 : 80}`;

		return originalSrc;
	}

	function handleLoad() {
		loaded = true;
	}

	function handleError() {
		error = true;
		if (fallback) {
			actualSrc = fallback;
		}
	}

	onMount(() => {
		if (imgElement?.complete) {
			loaded = true;
		}
	});
</script>

<div
	class="optimized-image-container"
	style="width: {width || '100%'}; height: {height || 'auto'}; border-radius: {borderRadius};"
>
	{#if !loaded && placeholder}
		<div class="image-placeholder" style="background-image: url({placeholder})"></div>
	{:else if !loaded}
		<div class="image-skeleton"></div>
	{/if}

	{#if actualSrc && !error}
		<img
			bind:this={imgElement}
			src={actualSrc}
			{alt}
			{loading}
			class="optimized-image"
			class:loaded
			style="object-fit: {objectFit};"
			on:load={handleLoad}
			on:error={handleError}
			decoding="async"
		/>
	{:else if error && fallback}
		<img src={fallback} {alt} class="optimized-image loaded" style="object-fit: {objectFit};" />
	{:else if error}
		<div class="image-error">
			<span>Failed to load</span>
		</div>
	{/if}
</div>

<style>
	.optimized-image-container {
		position: relative;
		overflow: hidden;
		background: var(--skeleton-base, #e0e0e0);
	}

	.image-placeholder,
	.image-skeleton {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.image-placeholder {
		background-size: cover;
		background-position: center;
		filter: blur(10px);
		transform: scale(1.1);
	}

	.image-skeleton {
		background: linear-gradient(
			90deg,
			var(--skeleton-base, #e0e0e0) 25%,
			var(--skeleton-highlight, #f5f5f5) 50%,
			var(--skeleton-base, #e0e0e0) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite ease-in-out;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	.optimized-image {
		width: 100%;
		height: 100%;
		opacity: 0;
		transition: opacity 300ms ease-out;
	}

	.optimized-image.loaded {
		opacity: 1;
	}

	.image-error {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--skeleton-base, #e0e0e0);
		color: var(--apple-gray-1, #8e8e93);
		font-size: 12px;
	}

	@media (prefers-reduced-motion: reduce) {
		.image-skeleton {
			animation: pulse 2s infinite ease-in-out;
		}

		@keyframes pulse {
			0%,
			100% {
				opacity: 1;
			}
			50% {
				opacity: 0.5;
			}
		}
	}
</style>
