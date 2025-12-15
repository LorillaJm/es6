<script>
    import { onMount } from 'svelte';
    import { 
        IconBrain, IconAlertTriangle, IconClock, IconUserExclamation, 
        IconChevronRight, IconRefresh, IconLoader2, IconTrendingDown,
        IconCalendarEvent, IconMessageCircle, IconUsers
    } from '@tabler/icons-svelte';
    import { StudentRiskLevel, InterventionType } from '$lib/ai/smartRecommendations.js';

    export let recommendations = [];
    export let summary = {};
    export let isLoading = false;
    export let onRefresh = () => {};
    export let onViewStudent = (userId) => {};

    const riskColors = {
        [StudentRiskLevel.LOW]: 'green',
        [StudentRiskLevel.MODERATE]: 'yellow',
        [StudentRiskLevel.HIGH]: 'orange',
        [StudentRiskLevel.CRITICAL]: 'red'
    };

    const riskLabels = {
        [StudentRiskLevel.LOW]: 'Low Risk',
        [StudentRiskLevel.MODERATE]: 'Moderate',
        [StudentRiskLevel.HIGH]: 'High Risk',
        [StudentRiskLevel.CRITICAL]: 'Critical'
    };

    const interventionIcons = {
        [InterventionType.COUNSELING]: IconMessageCircle,
        [InterventionType.SCHEDULE_ADJUSTMENT]: IconCalendarEvent,
        [InterventionType.PARENT_NOTIFICATION]: IconUsers,
        [InterventionType.MENTOR_ASSIGNMENT]: IconUsers,
        [InterventionType.WARNING_NOTICE]: IconAlertTriangle,
        [InterventionType.RECOGNITION]: IconUsers
    };

    $: criticalStudents = recommendations.filter(r => r.riskLevel === StudentRiskLevel.CRITICAL);
    $: highRiskStudents = recommendations.filter(r => r.riskLevel === StudentRiskLevel.HIGH);
    $: displayStudents = [...criticalStudents, ...highRiskStudents].slice(0, 5);
</script>

