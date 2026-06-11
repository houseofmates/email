# native mobile features (capacitor)

the capacitor app wraps the unified web build (`webDir: ../frontend/dist`), so
everything in the web app already works on device, and the offline service
worker (`frontend/public/sw.js`) gives an offline app shell inside the webview.

the items below are **native-only** — they need the android/ios toolchain and
capacitor plugins, so they can't be built or validated in the CI sandbox. this
is the wiring plan for when you build locally.

## build / sync

```bash
cd frontend && npm install && npm run build      # produces frontend/dist
cd ../mobile && npm install && npx cap sync       # copies dist + native deps
npx cap open android                              # build/run in android studio
```

after adding any plugin below: `npm i <plugin>` in `mobile/`, then `npx cap sync`,
and add it to `includePlugins` in `capacitor.config.ts` if you trim plugins.

## 1. biometric unlock (faceid / fingerprint)

plugin: `capacitor-native-biometric` (or `@aparajita/capacitor-biometric-auth`).

flow — biometrics gate a locally-stored master password that then unlocks the
vault via the existing `/api/passwords/unlock`:

```js
import { NativeBiometric } from "capacitor-native-biometric"

// after the user unlocks once, offer "enable biometric unlock":
await NativeBiometric.setCredentials({ username: "vault", password: masterPassword, server: "email.vault" })

// on app open / resume:
const { isAvailable } = await NativeBiometric.isAvailable()
if (isAvailable) {
  await NativeBiometric.verifyIdentity({ reason: "unlock your vault" })
  const c = await NativeBiometric.getCredentials({ server: "email.vault" })
  await vault.unlock(authHeader, userEmail, c.password) // services/vault.js
}
```

the master password sits in the OS keystore/keychain guarded by biometrics; it
is never written to app storage in plaintext. respect the vault's idle
auto-lock (re-prompt after backgrounding).

## 2. push notifications (new mail / reminders / security)

plugins: `@capacitor/push-notifications` (+ FCM on android / APNs on ios).

```js
import { PushNotifications } from "@capacitor/push-notifications"
await PushNotifications.requestPermissions()
await PushNotifications.register()
PushNotifications.addListener("registration", (t) =>
  fetch(`${apiBase}/api/push/register`, { method: "POST", headers: { authorization: authHeader }, body: JSON.stringify({ token: t.value, platform: "android" }) }))
```

bridge side (to add to `bridge/server.js`): a `/api/push/register` route storing
the device token, and a small sender that pushes via FCM when stalwart reports
new mail. stalwart → bridge can be driven by a JMAP `EventSource`/push
subscription (the bridge subscribes, fans out to FCM). honor the per-category
toggles already in settings (`notifyMail` / `notifyCalendar` / `notifySecurity`).

## 3. offline support

already covered by the PWA service worker for the app shell + cached static
assets; live data (`/api`, `/jmap`, `/dav`) is never cached. for richer offline
(read cached mail/vault while disconnected), have the relevant services persist
their last sync to `@capacitor/preferences` and hydrate from it when a fetch
fails. the vault already caches decrypted ciphers in the extension; mirror that
pattern with encrypted-at-rest preferences on device.

## 4. share extension (receive text/links from other apps)

plugin: `send-intent` (android) / share extension (ios). on receive, route into
compose (mail) or "save login/alias":

```js
import { SendIntent } from "send-intent"
SendIntent.checkSendIntentReceived().then((r) => {
  if (r?.text) window.dispatchEvent(new CustomEvent("shared:text", { detail: r.text }))
})
```

the web app can listen for `shared:text` and open the relevant compose/add modal.

## 5. widgets (upcoming events / unread / quick-add)

home-screen widgets are native (android app widget / ios widgetkit) and live
outside the webview — implement in the native project, reading from a small
bridge JSON endpoint (e.g. `/api/widgets/summary` returning unread count + next
events). not a capacitor-plugin concern.

---

**status:** the web/PWA layer (offline shell, installable, all features) is done
and is what the capacitor app loads today. the five items above are the native
deltas; each lists the plugin + the integration point in this codebase.
