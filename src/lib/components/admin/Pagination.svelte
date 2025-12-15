<script>
    // Phase 9.1 & 9.2 - Pagination Component with Apple-style UI
    import { createEventDispatcher } from 'svelte';
    import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight } from '@tabler/icons-svelte';

    export let page = 1;
    export let totalPages = 1;
    export let total = 0;
    export let limit = 20;
    export let showInfo = true;
    export let showPageSize = true;
    export let pageSizeOptions = [10, 20, 50, 100];
    export let compact = false;

    const dispatch = createEventDispatcher();

    $: startItem = (page - 1) * limit + 1;
    $: endItem = Math.min(page * limit, total);
    $: hasNext = page < totalPages;
    $: hasPrev = page > 1;

    // Generate visible page numbers
    $: visiblePages = (() => {
        const pages = [];
        const maxVisible = compact ? 3 : 5;
        
        let start = Math.max(1, page - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        
        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }
        
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        
        return pages;
    })();

    function goToPage(newPage) {
        if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
            dispatch('pageChange', { page: newPage });
        }
    }

    function changePageSize(event) {
        const newLimit = parseInt(event.target.value);
        dispatch('pageSizeChange', { limit: newLimit });
    }
</script>

<div class="pagination" class:compact>
    {#if showInfo}
        <div class="pagination-info">
            {#if total > 0}
                <span class="info-text">
                    Showing <strong>{startItem}</strong> - <strong>{endItem}</strong> of <strong>{total}</strong>
                </span>
            {:else}
                <span class="info-text">No results</span>
            {/if}
        </div>
    {/if}

    <div class="pagination-controls">
        <!-- First page -->
        {#if !compact}
            <button 
                class="page-btn nav-btn"
                disabled={!hasPrev}
                on:click={() => goToPage(1)}
                title="First page"
            >
                <IconChevronsLeft size={16} stroke={2} />
            </button>
        {/if}

        <!-- Previous -->
        <button 
            class="page-btn nav-btn"
            disabled={!hasPrev}
            on:click={() => goToPage(page - 1)}
            title="Previous page"
        >
            <IconChevronLeft size={16} stroke={2} />
        </button>

        <!-- Page numbers -->
        <div class="page-numbers">
            {#if visiblePages[0] > 1}
                <button class="page-btn" on:click={() => goToPage(1)}>1</button>
                {#if visiblePages[0] > 2}
                    <span class="ellipsis">...</span>
                {/if}
            {/if}

            {#each visiblePages as pageNum}
                <button 
                    class="page-btn"
                    class:active={pageNum === page}
                    on:click={() => goToPage(pageNum)}
                >
                    {pageNum}
                </button>
            {/each}

            {#if visiblePages[visiblePages.length - 1] < totalPages}
                {#if visiblePages[visiblePages.length - 1] < totalPages - 1}
                    <span class="ellipsis">...</span>
                {/if}
                <button class="page-btn" on:click={() => goToPage(totalPages)}>{totalPages}</button>
            {/if}
        </div>

        <!-- Next -->
        <button 
            class="page-btn nav-btn"
            disabled={!hasNext}
            on:click={() => goToPage(page + 1)}
            title="Next page"
        >
            <IconChevronRight size={16} stroke={2} />
        </button>

        <!-- Last page -->
        {#if !compact}
            <button 
                class="page-btn nav-btn"
                disabled={!hasNext}
                on:click={() => goToPage(totalPages)}
                title="Last page"
            >
                <IconChevronsRight size={16} stroke={2} />
            </button>
        {/if}
    </div>

    {#if showPageSize && !compact}
        <div class="page-size">
            <label for="pageSize">Per page:</label>
            <select id="pageSize" value={limit} on:change={changePageSize}>
                {#each pageSizeOptions as size}
                    <option value={size}>{size}</option>
                {/each}
            </select>
        </div>
    {/if}
</div>

<style>
    .pagination {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 16px 0;
        flex-wrap: wrap;
    }

    .pagination.compact {
        gap: 12px;
        padding: 12px 0;
    }

    .pagination-info {
        font-size: 13px;
        color: var(--theme-text-secondary, var(--apple-gray-1));
    }

    .info-text strong {
        color: var(--theme-text, var(--apple-black));
        font-weight: 600;
    }

    .pagination-controls {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .page-numbers {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .page-btn {
        min-width: 36px;
        height: 36px;
        padding: 0 10px;
        border: none;
        border-radius: 10px;
        background: var(--theme-border-light, var(--apple-gray-5));
        color: var(--theme-text, var(--apple-black));
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .page-btn:hover:not(:disabled) {
        background: var(--theme-border, var(--apple-gray-4));
    }

    .page-btn:active:not(:disabled) {
        transform: scale(0.95);
    }

    .page-btn.active {
        background: var(--apple-accent);
        color: white;
    }

    .page-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .nav-btn {
        background: transparent;
    }

    .nav-btn:hover:not(:disabled) {
        background: var(--theme-border-light, var(--apple-gray-5));
    }

    .ellipsis {
        padding: 0 8px;
        color: var(--theme-text-secondary, var(--apple-gray-1));
        font-size: 13px;
    }

    .page-size {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--theme-text-secondary, var(--apple-gray-1));
    }

    .page-size select {
        padding: 6px 10px;
        border: 1px solid var(--theme-border, var(--apple-gray-4));
        border-radius: 8px;
        background: var(--theme-card-bg, var(--apple-white));
        color: var(--theme-text, var(--apple-black));
        font-size: 13px;
        cursor: pointer;
        transition: border-color 0.2s ease;
    }

    .page-size select:focus {
        outline: none;
        border-color: var(--apple-accent);
    }

    /* Compact mode */
    .pagination.compact .page-btn {
        min-width: 32px;
        height: 32px;
        font-size: 12px;
        border-radius: 8px;
    }

    .pagination.compact .pagination-info {
        font-size: 12px;
    }

    /* Responsive */
    @media (max-width: 768px) {
        .pagination {
            flex-direction: column;
            gap: 12px;
        }

        .pagination-info {
            order: 2;
        }

        .pagination-controls {
            order: 1;
        }

        .page-size {
            order: 3;
        }
    }

    @media (max-width: 480px) {
        .page-btn {
            min-width: 32px;
            height: 32px;
            padding: 0 8px;
            font-size: 12px;
        }

        .page-numbers {
            gap: 2px;
        }
    }
</style>
