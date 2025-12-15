<script>
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import { onMount, onDestroy } from "svelte";
    import { adminAuthStore } from "$lib/stores/adminAuth.js";
    import { themeStore } from "$lib/stores/theme.js";
    import { IconShield, IconMail, IconLock, IconLoader2, IconAlertCircle, IconKey, IconRefresh, IconCheck } from "@tabler/icons-svelte";

    let email = '';
    let password = '';
    let mfaCode = '';
    let error = '';
    let success = '';
    let isLoading = false;
    let mfaRequired = false;
    let mfaSessionToken = '';
    
    // Email verification state
    let emailVerificationRequired = false;
    let verificationAdminId = '';
    let verificationEmail = '';
    let verificationSessionToken = '';
    let otpDigits = ['', '', '', '', '', ''];
    let otpInputs = [];
    let timeRemaining = 300;
    let timerInterval = null;
    let canResend = false;
    let resendCooldown = 0;

    onMount(() => {
        if (browser) {
            themeStore.init();
            // Check if already logged in
            const { accessToken } = adminAuthStore.getStoredTokens();
            if (accessToken) {
                goto('/admin/dashboard');
            }
        }
    });

    onDestroy(() => {
        if (timerInterval) clearInterval(timerInterval);
    });

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timeRemaining--;
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                error = 'Verification code has expired. Please request a new one.';
                canResend = true;
            }
        }, 1000);
    }

    function startResendCooldown() {
        resendCooldown = 60;
        canResend = false;
        const cooldownInterval = setInterval(() => {
            resendCooldown--;
            if (resendCooldown <= 0) {
                clearInterval(cooldownInterval);
                canResend = true;
            }
        }, 1000);
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    async function handleLogin() {
        if (!email || !password) {
            error = 'Please enter email and password';
            return;
        }

        isLoading = true;
        error = '';
        success = '';

        try {
            const response = await fetch('/api/admin/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            if (data.emailVerificationRequired) {
                // First-time login - email verification required
                emailVerificationRequired = true;
                verificationAdminId = data.adminId;
                verificationEmail = data.email;
                verificationSessionToken = data.sessionToken;
                timeRemaining = data.expiresIn || 300;
                startTimer();
                startResendCooldown();
                success = 'Verification code sent to your email!';
                
                // Focus first OTP input
                setTimeout(() => {
                    if (otpInputs[0]) otpInputs[0].focus();
                }, 100);
            } else if (data.mfaRequired) {
                mfaRequired = true;
                mfaSessionToken = data.mfaSessionToken;
            } else {
                adminAuthStore.setAdmin(data.admin, {
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken,
                    tokenExpiry: data.tokenExpiry
                });
                goto('/admin/dashboard');
            }
        } catch (err) {
            error = err.message;
        } finally {
            isLoading = false;
        }
    }

    function handleOtpInput(index, event) {
        const value = event.target.value;
        
        if (!/^\d*$/.test(value)) {
            otpDigits[index] = '';
            return;
        }
        
        if (value.length > 1) {
            const digits = value.slice(0, 6).split('');
            digits.forEach((digit, i) => {
                if (i < 6) otpDigits[i] = digit;
            });
            otpDigits = [...otpDigits];
            const nextIndex = Math.min(digits.length, 5);
            if (otpInputs[nextIndex]) otpInputs[nextIndex].focus();
            if (otpDigits.every(d => d !== '')) {
                handleEmailVerify();
            }
            return;
        }
        
        otpDigits[index] = value;
        
        if (value && index < 5) {
            otpInputs[index + 1]?.focus();
        }
        
        if (otpDigits.every(d => d !== '')) {
            handleEmailVerify();
        }
    }

    function handleOtpKeydown(index, event) {
        if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpInputs[index - 1]?.focus();
        }
        if (event.key === 'ArrowLeft' && index > 0) {
            otpInputs[index - 1]?.focus();
        }
        if (event.key === 'ArrowRight' && index < 5) {
            otpInputs[index + 1]?.focus();
        }
    }

    async function handleEmailVerify() {
        const code = otpDigits.join('');
        
        if (code.length !== 6) {
            error = 'Please enter the complete 6-digit code';
            return;
        }

        isLoading = true;
        error = '';
        success = '';

        try {
            const response = await fetch('/api/admin/auth/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    adminId: verificationAdminId, 
                    code, 
                    sessionToken: verificationSessionToken 
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Verification failed');
                otpDigits = ['', '', '', '', '', ''];
                otpInputs[0]?.focus();
            }

            success = 'Email verified successfully! Redirecting...';
            if (timerInterval) clearInterval(timerInterval);

            adminAuthStore.setAdmin(data.admin, {
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                tokenExpiry: data.tokenExpiry
            });
            
            setTimeout(() => {
                goto('/admin/dashboard');
            }, 1500);
        } catch (err) {
            error = err.message;
            otpDigits = ['', '', '', '', '', ''];
            otpInputs[0]?.focus();
        } finally {
            isLoading = false;
        }
    }

    async function handleResendCode() {
        if (!canResend || isLoading) return;

        isLoading = true;
        error = '';
        success = '';

        try {
            const response = await fetch('/api/admin/auth/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    adminId: verificationAdminId, 
                    action: 'resend' 
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to resend code');
            }

            verificationSessionToken = data.sessionToken;
            timeRemaining = data.expiresIn || 300;
            success = 'New verification code sent!';
            otpDigits = ['', '', '', '', '', ''];
            startTimer();
            startResendCooldown();
            
            setTimeout(() => {
                if (otpInputs[0]) otpInputs[0].focus();
            }, 100);
        } catch (err) {
            error = err.message;
        } finally {
            isLoading = false;
        }
    }

    async function handleMfaVerify() {
        if (!mfaCode || mfaCode.length !== 6) {
            error = 'Please enter a valid 6-character code';
            return;
        }

        isLoading = true;
        error = '';

        try {
            const response = await fetch('/api/admin/auth/verify-mfa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mfaSessionToken, code: mfaCode })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'MFA verification failed');
            }

            adminAuthStore.setAdmin(data.admin, {
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                tokenExpiry: data.tokenExpiry
            });
            goto('/admin/dashboard');
        } catch (err) {
            error = err.message;
        } finally {
            isLoading = false;
        }
    }

    function handleKeydown(event) {
        if (event.key === 'Enter') {
            if (emailVerificationRequired) {
                handleEmailVerify();
            } else if (mfaRequired) {
                handleMfaVerify();
            } else {
                handleLogin();
            }
        }
    }

    function goBackToLogin() {
        emailVerificationRequired = false;
        mfaRequired = false;
        otpDigits = ['', '', '', '', '', ''];
        mfaCode = '';
        error = '';
        success = '';
        if (timerInterval) clearInterval(timerInterval);
    }
