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
    let profileCheckFailed = false;

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
        profileCheckFailed = false;

        if (user) {
            try {
                await user.getIdToken();
                
                // Add timeout to prevent infinite loading (3s)
                const profilePromise = getUserProfile(user.uid);
                const timeoutPromise = new Promise((resolve) => 
                    setTimeout(() => resolve('TIMEOUT'), 3000)
                );
                
                const result = await Promise.race([profilePromise, timeoutPromise]);
                
                if (result === 'TIMEOUT') {
                    console.warn('Profile fetch timed out - assuming existing user');
                    profileCheckFailed = true;
                    userProfile = { displayName: user.displayName }; // Minimal profile to proceed
                } else {
                    userProfile = result;
                }
                
                // Check email verification status for first-time users
                if (userProfile && !userProfile.emailVerified && !profileCheckFailed) {
                    try {
                        const isVerified = await checkEmailVerification(user.uid);
                        if (!isVerified) {
                            needsEmailVerification = true;
                        }
                    } catch (e) {
                        console.warn('Email verification check failed:', e.message);
                    }
                }
            } catch (error) {
                console.error("Error checking profile:", error);
                profileCheckFailed = true;
                userProfile = { displayName: user.displayName }; // Allow user to proceed
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
    <!-- Apple Minimal Gradient Background -->
    <div class="bg-base"></div>
    <div class="bg-glow glow-1"></div>
    <div class="bg-glow glow-2"></div>
    
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
    /* Apple Minimal Gradient - Premium, Calm, Modern */
    .login-page {
        min-height: 100vh;
        min-height: 100dvh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        position: relative;
        overflow: hidden;
    }

    /* Base gradient background */
    .bg-base {
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, #E9EFFD 0%, #F5F7FA 50%, #F5F7FA 100%);
    }

    /* Subtle blue accent glows */
    .bg-glow {
        position: absolute;
        border-radius: 50%;
        filter: blur(120px);
        pointer-events: none;
    }

    .glow-1 {
        width: 600px;
        height: 600px;
        background: rgba(0, 122, 255, 0.08);
        top: -20%;
        right: -10%;
        animation: glowFloat 20s ease-in-out infinite;
    }

    .glow-2 {
        width: 500px;
        height: 500px;
        background: rgba(0, 122, 255, 0.06);
        bottom: -15%;
        left: -10%;
        animation: glowFloat 25s ease-in-out infinite reverse;
    }

    @keyframes glowFloat {
        0%, 100% { transform: translate(0, 0); }
        50% { transform: translate(30px, 20px); }
    }

    .login-container {
        width: 100%;
        max-width: 400px;
        position: relative;
        z-index: 10;
    }

    /* Clean Apple-style Card */
    .login-card {
        background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.8);
        box-shadow: 
            0 4px 24px rgba(0, 0, 0, 0.06),
            0 1px 2px rgba(0, 0, 0, 0.04);
        padding: clamp(32px, 6vw, 44px);
        animation: cardAppear 0.5s ease-out;
    }

    @keyframes cardAppear {
        from {
            opacity: 0;
            transform: translateY(16px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    /* Loading State */
    .loading-content {
        text-align: center;
        padding: 24px 0;
    }

    .loading-content .apple-spinner {
        margin: 0 auto 20px;
    }

    .loading-title {
        font-size: 17px;
        font-weight: 600;
        color: #1d1d1f;
        margin-bottom: 6px;
    }

    .loading-subtitle {
        font-size: 14px;
        color: #86868b;
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
        background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        box-shadow: 0 8px 24px rgba(0, 122, 255, 0.25);
    }

    .login-title {
        font-size: clamp(26px, 5vw, 30px);
        font-weight: 600;
        color: #1d1d1f;
        margin-bottom: 8px;
        letter-spacing: -0.3px;
    }

    .login-subtitle {
        font-size: 15px;
        color: #86868b;
        line-height: 1.5;
    }

    /* User Profile Section */
    .user-profile-section {
        background: #F5F5F7;
        border-radius: 14px;
        padding: 24px;
        text-align: center;
        margin-bottom: 16px;
    }

    .user-avatar-wrapper {
        position: relative;
        width: 80px;
        height: 80px;
        margin: 0 auto 14px;
    }

    .user-avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        object-fit: cover;
        border: 3px solid #fff;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .user-avatar-placeholder {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }

    .avatar-status {
        position: absolute;
        bottom: 2px;
        right: 2px;
        width: 16px;
        height: 16px;
        background: #34C759;
        border: 3px solid #F5F5F7;
        border-radius: 50%;
    }

    .avatar-status.unverified {
        background: #FF9500;
    }

    .verification-notice {
        background: rgba(255, 149, 0, 0.1);
        border-radius: 10px;
        padding: 12px 16px;
        margin-bottom: 16px;
    }

    .notice-text {
        font-size: 14px;
        color: #c27800;
        margin: 0;
    }

    .verify-btn {
        background: linear-gradient(135deg, #FF9500 0%, #FF6B00 100%);
        border: none;
        cursor: pointer;
    }

    .verify-btn:hover {
        box-shadow: 0 6px 20px rgba(255, 149, 0, 0.35);
    }

    .user-name {
        font-size: 20px;
        font-weight: 600;
        color: #1d1d1f;
        margin-bottom: 4px;
    }

    .user-email {
        font-size: 14px;
        color: #86868b;
        margin-bottom: 20px;
    }

    /* Dashboard Button */
    .dashboard-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 14px 24px;
        background: #007AFF;
        color: white;
        font-size: 16px;
        font-weight: 600;
        border-radius: 12px;
        text-decoration: none;
        transition: all 0.2s ease;
        border: none;
        cursor: pointer;
    }

    .dashboard-btn:hover {
        background: #0066d6;
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
        color: #86868b;
        font-size: 15px;
        font-weight: 500;
        border: 1px solid #d2d2d7;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .logout-btn:hover {
        background: #F5F5F7;
        color: #1d1d1f;
        border-color: #c7c7cc;
    }

    /* Google Button */
    .google-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        width: 100%;
        padding: 14px 24px;
        background: #fff;
        color: #1d1d1f;
        font-size: 16px;
        font-weight: 600;
        border: 1px solid #d2d2d7;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .google-btn:hover {
        background: #F5F5F7;
        border-color: #c7c7cc;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
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
        border-radius: 10px;
        margin-bottom: 20px;
        color: #FF3B30;
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
        color: #86868b;
    }

    /* Responsive Adjustments */
    @media (max-width: 480px) {
        .login-page {
            padding: 16px;
        }

        .login-card {
            padding: 28px 24px;
            border-radius: 16px;
        }

        .logo-icon {
            width: 56px;
            height: 56px;
            border-radius: 14px;
        }

        .user-profile-section {
            padding: 20px;
        }

        .user-avatar-wrapper,
        .user-avatar,
        .user-avatar-placeholder {
            width: 68px;
            height: 68px;
        }

        .glow-1 { width: 400px; height: 400px; }
        .glow-2 { width: 350px; height: 350px; }
    }

    @media (max-width: 360px) {
        .login-card {
            padding: 24px 20px;
        }

        .login-title {
            font-size: 24px;
        }

        .dashboard-btn,
        .google-btn {
            padding: 12px 20px;
            font-size: 15px;
        }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
        .bg-glow {
            animation: none;
        }
        
        .login-card {
            animation: none;
        }
    }
</style>
