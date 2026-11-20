import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMobileServer, normalizeServerUrl, saveMobileServer } from '../src/utils/mobileServer.ts';

test('Android ignores relative saved addresses and normalizes secure server addresses', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>([['hb_android_api_url', '/api']]);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }});
  try {
    assert.equal(getMobileServer(), 'https://admin.happybonding.co.in/api');
    assert.equal(normalizeServerUrl('https://store.example/'), 'https://store.example/api');
    for (const value of ['/api', 'http://store.example', 'https://user:pass@store.example', 'https://store.example?key=secret']) {
      assert.throws(() => normalizeServerUrl(value));
    }
    values.set('hb_erp_token', 'old-session');
    values.set('hb_erp_branch', 'old-branch');
    saveMobileServer('https://store.example');
    assert.equal(getMobileServer(), 'https://store.example/api');
    assert.equal(values.has('hb_erp_token'), false);
    assert.equal(values.has('hb_erp_branch'), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
