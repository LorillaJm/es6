<script>
    import { goto } from '$app/navigation';
    import { db, USER_PROFILE_PATH } from "$lib/firebase";
    import { ref, set } from 'firebase/database';
    import { IconUserPlus, IconCheck, IconArrowRight, IconMail } from "@tabler/icons-svelte";

    export let user;
    export let onProfileComplete;

    let formData = {
        name: user.displayName || '',
        email: user.email || '',
        year: '',
        departmentOrCourse: '',
        section: ''
    };
    let isSaving = false;
    let saveError = '';
    let profileSaved = false;
    let needsEmailVerification = false;

    async function saveProfile() {
        if (isSaving) return;
        isSaving = true;
        saveError = '';
        try {
            if (!formData.name || !formData.year || !formData.departmentOrCourse || !formData.section) {
                throw new Error("Please fill in all required fields.");
            }
            const uid = user.uid;
            const userProfileRef = ref(db, `${USER_PROFILE_PATH}/${uid}`);
            const profileData = {
                name: formData.name,
                year: formData.year,
                departmentOrCourse: formData.departmentOrCourse,
                section: formData.section,
                email: user.email,
                googleName: user.displayName,
                googleId: uid,
                picture: user.photoURL,
                emailVerified: false, // Mark as not verified initially
                createdAt: new Date().toISOString()
            };
            await set(userProfileRef, profileData);
            profileSaved = true;
            needsEmailVerification = true;
            onProfileComplete(profileData);
        } catch (error) {
            console.error("Failed to save profile:", error);
            saveError = error.message;
        } finally {
            isSaving = false;
        }
    }

    function goToVerification() {
        goto('/verify-email');
    }
</script>

<div class="profile-form-card apple-animate-in">
    {#if profileSaved}
        <div class="success-state">
            <div class="success-icon" class:verify-icon={needsEmailVerification}>
                {#if needsEmailVerification}
                    <IconMail size={32} stroke={2} />
                {:else}
                    <IconCheck size={32} stroke={2} />
                {/if}
            </div>
            <h2 class="success-title">
                {#if needsEmailVerification}
                    One More Step!
                {:else}
                    Profile Complete!
                {/if}
            </h2>
            <p class="success-text">
                {#if needsEmailVerification}
                    Please verify your email to complete registration.
                {:else}
                    Your profile has been saved successfully.
                {/if}
            </p>
            {#if needsEmailVerification}
                <button class="success-btn verify-btn" on:click={goToVerification}>
                    <span>Verify Email</span>
                    <IconArrowRight size={20} stroke={2} />
                </button>
            {:else}
                <a href="/app/dashboard" class="success-btn">
                    <span>Go to Dashboard</span>
                    <IconArrowRight size={20} stroke={2} />
                </a>
            {/if}
        </div>
    {:else}
        <div class="form-header">
            <div class="header-icon"><IconUserPlus size={28} stroke={1.5} /></div>
            <h2 class="form-title">Complete Your Profile</h2>
            <p class="form-subtitle">This one-time setup is required to access the system.</p>
        </div>

        {#if saveError}
            <div class="error-alert apple-animate-in">
                <span>{saveError}</span>
            </div>
        {/if}

        <form on:submit|preventDefault={saveProfile} class="profile-form">
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

            <button type="submit" class="submit-btn" disabled={isSaving}>
                {#if isSaving}
                    <div class="btn-spinner"></div>
                    <span>Saving Profile...</span>
                {:else}
                    <IconCheck size={20} stroke={2} />
                    <span>Save and Continue</span>
                {/if}
            </button>
        </form>
    {/if}
</div>

<style>
    .profile-form-card { width: 100%; max-width: 420px; background: var(--apple-white); border-radius: var(--apple-radius-xl); box-shadow: var(--apple-shadow-lg); padding: clamp(28px, 5vw, 40px); }
    .form-header { text-align: center; margin-bottom: 28px; }
    .header-icon { width: 64px; height: 64px; margin: 0 auto 16px; border-radius: 16px; background: linear-gradient(135deg, var(--apple-accent), #5856D6); display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 8px 24px rgba(0, 122, 255, 0.25); }
    .form-title { font-size: 24px; font-weight: 700; color: var(--apple-black); margin-bottom: 8px; }
    .form-subtitle { font-size: 14px; color: var(--apple-gray-1); }
    .error-alert { padding: 14px 18px; background: rgba(255, 59, 48, 0.1); border: 1px solid rgba(255, 59, 48, 0.2); border-radius: var(--apple-radius-md); color: #C41E16; font-size: 14px; margin-bottom: 20px; }
    .profile-form { display: flex; flex-direction: column; gap: 18px; }
    .form-group { display: flex; flex-direction: column; gap: 8px; }
    .form-label { font-size: 14px; font-weight: 500; color: var(--apple-gray-1); }
    .form-input { width: 100%; padding: 14px 16px; border: 1px solid var(--apple-gray-4); border-radius: var(--apple-radius-md); font-size: 16px; color: var(--apple-black); background: var(--apple-white); transition: var(--apple-transition); }
    .form-input:focus { outline: none; border-color: var(--apple-accent); box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15); }
    .form-input::placeholder { color: var(--apple-gray-3); }
    .submit-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 16px 24px; background: var(--apple-accent); color: white; font-size: 16px; font-weight: 600; border: none; border-radius: var(--apple-radius-md); cursor: pointer; transition: var(--apple-transition); margin-top: 8px; }
    .submit-btn:hover:not(:disabled) { background: var(--apple-accent-hover); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0, 122, 255, 0.3); }
    .submit-btn:disabled { background: var(--apple-gray-3); cursor: not-allowed; }
    .btn-spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .success-state { text-align: center; padding: 20px 0; }
    .success-icon { width: 72px; height: 72px; margin: 0 auto 20px; border-radius: 50%; background: rgba(52, 199, 89, 0.1); display: flex; align-items: center; justify-content: center; color: var(--apple-green); }
    .success-icon.verify-icon { background: rgba(0, 122, 255, 0.1); color: var(--apple-accent); }
    .success-title { font-size: 24px; font-weight: 700; color: var(--apple-black); margin-bottom: 8px; }
    .success-text { font-size: 15px; color: var(--apple-gray-1); margin-bottom: 28px; }
    .success-btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; background: var(--apple-accent); color: white; font-size: 16px; font-weight: 600; border-radius: var(--apple-radius-md); text-decoration: none; transition: var(--apple-transition); border: none; cursor: pointer; }
    .success-btn:hover { background: var(--apple-accent-hover); transform: translateY(-1px); }
    .verify-btn { background: linear-gradient(135deg, #FF9500, #FF6B00); }
    .verify-btn:hover { background: linear-gradient(135deg, #e68600, #e65c00); }
</style>
