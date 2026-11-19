import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: './tests/e2e', testMatch: 'mobile-layout.spec.ts',
 use: { baseURL: 'http://127.0.0.1:5178', browserName: 'chromium' },
 webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5178 --strictPort', url: 'http://127.0.0.1:5178', reuseExistingServer: true },
 projects: [360, 412, 768].map(width => ({ name: 'mobile-' + width, use: { viewport: { width, height: 850 }, isMobile: true, hasTouch: true } }))
});