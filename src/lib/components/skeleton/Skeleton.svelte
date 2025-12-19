<script>
	/**
	 * Base Skeleton Component
	 * Provides shimmer animation for loading states
	 */
	export let width = '100%';
	export let height = '20px';
	export let borderRadius = '4px';
	export let variant = 'default'; // 'default' | 'circular' | 'text' | 'button'
	export let animate = true;

	$: style = `
		width: ${width};
		height: ${height};
		border-radius: ${variant === 'circular' ? '50%' : borderRadius};
	`;
</script>

<div
	class="skeleton"
	class:skeleton-animate={animate}
	class:skeleton-text={variant === 'text'}
	class:skeleton-button={variant === 'button'}
	class:skeleton-circular={variant === 'circular'}
	{style}
></div>

<style>
	.skeleton {
		background: linear-gradient(
			90deg,
			var(--skeleton-base, #e0e0e0) 25%,
			var(--skeleton-highlight, #f5f5f5) 50%,
			var(--skeleton-base, #e0e0e0) 75%
		);
		background-size: 200% 100%;
	}

	.skeleton-animate {
		animation: shimmer 1.5s infinite ease-in-out;
	}

	.skeleton-text {
		height: 1em;
		margin-bottom: 0.5em;
	}

	.skeleton-button {
		height: 40px;
		border-radius: 8px;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	/* Respect reduced motion preference */
	@media (prefers-reduced-motion: reduce) {
		.skeleton-animate {
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

	/* Dark mode support */
	:global([data-theme='dark']) .skeleton {
		--skeleton-base: #2a2a2a;
		--skeleton-highlight: #3a3a3a;
	}
</style>
