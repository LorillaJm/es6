<script>
    // Phase 9.2 - UI Polish: Loading Skeleton Component
    export let type = 'card'; // card, list, stats, table, text
    export let count = 1;
    export let animate = true;
</script>

<div class="skeleton-container" class:animate>
    {#if type === 'card'}
        {#each Array(count) as _, i}
            <div class="skeleton-card">
                <div class="skeleton-header">
                    <div class="skeleton skeleton-avatar"></div>
                    <div class="skeleton-header-text">
                        <div class="skeleton skeleton-title"></div>
                        <div class="skeleton skeleton-subtitle"></div>
                    </div>
                </div>
                <div class="skeleton-body">
                    <div class="skeleton skeleton-line"></div>
                    <div class="skeleton skeleton-line short"></div>
                </div>
            </div>
        {/each}

    {:else if type === 'stats'}
        <div class="skeleton-stats-grid">
            {#each Array(count) as _, i}
                <div class="skeleton-stat">
                    <div class="skeleton skeleton-stat-icon"></div>
                    <div class="skeleton skeleton-stat-value"></div>
                    <div class="skeleton skeleton-stat-label"></div>
                </div>
            {/each}
        </div>

    {:else if type === 'list'}
        {#each Array(count) as _, i}
            <div class="skeleton-list-item">
                <div class="skeleton skeleton-avatar small"></div>
                <div class="skeleton-list-content">
                    <div class="skeleton skeleton-line"></div>
                    <div class="skeleton skeleton-line short"></div>
                </div>
            </div>
        {/each}

    {:else if type === 'table'}
        <div class="skeleton-table">
            <div class="skeleton-table-header">
                {#each Array(4) as _}
                    <div class="skeleton skeleton-th"></div>
                {/each}
            </div>
            {#each Array(count) as _, i}
                <div class="skeleton-table-row">
                    {#each Array(4) as _}
                        <div class="skeleton skeleton-td"></div>
                    {/each}
                </div>
            {/each}
        </div>

    {:else if type === 'text'}
        {#each Array(count) as _, i}
            <div class="skeleton skeleton-text-line" style="width: {70 + Math.random() * 30}%"></div>
        {/each}
    {/if}
</div>

<style>
    .skeleton-container {
        width: 100%;
    }

    .skeleton {
        background: linear-gradient(
            90deg,
            var(--theme-border-light, var(--apple-gray-5)) 25%,
            var(--theme-card-bg, var(--apple-white)) 50%,
            var(--theme-border-light, var(--apple-gray-5)) 75%
        );
        background-size: 200% 100%;
        border-radius: var(--apple-radius-sm);
    }

    .skeleton-container.animate .skeleton {
        animation: shimmer 1.5s ease-in-out infinite;
    }

    @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }

    /* Card Skeleton */
    .skeleton-card {
        background: var(--theme-card-bg, var(--apple-white));
        border-radius: var(--apple-radius-lg);
        padding: 20px;
        margin-bottom: 16px;
        box-shadow: var(--apple-shadow-sm);
    }

    .skeleton-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
    }

    .skeleton-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .skeleton-avatar.small {
        width: 36px;
        height: 36px;
    }

    .skeleton-header-text {
        flex: 1;
    }

    .skeleton-title {
        height: 18px;
        width: 60%;
        margin-bottom: 8px;
    }

    .skeleton-subtitle {
        height: 14px;
        width: 40%;
    }

    .skeleton-body {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .skeleton-line {
        height: 14px;
        width: 100%;
    }

    .skeleton-line.short {
        width: 70%;
    }

    /* Stats Skeleton */
    .skeleton-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 16px;
    }

    .skeleton-stat {
        background: var(--theme-card-bg, var(--apple-white));
        border-radius: var(--apple-radius-lg);
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        box-shadow: var(--apple-shadow-sm);
    }

    .skeleton-stat-icon {
        width: 48px;
        height: 48px;
        border-radius: 14px;
    }

    .skeleton-stat-value {
        height: 32px;
        width: 80px;
    }

    .skeleton-stat-label {
        height: 14px;
        width: 60px;
    }

    /* List Skeleton */
    .skeleton-list-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid var(--theme-border-light, var(--apple-gray-5));
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

    /* Table Skeleton */
    .skeleton-table {
        width: 100%;
        background: var(--theme-card-bg, var(--apple-white));
        border-radius: var(--apple-radius-lg);
        overflow: hidden;
        box-shadow: var(--apple-shadow-sm);
    }

    .skeleton-table-header {
        display: flex;
        gap: 16px;
        padding: 16px;
        background: var(--theme-border-light, var(--apple-gray-6));
    }

    .skeleton-th {
        height: 14px;
        flex: 1;
    }

    .skeleton-table-row {
        display: flex;
        gap: 16px;
        padding: 16px;
        border-bottom: 1px solid var(--theme-border-light, var(--apple-gray-5));
    }

    .skeleton-table-row:last-child {
        border-bottom: none;
    }

    .skeleton-td {
        height: 16px;
        flex: 1;
    }

    /* Text Skeleton */
    .skeleton-text-line {
        height: 14px;
        margin-bottom: 10px;
    }

    .skeleton-text-line:last-child {
        margin-bottom: 0;
    }

    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
        .skeleton-container.animate .skeleton {
            animation: none;
        }
    }
</style>
