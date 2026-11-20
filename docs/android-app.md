# Android app

The Capacitor app bundles the React UI and connects to https://admin.happybonding.co.in/api using the existing login and branch permissions. It requires internet access. The website deployment is not modified by building this app.

## Build a test APK on Windows

Prerequisites: Node 22+, JDK 21, Android SDK platform 36, and Android build tools. Set JAVA_HOME to a JDK 21 installation (Android Studio's jbr works). Set the SDK path in android/local.properties, which must stay untracked.

1. npm ci
2. npm run build (generates the Prisma client and checks/builds the frontend)
3. npm run build:api
4. node --import tsx --test tests/*.test.ts
5. npm run android:sync (typechecks, builds and copies the web app and plugins)
6. From android/: .\gradlew.bat assembleDebug --console=plain
7. Install android/app/build/outputs/apk/debug/app-debug.apk on a test phone.

Run the tests after the build finishes, because the build regenerates the Prisma client used by the tests. The first Android build downloads Gradle and Maven dependencies and needs network access plus write access to the user Gradle cache.

Example local SDK configuration in `android/local.properties` (use your Windows username):

```properties
sdk.dir=C:/Users/YOUR_USER/AppData/Local/Android/Sdk
```

This is a debug-signed test package, not the final distribution build. Do not establish production installations with the debug key. For ongoing staff distribution, create and securely back up a release keystore, configure release signing outside version control, and retain the same application ID and signing key across updates. Increase versionCode for each release. Never uninstall to update a production app unnecessarily.

## Checks

## USB development (live reload)

Enable Developer options and USB debugging on the phone, connect a data USB cable and accept the computer authorization prompt. Start `npm run dev -- --host 127.0.0.1` in one terminal, then `npm run android:dev` in another. The script checks the authorized device, forwards port 5173 over USB, and uses Capacitor's development run command to install and launch the debug app. This first native installation is required; subsequent React/CSS edits reload without manually exporting APKs. Native plugin, manifest and launcher icon changes require another development run. Keep both terminals running; Ctrl+C stops the session. Backend requests still go to the selected HTTPS store server, so real billing actions affect that server.

The development command temporarily enables the local HTTP live reload URL. Normal `android:sync` restores the bundled configuration. Do not distribute a live reload installation as a production app.

## Validation

- npx tsc -b
- npx playwright install chromium --only-shell (first-time browser setup)
- npx playwright test --config playwright.mobile.config.ts
- Test on a real Android phone: login, branch switch, item search, create/save invoice, keyboard, PDF sharing, Android Back, screen rotation, and loss/recovery of network.
- Automated layout tests mock API responses and do not write to store data.
- Native PDF sharing uses the Android share sheet; files are staged in app cache. Choose WhatsApp or another compatible app. This does not automatically send anything.
- Android Back closes supported dialogs/navigation; otherwise it minimizes the app to preserve the current billing form. OS process termination can still discard an unsaved form.
- No offline billing or Bluetooth printer integration is included.
- Other browser download/print features (such as Excel export and direct printing) still need native device verification before rollout.

The server can be changed under Connection settings on the sign-in screen. Only HTTPS URLs without embedded credentials or query strings are accepted. Changing server clears the previous login and branch selection.
