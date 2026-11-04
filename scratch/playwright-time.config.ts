import base from '../playwright.mock.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({ ...base, testDir: '../tests/e2e', projects: [{name:'chrome', use:{...base.projects![0].use, channel:'chrome'}}] });
