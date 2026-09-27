import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '../tests/e2e', use: {baseURL:'http://localhost:4000'}, workers:1 });
