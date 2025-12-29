<!--
  Login Page - Apple-Inspired Design
  Student Attendance System
  
  Design Principles:
  - Minimalism: Clean, uncluttered interface
  - Clarity: Clear visual hierarchy and typography
  - Trust: Professional appearance that inspires confidence
  - Performance: Lightweight, fast-loading
  - Accessibility: WCAG compliant, keyboard navigable
-->
<script>
    import { auth, loginWithGoogle, subscribeToAuth, getUserProfile } from "$lib/firebase";
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import ProfileForm from '$lib/components/ProfileForm.svelte';

    // ============================================
    // STATE MANAGEMENT
    // ============================================
    
    /** @type {import('firebase/auth').User | null} */
    let user = null;
    
    /** @type {object | null} */
    let userProfile = null;
    
    /** @type {string} */
    let loginError = '';
    
    /** @type {boolean} */
    let isLoading = true;
    
    /** @type {boolean} */
    let isCheckingProfile = true;
    
    /** @type {boolean} */
    let isLoggingIn = false;
    
    /** @type {boolean} */
    let needsEmailVerification = false;
    
    /** @type {boolean} */
    let profileCheckFailed = false;
    
    /** @type {boolean} */
    let isRedirecting = false;

    // ============================================
    // EMAIL VERIFICATION CHECK
    // ============================================
    
    /**
     * Check if user's email is verified
     * @param {string} userId - Firebase user ID
     * @returns {Promise<boolean>}
     */
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

    // ============================================
    // AUTH STATE HANDLER
    // ============================================
    
    /**
     * Handle authentication state changes
     * Auto-redirects authenticated users to dashboard
     * @param {import('firebase/auth').User | null} u - Firebase user object
     */
    async function checkAuthAndProfile(u) {
        user = u;
        isCheckingProfile = true;
        userProfile = null;
        needsEmailVerification = false;
        profileCheckFailed = false;

        if (user) {
            try {
                await user.getIdToken();
                
                // Timeout to prevent infinite loading (3s max)
                const profilePromise = getUserProfile(user.uid);
                const timeoutPromise = new Promise((resolve) => 
                    setTimeout(() => resolve('TIMEOUT'), 3000)
                );
                
                const result = await Promise.race([profilePromise, timeoutPromise]);
                
                if (result === 'TIMEOUT') {
                    console.warn('Profile fetch timed out - assuming existing user');
                    profileCheckFailed = true;
                    userProfile = { displayName: user.displayName };
                } else {
                    userProfile = result;
                }
                
                // Check email verification for first-time users
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
                
                // Auto-redirect to dashboard if authenticated and verified
                if (userProfile && !needsEmailVerification) {
                    isRedirecting = true;
                    goto('/app/dashboard');
                    return;
                }
            } catch (error) {
                console.error("Error checking profile:", error);
                profileCheckFailed = true;
                userProfile = { displayName: user.displayName };
                
                // Redirect even on profile check failure - user is authenticated
                isRedirecting = true;
                goto('/app/dashboard');
                return;
            }
        }
        
        isCheckingProfile = false;
        isLoading = false;
    }

    // ============================================
    // LIFECYCLE
    // ============================================
    
    onMount(() => {
        const unsubscribe = subscribeToAuth(checkAuthAndProfile);
        return unsubscribe;
    });

    // ============================================
    // EVENT HANDLERS
    // ============================================
    
    /** Navigate to email verification page */
    function handleVerifyEmail() {
        goto('/verify-email');
    }

    /** Handle Google OAuth login */
    async function handleGoogleLogin() {
        if (isLoggingIn) return;
        
        loginError = '';
        isLoggingIn = true;
        
        try {
            await loginWithGoogle();
        } catch (error) {
            console.error("Login failed:", error);
            
            // User-friendly error messages
            const errorMessages = {
                'auth/popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
                'auth/cancelled-popup-request': 'Only one sign-in window allowed at a time.',
                'auth/popup-blocked': 'Pop-up was blocked. Please allow pop-ups and try again.',
                'auth/network-request-failed': 'Network error. Please check your connection.',
                'auth/configuration-not-found': 'Sign-in is temporarily unavailable.'
            };
            
            loginError = errorMessages[error.code] || 'Unable to sign in. Please try again.';
        } finally {
            isLoggingIn = false;
        }
    }

    /** Handle user logout */
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
    
    /** Handle profile form completion */
    function handleProfileComplete(profileData) {
        userProfile = profileData;
    }
