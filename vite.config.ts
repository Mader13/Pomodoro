import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

/**
 * GitHub project Pages live at `https://<user>.github.io/<repo>/`.
 * Relative `base: './'` breaks: opening `/repo` (no trailing slash) resolves
 * `./assets/*` to wrong host path → 404 for JS, white screen.
 * In GHA, use absolute `/<repo>/` from GITHUB_REPOSITORY.
 */
function productionBaseUrl(): string {
  if (process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REPOSITORY) {
    const repo = process.env.GITHUB_REPOSITORY.split('/')[1] ?? 'Pomodoro';
    return `/${repo}/`;
  }
  return './';
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    base: mode === 'production' ? productionBaseUrl() : '/',
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
