import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { isAndroidApp } from '../utils/mobileServer';

export function useAndroidBack(drawerOpen: boolean, closeDrawer: () => void, isDashboard: boolean, goToDashboard: () => void) {
  useEffect(() => {
    if (!isAndroidApp()) return;
    const listener = App.addListener('backButton', () => {
      const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
      if (dialog) { dialog.dispatchEvent(new Event('cancel', { cancelable: true })); return; }
      const closeButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-native-back]')].filter(button => button.getClientRects().length);
      if (closeButtons.length) { closeButtons.at(-1)?.click(); return; }
      if (drawerOpen) { closeDrawer(); return; }
      if (!isDashboard) { goToDashboard(); return; }
      if (window.confirm("Exit Happy Bonding ERP?")) void App.exitApp();
    });
    return () => { void listener.then(handle => handle.remove()); };
  }, [drawerOpen, closeDrawer, isDashboard, goToDashboard]);
}
