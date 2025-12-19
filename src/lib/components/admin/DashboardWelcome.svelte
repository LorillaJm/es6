<script>
    import { adminAuthStore } from '$lib/stores/adminAuth.js';
    import { getTimeGreeting } from '$lib/stores/adminDashboard.js';
    import { IconClock, IconServer, IconDatabase, IconAlertCircle, IconChevronRight } from '@tabler/icons-svelte';
    import { onMount } from 'svelte';

    export let lastLogin = null;
    export let systemUptime = '99.9%';
    export let lastBackup = null;
    export let pendingApprovals = 0;

    $: greeting = getTimeGreeting();
    $: adminName = $adminAuthStore.admin?.name || 'Admin';
    $: adminRole = $adminAuthStore.admin?.role === 'super_admin' ? 'Super Admin' : 'Admin';
    $: currentDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
    });

    function formatLastLogin(date) {
        if (!date) return 'First login';
        return new Date(date).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    // Cinematic volumetric smoke - fluid dynamics simulation
    // Layered depth system: background (far), midground, foreground (near)
    const volumetricLayers = {
        // Deep background - large, slow, diffuse
        background: [
            { x: 20, y: 30, size: 400, opacity: 0.04, blur: 80, duration: 45, delay: 0 },
            { x: 60, y: 50, size: 500, opacity: 0.035, blur: 90, duration: 50, delay: 5 },
            { x: 80, y: 25, size: 380, opacity: 0.04, blur: 85, duration: 42, delay: 10 },
        ],
        // Midground - medium density, natural turbulence
        midground: [
            { x: 30, y: 40, size: 280, opacity: 0.07, blur: 55, duration: 32, delay: 0 },
            { x: 50, y: 55, size: 320, opacity: 0.06, blur: 60, duration: 36, delay: 4 },
            { x: 70, y: 35, size: 260, opacity: 0.065, blur: 50, duration: 30, delay: 8 },
            { x: 45, y: 60, size: 300, opacity: 0.055, blur: 58, duration: 34, delay: 12 },
        ],
        // Foreground - detailed wisps, rim-lit edges
        foreground: [
            { x: 35, y: 45, size: 180, opacity: 0.09, blur: 35, duration: 24, delay: 0 },
            { x: 55, y: 50, size: 200, opacity: 0.08, blur: 40, duration: 28, delay: 3 },
            { x: 65, y: 40, size: 160, opacity: 0.085, blur: 32, duration: 22, delay: 6 },
            { x: 40, y: 55, size: 190, opacity: 0.075, blur: 38, duration: 26, delay: 9 },
            { x: 50, y: 48, size: 170, opacity: 0.08, blur: 34, duration: 25, delay: 12 },
        ],
    };

    // Turbulence curls - organic swirling motion
    const turbulenceCurls = [
        { x: 40, y: 45, size: 120, duration: 18, delay: 0 },
        { x: 55, y: 52, size: 100, duration: 20, delay: 2 },
        { x: 48, y: 48, size: 140, duration: 22, delay: 4 },
        { x: 60, y: 42, size: 110, duration: 19, delay: 6 },
    ];

    // Passing clouds - different colors, horizontal drift
    const passingClouds = [
        // Soft pink/coral clouds
        { color: 'rgba(255, 182, 193, 0.15)', y: 20, height: 60, duration: 35, delay: 0 },
        { color: 'rgba(255, 160, 180, 0.12)', y: 70, height: 50, duration: 40, delay: 8 },
        // Soft purple/lavender clouds
        { color: 'rgba(200, 180, 255, 0.14)', y: 35, height: 70, duration: 38, delay: 4 },
        { color: 'rgba(180, 160, 240, 0.11)', y: 55, height: 55, duration: 42, delay: 15 },
        // Soft cyan/teal clouds
        { color: 'rgba(150, 220, 255, 0.13)', y: 45, height: 65, duration: 36, delay: 10 },
        { color: 'rgba(130, 200, 240, 0.1)', y: 80, height: 45, duration: 45, delay: 20 },
        // Soft gold/amber clouds
        { color: 'rgba(255, 215, 150, 0.12)', y: 25, height: 55, duration: 40, delay: 6 },
        { color: 'rgba(255, 200, 130, 0.1)', y: 60, height: 50, duration: 38, delay: 18 },
        // Soft mint/green clouds
        { color: 'rgba(180, 255, 220, 0.11)', y: 40, height: 60, duration: 44, delay: 12 },
    ];

    let mounted = false;
    onMount(() => {
        // Staggered mount for cinematic reveal
        setTimeout(() => { mounted = true; }, 100);
    });
</script>

<div class="hero-welcome">
    <!-- Background Pattern -->
    <div class="hero-bg-pattern"></div>
    
    <!-- Cinematic Volumetric Smoke System -->
    <div class="cinematic-smoke" class:mounted>
        <!-- Dark vignette overlay -->
        <div class="smoke-vignette"></div>
        
        <!-- Volumetric light beam -->
        <div class="volumetric-light"></div>
        
        <!-- Background layer - deep, diffuse -->
        <div class="smoke-layer layer-bg">
            {#each volumetricLayers.background as cloud, i}
                <div 
                    class="smoke-volume"
                    style="
                        --x: {cloud.x}%;
                        --y: {cloud.y}%;
                        --size: {cloud.size}px;
                        --opacity: {cloud.opacity};
                        --blur: {cloud.blur}px;
                        --duration: {cloud.duration}s;
                        --delay: {cloud.delay}s;
                        --drift-x: {(i % 2 === 0 ? 1 : -1) * 30}px;
                        --drift-y: {-20 - (i * 8)}px;
                    "
                ></div>
            {/each}
        </div>
        
        <!-- Midground layer - medium density -->
        <div class="smoke-layer layer-mid">
            {#each volumetricLayers.midground as cloud, i}
                <div 
                    class="smoke-volume mid"
                    style="
                        --x: {cloud.x}%;
                        --y: {cloud.y}%;
                        --size: {cloud.size}px;
                        --opacity: {cloud.opacity};
                        --blur: {cloud.blur}px;
                        --duration: {cloud.duration}s;
                        --delay: {cloud.delay}s;
                        --drift-x: {(i % 2 === 0 ? -1 : 1) * 25}px;
                        --drift-y: {-15 - (i * 6)}px;
                        --turbulence: {3 + (i * 2)}px;
                    "
                ></div>
            {/each}
        </div>
        
        <!-- Foreground layer - detailed, rim-lit -->
        <div class="smoke-layer layer-fg">
            {#each volumetricLayers.foreground as cloud, i}
                <div 
                    class="smoke-volume fg"
                    style="
                        --x: {cloud.x}%;
                        --y: {cloud.y}%;
                        --size: {cloud.size}px;
                        --opacity: {cloud.opacity};
                        --blur: {cloud.blur}px;
                        --duration: {cloud.duration}s;
                        --delay: {cloud.delay}s;
                        --drift-x: {(i % 2 === 0 ? 1 : -1) * 18}px;
                        --drift-y: {-12 - (i * 4)}px;
                    "
                ></div>
            {/each}
        </div>
        
        <!-- Turbulence curls - organic swirling -->
        <div class="smoke-layer layer-curls">
            {#each turbulenceCurls as curl, i}
                <div 
                    class="smoke-curl"
                    style="
                        --x: {curl.x}%;
                        --y: {curl.y}%;
                        --size: {curl.size}px;
                        --duration: {curl.duration}s;
                        --delay: {curl.delay}s;
                        --rotation: {(i % 2 === 0 ? 1 : -1) * 15}deg;
                    "
                ></div>
            {/each}
        </div>
        
        <!-- Rim light highlights -->
        <div class="rim-light rim-1"></div>
        <div class="rim-light rim-2"></div>
        
        <!-- Passing Clouds Layer -->
        <div class="clouds-layer">
            {#each passingClouds as cloud, i}
                <div 
                    class="passing-cloud"
                    class:reverse={i % 2 === 1}
                    style="
                        --color: {cloud.color};
                        --y: {cloud.y}%;
                        --height: {cloud.height}px;
                        --duration: {cloud.duration}s;
                        --delay: {cloud.delay}s;
                        --scale: {0.8 + (i % 3) * 0.15};
                    "
                ></div>
            {/each}
        </div>
    </div>
    
    <div class="hero-content">
        <!-- Left: Avatar & Greeting -->
        <div class="hero-main">
            <div class="avatar-wrapper">
                <div class="avatar">{adminName.charAt(0).toUpperCase()}</div>
                <div class="avatar-status"></div>
            </div>
            <div class="hero-text">
                <h1 class="hero-title">{greeting}, <span class="name-highlight">{adminName}</span></h1>
                <p class="hero-subtitle">{currentDate}</p>
                <div class="hero-meta">
                    <span class="role-badge">{adminRole}</span>
                    <span class="meta-divider">•</span>
                    <span class="last-login">
                        <IconClock size={14} stroke={1.5} />
                        Last login: {formatLastLogin(lastLogin)}
                    </span>
                </div>
            </div>
        </div>

        <!-- Right Section: Status Cards -->
        <div class="hero-right">
            <!-- Quick Status Cards -->
            <div class="hero-status-grid">
                <div class="status-card">
                    <div class="status-icon server">
                        <IconServer size={18} stroke={1.5} />
                    </div>
                    <div class="status-info">
                        <span class="status-value">{systemUptime}</span>
                        <span class="status-label">Uptime</span>
                    </div>
                </div>
                
                <div class="status-card">
                    <div class="status-icon database">
                        <IconDatabase size={18} stroke={1.5} />
                    </div>
                    <div class="status-info">
                        <span class="status-value">{lastBackup || '2h ago'}</span>
                        <span class="status-label">Last Backup</span>
                    </div>
                </div>
                
                {#if pendingApprovals > 0}
                    <a href="/admin/feedback" class="status-card alert clickable">
                        <div class="status-icon alert">
                            <IconAlertCircle size={18} stroke={1.5} />
                        </div>
                        <div class="status-info">
                            <span class="status-value">{pendingApprovals}</span>
                            <span class="status-label">Pending</span>
                        </div>
                        <IconChevronRight size={16} stroke={2} class="status-arrow" />
                    </a>
                {/if}
            </div>
        </div>
    </div>
</div>

<style>
    .hero-welcome {
        position: relative;
        background: linear-gradient(135deg, var(--apple-accent) 0%, #5856D6 100%);
        margin-bottom: 20px;
        border-radius: var(--apple-radius-xl);
        padding: clamp(20px, 4vw, 28px);
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0, 122, 255, 0.2);
    }

    .hero-bg-pattern {
        position: absolute;
        inset: 0;
        background: 
            radial-gradient(circle at 100% 0%, rgba(255, 255, 255, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 0% 100%, rgba(255, 255, 255, 0.1) 0%, transparent 40%);
        pointer-events: none;
    }

    /* ========================================
       CINEMATIC VOLUMETRIC SMOKE SYSTEM
       Apple Keynote-level quality
       ======================================== */
    
    .cinematic-smoke {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 0;
        opacity: 0;
        transition: opacity 1.5s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .cinematic-smoke.mounted {
        opacity: 1;
    }

    /* Dark vignette - cinematic framing */
    .smoke-vignette {
        position: absolute;
        inset: 0;
        background: radial-gradient(
            ellipse 80% 60% at 50% 50%,
            transparent 0%,
            transparent 40%,
            rgba(0, 0, 0, 0.15) 70%,
            rgba(0, 0, 0, 0.3) 100%
        );
        z-index: 10;
    }

    /* Volumetric light beam - subtle god ray */
    .volumetric-light {
        position: absolute;
        top: -20%;
        left: 35%;
        width: 30%;
        height: 140%;
        background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.03) 0%,
            rgba(200, 220, 255, 0.02) 30%,
            transparent 70%
        );
        transform: rotate(-8deg);
        filter: blur(30px);
        opacity: 0;
        animation: lightBeam 25s ease-in-out infinite;
    }

    @keyframes lightBeam {
        0%, 100% { opacity: 0; transform: rotate(-8deg) translateX(-10px); }
        30% { opacity: 0.6; }
        50% { opacity: 0.8; transform: rotate(-5deg) translateX(10px); }
        70% { opacity: 0.5; }
    }

    /* Smoke layers - depth system */
    .smoke-layer {
        position: absolute;
        inset: 0;
    }

    .layer-bg { z-index: 1; }
    .layer-mid { z-index: 2; }
    .layer-fg { z-index: 3; }
    .layer-curls { z-index: 4; }

    /* Base smoke volume - fluid simulation */
    .smoke-volume {
        position: absolute;
        left: var(--x);
        top: var(--y);
        width: var(--size);
        height: var(--size);
        transform: translate(-50%, -50%);
        border-radius: 50%;
        opacity: 0;
        /* Grayscale smoke with subtle blue tint in highlights */
        background: radial-gradient(
            ellipse 100% 80% at 50% 50%,
            rgba(220, 225, 235, var(--opacity)) 0%,
            rgba(180, 190, 210, calc(var(--opacity) * 0.7)) 25%,
            rgba(140, 150, 170, calc(var(--opacity) * 0.4)) 50%,
            rgba(100, 110, 130, calc(var(--opacity) * 0.2)) 75%,
            transparent 100%
        );
        filter: blur(var(--blur));
        mix-blend-mode: screen;
        animation: volumetricFlow var(--duration) cubic-bezier(0.4, 0, 0.6, 1) infinite;
        animation-delay: var(--delay);
    }

    /* Midground - added turbulence */
    .smoke-volume.mid {
        background: radial-gradient(
            ellipse 90% 100% at 50% 55%,
            rgba(200, 210, 230, var(--opacity)) 0%,
            rgba(170, 180, 200, calc(var(--opacity) * 0.6)) 30%,
            rgba(130, 140, 160, calc(var(--opacity) * 0.3)) 60%,
            transparent 100%
        );
        animation: volumetricFlowMid var(--duration) cubic-bezier(0.4, 0, 0.6, 1) infinite;
        animation-delay: var(--delay);
    }

    /* Foreground - rim-lit edges, more detail */
    .smoke-volume.fg {
        background: 
            radial-gradient(
                ellipse 80% 90% at 50% 50%,
                rgba(240, 245, 255, calc(var(--opacity) * 1.2)) 0%,
                rgba(200, 210, 230, calc(var(--opacity) * 0.8)) 20%,
                rgba(160, 170, 190, calc(var(--opacity) * 0.5)) 45%,
                rgba(120, 130, 150, calc(var(--opacity) * 0.2)) 70%,
                transparent 100%
            ),
            /* Rim light effect */
            radial-gradient(
                ellipse 120% 120% at 30% 30%,
                rgba(180, 200, 255, calc(var(--opacity) * 0.3)) 0%,
                transparent 50%
            );
        animation: volumetricFlowFg var(--duration) cubic-bezier(0.4, 0, 0.6, 1) infinite;
        animation-delay: var(--delay);
    }

    /* Turbulence curls - organic swirling */
    .smoke-curl {
        position: absolute;
        left: var(--x);
        top: var(--y);
        width: var(--size);
        height: calc(var(--size) * 0.6);
        transform: translate(-50%, -50%);
        border-radius: 50%;
        opacity: 0;
        background: radial-gradient(
            ellipse 100% 60% at 50% 50%,
            rgba(230, 235, 245, 0.06) 0%,
            rgba(200, 210, 225, 0.04) 40%,
            transparent 70%
        );
        filter: blur(25px);
        mix-blend-mode: screen;
        animation: curlMotion var(--duration) ease-in-out infinite;
        animation-delay: var(--delay);
    }

    /* Rim light highlights - edge definition */
    .rim-light {
        position: absolute;
        border-radius: 50%;
        filter: blur(40px);
        mix-blend-mode: screen;
        opacity: 0;
    }

    .rim-light.rim-1 {
        width: 200px;
        height: 80px;
        background: linear-gradient(90deg, transparent, rgba(180, 200, 255, 0.08), transparent);
        left: 25%;
        top: 40%;
        animation: rimPulse1 20s ease-in-out infinite;
    }

    .rim-light.rim-2 {
        width: 150px;
        height: 60px;
        background: linear-gradient(90deg, transparent, rgba(200, 215, 255, 0.06), transparent);
        right: 30%;
        top: 55%;
        animation: rimPulse2 18s ease-in-out infinite;
        animation-delay: 5s;
    }

    /* ========================================
       KEYFRAME ANIMATIONS - Fluid Dynamics
       ======================================== */

    /* Background layer - slow, majestic drift */
    @keyframes volumetricFlow {
        0%, 100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.7) translateY(20px);
        }
        10% {
            opacity: calc(var(--opacity) * 0.5);
        }
        25% {
            opacity: var(--opacity);
            transform: translate(-50%, -50%) scale(0.85) translateY(10px) translateX(calc(var(--drift-x) * 0.3));
        }
        50% {
            opacity: calc(var(--opacity) * 0.9);
            transform: translate(-50%, -50%) scale(1) translateY(var(--drift-y)) translateX(calc(var(--drift-x) * 0.6));
        }
        75% {
            opacity: calc(var(--opacity) * 0.6);
            transform: translate(-50%, -50%) scale(1.1) translateY(calc(var(--drift-y) * 1.5)) translateX(var(--drift-x));
        }
        90% {
            opacity: calc(var(--opacity) * 0.2);
        }
    }

    /* Midground - natural turbulence */
    @keyframes volumetricFlowMid {
        0%, 100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.6) translateY(15px);
        }
        8% {
            opacity: calc(var(--opacity) * 0.4);
        }
        20% {
            opacity: var(--opacity);
            transform: translate(-50%, -50%) scale(0.8) translateY(5px) translateX(calc(var(--drift-x) * 0.2));
        }
        35% {
            transform: translate(-50%, -50%) scale(0.9) translateY(calc(var(--drift-y) * 0.4)) translateX(calc(var(--drift-x) * 0.4)) rotate(2deg);
        }
        50% {
            opacity: calc(var(--opacity) * 0.85);
            transform: translate(-50%, -50%) scale(1) translateY(calc(var(--drift-y) * 0.7)) translateX(calc(var(--drift-x) * 0.6)) rotate(-1deg);
        }
        65% {
            transform: translate(-50%, -50%) scale(1.05) translateY(var(--drift-y)) translateX(calc(var(--drift-x) * 0.8)) rotate(1deg);
        }
        80% {
            opacity: calc(var(--opacity) * 0.5);
            transform: translate(-50%, -50%) scale(1.15) translateY(calc(var(--drift-y) * 1.3)) translateX(var(--drift-x));
        }
        92% {
            opacity: calc(var(--opacity) * 0.15);
        }
    }

    /* Foreground - detailed, breath-like */
    @keyframes volumetricFlowFg {
        0%, 100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5) translateY(10px);
        }
        5% {
            opacity: calc(var(--opacity) * 0.3);
        }
        15% {
            opacity: var(--opacity);
            transform: translate(-50%, -50%) scale(0.7) translateY(3px);
        }
        30% {
            transform: translate(-50%, -50%) scale(0.85) translateY(calc(var(--drift-y) * 0.3)) translateX(calc(var(--drift-x) * 0.3)) rotate(-2deg);
        }
        45% {
            opacity: calc(var(--opacity) * 0.95);
            transform: translate(-50%, -50%) scale(0.95) translateY(calc(var(--drift-y) * 0.5)) translateX(calc(var(--drift-x) * 0.5)) rotate(1deg);
        }
        60% {
            transform: translate(-50%, -50%) scale(1) translateY(calc(var(--drift-y) * 0.7)) translateX(calc(var(--drift-x) * 0.7)) rotate(-1deg);
        }
        75% {
            opacity: calc(var(--opacity) * 0.6);
            transform: translate(-50%, -50%) scale(1.08) translateY(var(--drift-y)) translateX(var(--drift-x)) rotate(0.5deg);
        }
        88% {
            opacity: calc(var(--opacity) * 0.2);
        }
    }

    /* Curl motion - organic swirling */
    @keyframes curlMotion {
        0%, 100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.6) rotate(0deg);
        }
        15% {
            opacity: 0.5;
        }
        30% {
            opacity: 0.7;
            transform: translate(-50%, -50%) scale(0.85) rotate(calc(var(--rotation) * 0.5)) translateX(8px);
        }
        50% {
            opacity: 0.6;
            transform: translate(-50%, -50%) scale(1) rotate(var(--rotation)) translateX(15px) translateY(-8px);
        }
        70% {
            opacity: 0.4;
            transform: translate(-50%, -50%) scale(1.1) rotate(calc(var(--rotation) * 1.5)) translateX(10px) translateY(-15px);
        }
        85% {
            opacity: 0.15;
        }
    }

    /* Rim light pulses */
    @keyframes rimPulse1 {
        0%, 100% { opacity: 0; transform: translateX(-15px) scaleX(0.8); }
        25% { opacity: 0.6; }
        50% { opacity: 0.8; transform: translateX(20px) scaleX(1.2); }
        75% { opacity: 0.4; }
    }

    @keyframes rimPulse2 {
        0%, 100% { opacity: 0; transform: translateX(10px) scaleX(0.9); }
        30% { opacity: 0.5; }
        55% { opacity: 0.7; transform: translateX(-15px) scaleX(1.15); }
        80% { opacity: 0.3; }
    }

    /* ========================================
       PASSING CLOUDS - Colorful Drift
       ======================================== */
    
    .clouds-layer {
        position: absolute;
        inset: 0;
        z-index: 5;
        overflow: hidden;
    }

    .passing-cloud {
        position: absolute;
        top: var(--y);
        left: -30%;
        width: 60%;
        height: var(--height);
        background: linear-gradient(
            90deg,
            transparent 0%,
            var(--color) 20%,
            var(--color) 50%,
            var(--color) 80%,
            transparent 100%
        );
        border-radius: 100px;
        filter: blur(30px);
        opacity: 0;
        transform: scaleY(var(--scale)) translateY(-50%);
        animation: cloudDriftRight var(--duration) linear infinite;
        animation-delay: var(--delay);
    }

    .passing-cloud.reverse {
        left: auto;
        right: -30%;
        animation: cloudDriftLeft var(--duration) linear infinite;
        animation-delay: var(--delay);
    }

    /* Cloud drift animations - smooth horizontal pass */
    @keyframes cloudDriftRight {
        0% {
            left: -30%;
            opacity: 0;
            transform: scaleY(var(--scale)) scaleX(0.8) translateY(-50%);
        }
        5% {
            opacity: 0.6;
        }
        15% {
            opacity: 1;
            transform: scaleY(var(--scale)) scaleX(1) translateY(-50%);
        }
        50% {
            opacity: 0.9;
            transform: scaleY(calc(var(--scale) * 1.1)) scaleX(1.05) translateY(calc(-50% - 5px));
        }
        85% {
            opacity: 1;
            transform: scaleY(var(--scale)) scaleX(1) translateY(-50%);
        }
        95% {
            opacity: 0.5;
        }
        100% {
            left: 130%;
            opacity: 0;
            transform: scaleY(var(--scale)) scaleX(0.9) translateY(-50%);
        }
    }

    @keyframes cloudDriftLeft {
        0% {
            right: -30%;
            opacity: 0;
            transform: scaleY(var(--scale)) scaleX(0.8) translateY(-50%);
        }
        5% {
            opacity: 0.6;
        }
        15% {
            opacity: 1;
            transform: scaleY(var(--scale)) scaleX(1) translateY(-50%);
        }
        50% {
            opacity: 0.85;
            transform: scaleY(calc(var(--scale) * 1.08)) scaleX(1.03) translateY(calc(-50% + 3px));
        }
        85% {
            opacity: 1;
            transform: scaleY(var(--scale)) scaleX(1) translateY(-50%);
        }
        95% {
            opacity: 0.5;
        }
        100% {
            right: 130%;
            opacity: 0;
            transform: scaleY(var(--scale)) scaleX(0.9) translateY(-50%);
        }
    }

    /* ========================================
       ACCESSIBILITY & PERFORMANCE
       ======================================== */

    @media (prefers-reduced-motion: reduce) {
        .cinematic-smoke.mounted {
            opacity: 0.5;
        }
        .smoke-volume,
        .smoke-curl,
        .rim-light,
        .volumetric-light,
        .passing-cloud {
            animation: none !important;
            opacity: 0.3;
        }
    }

    /* Hide on mobile for performance */
    @media (max-width: 768px) {
        .cinematic-smoke {
            display: none;
        }
    }

    .hero-content {
        position: relative;
        z-index: 1;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 20px;
    }

    .hero-main {
        display: flex;
        align-items: center;
        gap: 16px;
        flex: 1;
        min-width: 0;
    }

    .avatar-wrapper {
        position: relative;
        flex-shrink: 0;
    }

    .avatar {
        width: 64px;
        height: 64px;
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 24px;
        font-weight: 700;
    }

    .avatar-status {
        position: absolute;
        bottom: 2px;
        right: 2px;
        width: 14px;
        height: 14px;
        background: var(--apple-green);
        border: 3px solid rgba(255, 255, 255, 0.9);
        border-radius: 50%;
    }

    .hero-text {
        flex: 1;
        min-width: 0;
    }

    .hero-title {
        font-size: clamp(18px, 2.5vw, 26px);
        font-weight: 700;
        color: white;
        margin: 0 0 4px;
        letter-spacing: -0.3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .name-highlight {
        opacity: 0.95;
    }

    .hero-subtitle {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.8);
        margin: 0 0 8px;
    }

    .hero-meta {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }

    .role-badge {
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(8px);
        color: white;
        font-size: 10px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 20px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .meta-divider {
        color: rgba(255, 255, 255, 0.4);
        font-size: 10px;
    }

    .last-login {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.75);
    }

    /* Right Section */
    .hero-right {
        display: flex;
        align-items: center;
        flex-shrink: 0;
    }

    /* Status Grid */
    .hero-status-grid {
        display: flex;
        gap: 10px;
    }

    .status-card {
        display: flex;
        align-items: center;
        gap: 10px;
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(10px);
        padding: 10px 14px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        transition: var(--apple-transition);
        text-decoration: none;
    }

    .status-card.clickable {
        cursor: pointer;
    }

    .status-card.clickable:hover {
        background: rgba(255, 255, 255, 0.25);
        transform: translateY(-2px);
    }

    .status-card.alert {
        background: rgba(255, 149, 0, 0.25);
        border-color: rgba(255, 149, 0, 0.3);
    }

    .status-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        flex-shrink: 0;
    }

    .status-icon.server {
        background: rgba(52, 199, 89, 0.3);
    }

    .status-icon.database {
        background: rgba(90, 200, 250, 0.3);
    }

    .status-icon.alert {
        background: rgba(255, 149, 0, 0.4);
    }

    .status-info {
        display: flex;
        flex-direction: column;
    }

    .status-value {
        font-size: 14px;
        font-weight: 600;
        color: white;
        line-height: 1.2;
    }

    .status-label {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.7);
    }

    .status-card :global(.status-arrow) {
        color: rgba(255, 255, 255, 0.6);
        margin-left: 4px;
    }

    /* Responsive - Tablet */
    @media (max-width: 1100px) {
        .hero-content {
            flex-wrap: wrap;
        }

        .hero-right {
            width: 100%;
            justify-content: flex-end;
            margin-top: 8px;
        }

        .hero-status-grid {
            flex-wrap: wrap;
        }
    }

    /* Responsive - Mobile */
    @media (max-width: 768px) {
        .hero-welcome {
            padding: 16px;
            border-radius: var(--apple-radius-lg);
            margin-bottom: 16px;
        }

        .hero-content {
            flex-direction: column;
            gap: 16px;
        }

        .hero-main {
            width: 100%;
        }

        .avatar {
            width: 52px;
            height: 52px;
            font-size: 20px;
        }

        .hero-title {
            font-size: 18px;
        }

        .hero-subtitle {
            font-size: 13px;
        }

        .hero-right {
            width: 100%;
        }

        .hero-status-grid {
            width: 100%;
            justify-content: space-between;
        }

        .status-card {
            flex: 1;
            min-width: 0;
            padding: 10px 12px;
        }
    }

    /* Responsive - Small Mobile */
    @media (max-width: 480px) {
        .hero-welcome {
            padding: 14px;
            margin-bottom: 12px;
        }

        .hero-main {
            gap: 12px;
        }

        .avatar {
            width: 46px;
            height: 46px;
            font-size: 18px;
        }

        .hero-title {
            font-size: 16px;
        }

        .hero-subtitle {
            font-size: 12px;
            margin-bottom: 6px;
        }

        .hero-meta {
            gap: 8px;
        }

        .role-badge {
            font-size: 9px;
            padding: 3px 8px;
        }

        .last-login {
            font-size: 10px;
        }

        .hero-status-grid {
            gap: 8px;
        }

        .status-card {
            padding: 8px 10px;
            gap: 8px;
        }

        .status-icon {
            width: 28px;
            height: 28px;
        }

        .status-value {
            font-size: 12px;
        }

        .status-label {
            font-size: 9px;
        }
    }

    /* Extra Small */
    @media (max-width: 360px) {
        .status-card {
            flex-direction: column;
            text-align: center;
            padding: 10px 8px;
        }

        .status-info {
            align-items: center;
        }
    }
</style>
