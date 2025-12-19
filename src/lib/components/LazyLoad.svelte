<script>
	/**
	 * Lazy Load Component
	 * Uses Intersection Observer to defer loading until visible
	 */
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import Skeleton from './skeleton/Skeleton.svelte';

	export let threshold = 0.1;
	export let rootMargin = '100px';
	export let once = true;
	export let placeholder = true;
	export let height = '200px';
	export let onVisible = () => {};

	let element;
	let isVisible = false;
	let hasLoaded = false;
	let observer;

	onMount(() => {
		if (!browser) {
			isVisible = true;
			return;
		}

		observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						isVisible = true;
						hasLoaded = true;
						onVisible();

						if (once && observer) {
							observer.unobserve(element);
						}
					} else if (!once) {
						isVisible = false;
					}
				});
			},
			{
				threshold,
				rootMargin
			}
		);

		if (element) {
			observer.observe(element);
		}
	});

	onDestroy(() => {
		if (observer && element) {
			observer.unobserve(element);
		}
	});
</script>

<div bind:this={element} class="lazy-load-container" style="min-height: {isVisible ? 'auto' : height}">
	{#if isVisible || hasLoaded}
		<slot />
	{:else if placeholder}
		<slot name="placeholder">
			<div class="lazy-placeholder">
				<Skeleton width="100%" {height} />
			</div>
		</slot>
	{/if}
</div>

<style>
	.lazy-load-container {
		width: 100%;
	}

	.lazy-placeholder {
		width: 100%;
	}
</style>
