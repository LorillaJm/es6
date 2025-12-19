<script>
	/**
	 * Stats Grid Skeleton Component
	 */
	import Skeleton from './Skeleton.svelte';

	export let count = 4;
</script>

<div class="skeleton-stats-grid">
	{#each Array(count) as _}
		<div class="skeleton-stat-card">
			<Skeleton width="40px" height="40px" borderRadius="10px" />
			<div class="skeleton-stat-content">
				<Skeleton width="60px" height="24px" />
				<Skeleton width="80px" height="12px" />
			</div>
			<Skeleton width="50px" height="20px" borderRadius="10px" />
		</div>
	{/each}
</div>

<style>
	.skeleton-stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 12px;
	}

	.skeleton-stat-card {
		background: var(--theme-card-bg, white);
		border-radius: 12px;
		padding: 16px;
		border: 1px solid var(--theme-border-light, #e5e5e5);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.skeleton-stat-content {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	@media (max-width: 480px) {
		.skeleton-stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
