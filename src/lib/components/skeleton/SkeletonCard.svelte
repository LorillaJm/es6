<script>
	/**
	 * Skeleton Card Component
	 * Pre-built skeleton for card layouts
	 */
	import Skeleton from './Skeleton.svelte';

	export let lines = 3;
	export let showAvatar = false;
	export let showImage = false;
	export let showAction = false;
</script>

<div class="skeleton-card">
	{#if showImage}
		<Skeleton height="160px" borderRadius="8px 8px 0 0" />
	{/if}

	<div class="skeleton-card-content">
		{#if showAvatar}
			<div class="skeleton-header">
				<Skeleton width="48px" height="48px" variant="circular" />
				<div class="skeleton-header-text">
					<Skeleton width="60%" height="16px" />
					<Skeleton width="40%" height="12px" />
				</div>
			</div>
		{/if}

		<div class="skeleton-body">
			{#each Array(lines) as _, i}
				<Skeleton width={i === lines - 1 ? '70%' : '100%'} height="14px" />
			{/each}
		</div>

		{#if showAction}
			<div class="skeleton-actions">
				<Skeleton width="80px" variant="button" />
			</div>
		{/if}
	</div>
</div>

<style>
	.skeleton-card {
		background: var(--theme-card-bg, white);
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid var(--theme-border-light, #e5e5e5);
	}

	.skeleton-card-content {
		padding: 16px;
	}

	.skeleton-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 16px;
	}

	.skeleton-header-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.skeleton-body {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.skeleton-actions {
		margin-top: 16px;
		display: flex;
		justify-content: flex-end;
	}
</style>
