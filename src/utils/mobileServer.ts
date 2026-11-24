import { Capacitor } from '@capacitor/core';

const SERVER_KEY = 'hb_android_api_url';
export const isAndroidApp = () => Capacitor.getPlatform() === 'android';

export function normalizeServerUrl(value: string): string {
  const url = new URL(value.trim());
  const isLoopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) || url.username || url.password || url.search || url.hash) {
    throw new Error('Enter your secure HTTPS website address, or a local loopback address for development.');
  }
  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = path.endsWith('/api') ? path : `${path}/api`;
  return url.toString().replace(/\/+$/, '');
}

export function getMobileServer() {
  return localStorage.getItem(SERVER_KEY) || import.meta.env.VITE_API_URL || 'https://admin.happybonding.co.in/api';
}

export function saveMobileServer(value: string) {
  const normalized = normalizeServerUrl(value);
  if (normalized !== getMobileServer()) {
    localStorage.removeItem('hb_erp_token');
    localStorage.removeItem('hb_erp_branch');
  }
  localStorage.setItem(SERVER_KEY, normalized);
}
