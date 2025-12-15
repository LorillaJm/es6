<script>
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { onMount, onDestroy } from 'svelte';
    import { auth, subscribeToAuth } from '$lib/firebase';
    import { IconMail, IconShieldCheck, IconLoader2, IconAlertCircle, IconRefresh, IconArrowLeft, IconCheck } from '@tabler/icons-svelte';

    let user = null;
    let isLoading = true;
    let isSending = false;
    let isVerifying = false;
    let error = '';
    let success = '';
    
    // OTP input
    let otpDigits = ['', '', '', '', '', ''];
    let otpInputs = [];
    
    // Session management
    let sessionToken = '';
    let expiresIn = 300; // 5 minutes default
    let timeRemaining = 0;
    let timerInterval = null;
    
    // Resend management
    let canResend = false;
    let resendCooldown = 0;
    let resendCount = 0;
    let maxResends = 3;

    onMount(() => {
        const unsubscribe = subscribeToAuth(async (u) => {
            user = u;
            isLoading = false;
            
            if (!u) {
                // Not logged in, redirect to home
                goto('/');
                return;
            }
            
            // Check if already verified
            await checkVerificationStatus();
        });
        
        return () => {
            unsubscribe();
            if (timerInterval) clearInterval(timerInterval);
        };
    });

    onDestroy(() => {
        if (timerInterval) clearInterval(timerInterval);
    });

    async function checkVerificationStatus() {
        if (!user) return;
        
        try {
            const response = await fetch('/api/auth/verify-email/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.uid })
            });
            
            const data = await response.json();
            
            if (data.verified) {
                // Already verified, redirect to dashboard
                success = 'Email already verified!';
                setTimeout(() => goto('/app/dashboard'), 1500);
                return;
            }
            
            if (data.pending) {
                // Has pending verification
                canResend = data.canResend;
                resendCooldown = data.resendIn || 0;
                resendCount = data.resendCount || 0;
                maxResends = data.maxResends || 3;
                
                if (data.expiresAt) {
                    const expiresAt = new Date(data.expiresAt).getTime();
                    timeRemaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
                    startTimer();
                }
                
                // Get session token from URL if available
                const urlToken = $page.url.searchParams.get('token');
                if (urlToken) {
                    sessionToken = urlToken;
                }
            } else {
                // No pending verification, send new OTP
                await sendVerificationCode();
            }
        } catch (err) {
            console.error('Error checking verification status:', err);
        }
    }

    async function sendVerificationCode() {
        if (!user || isSending) return;
        
        isSending = true;
        error = '';
        success = '';
        
        try {
            const response = await fetch('/api/auth/verify-email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    email: user.email,
                    userName: user.displayName || 'User'
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                if (data.verified) {
                    success = 'Email already verified!';
                    setTimeout(() => goto('/app/dashboard'), 1500);
                    return;
                }
                error = data.error || 'Failed to send verification code';
                if (data.retryAfter) {
                    resendCooldown = data.retryAfter;
                    startResendCooldown();
                }
                return;
            }
            
            sessionToken = data.sessionToken;
            expiresIn = data.expiresIn || 300;
            timeRemaining = expiresIn;
            success = 'Verification code sent to your email!';
            canResend = false;
            resendCount++;
            
            startTimer();
            startResendCooldown();
            
            // Focus first input
            setTimeout(() => {
                if (otpInputs[0]) otpInputs[0].focus();
            }, 100);
        } catch (err) {
            console.error('Error sending verification code:', err);
            error = 'Failed to send verification code. Please try again.';
        } finally {
            isSending = false;
        }
    }

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
        resendCooldown = 60; // 1 minute cooldown
        canResend = false;
        
        const cooldownInterval = setInterval(() => {
            resendCooldown--;
            if (resendCooldown <= 0) {
                clearInterval(cooldownInterval);
                canResend = resendCount < maxResends;
            }
        }, 1000);
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function handleOtpInput(index, event) {
        const value = event.target.value;
        
        // Only allow digits
        if (!/^\d*$/.test(value)) {
            otpDigits[index] = '';
            return;
        }
        
        // Handle paste
        if (value.length > 1) {
            const digits = value.slice(0, 6).split('');
            digits.forEach((digit, i) => {
                if (i < 6) otpDigits[i] = digit;
            });
            otpDigits = [...otpDigits];
            
            // Focus last filled or next empty
            const nextIndex = Math.min(digits.length, 5);
            if (otpInputs[nextIndex]) otpInputs[nextIndex].focus();
            
            // Auto-verify if all filled
            if (otpDigits.every(d => d !== '')) {
                verifyCode();
            }
            return;
        }
        
        otpDigits[index] = value;
        
        // Move to next input
        if (value && index < 5) {
            otpInputs[index + 1]?.focus();
        }
        
        // Auto-verify if all filled
        if (otpDigits.every(d => d !== '')) {
            verifyCode();
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

    async function verifyCode() {
        const code = otpDigits.join('');
        
        if (code.length !== 6) {
            error = 'Please enter the complete 6-digit code';
            return;
        }
        
        if (!sessionToken) {
            error = 'Session expired. Please request a new code.';
            return;
        }
        
        isVerifying = true;
        error = '';
        success = '';
        
        try {
            const response = await fetch('/api/auth/verify-email/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    code,
                    sessionToken
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                error = data.error || 'Verification failed';
                // Clear inputs on error
                otpDigits = ['', '', '', '', '', ''];
                otpInputs[0]?.focus();
                return;
            }
            
            success = 'Email verified successfully! Redirecting...';
            
            // Clear timer
            if (timerInterval) clearInterval(timerInterval);
            
            // Redirect to dashboard
            setTimeout(() => {
                goto('/app/dashboard');
            }, 1500);
        } catch (err) {
            console.error('Error verifying code:', err);
            error = 'Verification failed. Please try again.';
        } finally {
            isVerifying = false;
        }
    }

    function handleResend() {
        if (!canResend || isSending) return;
        otpDigits = ['', '', '', '', '', ''];
        sendVerificationCode();
    }

    async function handleLogout() {
        try {
            await auth.signOut();
            goto('/');
        } catch (err) {
            console.error('Logout error:', err);
        }
    }
</script>

<svelte:head>
    <title>Verify Email | Attendance System</title>
</svelte:head>

<div class="verify-page">
    <div class="verify-container">
        {#if isLoading}
            <div class="verify-card">
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Loading...</p>
                </div>
            </div>
        {:else if !user}
            <div class="verify-card">
                <div class="error-state">
                    <IconAlertCircle size={48} stroke={1.5} />
                    <h2>Not Logged In</h2>
                    <p>Please sign in to verify your email.</p>
                    <a href="/" class="btn-primary">Go to Login</a>
                </div>
            </div>
        {:else}
            <div class="verify-card">
                <!-- Header -->
                <div class="verify-header">
                    <div class="icon-wrapper">
                        <IconMail size={32} stroke={1.5} />
                    </div>
                    <h1>Verify Your Email</h1>
                    <p class="subtitle">
                        We've sent a verification code to<br>
                        <strong>{user.email}</strong>
                    </p>
                </div>

                <!-- Success Message -->
                {#if success}
                    <div class="alert alert-success">
                        <IconCheck size={18} stroke={2} />
                        <span>{success}</span>
                    </div>
                {/if}

                <!-- Error Message -->
                {#if error}
                    <div class="alert alert-error">
                        <IconAlertCircle size={18} stroke={2} />
                        <span>{error}</span>
                    </div>
                {/if}

                <!-- OTP Input -->
                <div class="otp-section">
                    <label class="otp-label">Enter 6-digit code</label>
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
                                disabled={isVerifying}
                            />
                        {/each}
                    </div>
                    
                    <!-- Timer -->
                    {#if timeRemaining > 0}
                        <p class="timer">
                            Code expires in <strong>{formatTime(timeRemaining)}</strong>
                        </p>
                    {/if}
                </div>

                <!-- Verify Button -->
                <button 
                    class="btn-primary verify-btn"
                    on:click={verifyCode}
                    disabled={isVerifying || otpDigits.some(d => d === '')}
                >
                    {#if isVerifying}
                        <IconLoader2 size={20} stroke={2} class="spin" />
                        Verifying...
                    {:else}
                        <IconShieldCheck size={20} stroke={2} />
                        Verify Email
                    {/if}
                </button>

                <!-- Resend Section -->
                <div class="resend-section">
                    <p class="resend-text">Didn't receive the code?</p>
                    {#if canResend}
                        <button 
                            class="btn-link"
                            on:click={handleResend}
                            disabled={isSending}
                        >
                            {#if isSending}
                                <IconLoader2 size={16} stroke={2} class="spin" />
                                Sending...
                            {:else}
                                <IconRefresh size={16} stroke={2} />
                                Resend Code
                            {/if}
                        </button>
                        {#if resendCount > 0}
                            <p class="resend-count">{maxResends - resendCount} resends remaining</p>
                        {/if}
                    {:else if resendCooldown > 0}
                        <p class="cooldown-text">Resend available in {resendCooldown}s</p>
                    {:else}
                        <p class="cooldown-text">Maximum resend attempts reached</p>
                    {/if}
                </div>

                <!-- Back Link -->
                <button class="btn-back" on:click={handleLogout}>
                    <IconArrowLeft size={16} stroke={2} />
                    Sign out and go back
                </button>
            </div>
        {/if}
    </div>
</div>

<style>
    .verify-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: var(--apple-light-bg, #f5f5f7);
    }

    .verify-container {
        width: 100%;
        max-width: 440px;
    }

    .verify-card {
        background: var(--apple-white, white);
        border-radius: 20px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
        padding: 40px;
    }

    /* Loading State */
    .loading-state {
        text-align: center;
        padding: 40px 0;
    }

    .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--apple-gray-4, #d1d1d6);
        border-top-color: var(--apple-accent, #007AFF);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    /* Error State */
    .error-state {
        text-align: center;
        padding: 20px 0;
        color: var(--apple-gray-1, #8e8e93);
    }

    .error-state h2 {
        margin: 16px 0 8px;
        color: var(--apple-black, #1d1d1f);
    }

    /* Header */
    .verify-header {
        text-align: center;
        margin-bottom: 32px;
    }

    .icon-wrapper {
        width: 72px;
        height: 72px;
        border-radius: 18px;
        background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        margin: 0 auto 20px;
        box-shadow: 0 8px 24px rgba(0, 122, 255, 0.25);
    }

    .verify-header h1 {
        font-size: 28px;
        font-weight: 700;
        color: var(--apple-black, #1d1d1f);
        margin: 0 0 12px;
    }

    .subtitle {
        font-size: 15px;
        color: var(--apple-gray-1, #8e8e93);
        line-height: 1.5;
        margin: 0;
    }

    .subtitle strong {
        color: var(--apple-black, #1d1d1f);
    }

    /* Alerts */
    .alert {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 16px;
        border-radius: 12px;
        font-size: 14px;
        margin-bottom: 24px;
    }

    .alert-success {
        background: rgba(52, 199, 89, 0.1);
        border: 1px solid rgba(52, 199, 89, 0.3);
        color: #059669;
    }

    .alert-error {
        background: rgba(255, 59, 48, 0.1);
        border: 1px solid rgba(255, 59, 48, 0.3);
        color: #dc2626;
    }

    /* OTP Section */
    .otp-section {
        margin-bottom: 24px;
    }

    .otp-label {
        display: block;
        font-size: 13px;
        font-weight: 500;
        color: var(--apple-gray-1, #8e8e93);
        margin-bottom: 12px;
        text-align: center;
    }

    .otp-inputs {
        display: flex;
        gap: 8px;
        justify-content: center;
    }

    .otp-input {
        width: 48px;
        height: 56px;
        border: 2px solid var(--apple-gray-4, #d1d1d6);
        border-radius: 12px;
        font-size: 24px;
        font-weight: 600;
        text-align: center;
        background: var(--apple-gray-6, #f2f2f7);
        color: var(--apple-black, #1d1d1f);
        transition: all 0.2s ease;
        outline: none;
    }

    .otp-input:focus {
        border-color: var(--apple-accent, #007AFF);
        background: white;
        box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1);
    }

    .otp-input.filled {
        border-color: var(--apple-accent, #007AFF);
        background: white;
    }

    .otp-input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .timer {
        text-align: center;
        font-size: 13px;
        color: var(--apple-gray-1, #8e8e93);
        margin-top: 16px;
    }

    .timer strong {
        color: var(--apple-accent, #007AFF);
        font-family: 'SF Mono', Monaco, monospace;
    }

    /* Buttons */
    .btn-primary {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 16px 24px;
        background: var(--apple-accent, #007AFF);
        color: white;
        font-size: 16px;
        font-weight: 600;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-primary:hover:not(:disabled) {
        background: #0066d6;
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(0, 122, 255, 0.3);
    }

    .btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
    }

    /* Resend Section */
    .resend-section {
        text-align: center;
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid var(--apple-gray-5, #e5e5ea);
    }

    .resend-text {
        font-size: 14px;
        color: var(--apple-gray-1, #8e8e93);
        margin: 0 0 8px;
    }

    .btn-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: none;
        border: none;
        color: var(--apple-accent, #007AFF);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        padding: 8px 16px;
        border-radius: 8px;
        transition: all 0.2s ease;
    }

    .btn-link:hover:not(:disabled) {
        background: rgba(0, 122, 255, 0.1);
    }

    .btn-link:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .resend-count {
        font-size: 12px;
        color: var(--apple-gray-2, #aeaeb2);
        margin: 8px 0 0;
    }

    .cooldown-text {
        font-size: 13px;
        color: var(--apple-gray-2, #aeaeb2);
        margin: 0;
    }

    /* Back Button */
    .btn-back {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        width: 100%;
        margin-top: 16px;
        padding: 12px;
        background: none;
        border: none;
        color: var(--apple-gray-1, #8e8e93);
        font-size: 14px;
        cursor: pointer;
        transition: color 0.2s ease;
    }

    .btn-back:hover {
        color: var(--apple-black, #1d1d1f);
    }

    /* Spin Animation */
    :global(.spin) {
        animation: spin 1s linear infinite;
    }

    /* Responsive */
    @media (max-width: 480px) {
        .verify-card {
            padding: 28px 20px;
        }

        .otp-input {
            width: 42px;
            height: 50px;
            font-size: 20px;
        }

        .verify-header h1 {
            font-size: 24px;
        }
    }
</style>
