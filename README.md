<div align="center">
  <h1>email</h1>
  <p>unified interface for stalwart, vaultwarden, and simplelogin</p>
  <p>
    <em>one email client, one password manager, one alias service — on your infra</em>
  </p>
</div>

---

## what is this?

a self-hosted unified frontend for three services that live on your own hardware:

- **stalwart** — email server (jmap, smtp, imap)
- **vaultwarden** — password manager (bitwarden-compatible)
- **simplelogin** — email aliases (optional)

instead of maintaining three separate UIs, this project gives you:
- one web app for email + passwords + aliases
- one firefox extension for auto-fill and alias generation
- two native android apps (email.apk + passwords.apk)

## project structure

```
email/
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
```

## setup

### 1. configure .env

```
cp .env.example .env
```

edit the values to match your services.

### 2. start the bridge

```
cd bridge
npm install
node server.js
```

the bridge runs on `http://localhost:3099` and proxies:
- `/api/mail/*` → stalwart api
- `/api/passwords/*` → vaultwarden api  
- `/api/aliases/*` → simplelogin or stalwart alias store
- `/jmap/*` → stalwart jmap
- serves the frontend from `frontend/dist`

### 3. start the frontend (dev mode)

```
cd frontend
npm install
npm run dev
```

### 4. install the firefox extension

1. go to `about:debugging#/runtime/this-firefox`
2. click "load temporary add-on"
3. select `extension/web-ext-artifacts/passwords-1.0.zip`
4. right-click the extension icon → "manage extension"
5. enter your api base url (`http://localhost:3099`), alias domain, and auth token

### 5. install the android apps

```
adb install mobile/android/app/build/outputs/apk/debug/app-debug.apk
adb install mobile-passwords/android/app/build/outputs/apk/debug/app-debug.apk
```

## building everything

```
bash scripts/build-all.sh
```

## the pkm aesthetic

every pixel of this project follows the same design language:

| token | hex | use |
|---|---|---|
| `#050505` | bg | main background |
| `#f6b012` | gold | primary accent, ctas |
| `#3c9fdd` | sky | secondary accent, info |
| `#ffffff` | white | body text |

- **varela round** font everywhere
- **strictly lowercase** ui text
- no gradients, no shadows, no glass
- 44x44pt minimum touch targets
- `min-h-[100dvh]` not `h-screen`

## architecture

```
                     ┌──────────────────┐
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
```

## services integration

- **auth**: login against stalwart's oauth, credentials shared across all views
- **passwords**: stored in stalwart's credential store (also syncable with vaultwarden via bitwarden api)
- **aliases**: managed via stalwart's alias api, with optional simplelogin backend
- **extension**: detects signup pages (distinguishes from login), generates site-specific aliases, offers autofill from stored credentials
