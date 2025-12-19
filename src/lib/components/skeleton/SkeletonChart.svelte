<script>
	/**
	 * Chart Skeleton Component
	 */
	import Skeleton from './Skeleton.svelte';

	export let bars = 7;
</script>

<div class="skeleton-chart">
	<div class="skeleton-chart-header">
		<div>
			<Skeleton width="140px" height="18px" />
			<Skeleton width="100px" height="12px" />
		</div>
		<div class="skeleton-legend">
			<Skeleton width="60px" height="12px" />
			<Skeleton width="60px" height="12px" />
		</div>
	</div>

	<div class="skeleton-chart-bars">
		{#each Array(bars) as _, i}
			<div class="skeleton-bar-wrapper">
				<Skeleton width="12px" height="10px" />
				<div class="skeleton-bar-track">
					<Skeleton width="100%" height={`${30 + Math.random() * 60}%`} borderRadius="4px 4px 0 0" />
				</div>
				<Skeleton width="24px" height="12px" />
			</div>
		{/each}
	</div>

	<div class="skeleton-chart-footer">
		{#each Array(3) as _}
			<div class="skeleton-chart-stat">
				<Skeleton width="60px" height="10px" />
				<Skeleton width="40px" height="16px" />
			</div>
		{/each}
	</div>
</div>

<style>
	.skeleton-chart {
		background: var(--theme-card-bg, white);
		border-radius: 16px;
		padding: 20px;
		border: 1px solid var(--theme-border-light, #e5e5e5);
	}

	.skeleton-chart-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 24px;
	}

	.skeleton-chart-header > div:first-child {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.skeleton-legend {
		display: flex;
		gap: 16px;
	}

	.skeleton-chart-bars {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		height: 160px;
		padding: 0 8px;
		margin-bottom: 16px;
	}

	.skeleton-bar-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		flex: 1;
		height: 100%;
	}

	.skeleton-bar-track {
		flex: 1;
		width: 100%;
		max-width: 32px;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}

	.skeleton-chart-footer {
		display: flex;
		justify-content: space-around;
		padding-top: 16px;
		border-top: 1px solid var(--theme-border-light, #e5e5e5);
	}

	.skeleton-chart-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	@media (max-width: 480px) {
		.skeleton-chart-bars {
			height: 120px;
		}
	}
</style>
