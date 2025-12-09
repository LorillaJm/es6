<script>
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { activeHoliday, seasonalPrefs, seasonalConfig } from '$lib/stores/seasonalTheme.js';
    
    export let onGiftReceived = (gift) => {};
    
    let showOrnament = true;
    let showMascot = false;
    let mascotMessage = '';
    let shakeDetected = false;
    let giftModal = false;
    let currentGift = null;
    let lastShakeTime = 0;
    
    // Christmas tips from Santa
    const santaTips = [
        "🎅 Ho ho ho! Don't forget to check in today!",
        "🎅 Keep up your attendance streak for bonus rewards!",
        "🎅 Shake your phone for a surprise gift! 📱",
        "🎅 Merry Christmas! You're doing great!",
        "🎅 Stay consistent - Santa's watching! 👀",
        "🎅 Your dedication is on the nice list! ✨"
    ];
    
    // Possible gifts from shaking
    const gifts = [
        { emoji: '🎁', name: 'Mystery Box', points: 10, rarity: 'common' },
        { emoji: '⭐', name: 'Golden Star', points: 25, rarity: 'uncommon' },
        { emoji: '🍪', name: 'Christmas Cookie', points: 5, rarity: 'common' },
        { emoji: '🎄', name: 'Mini Tree', points: 15, rarity: 'common' },
        { emoji: '❄️', name: 'Snowflake Badge', points: 50, rarity: 'rare' },
        { emoji: '🦌', name: 'Reindeer Friend', points: 100, rarity: 'legendary' },
        { emoji: '🔔', name: 'Jingle Bell', points: 20, rarity: 'uncommon' }
    ];
    
    const rarityColors = {
        common: '#34C759',
        uncommon: '#007AFF',
        rare: '#AF52DE',
        legendary: '#FFD700'
    };
    
    // Shake detection
    let shakeThreshold = 15;
    let lastX = 0, lastY = 0, lastZ = 0;
    
    function handleMotion(event) {
        if (!browser || !$activeHoliday || $activeHoliday.id !== 'christmas') return;
        if (!$seasonalPrefs.enabled) return;
        
        const { accelerationIncludingGravity } = event;
        if (!accelerationIncludingGravity) return;
        
        const { x, y, z } = accelerationIncludingGravity;
        const deltaX = Math.abs(x - lastX);
        const deltaY = Math.abs(y - lastY);
        const deltaZ = Math.abs(z - lastZ);
        
        if ((deltaX > shakeThreshold && deltaY > shakeThreshold) ||
            (deltaX > shakeThreshold && deltaZ > shakeThreshold) ||
            (deltaY > shakeThreshold && deltaZ > shakeThreshold)) {
            
            const now = Date.now();
            if (now - lastShakeTime > 3000) { // 3 second cooldown
                lastShakeTime = now;
                triggerGift();
            }
        }
        
        lastX = x; lastY = y; lastZ = z;
    }
    
    function triggerGift() {
        // Weighted random selection based on rarity
        const weights = { common: 50, uncommon: 30, rare: 15, legendary: 5 };
        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        
        let selectedRarity = 'common';
        for (const [rarity, weight] of Object.entries(weights)) {
            random -= weight;
            if (random <= 0) {
                selectedRarity = rarity;
                break;
            }
        }
        
        const rarityGifts = gifts.filter(g => g.rarity === selectedRarity);
        currentGift = rarityGifts[Math.floor(Math.random() * rarityGifts.length)];
        giftModal = true;
        shakeDetected = true;
        
        // Play sound if enabled
        if ($seasonalPrefs.soundEnabled && browser) {
            playBellSound();
        }
        
        // Callback for parent to handle reward
        onGiftReceived(currentGift);
        
        setTimeout(() => shakeDetected = false, 500);
    }
    
    function playBellSound() {
        // Simple bell sound using Web Audio API
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.3);
            
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.5);
        } catch (e) {
            console.log('Audio not supported');
        }
    }
    
    function showRandomTip() {
        if (!$activeHoliday || $activeHoliday.id !== 'christmas') return;
        mascotMessage = santaTips[Math.floor(Math.random() * santaTips.length)];
        showMascot = true;
        setTimeout(() => showMascot = false, 5000);
    }
    
    function closeGiftModal() {
        giftModal = false;
        currentGift = null;
    }
    
    onMount(() => {
        if (!browser) return;
        
        // Request motion permission on iOS
        if (typeof DeviceMotionEvent !== 'undefined' && 
            typeof DeviceMotionEvent.requestPermission === 'function') {
            // iOS 13+ requires permission
            document.addEventListener('click', async () => {
                try {
                    const permission = await DeviceMotionEvent.requestPermission();
                    if (permission === 'granted') {
                        window.addEventListener('devicemotion', handleMotion);
                    }
                } catch (e) {
                    console.log('Motion permission denied');
                }
            }, { once: true });
        } else {
            window.addEventListener('devicemotion', handleMotion);
        }
        
        // Show Santa tip randomly every 2-5 minutes
        const tipInterval = setInterval(() => {
            if (Math.random() > 0.7) showRandomTip();
        }, 120000 + Math.random() * 180000);
        
        // Show initial tip after 30 seconds
        setTimeout(showRandomTip, 30000);
        
        return () => {
            window.removeEventListener('devicemotion', handleMotion);
            clearInterval(tipInterval);
        };
    });
    
    $: isChristmas = $activeHoliday?.id === 'christmas' && $seasonalPrefs.enabled;