<div class="recommendations-panel">
    <div class="panel-header">
        <div class="header-title">
            <IconBrain size={18} stroke={1.5} />
            <h3>Smart Recommendations</h3>
            <span class="ai-badge">AI</span>
        </div>
        <button class="refresh-btn" on:click={onRefresh} disabled={isLoading}>
            {#if isLoading}
                <IconLoader2 size={16} stroke={2} class="spin" />
            {:else}
                <IconRefresh size={16} stroke={2} />
            {/if}
        </button>
    </div>

    {#if isLoading}
        <div class="loading-state">
            <IconLoader2 size={24} stroke={1.5} class="spin" />
            <span>Analyzing attendance patterns...</span>
        </div>
    {:else if displayStudents.length === 0}
        <div class="empty-state">
            <IconUsers size={32} stroke={1.5} />
            <p>No students need intervention</p>
            <span>All attendance patterns look healthy</span>
        </div>
    {:else}
        <!-- Summary Stats -->
        <div class="summary-stats">
            <div class="stat-item critical">
                <span class="stat-value">{summary.criticalCases || 0}</span>
                <span class="stat-label">Critical</span>
            </div>
            <div class="stat-item high">
                <span class="stat-value">{summary.highRiskCases || 0}</span>
                <span class="stat-label">High Risk</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">{summary.studentsNeedingIntervention || 0}</span>
                <span class="stat-label">Need Action</span>
            </div>
        </div>

        <!-- Student List -->
        <div class="students-list">
            {#each displayStudents as student}
                <button class="student-card" on:click={() => onViewStudent(student.userId)}>
                    <div class="student-info">
                        <div class="student-avatar">
                            {(student.userName || 'U').charAt(0)}
                        </div>
                        <div class="student-details">
                            <span class="student-name">{student.userName}</span>
                            <span class="student-meta">
                                {student.department || ''} {student.year || ''} {student.section || ''}
                            </span>
                        </div>
                    </div>
                    <div class="student-status">
                        <span class="risk-badge {riskColors[student.riskLevel]}">
                            {riskLabels[student.riskLevel]}
                        </span>
                        <div class="stats-mini">
                            <span class="stat-mini" title="Late arrivals">
                                <IconClock size={12} /> {student.analysis.lateCount}
                            </span>
                            {#if student.analysis.absentCount > 0}
                                <span class="stat-mini absent" title="Absences">
                                    <IconUserExclamation size={12} /> {student.analysis.absentCount}
                                </span>
                            {/if}
                        </div>
                    </div>
                    <IconChevronRight size={16} class="chevron" />
                </button>

                {#if student.recommendations.length > 0}
                    <div class="recommendation-preview">
                        {@const rec = student.recommendations[0]}
                        <svelte:component this={interventionIcons[rec.type] || IconAlertTriangle} size={14} />
                        <span>{rec.title}</span>
                    </div>
                {/if}
            {/each}
        </div>

        {#if recommendations.length > 5}
            <a href="/admin/users?filter=at-risk" class="view-all-link">
                View all {recommendations.length} students
                <IconChevronRight size={14} />
            </a>
        {/if}
    {/if}
</div>

<style>
    .recommendations-panel {
        background: var(--theme-card-bg, var(--apple-white));
        border: 1px solid var(--theme-border, var(--apple-gray-4));
        border-radius: var(--apple-radius-lg);
        overflow: hidden;
    }

    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 16px;
        border-bottom: 1px solid var(--theme-border-light, var(--apple-gray-5));
        background: linear-gradient(135deg, rgba(175, 82, 222, 0.05), rgba(0, 122, 255, 0.05));
    }

    .header-title {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--apple-purple);
    }

    .header-title h3 {
        font-size: 14px;
        font-weight: 600;
        color: var(--theme-text, var(--apple-black));
        margin: 0;
    }

    .ai-badge {
        font-size: 9px;
        font-weight: 700;
        color: var(--apple-purple);
        background: rgba(175, 82, 222, 0.15);
        padding: 2px 6px;
        border-radius: 8px;
    }

    .refresh-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: var(--theme-border-light, var(--apple-gray-6));
        border: none;
        border-radius: 8px;
        color: var(--theme-text-secondary);
        cursor: pointer;
        transition: all 0.2s;
    }

    .refresh-btn:hover:not(:disabled) {
        background: var(--apple-accent);
        color: white;
    }

    .refresh-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .loading-state, .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 32px 16px;
        gap: 8px;
        color: var(--theme-text-secondary);
    }

    .empty-state p {
        font-size: 14px;
        font-weight: 500;
        color: var(--theme-text);
        margin: 0;
    }

    .empty-state span {
        font-size: 12px;
    }

    .summary-stats {
        display: flex;
        gap: 8px;
        padding: 12px 16px;
        border-bottom: 1px solid var(--theme-border-light);
    }

    .stat-item {
        flex: 1;
        text-align: center;
        padding: 8px;
        background: var(--theme-border-light, var(--apple-gray-6));
        border-radius: 8px;
    }

    .stat-item.critical {
        background: rgba(255, 59, 48, 0.1);
    }

    .stat-item.critical .stat-value {
        color: var(--apple-red);
    }

    .stat-item.high {
        background: rgba(255, 149, 0, 0.1);
    }

    .stat-item.high .stat-value {
        color: var(--apple-orange);
    }

    .stat-value {
        display: block;
        font-size: 20px;
        font-weight: 700;
        color: var(--theme-text);
    }

    .stat-label {
        font-size: 10px;
        color: var(--theme-text-secondary);
        text-transform: uppercase;
    }

    .students-list {
        padding: 8px;
    }

    .student-card {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 12px;
        background: none;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        transition: background 0.2s;
        text-align: left;
    }

    .student-card:hover {
        background: var(--theme-border-light, var(--apple-gray-6));
    }

    .student-info {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        min-width: 0;
    }

    .student-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--apple-accent), var(--apple-purple));
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: 14px;
        flex-shrink: 0;
    }

    .student-details {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .student-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--theme-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .student-meta {
        font-size: 11px;
        color: var(--theme-text-secondary);
    }

    .student-status {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
    }

    .risk-badge {
        font-size: 10px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 10px;
    }

    .risk-badge.red {
        background: rgba(255, 59, 48, 0.15);
        color: var(--apple-red);
    }

    .risk-badge.orange {
        background: rgba(255, 149, 0, 0.15);
        color: var(--apple-orange);
    }

    .risk-badge.yellow {
        background: rgba(255, 204, 0, 0.15);
        color: #B8860B;
    }

    .risk-badge.green {
        background: rgba(52, 199, 89, 0.15);
        color: var(--apple-green);
    }

    .stats-mini {
        display: flex;
        gap: 8px;
    }

    .stat-mini {
        display: flex;
        align-items: center;
        gap: 3px;
        font-size: 11px;
        color: var(--theme-text-secondary);
    }

    .stat-mini.absent {
        color: var(--apple-red);
    }

    :global(.chevron) {
        color: var(--theme-text-secondary);
        flex-shrink: 0;
    }

    .recommendation-preview {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: -4px 12px 8px 58px;
        padding: 6px 10px;
        background: rgba(255, 149, 0, 0.08);
        border-radius: 6px;
        font-size: 11px;
        color: var(--apple-orange);
    }

    .view-all-link {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 12px;
        border-top: 1px solid var(--theme-border-light);
        font-size: 13px;
        font-weight: 500;
        color: var(--apple-accent);
        text-decoration: none;
        transition: background 0.2s;
    }

    .view-all-link:hover {
        background: var(--theme-border-light);
    }

    :global(.spin) {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    @media (max-width: 480px) {
        .summary-stats {
            padding: 10px 12px;
        }

        .stat-value {
            font-size: 18px;
        }

        .student-card {
            padding: 10px;
        }

        .student-avatar {
            width: 32px;
            height: 32px;
            font-size: 12px;
        }
    }
</style>
