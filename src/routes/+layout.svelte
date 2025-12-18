<script>
	import '../app.css';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import SplashScreen from '$lib/components/SplashScreen.svelte';
	import { registerServiceWorker, swStatus, updateServiceWorker } from '$lib/utils/serviceWorker.js';
	import { initPushNotifications } from '$lib/notifications/pushNotificationService.js';
	import { preloadSounds, playSound, setupServiceWorkerSoundListener } from '$lib/notifications/notificationSoundPlayer.js';
	
	let { children } = $props();
	let showSplash = $state(false);
	let appReady = $state(false);
	let showUpdateBanner = $state(false);

	// Subscribe to SW status for update notifications
	$effect(() => {
		if ($swStatus.updateAvailable) {
			showUpdateBanner = true;
		}
	});

	onMount(async () => {
		if (browser) {
			// Register service worker
			registerServiceWorker().then((registration) => {
				if (registration) {
					console.log('[App] Service worker registered');
				}
			});

			// Initialize push notifications with sound support
			initPushNotifications().then((result) => {
				if (result.success) {
					console.log('[App] Push notifications initialized with sound support');
				}
			});

			// Preload notification sounds for instant playback
			preloadSounds();

			// Set up listener for service worker sound messages (for background notifications)
			setupServiceWorkerSoundListener();

			// Check if running as installed PWA/APK (standalone mode)
			const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
				|| window.navigator.standalone 
				|| document.referrer.includes('android-app://');
			
			if (isStandalone) {
				// Always show splash when PWA/APK opens
				showSplash = true;
			} else {
				// Browser: only show splash once per session
				const hasSeenSplash = sessionStorage.getItem('splashShown');
				if (!hasSeenSplash) {
					showSplash = true;
					sessionStorage.setItem('splashShown', 'true');
				} else {
					appReady = true;
				}
			}
		}
	});

	function handleSplashComplete() {
		showSplash = false;
		appReady = true;
	}

	function handleUpdate() {
		updateServiceWorker();
	}

	function dismissUpdate() {
		showUpdateBanner = false;
	}
</script>

{#if showSplash}
	<SplashScreen onComplete={handleSplashComplete} duration={2500} />
{/if}

{#if appReady || !browser}
	{@render children()}
{/if}

<!-- Update Available Banner -->
{#if showUpdateBanner}
	<div class="update-banner">
		<div class="update-content">
			<span class="update-icon">🔄</span>
			<span class="update-text">A new version is available!</span>
		</div>
		<div class="update-actions">
			<button class="update-btn" onclick={handleUpdate}>Update Now</button>
			<button class="dismiss-btn" onclick={dismissUpdate}>Later</button>
		</div>
	</div>
{/if}

<!-- Offline Indicator -->
{#if $swStatus.offline}
	<div class="offline-banner">
		<span class="offline-icon">📴</span>
		<span>You're offline. Some features may be limited.</span>
	</div>
{/if}

<style>
	.update-banner {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: linear-gradient(135deg, #007AFF, #5856D6);
		color: white;
		padding: 12px 16px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		z-index: 10000;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
		flex-wrap: wrap;
	}
	.update-content {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.update-icon {
		font-size: 18px;
	}
	.update-text {
		font-size: 14px;
		font-weight: 500;
	}
	.update-actions {
		display: flex;
		gap: 8px;
	}
	.update-btn {
		background: white;
		color: #007AFF;
		border: none;
		padding: 8px 16px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: transform 0.2s;
	}
	.update-btn:hover {
		transform: scale(1.02);
	}
	.dismiss-btn {
		background: rgba(255, 255, 255, 0.2);
		color: white;
		border: none;
		padding: 8px 12px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}
	.offline-banner {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		background: #FF9500;
		color: white;
		padding: 8px 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 500;
		z-index: 10000;
	}
	.offline-icon {
		font-size: 14px;
	}

	@media (max-width: 480px) {
		.update-banner {
			flex-direction: column;
			text-align: center;
			padding-bottom: calc(12px + env(safe-area-inset-bottom));
		}
	}
</style>
