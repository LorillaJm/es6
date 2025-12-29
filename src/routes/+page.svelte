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
    <!-- Animated Background -->
    <div class="bg-gradient"></div>
    <div class="bg-blob blob-1"></div>
    <div class="bg-blob blob-2"></div>
    <div class="bg-blob blob-3"></div>
    <div class="bg-blob blob-4"></div>
    <div class="bg-noise"></div>
    
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
        min-height: 100dvh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        position: relative;
        overflow: hidden;
        background: #0f0f1a;
    }

    /* Animated Gradient Background */
    .bg-gradient {
        position: absolute;
        inset: 0;
        background: linear-gradient(
            135deg,
            #1a1a2e 0%,
            #16213e 25%,
            #0f3460 50%,
            #1a1a2e 75%,
            #16213e 100%
        );
        background-size: 400% 400%;
        animation: gradientShift 15s ease infinite;
    }

    @keyframes gradientShift {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
    }

    /* Floating Blobs */
    .bg-blob {
        position: absolute;
        border-radius: 50%;
        filter: blur(80px);
        opacity: 0.6;
        animation: float 20s ease-in-out infinite;
    }

    .blob-1 {
        width: 500px;
        height: 500px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        top: -15%;
        left: -10%;
        animation-delay: 0s;
    }

    .blob-2 {
        width: 400px;
        height: 400px;
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        top: 50%;
        right: -15%;
        animation-delay: -5s;
        animation-duration: 25s;
    }

    .blob-3 {
        width: 350px;
        height: 350px;
        background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        bottom: -10%;
        left: 20%;
        animation-delay: -10s;
        animation-duration: 22s;
    }

    .blob-4 {
        width: 300px;
        height: 300px;
        background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
        top: 30%;
        left: 50%;
        animation-delay: -15s;
        animation-duration: 18s;
        opacity: 0.4;
    }

    @keyframes float {
        0%, 100% {
            transform: translate(0, 0) scale(1);
        }
        25% {
            transform: translate(30px, -30px) scale(1.05);
        }
        50% {
            transform: translate(-20px, 20px) scale(0.95);
        }
        75% {
            transform: translate(-30px, -20px) scale(1.02);
        }
    }

    /* Noise Texture Overlay */
    .bg-noise {
        position: absolute;
        inset: 0;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
        opacity: 0.03;
        pointer-events: none;
    }

    .login-container {
        width: 100%;
        max-width: 420px;
        position: relative;
        z-index: 10;
    }

    /* Glassmorphism Card */
    .login-card {
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 24px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        padding: clamp(28px, 5vw, 40px);
        animation: cardAppear 0.6s ease-out;
    }

    @keyframes cardAppear {
        from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }

    /* Loading State */
    .loading-content {
        text-align: center;
        padding: 20px 0;
    }

    .loading-content .apple-spinner {
        margin: 0 auto 20px;
        border-color: rgba(255, 255, 255, 0.2);
        border-top-color: #fff;
    }

    .loading-title {
        font-size: 17px;
        font-weight: 600;
        color: #fff;
        margin-bottom: 6px;
    }

    .loading-subtitle {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.6);
    }

    /* Header */
    .login-header {
        text-align: center;
        margin-bottom: 32px;
    }

    .logo-icon {
        width: 68px;
        height: 68px;
        margin: 0 auto 20px;
        border-radius: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        box-shadow: 
            0 10px 30px rgba(102, 126, 234, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        animation: iconPulse 3s ease-in-out infinite;
    }

    @keyframes iconPulse {
        0%, 100% { box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2); }
        50% { box-shadow: 0 15px 40px rgba(102, 126, 234, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2); }
    }

    .login-title {
        font-size: clamp(26px, 5vw, 32px);
        font-weight: 700;
        color: #fff;
        margin-bottom: 8px;
        letter-spacing: -0.5px;
    }

    .login-subtitle {
        font-size: 15px;
        color: rgba(255, 255, 255, 0.6);
        line-height: 1.5;
    }

    /* User Profile Section */
    .user-profile-section {
        background: rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 28px;
        text-align: center;
        margin-bottom: 16px;
    }

    .user-avatar-wrapper {
        position: relative;
        width: 88px;
        height: 88px;
        margin: 0 auto 16px;
    }

    .user-avatar {
        width: 88px;
        height: 88px;
        border-radius: 50%;
        object-fit: cover;
        border: 3px solid rgba(255, 255, 255, 0.3);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }

    .user-avatar-placeholder {
        width: 88px;
        height: 88px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        border: 3px solid rgba(255, 255, 255, 0.3);
    }

    .avatar-status {
        position: absolute;
        bottom: 4px;
        right: 4px;
        width: 18px;
        height: 18px;
        background: #43e97b;
        border: 3px solid rgba(26, 26, 46, 0.8);
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(67, 233, 123, 0.5);
    }

    .avatar-status.unverified {
        background: #f5576c;
        box-shadow: 0 2px 8px rgba(245, 87, 108, 0.5);
    }

    .verification-notice {
        background: rgba(245, 87, 108, 0.15);
        border: 1px solid rgba(245, 87, 108, 0.3);
        border-radius: 12px;
        padding: 12px 16px;
        margin-bottom: 16px;
    }

    .notice-text {
        font-size: 14px;
        color: #f5576c;
        margin: 0;
    }

    .verify-btn {
        background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%);
        border: none;
        cursor: pointer;
    }

    .verify-btn:hover {
        box-shadow: 0 8px 24px rgba(245, 87, 108, 0.4);
    }

    .user-name {
        font-size: 22px;
        font-weight: 600;
        color: #fff;
        margin-bottom: 4px;
    }

    .user-email {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.5);
        margin-bottom: 24px;
    }

    /* Dashboard Button */
    .dashboard-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 16px 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-size: 16px;
        font-weight: 600;
        border-radius: 14px;
        text-decoration: none;
        transition: all 0.3s ease;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
    }

    .dashboard-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 28px rgba(102, 126, 234, 0.5);
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
        background: rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.7);
        font-size: 15px;
        font-weight: 500;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 14px;
        cursor: pointer;
        transition: all 0.3s ease;
    }

    .logout-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        border-color: rgba(255, 255, 255, 0.2);
    }

    /* Google Button */
    .google-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        width: 100%;
        padding: 16px 24px;
        background: rgba(255, 255, 255, 0.95);
        color: #1a1a2e;
        font-size: 16px;
        font-weight: 600;
        border: none;
        border-radius: 14px;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }

    .google-btn:hover {
        background: #fff;
        transform: translateY(-2px);
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.3);
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
        background: rgba(245, 87, 108, 0.15);
        border: 1px solid rgba(245, 87, 108, 0.3);
        border-radius: 12px;
        margin-bottom: 20px;
        color: #f5576c;
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
        color: rgba(255, 255, 255, 0.4);
    }

    /* Responsive Adjustments */
    @media (max-width: 480px) {
        .login-page {
            padding: 16px;
        }

        .login-card {
            padding: 24px;
            border-radius: 20px;
        }

        .logo-icon {
            width: 60px;
            height: 60px;
            border-radius: 16px;
        }

        .user-profile-section {
            padding: 20px;
        }

        .user-avatar-wrapper,
        .user-avatar,
        .user-avatar-placeholder {
            width: 72px;
            height: 72px;
        }

        .blob-1 { width: 300px; height: 300px; }
        .blob-2 { width: 250px; height: 250px; }
        .blob-3 { width: 200px; height: 200px; }
        .blob-4 { width: 180px; height: 180px; }
    }

    @media (max-width: 360px) {
        .login-card {
            padding: 20px;
        }

        .login-title {
            font-size: 24px;
        }

        .dashboard-btn,
        .google-btn {
            padding: 14px 20px;
            font-size: 15px;
        }
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
        .bg-gradient,
        .bg-blob,
        .logo-icon {
            animation: none;
        }
        
        .login-card {
            animation: none;
        }
    }
</style>
