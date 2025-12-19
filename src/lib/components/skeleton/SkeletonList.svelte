<script>
	/**
	 * Skeleton List Component
	 * Pre-built skeleton for list layouts
	 */
	import Skeleton from './Skeleton.svelte';

	export let items = 5;
	export let showAvatar = true;
	export let showSecondaryText = true;
	export let showAction = false;
</script>

<div class="skeleton-list">
	{#each Array(items) as _, i}
		<div class="skeleton-list-item">
			{#if showAvatar}
				<Skeleton width="40px" height="40px" variant="circular" />
			{/if}

			<div class="skeleton-list-content">
				<Skeleton width={`${70 + Math.random() * 20}%`} height="16px" />
				{#if showSecondaryText}
					<Skeleton width={`${40 + Math.random() * 30}%`} height="12px" />
				{/if}
			</div>

			{#if showAction}
				<Skeleton width="60px" height="32px" borderRadius="6px" />
			{/if}
		</div>
	{/each}
</div>

<style>
	.skeleton-list {
		display: flex;
		flex-direction: column;
	}

	.skeleton-list-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 0;
		border-bottom: 1px solid var(--theme-border-light, #e5e5e5);
	}

	.skeleton-list-item:last-child {
		border-bottom: none;
	}

	.skeleton-list-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
</style>