</script>

<svelte:head>
    <title>Sign In | Student Attendance</title>
    <meta name="description" content="Sign in to track your class attendance" />
</svelte:head>

<!-- Main Container -->
<main class="login-page" role="main">
    
    <!-- 
        Apple-Inspired Premium Background
        University Edition - Minimal, Calm, Secure
        
        Layers (back to front):
        1. Base gradient - soft neutral tones
        2. Ambient typography - atmospheric texture
        3. Depth grid - subtle structure
        4. Accent glows - directional light
        5. Card focus glow - frosted glass effect
        6. Academic accent icon - contextual detail
    -->
    <div class="background" aria-hidden="true">
        <!-- Base gradient layer -->
        <div class="bg-gradient-base"></div>
        
        <!-- Ambient typography - atmospheric texture -->
        <div class="bg-ambient-text">
            <span class="ambient-word ambient-word-1">ATTENDANCE</span>
            <span class="ambient-word ambient-word-2">SECURE ACCESS</span>
            <span class="ambient-word ambient-word-3">STUDENT</span>
        </div>
        
        <!-- Subtle depth grid -->
        <div class="bg-depth-grid"></div>
        
        <!-- Atmospheric depth layer -->
        <div class="bg-atmosphere"></div>
        
        <!-- Accent glows -->
        <div class="bg-glow bg-glow-primary"></div>
        <div class="bg-glow bg-glow-secondary"></div>
        
        <!-- Academic accent icon - shield/checkmark -->
        <div class="bg-accent-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M9 12l2 2 4-4"/>
            </svg>
        </div>
    </div>
    
    <!-- Frosted glass focus glow - behind card -->
    <div class="card-focus-glow" aria-hidden="true"></div>
    
    <!-- Login Card Container -->
    <div class="card-container">
        
        <!-- Loading State -->
        {#if isLoading || isCheckingProfile || isRedirecting}
            <div class="card" role="status" aria-live="polite">
                <div class="loading-state">
                    <div class="spinner" aria-hidden="true">
                        <svg viewBox="0 0 50 50">
                            <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
                        </svg>
                    </div>
                    <p class="loading-text">
                        {isRedirecting ? 'Redirecting...' : 'Loading...'}
                    </p>
                </div>
            </div>
            
        <!-- Profile Setup (New User) -->
        {:else if user && !userProfile}
            <ProfileForm {user} onProfileComplete={handleProfileComplete} />
            
        <!-- Main Login Card -->
        {:else}
            <div class="card">
                
                <!-- Header Section -->
                <header class="card-header">
                    <!-- App Icon -->
                    <div class="app-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 12l2 2 4-4" />
                            <path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9z" />
                        </svg>
                    </div>
                    
                    <h1 class="title">Welcome Back</h1>
                    <p class="subtitle">Sign in to track your class attendance</p>
                </header>

                <!-- Authenticated User View -->
                {#if user}
                    <div class="session-card">
                        <!-- User Avatar -->
                        <div class="avatar-container">
                            {#if user.photoURL}
                                <img 
                                    src={user.photoURL} 
                                    alt="" 
                                    class="avatar"
                                    referrerpolicy="no-referrer"
                                />
                            {:else}
                                <div class="avatar avatar-placeholder">
                                    <span>{user.displayName?.charAt(0) || user.email?.charAt(0) || '?'}</span>
                                </div>
                            {/if}
                            <div class="status-indicator" class:warning={needsEmailVerification}></div>
                        </div>
                        
                        <!-- User Info -->
                        <p class="user-name">{user.displayName || 'User'}</p>
                        <p class="user-email">{user.email}</p>
                        
                        <!-- Email Verification Notice -->
                        {#if needsEmailVerification}
                            <div class="notice notice-warning" role="alert">
                                <svg class="notice-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                                </svg>
                                <span>Please verify your email to continue</span>
                            </div>
                            
                            <button 
                                type="button"
                                class="btn btn-primary btn-warning"
                                on:click={handleVerifyEmail}
                            >
                                <span>Verify Email</span>
                                <svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                                </svg>
                            </button>
                        {:else}
                            <a href="/app/dashboard" class="btn btn-primary">
                                <span>Go to Dashboard</span>
                                <svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                                </svg>
                            </a>
                        {/if}
                    </div>

                    <!-- Sign Out Button -->
                    <button 
                        type="button"
                        class="btn btn-ghost"
                        on:click={handleLogout}
                    >
                        <svg class="btn-icon-left" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd" />
                        </svg>
                        <span>Sign Out</span>
                    </button>
                    
                <!-- Login View -->
                {:else}
                    
                    <!-- Error Alert -->
                    {#if loginError}
                        <div class="notice notice-error" role="alert">
                            <svg class="notice-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                            </svg>
                            <span>{loginError}</span>
                        </div>
                    {/if}

                    <!-- Google Sign In Button -->
                    <button 
                        type="button"
                        class="btn btn-google"
                        on:click={handleGoogleLogin}
                        disabled={isLoggingIn}
                        aria-busy={isLoggingIn}
                    >
                        {#if isLoggingIn}
                            <div class="btn-spinner" aria-hidden="true"></div>
                            <span>Signing in...</span>
                        {:else}
                            <svg class="google-logo" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            <span>Continue with Google</span>
                        {/if}
                    </button>

                    <!-- Security Footer -->
                    <footer class="security-footer">
                        <svg class="security-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
                        </svg>
                        <span>Secured with Google Authentication</span>
                    </footer>
                {/if}
            </div>
        {/if}
    </div>
</main>


<style>
    /* ============================================
       CSS CUSTOM PROPERTIES (Design Tokens)
       Apple-inspired color palette and spacing
       ============================================ */
    
    :root {
        /* Colors - Apple System Colors */
        --color-primary: #007AFF;
        --color-primary-hover: #0066D6;
        --color-primary-active: #0055B3;
        
        --color-warning: #FF9500;
        --color-warning-hover: #E68600;
        
        --color-error: #FF3B30;
        --color-error-bg: rgba(255, 59, 48, 0.08);
        
        --color-success: #34C759;
        
        /* Neutrals */
        --color-text-primary: #1D1D1F;
        --color-text-secondary: #86868B;
        --color-text-tertiary: #AEAEB2;
        
        --color-bg-primary: #FFFFFF;
        --color-bg-secondary: #F5F5F7;
        --color-bg-tertiary: #E8E8ED;
        
        --color-border: #D2D2D7;
        --color-border-hover: #C7C7CC;
        
        /* Shadows - Subtle, layered */
        --shadow-card: 
            0 4px 6px -1px rgba(0, 0, 0, 0.05),
            0 10px 20px -5px rgba(0, 0, 0, 0.04),
            0 1px 3px rgba(0, 0, 0, 0.03);
        
        --shadow-card-hover:
            0 8px 12px -2px rgba(0, 0, 0, 0.06),
            0 16px 32px -8px rgba(0, 0, 0, 0.05);
        
        --shadow-button:
            0 1px 2px rgba(0, 0, 0, 0.05);
        
        --shadow-button-hover:
            0 4px 12px rgba(0, 122, 255, 0.25);
        
        /* Typography */
        --font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        
        /* Spacing */
        --space-xs: 4px;
        --space-sm: 8px;
        --space-md: 16px;
        --space-lg: 24px;
        --space-xl: 32px;
        --space-2xl: 48px;
        
        /* Border Radius */
        --radius-sm: 8px;
        --radius-md: 12px;
        --radius-lg: 16px;
        --radius-xl: 20px;
        --radius-full: 9999px;
        
        /* Transitions */
        --transition-fast: 150ms ease-out;
        --transition-normal: 200ms ease-out;
        --transition-slow: 300ms ease-out;
    }

    /* ============================================
       BASE LAYOUT
       ============================================ */
    
    .login-page {
        min-height: 100vh;
        min-height: 100dvh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-lg);
        position: relative;
        overflow: hidden;
        font-family: var(--font-family);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }

    /* ============================================
       BACKGROUND - Apple-Inspired Premium Design
       University Edition - Minimal, Calm, Secure
       
       Design Philosophy:
       - Intentional, not empty
       - Calm, trustworthy, professional atmosphere
       - Subtle depth and texture without distraction
       - Guides focus naturally to the login card
       - Premium feel through restraint
       ============================================ */
    
    .background {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
        z-index: 0;
    }
    
    /* 
       Base Gradient Layer
       - Soft diagonal gradient with neutral, calming tones
       - Creates foundation for depth perception
    */
    .bg-gradient-base {
        position: absolute;
        inset: 0;
        background: linear-gradient(
            165deg,
            #F4F6FA 0%,      /* Very light blue-gray - top */
            #F8FAFC 20%,     /* Soft white with blue hint */
            #FFFFFF 45%,     /* Pure white - center focus area */
            #FAFBFD 70%,     /* Subtle return to blue-gray */
            #F5F7FA 100%     /* Light gray-blue - bottom */
        );
    }
    
    /* 
       Ambient Typography Layer
       - Very large, ultra-subtle background text
       - Acts as atmospheric texture, not readable content
       - Opacity: 2-3% only
    */
    .bg-ambient-text {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
    }
    
    .ambient-word {
        position: absolute;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #64748B;
        opacity: 0.06;
        white-space: nowrap;
        user-select: none;
    }
    
    .ambient-word-1 {
        font-size: clamp(140px, 20vw, 320px);
        top: 5%;
        left: -3%;
        transform: rotate(-6deg);
    }
    
    .ambient-word-2 {
        font-size: clamp(100px, 14vw, 200px);
        bottom: 12%;
        right: -5%;
        transform: rotate(4deg);
    }
    
    .ambient-word-3 {
        font-size: clamp(120px, 16vw, 260px);
        top: 58%;
        left: -8%;
        transform: rotate(-4deg);
        opacity: 0.045;
    }
    
    /* 
       Subtle Depth Grid
       - Ultra-light dot pattern for structure
       - Opacity: 3-4% maximum
       - Creates subtle texture without pattern repetition feel
    */
    .bg-depth-grid {
        position: absolute;
        inset: 0;
        background-image: radial-gradient(
            circle at center,
            rgba(100, 116, 139, 0.08) 1.5px,
            transparent 1.5px
        );
        background-size: 40px 40px;
        mask-image: radial-gradient(
            ellipse 80% 60% at 50% 50%,
            black 0%,
            transparent 75%
        );
        -webkit-mask-image: radial-gradient(
            ellipse 80% 60% at 50% 50%,
            black 0%,
            transparent 75%
        );
    }
    
    /* 
       Atmospheric Depth Layer
       - Very subtle radial vignette
       - Creates air-like depth perception
    */
    .bg-atmosphere {
        position: absolute;
        inset: 0;
        background: radial-gradient(
            ellipse 85% 65% at 50% 48%,
            transparent 0%,
            transparent 40%,
            rgba(180, 195, 215, 0.08) 100%
        );
    }
    
    /* 
       Glow Elements - Shared Properties
    */
    .bg-glow {
        position: absolute;
        border-radius: 50%;
        pointer-events: none;
    }
    
    /* 
       Primary Glow - Top Left
       - Soft blue tint (Apple signature)
       - Creates subtle directional light
    */
    .bg-glow-primary {
        width: 700px;
        height: 700px;
        top: -280px;
        left: -180px;
        background: radial-gradient(
            circle,
            rgba(0, 122, 255, 0.1) 0%,
            rgba(88, 166, 255, 0.06) 40%,
            transparent 70%
        );
        filter: blur(80px);
    }
    
    /* 
       Secondary Glow - Bottom Right
       - Subtle purple-blue tint
       - Balances the primary glow
    */
    .bg-glow-secondary {
        width: 600px;
        height: 600px;
        bottom: -220px;
        right: -120px;
        background: radial-gradient(
            circle,
            rgba(88, 86, 214, 0.08) 0%,
            rgba(120, 120, 230, 0.045) 45%,
            transparent 70%
        );
        filter: blur(90px);
    }
    
    /* 
       Academic Accent Icon
       - Shield with checkmark - security/verification context
       - Outline only, extremely subtle
       - Positioned in corner, never draws attention
    */
    .bg-accent-icon {
        position: absolute;
        bottom: 6%;
        left: 4%;
        width: clamp(200px, 25vw, 380px);
        height: clamp(200px, 25vw, 380px);
        opacity: 0.045;
        color: #475569;
        pointer-events: none;
        transform: rotate(-12deg);
    }
    
    .bg-accent-icon svg {
        width: 100%;
        height: 100%;
    }
    
    /* 
       Frosted Glass Focus Glow
       - Premium focus effect behind the login card
       - Creates depth and draws eye to center
       - Soft, rounded, no hard edges
    */
    .card-focus-glow {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 520px;
        height: 580px;
        background: radial-gradient(
            ellipse 100% 100% at 50% 50%,
            rgba(255, 255, 255, 0.95) 0%,
            rgba(255, 255, 255, 0.7) 25%,
            rgba(248, 250, 252, 0.4) 50%,
            transparent 75%
        );
        filter: blur(40px);
        border-radius: 50%;
        pointer-events: none;
        z-index: 0;
    }

    /* ============================================
       CARD CONTAINER
       ============================================ */
    
    .card-container {
        width: 100%;
        max-width: 420px;
        position: relative;
        z-index: 1;
    }

    /* ============================================
       CARD - Apple-style floating card
       ============================================ */
    
    .card {
        background: var(--color-bg-primary);
        border-radius: var(--radius-xl);
        padding: var(--space-xl);
        box-shadow: var(--shadow-card);
        border: 1px solid rgba(255, 255, 255, 0.8);
        
        /* Entry animation */
        animation: cardEnter 0.4s ease-out;
        
        /* Hover effect - subtle shadow enhancement */
        transition: box-shadow var(--transition-slow);
    }
    
    .card:hover {
        box-shadow: var(--shadow-card-hover);
    }
    
    @keyframes cardEnter {
        from {
            opacity: 0;
            transform: translateY(12px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    /* ============================================
       LOADING STATE
       ============================================ */
    
    .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-2xl) 0;
        gap: var(--space-md);
    }
    
    .spinner {
        width: 32px;
        height: 32px;
        color: var(--color-primary);
    }
    
    .spinner svg {
        width: 100%;
        height: 100%;
        animation: spinnerRotate 1s linear infinite;
    }
    
    .spinner circle {
        stroke-dasharray: 80, 200;
        stroke-dashoffset: 0;
        animation: spinnerDash 1.5s ease-in-out infinite;
    }
    
    @keyframes spinnerRotate {
        100% { transform: rotate(360deg); }
    }
    
    @keyframes spinnerDash {
        0% {
            stroke-dasharray: 1, 200;
            stroke-dashoffset: 0;
        }
        50% {
            stroke-dasharray: 90, 200;
            stroke-dashoffset: -35;
        }
        100% {
            stroke-dasharray: 90, 200;
            stroke-dashoffset: -125;
        }
    }
    
    .loading-text {
        font-size: 15px;
        font-weight: 500;
        color: var(--color-text-secondary);
        margin: 0;
    }

    /* ============================================
       CARD HEADER
       ============================================ */
    
    .card-header {
        text-align: center;
        margin-bottom: var(--space-xl);
    }
    
    .app-icon {
        width: 64px;
        height: 64px;
        margin: 0 auto var(--space-lg);
        border-radius: var(--radius-lg);
        background: linear-gradient(135deg, var(--color-primary) 0%, #5856D6 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        box-shadow: 0 8px 24px rgba(0, 122, 255, 0.3);
    }
    
    .app-icon svg {
        width: 32px;
        height: 32px;
    }
    
    .title {
        font-size: 28px;
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0 0 var(--space-sm);
        letter-spacing: -0.5px;
        line-height: 1.2;
    }
    
    .subtitle {
        font-size: 15px;
        font-weight: 400;
        color: var(--color-text-secondary);
        margin: 0;
        line-height: 1.5;
    }

    /* ============================================
       SESSION CARD (Authenticated User)
       ============================================ */
    
    .session-card {
        background: var(--color-bg-secondary);
        border-radius: var(--radius-lg);
        padding: var(--space-lg);
        text-align: center;
        margin-bottom: var(--space-md);
    }
    
    .avatar-container {
        position: relative;
        width: 72px;
        height: 72px;
        margin: 0 auto var(--space-md);
    }
    
    .avatar {
        width: 72px;
        height: 72px;
        border-radius: var(--radius-full);
        object-fit: cover;
        border: 3px solid var(--color-bg-primary);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .avatar-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, var(--color-primary) 0%, #5856D6 100%);
        color: white;
        font-size: 28px;
        font-weight: 600;
    }
    
    .status-indicator {
        position: absolute;
        bottom: 2px;
        right: 2px;
        width: 16px;
        height: 16px;
        background: var(--color-success);
        border: 3px solid var(--color-bg-secondary);
        border-radius: var(--radius-full);
    }
    
    .status-indicator.warning {
        background: var(--color-warning);
    }
    
    .user-name {
        font-size: 18px;
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0 0 var(--space-xs);
    }
    
    .user-email {
        font-size: 14px;
        color: var(--color-text-secondary);
        margin: 0 0 var(--space-lg);
    }

    /* ============================================
       NOTICE COMPONENTS
       ============================================ */
    
    .notice {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-md);
        border-radius: var(--radius-md);
        font-size: 14px;
        margin-bottom: var(--space-md);
        animation: noticeEnter 0.2s ease-out;
    }
    
    @keyframes noticeEnter {
        from {
            opacity: 0;
            transform: translateY(-4px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .notice-icon {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
    }
    
    .notice-error {
        background: var(--color-error-bg);
        color: var(--color-error);
    }
    
    .notice-warning {
        background: rgba(255, 149, 0, 0.1);
        color: #B36B00;
    }

    /* ============================================
       BUTTONS - Apple-style
       ============================================ */
    
    .btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-sm);
        width: 100%;
        height: 48px;
        padding: 0 var(--space-lg);
        font-family: inherit;
        font-size: 16px;
        font-weight: 600;
        border-radius: var(--radius-md);
        border: none;
        cursor: pointer;
        text-decoration: none;
        transition: 
            background-color var(--transition-fast),
            transform var(--transition-fast),
            box-shadow var(--transition-fast);
        
        /* Prevent text selection */
        user-select: none;
        -webkit-user-select: none;
        
        /* Touch optimization */
        -webkit-tap-highlight-color: transparent;
    }
    
    .btn:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
    }
    
    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    
    /* Primary Button */
    .btn-primary {
        background: var(--color-primary);
        color: white;
        box-shadow: var(--shadow-button);
    }
    
    .btn-primary:hover:not(:disabled) {
        background: var(--color-primary-hover);
        transform: translateY(-1px);
        box-shadow: var(--shadow-button-hover);
    }
    
    .btn-primary:active:not(:disabled) {
        background: var(--color-primary-active);
        transform: translateY(0);
    }
    
    /* Warning variant */
    .btn-warning {
        background: var(--color-warning);
    }
    
    .btn-warning:hover:not(:disabled) {
        background: var(--color-warning-hover);
        box-shadow: 0 4px 12px rgba(255, 149, 0, 0.3);
    }
    
    /* Ghost Button */
    .btn-ghost {
        background: transparent;
        color: var(--color-text-secondary);
        border: 1px solid var(--color-border);
    }
    
    .btn-ghost:hover:not(:disabled) {
        background: var(--color-bg-secondary);
        color: var(--color-text-primary);
        border-color: var(--color-border-hover);
    }
    
    /* Google Button */
    .btn-google {
        background: var(--color-bg-primary);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
        box-shadow: var(--shadow-button);
    }
    
    .btn-google:hover:not(:disabled) {
        background: var(--color-bg-secondary);
        border-color: var(--color-border-hover);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    
    .btn-google:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: var(--shadow-button);
    }
    
    .google-logo {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
    }
    
    .btn-icon,
    .btn-icon-left {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
    }
    
    /* Button spinner */
    .btn-spinner {
        width: 18px;
        height: 18px;
        border: 2px solid var(--color-border);
        border-top-color: var(--color-text-primary);
        border-radius: var(--radius-full);
        animation: spinnerRotate 0.8s linear infinite;
    }

    /* ============================================
       SECURITY FOOTER
       ============================================ */
    
    .security-footer {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin-top: var(--space-lg);
        font-size: 12px;
        color: var(--color-text-tertiary);
    }
    
    .security-icon {
        width: 14px;
        height: 14px;
    }

    /* ============================================
       RESPONSIVE DESIGN
       ============================================ */
    
    /* Tablet */
    @media (max-width: 768px) {
        /* Scale down glows for tablet */
        .bg-glow-primary {
            width: 500px;
            height: 500px;
            top: -180px;
            left: -120px;
        }
        
        .bg-glow-secondary {
            width: 450px;
            height: 450px;
            bottom: -160px;
            right: -80px;
        }
        
        .card-focus-glow {
            width: 420px;
            height: 480px;
        }
        
        /* Reduce ambient text visibility on tablet */
        .ambient-word {
            opacity: 0.05;
        }
        
        .bg-accent-icon {
            opacity: 0.035;
        }
    }
    
    /* Mobile */
    @media (max-width: 480px) {
        .login-page {
            padding: var(--space-md);
            align-items: flex-start;
            padding-top: 10vh;
        }
        
        .card-container {
            max-width: 100%;
        }
        
        .card {
            padding: var(--space-lg);
            border-radius: var(--radius-lg);
        }
        
        .app-icon {
            width: 56px;
            height: 56px;
            border-radius: var(--radius-md);
        }
        
        .app-icon svg {
            width: 28px;
            height: 28px;
        }
        
        .title {
            font-size: 24px;
        }
        
        .subtitle {
            font-size: 14px;
        }
        
        .session-card {
            padding: var(--space-md);
        }
        
        .avatar-container,
        .avatar {
            width: 64px;
            height: 64px;
        }
        
        .avatar-placeholder {
            font-size: 24px;
        }
        
        .user-name {
            font-size: 17px;
        }
        
        .btn {
            height: 44px;
            font-size: 15px;
        }
        
        /* Simplified background for mobile - clean and performant */
        .bg-glow-primary,
        .bg-glow-secondary {
            display: none;
        }
        
        /* Hide ambient text on mobile for cleaner look */
        .bg-ambient-text {
            display: none;
        }
        
        /* Hide depth grid on mobile */
        .bg-depth-grid {
            display: none;
        }
        
        /* Hide accent icon on mobile */
        .bg-accent-icon {
            display: none;
        }
        
        /* Simpler focus glow for mobile */
        .card-focus-glow {
            width: 320px;
            height: 380px;
            filter: blur(30px);
        }
        
        /* Simpler gradient for mobile */
        .bg-gradient-base {
            background: linear-gradient(
                180deg,
                #F5F7FA 0%,
                #FFFFFF 40%,
                #FFFFFF 60%,
                #F8FAFC 100%
            );
        }
    }
    
    /* Small mobile */
    @media (max-width: 360px) {
        .card {
            padding: var(--space-md) var(--space-md);
        }
        
        .title {
            font-size: 22px;
        }
        
        .card-focus-glow {
            width: 280px;
            height: 320px;
        }
    }

    /* ============================================
       ACCESSIBILITY - Reduced Motion
       ============================================ */
    
    @media (prefers-reduced-motion: reduce) {
        .card {
            animation: none;
        }
        
        .notice {
            animation: none;
        }
        
        .spinner svg,
        .spinner circle,
        .btn-spinner {
            animation-duration: 0.01ms;
        }
        
        .btn {
            transition: none;
        }
    }

    /* ============================================
       ACCESSIBILITY - High Contrast
       ============================================ */
    
    @media (prefers-contrast: high) {
        .card {
            border: 2px solid var(--color-text-primary);
        }
        
        .btn {
            border-width: 2px;
        }
        
        .notice {
            border: 1px solid currentColor;
        }
    }

    /* ============================================
       DARK MODE SUPPORT (Future-ready)
       ============================================ */
    
    @media (prefers-color-scheme: dark) {
        /* Dark mode variables would go here */
        /* Currently keeping light mode only for Apple-like consistency */
    }
</style>
