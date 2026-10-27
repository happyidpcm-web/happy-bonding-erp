import { defineConfig } from "@playwright/test";
import config from "./playwright.mock.config";

export default defineConfig({ ...config, testMatch: "party-import.spec.ts", projects: [{ name: "chrome", use: { channel: "chrome" } }] });
