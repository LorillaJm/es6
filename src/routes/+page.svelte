<script>
    import { auth, loginWithGoogle, subscribeToAuth, getUserProfile } from "$lib/firebase";
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import ProfileForm from '$lib/components/ProfileForm.svelte';
    import { IconLock, IconLogin, IconLogout, IconUserCircle, IconArrowRight, IconShieldCheck } from "@tabler/icons-svelte";

    let user = null;
    let isLoading = true;
    let loginError = '';
    let userProfile = null;
    let isCheckingProfile = true;
    let needsEmailVerification = false;

    async function checkEmailVerification(userId) {
        try {
            const response = await fetch(`/api/auth/verify-email/status?userId=${userId}`);
            const data = await response.json();
            return data.verified === true;
        } catch (error) {
            console.error('Error checking email verification:', error);
            return true; // Assume verified on error to not block users
        }
    }

    async function checkAuthAndProfile(u) {
        user = u;
        isCheckingProfile = true;
        userProfile = null;
        needsEmailVerification = false;

        if (user) {
            try {
                await user.getIdToken();
                const profile = await getUserProfile(user.uid);
                userProfile = profile;
                
                // Check email verification status for first-time users
                if (profile && !profile.emailVerified) {
                    const isVerified = await checkEmailVerification(user.uid);
                    if (!isVerified) {
                        needsEmailVerification = true;
                    }
                }
            } catch (error) {
                console.error("Error checking profile:", error);
                loginError = `Error loading profile: ${error.message}`;
            }
        }
        
        isCheckingProfile = false;
        isLoading = false;
    }

    onMount(() => {
        const unsubscribe = subscribeToAuth(checkAuthAndProfile);
        return unsubscribe;
    });

    function handleVerifyEmail() {
        goto('/verify-email');
    }

    async function handleGoogleLogin() {
        loginError = '';
        try {
            await loginWithGoogle();
        } catch (error) {
            console.error("Login failed:", error);
            if (error.code === 'auth/popup-closed-by-user') {
                loginError = 'The sign-in window was closed.';
            } else if (error.code === 'auth/cancelled-popup-request') {
                loginError = 'Authentication request cancelled (please click once).';
            } else if (error.code === 'auth/configuration-not-found') {
                loginError = 'Configuration error: Google Sign-in provider is not enabled.';
            } else {
                loginError = `Login failed: ${error.message}`;
            }
        }
    }

    async function handleLogout() {
        try {
            await auth.signOut();
            user = null; 
            userProfile = null;
            loginError = '';
        } catch (error) {
            console.error("Logout error:", error);
        }
    }
    
    function handleProfileComplete(profileData) {
        userProfile = profileData;
    }
</script>

<svelte:head>
    <title>Student Attendance | Sign In</title>
</svelte:head>

