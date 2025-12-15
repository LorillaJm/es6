// src/lib/stores/impersonation.js
// Admin Impersonation Mode - Phase 8.3
// Allows admin to view the app as a specific user for troubleshooting

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

const IMPERSONATION_KEY = 'admin-impersonation';

/**
 * Impersonation state
 */
function createImpersonationStore() {
    const defaultState = {
        isActive: false,
        targetUser: null,
        adminId: null,
        adminName: null,
        startedAt: null,
        reason: '',
        actions: [] // Log of actions taken while impersonating
    };

    const stored = browser ? JSON.parse(sessionStorage.getItem(IMPERSONATION_KEY) || 'null') : null;
    const initialState = stored || defaultState;

    const { subscribe, set, update } = writable(initialState);

    return {
        subscribe,

        /**
         * Start impersonation session
         */
        start: (adminId, adminName, targetUser, reason = '') => {
            const state = {
                isActive: true,
                targetUser: {
                    id: targetUser.id,
                    name: targetUser.name || targetUser.displayName,
                    email: targetUser.email,
                    role: targetUser.role,
                    department: targetUser.department,
                    year: targetUser.year,
                    section: targetUser.section,
                    profilePhoto: targetUser.profilePhoto
                },
                adminId,
                adminName,
                startedAt: new Date().toISOString(),
                reason,
                actions: []
            };

            if (browser) {
                sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(state));
            }

            set(state);
            return true;
        },

        /**
         * End impersonation session
         */
        end: () => {
            if (browser) {
                sessionStorage.removeItem(IMPERSONATION_KEY);
            }
            set(defaultState);
        },

        /**
         * Log an action taken during impersonation
         */
        logAction: (action, details = {}) => {
            update(state => {
                if (!state.isActive) return state;

                const newAction = {
                    action,
                    details,
                    timestamp: new Date().toISOString()
                };

                const newState = {
                    ...state,
                    actions: [...state.actions, newAction]
                };

                if (browser) {
                    sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(newState));
                }

                return newState;
            });
        },

        /**
         * Get session duration
         */
        getDuration: () => {
            let duration = 0;
            const unsubscribe = subscribe(state => {
                if (state.isActive && state.startedAt) {
                    duration = Date.now() - new Date(state.startedAt).getTime();
                }
            });
            unsubscribe();
            return duration;
        },

        /**
         * Check if impersonation is allowed (admin only)
         */
        canImpersonate: (adminRole) => {
            return adminRole === 'super_admin' || adminRole === 'admin';
        }
    };
}

export const impersonationStore = createImpersonationStore();

/**
 * Derived store for impersonation status
 */
export const isImpersonating = derived(
    impersonationStore,
    $state => $state.isActive
);

/**
 * Derived store for impersonated user
 */
export const impersonatedUser = derived(
    impersonationStore,
    $state => $state.isActive ? $state.targetUser : null
);

/**
 * Format impersonation duration
 */
export function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}
