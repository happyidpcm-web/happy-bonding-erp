import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'in.happybonding.erp',
  appName: 'Happy Bonding',
  webDir: 'dist',
  backgroundColor: '#fffdf7',
  android: { backgroundColor: '#fffdf7' },
  plugins: { SystemBars: { insetsHandling: 'native' } },
};
export default config;
