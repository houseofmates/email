<h1 align="center">email</h1>

<p align="center">unified interface for stalwart, vaultwarden, and simplelogin</p>

<p align="center">
  <em>one email client, one password manager, one alias service — on your infra</em>
</p>

<hr>

<h2 align="center" id="what-is-this">what is this?</h2>

<p align="center">a self-hosted unified frontend for three services that live on your own hardware:</p>

- **stalwart** — email server (jmap, smtp, imap)
- **vaultwarden** — password manager (bitwarden-compatible)
- **simplelogin** — email aliases (optional)

<p align="center">instead of maintaining three separate uis, this project gives you:</p>

- one web app for email + passwords + aliases
- one firefox extension for auto-fill and alias generation
- two native android apps (email.apk + passwords.apk)

<hr>

<h2 align="center" id="project-structure">project structure</h2>

<pre align="center"><code>email/
├── frontend/          # react + vite + tailwind web app
│   ├── src/
│   │   ├── App.jsx       # unified routing + auth
│   │   ├── inbox.jsx     # jmap email client
│   │   ├── passwords.jsx # credential manager
│   │   ├── aliases.jsx   # email alias manager
│   │   ├── settings.jsx  # service status + logout
│   │   ├── layout.jsx    # shared nav (sidebar + bottom nav)
│   │   ├── login.jsx     # unified login
│   │   ├── jmap.js       # jmap api client
│   │   └── index.css     # pkm aesthetic
│   └── dist/             # built frontend
├── extension/         # firefox extension
│   ├── manifest.json
│   ├── background.js  # api bridge
│   ├── content.js     # signup detection + autofill
│   ├── popup.html/css # pkm-themed popup
│   ├── options.html   # settings page
│   └── web-ext-artifacts/  # built .xpi
├── bridge/            # node.js proxy server
│   ├── server.js      # unifies all service APIs
│   └── package.json
├── mobile/            # capacitor android app (email)
├── mobile-passwords/  # capacitor android app (passwords)
├── scripts/
│   ├── build-all.sh   # build everything
│   └── email-bridge.service  # systemd service
├── .env               # environment config
└── gen_icons*.py      # icon generators
</code></pre>

<hr>

<h2 align="center" id="setup">setup</h2>

<h3 align="center" id="1-configure-env">1. configure .env</h3>

<pre align="center"><code>cp .env.example .env
</code></pre>

<p align="center">edit the values to match your services.</p>

<h3 align="center" id="2-start-the-bridge">2. start the bridge</h3>

<pre align="center"><code>cd bridge
npm install
node server.js
</code></pre>

<p align="center">the bridge runs on <code>http://localhost:3099</code> and proxies:</p>

- `/api/mail/*` → stalwart api
- `/api/passwords/*` → vaultwarden api
- `/api/aliases/*` → simplelogin or stalwart alias store
- `/jmap/*` → stalwart jmap
- serves the frontend from `frontend/dist`

<h3 align="center" id="3-start-the-frontend-dev">3. start the frontend (dev mode)</h3>

<pre align="center"><code>cd frontend
npm install
npm run dev
</code></pre>

<h3 align="center" id="4-install-the-firefox-extension">4. install the firefox extension</h3>

1. go to `about:debugging#/runtime/this-firefox`
2. click "load temporary add-on"
3. select `extension/web-ext-artifacts/passwords-1.0.zip`
4. right-click the extension icon → "manage extension"
5. enter your api base url (`http://localhost:3099`), alias domain, and auth token

<h3 align="center" id="5-install-the-android-apps">5. install the android apps</h3>

<pre align="center"><code>adb install mobile/android/app/build/outputs/apk/debug/app-debug.apk
adb install mobile-passwords/android/app/build/outputs/apk/debug/app-debug.apk
</code></pre>

<hr>

<h2 align="center" id="building-everything">building everything</h2>

<pre align="center"><code>bash scripts/build-all.sh
</code></pre>

<hr>

<h2 align="center" id="the-pkm-aesthetic">the pkm aesthetic</h2>

<p align="center">every pixel of this project follows the same design language:</p>

<div align="center">
<table>
  <thead>
    <tr><th>token</th><th>hex</th><th>use</th></tr>
  </thead>
  <tbody>
    <tr><td><code>#050505</code></td><td>bg</td><td>main background</td></tr>
    <tr><td><code>#f6b012</code></td><td>gold</td><td>primary accent, ctas</td></tr>
    <tr><td><code>#3c9fdd</code></td><td>sky</td><td>secondary accent, info</td></tr>
    <tr><td><code>#ffffff</code></td><td>white</td><td>body text</td></tr>
  </tbody>
</table>
</div>

- **varela round** font everywhere
- **strictly lowercase** ui text
- no gradients, no shadows, no glass
- 44x44pt minimum touch targets
- `min-h-[100dvh]` not `h-screen`

<hr>

<h2 align="center" id="architecture">architecture</h2>

<pre align="center"><code>                     ┌──────────────────┐
                     │   firefox ext    │
                     │  (content.js)    │
                     └────────┬─────────┘
                              │
                     ┌────────▼─────────┐
                     │   bridge (:3099) │◄─────── frontend (vite :5173)
                     │  express proxy   │
                     └──┬────┬────┬─────┘
                        │    │    │
              ┌─────────┘    │    └──────────┐
              ▼              ▼               ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │  stalwart  │  │ vaultwarden│  │simplelogin │
     │  (:8080)   │  │  (:8085)   │  │ (optional) │
     └────────────┘  └────────────┘  └────────────┘
</code></pre>

<hr>

<h2 align="center" id="services-integration">services integration</h2>

- **auth**: login against stalwart's oauth, credentials shared across all views
- **passwords**: stored in stalwart's credential store (also syncable with vaultwarden via bitwarden api)
- **aliases**: managed via stalwart's alias api, with optional simplelogin backend
- **extension**: detects signup pages (distinguishes from login), generates site-specific aliases, offers autofill from stored credentials

<h2 align="center" id="license">license</h2>

<p align="center"><a href="./license">mates license (with disclaimer)</a></p>