<div class="login-page">
    <!-- Background Pattern -->
    <div class="bg-pattern"></div>
    
    <div class="login-container">
        {#if isLoading || isCheckingProfile}
            <!-- Loading State -->
            <div class="login-card apple-animate-in">
                <div class="loading-content">
                    <div class="apple-spinner"></div>
                    <p class="loading-title">Loading...</p>
                    <p class="loading-subtitle">This should only take a moment</p>
                </div>
            </div>
            
        {:else if user && !userProfile}
            <ProfileForm user={user} onProfileComplete={handleProfileComplete} />

        {:else}
            <div class="login-card apple-animate-in">
                <!-- Logo & Header -->
                <div class="login-header">
                    <div class="logo-icon">
                        <IconShieldCheck size={32} stroke={1.5} />
                    </div>
                    <h1 class="login-title">Welcome Back</h1>
                    <p class="login-subtitle">Sign in to track your class attendance</p>
                </div>

                {#if user}
                    <!-- Logged In State -->
                    <div class="user-profile-section">
                        <div class="user-avatar-wrapper">
                            {#if user.photoURL}
                                <img src={user.photoURL} alt="Profile" class="user-avatar" />
                            {:else}
                                <div class="user-avatar-placeholder">
                                    <IconUserCircle size={48} stroke={1.5} />
                                </div>
                            {/if}
                            <div class="avatar-status" class:unverified={needsEmailVerification}></div>
                        </div>
                        <p class="user-name">{user.displayName}</p>
                        <p class="user-email">{user.email}</p>
                        
                        {#if needsEmailVerification}
                            <!-- Email Verification Required -->
                            <div class="verification-notice">
                                <p class="notice-text">Please verify your email to continue</p>
                            </div>
                            <button class="dashboard-btn verify-btn" on:click={handleVerifyEmail}>
                                <span>Verify Email</span>
                                <IconArrowRight size={20} stroke={2} />
                            </button>
                        {:else}
                            <a href="/app/dashboard" class="dashboard-btn">
                                <span>Go to Dashboard</span>
                                <IconArrowRight size={20} stroke={2} />
                            </a>
                        {/if}
                    </div>

                    <button class="logout-btn" on:click={handleLogout}>
                        <IconLogout size={20} stroke={1.5} />
                        <span>Sign Out</span>
                    </button>
                {:else}
                    <!-- Login State -->
                    {#if loginError}
                        <div class="error-alert apple-animate-in">
                            <svg class="error-icon" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                            </svg>
                            <span>{loginError}</span>
                        </div>
                    {/if}

                    <button class="google-btn" on:click={handleGoogleLogin}>
                        <svg class="google-icon" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span>Sign in with Google</span>
                    </button>

                    <!-- Security Note -->
                    <div class="security-note">
                        <IconLock size={14} stroke={1.5} />
                        <span>Your data is securely protected</span>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    /* Page Layout */
    .login-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: var(--apple-light-bg);
        position: relative;
        overflow: hidden;
    }

    /* Subtle Background Pattern */
    .bg-pattern {
        position: absolute;
        inset: 0;
        background: 
            radial-gradient(circle at 20% 20%, rgba(0, 122, 255, 0.03) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(52, 199, 89, 0.03) 0%, transparent 50%);
        pointer-events: none;
    }

    .login-container {
        width: 100%;
        max-width: 420px;
        position: relative;
        z-index: 1;
    }

    /* Card Styles */
    .login-card {
        background: var(--apple-white);
        border-radius: var(--apple-radius-xl);
        box-shadow: var(--apple-shadow-lg);
        padding: clamp(28px, 5vw, 40px);
    }

    /* Loading State */
    .loading-content {
        text-align: center;
        padding: 20px 0;
    }

    .loading-content .apple-spinner {
        margin: 0 auto 20px;
    }

    .loading-title {
        font-size: 17px;
        font-weight: 600;
        color: var(--apple-black);
        margin-bottom: 6px;
    }

    .loading-subtitle {
        font-size: 14px;
        color: var(--apple-gray-1);
    }

    /* Header */
    .login-header {
        text-align: center;
        margin-bottom: 32px;
    }

    .logo-icon {
        width: 64px;
        height: 64px;
        margin: 0 auto 20px;
        border-radius: 16px;
        background: linear-gradient(135deg, var(--apple-accent), #5856D6);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        box-shadow: 0 8px 24px rgba(0, 122, 255, 0.25);
    }

    .login-title {
        font-size: clamp(26px, 5vw, 32px);
        font-weight: 700;
        color: var(--apple-black);
        margin-bottom: 8px;
        letter-spacing: -0.5px;
    }

    .login-subtitle {
        font-size: 15px;
        color: var(--apple-gray-1);
        line-height: 1.5;
    }

    /* User Profile Section */
    .user-profile-section {
        background: var(--apple-gray-6);
        border-radius: var(--apple-radius-lg);
        padding: 28px;
        text-align: center;
        margin-bottom: 16px;
    }

    .user-avatar-wrapper {
        position: relative;
        width: 80px;
        height: 80px;
        margin: 0 auto 16px;
    }

    .user-avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        object-fit: cover;
        border: 3px solid var(--apple-white);
        box-shadow: var(--apple-shadow-md);
    }

    .user-avatar-placeholder {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--apple-accent), #5856D6);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }

    .avatar-status {
        position: absolute;
        bottom: 4px;
        right: 4px;
        width: 16px;
        height: 16px;
        background: var(--apple-green);
        border: 3px solid var(--apple-white);
        border-radius: 50%;
    }

    .avatar-status.unverified {
        background: var(--apple-orange, #FF9500);
    }

    .verification-notice {
        background: rgba(255, 149, 0, 0.1);
        border: 1px solid rgba(255, 149, 0, 0.3);
        border-radius: var(--apple-radius-md);
        padding: 12px 16px;
        margin-bottom: 16px;
    }

    .notice-text {
        font-size: 14px;
        color: #c27800;
        margin: 0;
    }

    .verify-btn {
        background: linear-gradient(135deg, #FF9500, #FF6B00);
        border: none;
        cursor: pointer;
    }

    .verify-btn:hover {
        background: linear-gradient(135deg, #e68600, #e65c00);
        box-shadow: 0 6px 20px rgba(255, 149, 0, 0.3);
    }

    .user-name {
        font-size: 20px;
        font-weight: 600;
        color: var(--apple-black);
        margin-bottom: 4px;
    }

    .user-email {
        font-size: 14px;
        color: var(--apple-gray-1);
        margin-bottom: 24px;
    }

    /* Dashboard Button */
    .dashboard-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 14px 24px;
        background: var(--apple-accent);
        color: white;
        font-size: 16px;
        font-weight: 600;
        border-radius: var(--apple-radius-md);
        text-decoration: none;
        transition: var(--apple-transition);
    }

    .dashboard-btn:hover {
        background: var(--apple-accent-hover);
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(0, 122, 255, 0.3);
    }

    .dashboard-btn:active {
        transform: translateY(0);
    }

    /* Logout Button */
    .logout-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 14px 24px;
        background: transparent;
        color: var(--apple-gray-1);
        font-size: 15px;
        font-weight: 500;
        border: 1px solid var(--apple-gray-4);
        border-radius: var(--apple-radius-md);
        cursor: pointer;
        transition: var(--apple-transition);
    }

    .logout-btn:hover {
        background: var(--apple-gray-6);
        color: var(--apple-black);
        border-color: var(--apple-gray-3);
    }

    /* Google Button */
    .google-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        width: 100%;
        padding: 14px 24px;
        background: var(--apple-white);
        color: var(--apple-black);
        font-size: 16px;
        font-weight: 600;
        border: 1px solid var(--apple-gray-4);
        border-radius: var(--apple-radius-md);
        cursor: pointer;
        transition: var(--apple-transition);
    }

    .google-btn:hover {
        background: var(--apple-gray-6);
        border-color: var(--apple-gray-3);
        transform: translateY(-1px);
        box-shadow: var(--apple-shadow-md);
    }

    .google-btn:active {
        transform: translateY(0);
    }

    .google-icon {
        width: 20px;
        height: 20px;
    }

    /* Error Alert */
    .error-alert {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        background: rgba(255, 59, 48, 0.08);
        border: 1px solid rgba(255, 59, 48, 0.2);
        border-radius: var(--apple-radius-md);
        margin-bottom: 20px;
        color: #C41E16;
        font-size: 14px;
    }

    .error-icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
    }

    /* Security Note */
    .security-note {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin-top: 24px;
        font-size: 12px;
        color: var(--apple-gray-2);
    }

    /* Responsive Adjustments */
    @media (max-width: 480px) {
        .login-page {
            padding: 16px;
        }

        .login-card {
            padding: 24px;
        }

        .logo-icon {
            width: 56px;
            height: 56px;
        }

        .user-profile-section {
            padding: 20px;
        }

        .user-avatar-wrapper,
        .user-avatar,
        .user-avatar-placeholder {
            width: 64px;
            height: 64px;
        }
    }
</style>