</script>

{#if isChristmas}
    <!-- Floating Christmas Ornament -->
    {#if showOrnament && $seasonalConfig?.intensity?.decorations}
        <div class="floating-ornament" aria-hidden="true">
            <div class="ornament-glow"></div>
            <div class="ornament-ball">🎄</div>
            <div class="ornament-sparkle sparkle-1">✨</div>
            <div class="ornament-sparkle sparkle-2">✨</div>
            <div class="ornament-sparkle sparkle-3">⭐</div>
        </div>
    {/if}
    
    <!-- Santa Mascot with Tips -->
    {#if showMascot}
        <div class="santa-mascot" class:visible={showMascot}>
            <div class="mascot-bubble">
                <p>{mascotMessage}</p>
                <button class="mascot-close" on:click={() => showMascot = false}>×</button>
            </div>
            <div class="mascot-avatar">🎅</div>
        </div>
    {/if}
    
    <!-- Gift Modal -->
    {#if giftModal && currentGift}
        <div class="gift-overlay" on:click={closeGiftModal} on:keydown={(e) => e.key === 'Escape' && closeGiftModal()} role="button" tabindex="0">
            <div class="gift-modal" on:click|stopPropagation>
                <div class="gift-burst"></div>
                <div class="gift-content">
                    <div class="gift-emoji" style="--rarity-color: {rarityColors[currentGift.rarity]}">{currentGift.emoji}</div>
                    <h3 class="gift-title">You found a gift!</h3>
                    <p class="gift-name">{currentGift.name}</p>
                    <div class="gift-points">+{currentGift.points} points</div>
                    <span class="gift-rarity" style="--rarity-color: {rarityColors[currentGift.rarity]}">{currentGift.rarity}</span>
                    <button class="gift-btn" on:click={closeGiftModal}>Collect 🎁</button>
                </div>
            </div>
        </div>
    {/if}
    
    <!-- Shake Indicator (mobile hint) -->
    <div class="shake-hint" class:shake-active={shakeDetected}>
        <span>📱</span>
        <span class="shake-text">Shake for gifts!</span>
    </div>
{/if}

<style>
    /* Floating Ornament */
    .floating-ornament {
        position: fixed;
        bottom: 120px;
        right: 24px;
        z-index: 100;
        pointer-events: none;
    }
    
    .ornament-ball {
        font-size: 48px;
        animation: ornament-float 3s ease-in-out infinite;
        filter: drop-shadow(0 4px 12px rgba(196, 30, 58, 0.4));
    }
    
    .ornament-glow {
        position: absolute;
        inset: -20px;
        background: radial-gradient(circle, rgba(196, 30, 58, 0.3) 0%, transparent 70%);
        border-radius: 50%;
        animation: glow-pulse 2s ease-in-out infinite;
    }
    
    .ornament-sparkle {
        position: absolute;
        font-size: 16px;
        animation: sparkle-twinkle 1.5s ease-in-out infinite;
    }
    
    .sparkle-1 { top: -10px; left: 50%; animation-delay: 0s; }
    .sparkle-2 { top: 20px; right: -15px; animation-delay: 0.5s; }
    .sparkle-3 { bottom: 0; left: -10px; animation-delay: 1s; }
    
    @keyframes ornament-float {
        0%, 100% { transform: translateY(0) rotate(-5deg); }
        50% { transform: translateY(-15px) rotate(5deg); }
    }
    
    @keyframes glow-pulse {
        0%, 100% { opacity: 0.5; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.1); }
    }
    
    @keyframes sparkle-twinkle {
        0%, 100% { opacity: 0.3; transform: scale(0.8); }
        50% { opacity: 1; transform: scale(1.2); }
    }
    
    /* Santa Mascot */
    .santa-mascot {
        position: fixed;
        bottom: 100px;
        left: 24px;
        z-index: 1000;
        display: flex;
        align-items: flex-end;
        gap: 12px;
        opacity: 0;
        transform: translateX(-20px);
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    .santa-mascot.visible {
        opacity: 1;
        transform: translateX(0);
    }
    
    .mascot-avatar {
        font-size: 56px;
        animation: santa-bounce 2s ease-in-out infinite;
        filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
    }
    
    @keyframes santa-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
    }
    
    .mascot-bubble {
        background: var(--theme-card-bg, white);
        border-radius: 16px 16px 16px 4px;
        padding: 14px 18px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        max-width: 260px;
        position: relative;
        animation: bubble-pop 0.3s ease-out;
    }
    
    @keyframes bubble-pop {
        0% { transform: scale(0.8); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
    }
    
    .mascot-bubble p {
        font-size: 14px;
        color: var(--theme-text, #0A0A0A);
        margin: 0;
        line-height: 1.5;
    }
    
    .mascot-close {
        position: absolute;
        top: 6px;
        right: 8px;
        background: none;
        border: none;
        font-size: 18px;
        color: var(--theme-text-secondary, #8E8E93);
        cursor: pointer;
        padding: 4px;
        line-height: 1;
    }
    
    /* Gift Modal */
    .gift-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        animation: fade-in 0.3s ease;
    }
    
    @keyframes fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    .gift-modal {
        background: var(--theme-card-bg, white);
        border-radius: 28px;
        padding: 40px;
        text-align: center;
        position: relative;
        overflow: hidden;
        animation: modal-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
    }
    
    @keyframes modal-pop {
        0% { transform: scale(0.5) rotate(-10deg); opacity: 0; }
        100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    
    .gift-burst {
        position: absolute;
        inset: -50%;
        background: conic-gradient(
            from 0deg,
            #C41E3A 0deg, transparent 30deg,
            #228B22 60deg, transparent 90deg,
            #FFD700 120deg, transparent 150deg,
            #C41E3A 180deg, transparent 210deg,
            #228B22 240deg, transparent 270deg,
            #FFD700 300deg, transparent 330deg
        );
        animation: burst-spin 10s linear infinite;
        opacity: 0.1;
    }
    
    @keyframes burst-spin {
        to { transform: rotate(360deg); }
    }
    
    .gift-content {
        position: relative;
        z-index: 1;
    }
    
    .gift-emoji {
        font-size: 80px;
        margin-bottom: 16px;
        animation: gift-bounce 0.6s ease-out;
        filter: drop-shadow(0 8px 16px var(--rarity-color));
    }
    
    @keyframes gift-bounce {
        0% { transform: translateY(-30px) scale(0); }
        60% { transform: translateY(10px) scale(1.1); }
        100% { transform: translateY(0) scale(1); }
    }
    
    .gift-title {
        font-size: 24px;
        font-weight: 700;
        color: var(--theme-text, #0A0A0A);
        margin: 0 0 8px;
    }
    
    .gift-name {
        font-size: 18px;
        font-weight: 600;
        color: var(--theme-text, #0A0A0A);
        margin: 0 0 12px;
    }
    
    .gift-points {
        font-size: 28px;
        font-weight: 700;
        color: #34C759;
        margin-bottom: 8px;
    }
    
    .gift-rarity {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1px;
        background: var(--rarity-color);
        color: white;
        margin-bottom: 20px;
    }
    
    .gift-btn {
        display: block;
        width: 100%;
        padding: 14px 28px;
        background: linear-gradient(135deg, #C41E3A, #228B22);
        color: white;
        font-size: 16px;
        font-weight: 600;
        border: none;
        border-radius: 14px;
        cursor: pointer;
        transition: transform 0.2s ease;
    }
    
    .gift-btn:hover {
        transform: scale(1.05);
    }
    
    /* Shake Hint */
    .shake-hint {
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
        background: rgba(196, 30, 58, 0.9);
        color: white;
        border-radius: 24px;
        font-size: 13px;
        font-weight: 500;
        opacity: 0.8;
        z-index: 99;
        transition: all 0.3s ease;
    }
    
    .shake-hint span:first-child {
        animation: shake-phone 1s ease-in-out infinite;
    }
    
    @keyframes shake-phone {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-15deg); }
        75% { transform: rotate(15deg); }
    }
    
    .shake-hint.shake-active {
        background: #34C759;
        transform: translateX(-50%) scale(1.1);
    }
    
    /* Responsive */
    @media (max-width: 768px) {
        .floating-ornament {
            bottom: 160px;
            right: 16px;
        }
        
        .ornament-ball {
            font-size: 36px;
        }
        
        .santa-mascot {
            bottom: 160px;
            left: 16px;
        }
        
        .mascot-avatar {
            font-size: 44px;
        }
        
        .mascot-bubble {
            max-width: 200px;
            padding: 12px 14px;
        }
        
        .gift-modal {
            margin: 20px;
            padding: 32px 24px;
        }
        
        .gift-emoji {
            font-size: 60px;
        }
    }
    
    /* Hide on desktop (shake is mobile-only) */
    @media (min-width: 1025px) {
        .shake-hint {
            display: none;
        }
    }
    
    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
        .ornament-ball,
        .ornament-glow,
        .ornament-sparkle,
        .mascot-avatar,
        .gift-burst,
        .gift-emoji,
        .shake-hint span:first-child {
            animation: none;
        }
    }
</style>