</script>

<svelte:head>
    <title>Admin Login | Attendance System</title>
</svelte:head>

<div class="login-container">
    <div class="login-card apple-card">
        <div class="login-header">
            <div class="login-icon">
                <IconShield size={32} stroke={1.5} />
            </div>
            <h1>Admin Portal</h1>
            <p class="login-subtitle">
                {#if emailVerificationRequired}
                    Verify your email to continue
                {:else if mfaRequired}
                    Enter your verification code
                {:else}
                    Sign in to access the admin dashboard
                {/if}
            </p>
        </div>

        {#if success}
            <div class="success-alert">
                <IconCheck size={18} stroke={2} />
                <span>{success}</span>
            </div>
        {/if}

        {#if error}
            <div class="error-alert">
                <IconAlertCircle size={18} stroke={2} />
                <span>{error}</span>
            </div>
        {/if}

        {#if emailVerificationRequired}
            <!-- Email Verification Form -->
            <div class="login-form">
                <p class="verification-email-text">
                    We've sent a code to <strong>{verificationEmail}</strong>
                </p>

                <div class="form-group">
                    <label class="apple-label otp-label">Enter 6-digit code</label>
                    <div class="otp-inputs">
                        {#each otpDigits as digit, i}
                            <input
                                type="text"
                                inputmode="numeric"
                                maxlength="6"
                                class="otp-input"
                                class:filled={digit !== ''}
                                bind:this={otpInputs[i]}
                                bind:value={otpDigits[i]}
                                on:input={(e) => handleOtpInput(i, e)}
                                on:keydown={(e) => handleOtpKeydown(i, e)}
                                disabled={isLoading}
                            />
                        {/each}
                    </div>
                    
                    {#if timeRemaining > 0}
                        <p class="timer">Code expires in <strong>{formatTime(timeRemaining)}</strong></p>
                    {/if}
                </div>

                <button 
                    class="apple-btn-primary login-btn" 
                    on:click={handleEmailVerify}
                    disabled={isLoading || otpDigits.some(d => d === '')}
                >
                    {#if isLoading}
                        <IconLoader2 size={20} stroke={2} class="spin" />
                        Verifying...
                    {:else}
                        Verify Email
                    {/if}
                </button>

                <div class="resend-section">
                    {#if canResend}
                        <button class="resend-btn" on:click={handleResendCode} disabled={isLoading}>
                            <IconRefresh size={16} stroke={2} />
                            Resend Code
                        </button>
                    {:else if resendCooldown > 0}
                        <p class="cooldown-text">Resend available in {resendCooldown}s</p>
                    {/if}
                </div>

                <button class="back-btn" on:click={goBackToLogin}>
                    Back to login
                </button>
            </div>
        {:else if mfaRequired}
            <!-- MFA Verification Form -->
            <div class="login-form">
                <div class="form-group">
                    <label class="apple-label" for="mfaCode">Verification Code</label>
                    <div class="input-wrapper">
                        <IconKey size={20} stroke={1.5} class="input-icon" />
                        <input
                            type="text"
                            id="mfaCode"
                            class="apple-input with-icon"
                            placeholder="Enter 6-character code"
                            bind:value={mfaCode}
                            on:keydown={handleKeydown}
                            maxlength="6"
                            autocomplete="one-time-code"
                        />
                    </div>
                </div>

                <button 
                    class="apple-btn-primary login-btn" 
                    on:click={handleMfaVerify}
                    disabled={isLoading}
                >
                    {#if isLoading}
                        <IconLoader2 size={20} stroke={2} class="spin" />
                        Verifying...
                    {:else}
                        Verify Code
                    {/if}
                </button>

                <button class="back-btn" on:click={goBackToLogin}>
                    Back to login
                </button>
            </div>
        {:else}
            <!-- Login Form -->
            <div class="login-form">
                <div class="form-group">
                    <label class="apple-label" for="email">Email</label>
                    <div class="input-wrapper">
                        <IconMail size={20} stroke={1.5} class="input-icon" />
                        <input
                            type="email"
                            id="email"
                            class="apple-input with-icon"
                            placeholder="admin@example.com"
                            bind:value={email}
                            on:keydown={handleKeydown}
                            autocomplete="email"
                        />
                    </div>
                </div>

                <div class="form-group">
                    <label class="apple-label" for="password">Password</label>
                    <div class="input-wrapper">
                        <IconLock size={20} stroke={1.5} class="input-icon" />
                        <input
                            type="password"
                            id="password"
                            class="apple-input with-icon"
                            placeholder="Enter your password"
                            bind:value={password}
                            on:keydown={handleKeydown}
                            autocomplete="current-password"
                        />
                    </div>
                </div>

                <button 
                    class="apple-btn-primary login-btn" 
                    on:click={handleLogin}
                    disabled={isLoading}
                >
                    {#if isLoading}
                        <IconLoader2 size={20} stroke={2} class="spin" />
                        Signing in...
                    {:else}
                        Sign In
                    {/if}
                </button>
            </div>
        {/if}
    </div>
</div>


<style>
    .login-container {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: var(--theme-bg, var(--apple-light-bg));
    }

    .login-card {
        width: 100%;
        max-width: 420px;
        padding: 40px;
    }

    .login-header {
        text-align: center;
        margin-bottom: 32px;
    }

    .login-icon {
        width: 64px;
        height: 64px;
        border-radius: var(--apple-radius-lg);
        background: linear-gradient(135deg, var(--apple-accent), #5856D6);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        margin: 0 auto 20px;
    }

    .login-header h1 {
        font-size: 28px;
        font-weight: 700;
        color: var(--theme-text, var(--apple-black));
        margin-bottom: 8px;
    }

    .login-subtitle {
        font-size: 15px;
        color: var(--theme-text-secondary, var(--apple-gray-1));
    }

    .success-alert {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 16px;
        background: rgba(52, 199, 89, 0.1);
        border: 1px solid rgba(52, 199, 89, 0.3);
        border-radius: var(--apple-radius-md);
        color: #059669;
        font-size: 14px;
        margin-bottom: 24px;
    }

    .error-alert {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 16px;
        background: rgba(255, 59, 48, 0.1);
        border: 1px solid rgba(255, 59, 48, 0.3);
        border-radius: var(--apple-radius-md);
        color: var(--apple-red);
        font-size: 14px;
        margin-bottom: 24px;
    }

    .verification-email-text {
        text-align: center;
        font-size: 14px;
        color: var(--theme-text-secondary, var(--apple-gray-1));
        margin-bottom: 24px;
    }

    .verification-email-text strong {
        color: var(--theme-text, var(--apple-black));
    }

    .otp-label {
        text-align: center;
        margin-bottom: 12px;
    }

    .otp-inputs {
        display: flex;
        gap: 8px;
        justify-content: center;
        margin-bottom: 16px;
    }

    .otp-input {
        width: 44px;
        height: 52px;
        border: 2px solid var(--apple-gray-4, #d1d1d6);
        border-radius: 12px;
        font-size: 22px;
        font-weight: 600;
        text-align: center;
        background: var(--theme-input-bg, var(--apple-gray-6));
        color: var(--theme-text, var(--apple-black));
        transition: all 0.2s ease;
        outline: none;
    }

    .otp-input:focus {
        border-color: var(--apple-accent);
        background: var(--theme-bg, white);
        box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1);
    }

    .otp-input.filled {
        border-color: var(--apple-accent);
        background: var(--theme-bg, white);
    }

    .otp-input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .timer {
        text-align: center;
        font-size: 13px;
        color: var(--theme-text-secondary, var(--apple-gray-1));
        margin: 0;
    }

    .timer strong {
        color: var(--apple-accent);
        font-family: 'SF Mono', Monaco, monospace;
    }

    .resend-section {
        text-align: center;
        margin: 16px 0;
    }

    .resend-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: none;
        border: none;
        color: var(--apple-accent);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        padding: 8px 16px;
        border-radius: 8px;
        transition: all 0.2s ease;
    }

    .resend-btn:hover:not(:disabled) {
        background: rgba(0, 122, 255, 0.1);
    }

    .resend-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .cooldown-text {
        font-size: 13px;
        color: var(--theme-text-secondary, var(--apple-gray-2));
        margin: 0;
    }

    .login-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .form-group {
        display: flex;
        flex-direction: column;
    }

    .input-wrapper {
        position: relative;
    }

    .input-wrapper :global(.input-icon) {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--theme-text-secondary, var(--apple-gray-1));
        pointer-events: none;
    }

    .apple-input.with-icon {
        padding-left: 44px;
    }

    .login-btn {
        width: 100%;
        margin-top: 8px;
    }

    .back-btn {
        background: none;
        border: none;
        color: var(--apple-accent);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        padding: 8px;
        transition: var(--apple-transition);
    }

    .back-btn:hover {
        text-decoration: underline;
    }

    :global(.spin) {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    @media (max-width: 480px) {
        .login-card {
            padding: 28px 20px;
        }

        .login-header h1 {
            font-size: 24px;
        }
    }
</style>
