<script>
	/**
	 * Dashboard Skeleton Component
	 * Complete skeleton for the attendance dashboard
	 */
	import Skeleton from './Skeleton.svelte';
	import SkeletonStats from './SkeletonStats.svelte';
	import SkeletonChart from './SkeletonChart.svelte';
</script>

<div class="skeleton-dashboard">
	<!-- Hero Section -->
	<section class="skeleton-hero">
		<div class="skeleton-hero-content">
			<div class="skeleton-hero-text">
				<Skeleton width="120px" height="16px" />
				<Skeleton width="200px" height="32px" />
				<Skeleton width="180px" height="14px" />
			</div>
			<div class="skeleton-hero-time">
				<Skeleton width="80px" height="48px" borderRadius="8px" />
			</div>
		</div>
		<div class="skeleton-status">
			<Skeleton width="100px" height="28px" borderRadius="14px" />
			<Skeleton width="160px" height="14px" />
		</div>
	</section>

	<!-- Progress Card -->
	<section class="skeleton-progress">
		<div class="skeleton-progress-header">
			<div>
				<Skeleton width="140px" height="18px" />
				<Skeleton width="100px" height="12px" />
			</div>
			<Skeleton width="80px" height="24px" />
		</div>
		<Skeleton width="100%" height="8px" borderRadius="4px" />
		<div class="skeleton-progress-footer">
			<Skeleton width="80px" height="14px" />
			<Skeleton width="100px" height="32px" borderRadius="6px" />
		</div>
	</section>

	<!-- Stats Grid -->
	<SkeletonStats count={4} />

	<!-- Chart Section -->
	<SkeletonChart />

	<!-- Activity Section -->
	<section class="skeleton-activity">
		<div class="skeleton-section-header">
			<Skeleton width="120px" height="18px" />
			<Skeleton width="60px" height="14px" />
		</div>
		<div class="skeleton-activity-list">
			{#each Array(4) as _}
				<div class="skeleton-activity-item">
					<Skeleton width="8px" height="8px" variant="circular" />
					<div class="skeleton-activity-content">
						<Skeleton width="100px" height="14px" />
						<Skeleton width="140px" height="12px" />
					</div>
					<Skeleton width="40px" height="14px" />
				</div>
			{/each}
		</div>
	</section>
</div>

<style>
	.skeleton-dashboard {
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding: 0;
	}

	/* Hero */
	.skeleton-hero {
		background: var(--theme-card-bg, white);
		border-radius: 16px;
		padding: 24px;
		border: 1px solid var(--theme-border-light, #e5e5e5);
	}

	.skeleton-hero-content {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 16px;
	}

	.skeleton-hero-text {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.skeleton-status {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	/* Progress */
	.skeleton-progress {
		background: var(--theme-card-bg, white);
		border-radius: 16px;
		padding: 20px;
		border: 1px solid var(--theme-border-light, #e5e5e5);
	}

	.skeleton-progress-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 16px;
	}

	.skeleton-progress-header > div {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.skeleton-progress-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 12px;
	}

	/* Activity */
	.skeleton-activity {
		background: var(--theme-card-bg, white);
		border-radius: 16px;
		padding: 20px;
		border: 1px solid var(--theme-border-light, #e5e5e5);
	}

	.skeleton-section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.skeleton-activity-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.skeleton-activity-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 0;
	}

	.skeleton-activity-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.skeleton-hero {
			padding: 16px;
		}

		.skeleton-hero-content {
			flex-direction: column;
			gap: 16px;
		}
	}
</style>
