<script>
    import { auth, db, USER_PROFILE_PATH, getUserProfile } from "$lib/firebase";
    import { ref, update } from "firebase/database";
    import { IconUser, IconCheck, IconAlertTriangle, IconPalette, IconBell, IconShieldLock, IconSparkles } from "@tabler/icons-svelte";
    import { onMount } from "svelte";
    import ProfileCustomization from "$lib/components/ProfileCustomization.svelte";
    import NotificationsCenter from "$lib/components/NotificationsCenter.svelte";
    import PrivacySettings from "$lib/components/PrivacySettings.svelte";
    import { SeasonalSettings } from "$lib/components/seasonal";
    import { themeStore } from "$lib/stores/theme.js";

    let user = null;
    let userProfile = null;
    let loading = true;
    let saving = false;
    let saveSuccess = false;
    let saveError = "";
    let activeTab = "info";
    let formData = { name: "", year: "", departmentOrCourse: "", section: "" };

    onMount(async () => {
        themeStore.init();
        user = auth.currentUser;
        if (user) {
            try {
                const profile = await getUserProfile(user.uid);
                userProfile = profile;
                if (profile) {
                    formData = {
                        name: profile.name || user.displayName || "",
                        year: profile.year || "",
                        departmentOrCourse: profile.departmentOrCourse || "",
                        section: profile.section || ""
                    };
                }
            } catch (e) {
                console.error("Error loading profile:", e);
                saveError = "Failed to load profile.";
            }
        }
        loading = false;
    });

    async function updateProfile() {
        if (!user || saving) return;
        saveError = "";
        saveSuccess = false;
        saving = true;
        try {
            if (!formData.name || !formData.year || !formData.departmentOrCourse || !formData.section) {
                throw new Error("All fields are required.");
            }
            const userRef = ref(db, `${USER_PROFILE_PATH}/${user.uid}`);
            await update(userRef, formData);
            saveSuccess = true;
            setTimeout(() => saveSuccess = false, 3000);
        } catch (e) {
            console.error(e);
            saveError = e.message;
        }
        saving = false;
    }
</script>

<svelte:head><title>Profile | Attendance System</title></svelte:head>

