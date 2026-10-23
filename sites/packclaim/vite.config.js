import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],

  server: {
    port: 6173
  },

  // Bind preview to IPv4 so tools/e2e-site.sh can reach it at 127.0.0.1.
  preview: {
    host: '127.0.0.1'
  },

  test: {
    expect: { requireAssertions: true },

    projects: [
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
