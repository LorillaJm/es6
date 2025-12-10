<script>
	import '../app.css';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import SplashScreen from '$lib/components/SplashScreen.svelte';
	
	let { children } = $props();
	let showSplash = $state(false);
	let appReady = $state(false);

	onMount(() => {
		if (browser) {
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
</script>

{#if showSplash}
	<SplashScreen onComplete={handleSplashComplete} duration={2500} />
{/if}

{#if appReady || !browser}
	{@render children()}
{/if}