<div class="profile-page">
    <div class="profile-content apple-animate-in">
        <header class="page-header">
            <h1 class="page-title">Profile</h1>
            <p class="page-subtitle">Manage your account and preferences</p>
        </header>

        <!-- Tab Navigation -->
        <div class="tab-nav">
            <button 
                class="tab-btn" 
                class:tab-active={activeTab === 'info'}
                on:click={() => activeTab = 'info'}
            >
                <IconUser size={18} stroke={1.5} />
                <span>Profile</span>
            </button>
            <button 
                class="tab-btn" 
                class:tab-active={activeTab === 'customize'}
                on:click={() => activeTab = 'customize'}
            >
                <IconPalette size={18} stroke={1.5} />
                <span>Customize</span>
            </button>
            <button 
                class="tab-btn" 
                class:tab-active={activeTab === 'notifications'}
                on:click={() => activeTab = 'notifications'}
            >
                <IconBell size={18} stroke={1.5} />
                <span>Alerts</span>
            </button>
            <button 
                class="tab-btn" 
                class:tab-active={activeTab === 'privacy'}
                on:click={() => activeTab = 'privacy'}
            >
                <IconShieldLock size={18} stroke={1.5} />
                <span>Privacy</span>
            </button>
            <button 
                class="tab-btn" 
                class:tab-active={activeTab === 'seasonal'}
                on:click={() => activeTab = 'seasonal'}
            >
                <IconSparkles size={18} stroke={1.5} />
                <span>Seasonal</span>
            </button>
        </div>

        {#if loading}
            <div class="profile-card">
                <div class="loading-state">
                    <div class="apple-spinner"></div>
                    <p class="loading-text">Loading profile...</p>
                </div>
            </div>
        {:else}
            <!-- Profile Info Tab -->
            {#if activeTab === 'info'}
                <div class="profile-card apple-animate-in">
                    <div class="card-header">
                        <div class="header-icon"><IconUser size={24} stroke={1.5} /></div>
                        <div class="header-text">
                            <h2 class="card-title">Edit Profile</h2>
                            <p class="card-subtitle">Update your personal information</p>
                        </div>
                    </div>

                    {#if saveSuccess}
                        <div class="alert alert-success apple-animate-in">
                            <IconCheck size={20} stroke={2} />
                            <span>Profile updated successfully!</span>
                        </div>
                    {/if}

                    {#if saveError}
                        <div class="alert alert-error apple-animate-in">
                            <IconAlertTriangle size={20} stroke={2} />
                            <span>{saveError}</span>
                        </div>
                    {/if}

                    <form on:submit|preventDefault={updateProfile} class="profile-form">
                        <div class="form-group">
                            <label for="name" class="form-label">Full Name</label>
                            <input id="name" type="text" class="form-input" bind:value={formData.name} required placeholder="Enter your full name" />
                        </div>

                        <div class="form-group">
                            <label for="year" class="form-label">Year / Level</label>
                            <input id="year" type="text" class="form-input" bind:value={formData.year} required placeholder="e.g., 3rd Year" />
                        </div>

                        <div class="form-group">
                            <label for="course" class="form-label">Department or Course</label>
                            <input id="course" type="text" class="form-input" bind:value={formData.departmentOrCourse} required placeholder="e.g., Computer Science" />
                        </div>

                        <div class="form-group">
                            <label for="section" class="form-label">Section</label>
                            <input id="section" type="text" class="form-input" bind:value={formData.section} required placeholder="e.g., Section A" />
                        </div>

                        <button type="submit" class="submit-btn" disabled={saving}>
                            {#if saving}
                                <div class="btn-spinner"></div>
                                <span>Saving...</span>
                            {:else}
                                <IconCheck size={20} stroke={2} />
                                <span>Update Profile</span>
                            {/if}
                        </button>
                    </form>
                </div>
            {/if}

            <!-- Customization Tab -->
            {#if activeTab === 'customize'}
                <div class="profile-card apple-animate-in">
                    <div class="card-header">
                        <div class="header-icon header-icon-purple"><IconPalette size={24} stroke={1.5} /></div>
                        <div class="header-text">
                            <h2 class="card-title">Customize</h2>
                            <p class="card-subtitle">Personalize your experience</p>
                        </div>
                    </div>

                    <ProfileCustomization {user} {userProfile} />
                </div>
            {/if}

            <!-- Notifications Tab -->
            {#if activeTab === 'notifications'}
                <div class="profile-card apple-animate-in">
                    <div class="card-header">
                        <div class="header-icon header-icon-orange"><IconBell size={24} stroke={1.5} /></div>
                        <div class="header-text">
                            <h2 class="card-title">Notifications & Alerts</h2>
                            <p class="card-subtitle">Manage your notification preferences</p>
                        </div>
                    </div>

                    <NotificationsCenter {user} {userProfile} />
                </div>
            {/if}

            <!-- Privacy Tab -->
            {#if activeTab === 'privacy'}
                <div class="profile-card apple-animate-in">
                    <div class="card-header">
                        <div class="header-icon header-icon-green"><IconShieldLock size={24} stroke={1.5} /></div>
                        <div class="header-text">
                            <h2 class="card-title">Privacy & Data Permissions</h2>
                            <p class="card-subtitle">Control your data and privacy settings</p>
                        </div>
                    </div>

                    <PrivacySettings {user} {userProfile} />
                </div>
            {/if}

            <!-- Seasonal Themes Tab -->
            {#if activeTab === 'seasonal'}
                <div class="apple-animate-in">
                    <SeasonalSettings />
                </div>
            {/if}
        {/if}
    </div>
</div>

<style>
    .profile-page { min-height: 100%; padding: clamp(16px, 4vw, 40px); background: var(--theme-bg, var(--apple-light-bg)); }
    .profile-content { max-width: 640px; margin: 0 auto; }
    .page-header { margin-bottom: clamp(16px, 3vw, 24px); }
    .page-title { font-size: clamp(28px, 5vw, 36px); font-weight: 700; color: var(--theme-text, var(--apple-black)); letter-spacing: -0.5px; margin-bottom: 6px; }
    .page-subtitle { font-size: clamp(14px, 2vw, 16px); color: var(--theme-text-secondary, var(--apple-gray-1)); }
    
    /* Tab Navigation */
    .tab-nav {
        display: flex;
        gap: 6px;
        margin-bottom: 20px;
        padding: 4px;
        background: var(--theme-card-bg, var(--apple-white));
        border-radius: var(--apple-radius-lg);
        box-shadow: var(--apple-shadow-sm);
    }

    .tab-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 12px 8px;
        background: transparent;
        border: none;
        border-radius: var(--apple-radius-md);
        color: var(--theme-text-secondary, var(--apple-gray-1));
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: var(--apple-transition);
    }

    .tab-btn:hover {
        color: var(--theme-text, var(--apple-black));
        background: var(--theme-border-light, var(--apple-gray-6));
    }

    .tab-btn:active {
        transform: scale(0.97);
    }

    .tab-active {
        background: var(--apple-accent);
        color: white !important;
        box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
    }

    .tab-active:hover {
        background: var(--apple-accent-hover);
    }

    /* Hide text on smaller screens, show only icons */
    @media (max-width: 520px) {
        .tab-btn {
            padding: 12px 10px;
        }

        .tab-btn span {
            display: none;
        }

        .tab-btn :global(svg) {
            width: 20px;
            height: 20px;
        }
    }

    /* Show text on larger mobile screens */
    @media (min-width: 521px) {
        .tab-btn span {
            display: inline;
        }
    }

    .profile-card { background: var(--theme-card-bg, var(--apple-white)); border-radius: var(--apple-radius-xl); box-shadow: var(--apple-shadow-md); padding: clamp(24px, 5vw, 36px); }
    .loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; }
    .loading-text { margin-top: 16px; font-size: 15px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    .card-header { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid var(--theme-border-light, var(--apple-gray-5)); }
    .header-icon { width: 48px; height: 48px; border-radius: 14px; background: rgba(0, 122, 255, 0.1); display: flex; align-items: center; justify-content: center; color: var(--apple-accent); }
    .header-icon-purple { background: rgba(175, 82, 222, 0.1); color: #AF52DE; }
    .header-icon-orange { background: rgba(255, 149, 0, 0.1); color: #FF9500; }
    .header-icon-green { background: rgba(52, 199, 89, 0.1); color: #34C759; }
    .card-title { font-size: 20px; font-weight: 600; color: var(--theme-text, var(--apple-black)); margin-bottom: 4px; }
    .card-subtitle { font-size: 14px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    .alert { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-radius: var(--apple-radius-md); margin-bottom: 20px; font-size: 14px; font-weight: 500; }
    .alert-success { background: rgba(52, 199, 89, 0.1); color: #1D7A34; border: 1px solid rgba(52, 199, 89, 0.2); }
    .alert-error { background: rgba(255, 59, 48, 0.1); color: #C41E16; border: 1px solid rgba(255, 59, 48, 0.2); }
    .profile-form { display: flex; flex-direction: column; gap: 20px; }
    .form-group { display: flex; flex-direction: column; gap: 8px; }
    .form-label { font-size: 14px; font-weight: 500; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    .form-input { width: 100%; padding: 14px 16px; border: 1px solid var(--theme-border, var(--apple-gray-4)); border-radius: var(--apple-radius-md); font-size: 16px; color: var(--theme-text, var(--apple-black)); background: var(--theme-card-bg, var(--apple-white)); transition: var(--apple-transition); }
    .form-input:focus { outline: none; border-color: var(--apple-accent); box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15); }
    .form-input::placeholder { color: var(--theme-text-secondary, var(--apple-gray-3)); }
    .submit-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 16px 24px; background: var(--apple-accent); color: white; font-size: 16px; font-weight: 600; border: none; border-radius: var(--apple-radius-md); cursor: pointer; transition: var(--apple-transition); margin-top: 8px; }
    .submit-btn:hover:not(:disabled) { background: var(--apple-accent-hover); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0, 122, 255, 0.3); }
    .submit-btn:disabled { background: var(--apple-gray-3); cursor: not-allowed; }
    .btn-spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
</style>
