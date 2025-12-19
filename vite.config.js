import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), ...(isDev ? [basicSsl()] : [])],
	build: {
		rollupOptions: {
			external: ['@aws-sdk/client-rekognition']
		}
	},
	server: {
        https: true,
        host: '0.0.0.0',
        port: 5173
    },
    preview: {
        https: false,
        port: 4173
    },
	test: {
		projects: [
			{
				extends: './vite.config.js',
				test: {
					name: 'client',
					environment: 'browser',
					browser: {
						enabled: true,
						provider: 'playwright',
						instances: [{ browser: 'chromium' }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.js']
				}
			},
			{
				extends: './vite.config.js',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
