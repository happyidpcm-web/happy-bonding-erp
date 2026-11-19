# Android app

The Capacitor app bundles the React UI and connects to https://admin.happybonding.co.in/api using the existing login and branch permissions. It requires internet access. The website deployment is not modified by building this app.

## Build a test APK on Windows

Prerequisites: Node 22+, JDK 21, Android SDK platform 36, and Android build tools. Set JAVA_HOME to a JDK 21 installation (Android Studio's jbr works). Set the SDK path in android/local.properties, which must stay untracked.

1. npm ci
2. npm run android:sync
3. From android/: .\gradlew.bat assembleDebug
4. Install android/app/build/outputs/apk/debug/app-debug.apk on a test phone.

This is a debug-signed test package, not the final distribution build. Do not establish production installations with the debug key. For ongoing staff distribution, create and securely back up a release keystore, configure release signing outside version control, and retain the same application ID and signing key across updates. Increase versionCode for each release. Never uninstall to update a production app unnecessarily.

## Checks

- npx tsc -b
- npx playwright test --config playwright.mobile.config.ts
- Test on a real Android phone: login, branch switch, item search, create/save invoice, keyboard, PDF sharing, Android Back, screen rotation, and loss/recovery of network.
- Automated layout tests mock API responses and do not write to store data.
- Native PDF sharing uses the Android share sheet; files are staged in app cache. Choose WhatsApp or another compatible app. This does not automatically send anything.
- Android Back closes supported dialogs/navigation; otherwise it minimizes the app to preserve the current billing form. OS process termination can still discard an unsaved form.
- No offline billing or Bluetooth printer integration is included.
- Other browser download/print features (such as Excel export and direct printing) still need native device verification before rollout.

The server can be changed under Connection settings on the sign-in screen. Only HTTPS URLs without embedded credentials or query strings are accepted. Changing server clears the previous login and branch selection.
