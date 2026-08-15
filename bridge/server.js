require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })

const express = require('express')
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const path = require('path')

const app = express()
const PORT = process.env.BRIDGE_PORT || 3099
const PROD = process.env.NODE_ENV === 'production'

// trust the first reverse proxy hop (caddy/nginx) so that req.secure,
// req.ip (for rate limiting) and x-forwarded-proto are read correctly.
app.set('trust proxy', 1)

// ── security headers (helmet) ─────────────────────────────
// mounted BEFORE the proxies. helmet only sets response headers and never
// reads the request body, so it does not interfere with the body-stream
// ordering documented below.
//
// csp policy:
//   - scriptSrc 'self' only — NO inline scripts (vite emits external modules)
//   - styleSrc allows 'unsafe-inline' because tailwind injects a <style> tag
//     and layout.jsx appends a runtime <style> for safe-area padding
//   - fonts come from google fonts (see frontend/index.html)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"], // anti-clickjacking
      baseUri: ["'self'"],
      formAction: ["'self'"],
      // helmet enables this by default; keep it for prod (forces https
      // subresources) but disable in dev so local http isn't force-upgraded.
      'upgrade-insecure-requests': PROD ? [] : null,
    },
  },
  // hsts only makes sense once served over https in production
  hsts: PROD ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  // allow the frontend to embed cross-origin font/img resources it requests
  crossOriginEmbedderPolicy: false,
}))

// ── force https in production ─────────────────────────────
// when running behind a reverse proxy that terminates tls, redirect any
// plaintext request up to https. relies on trust proxy (set above).
if (PROD) {
  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next()
    return res.redirect(301, `https://${req.headers.host}${req.url}`)
  })
}

app.use(cors())

// ── rate limiting on auth endpoints ───────────────────────
// brute-force protection for the credential-bearing endpoints. mounted before
// the proxies for those exact paths so abusive clients are rejected at the
// edge. generous enough for normal use (token refreshes, retries) but caps
// password-guessing. note: option-b decrypt routes (added later) reuse this.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too many attempts, try again later' },
})
app.use('/api/passwords/unlock', authLimiter)   // vault unlock (master password)
app.use('/api/passwords/create', authLimiter)   // vault creation
app.use('/api/mail/auth', authLimiter)           // stalwart auth

// ── log redaction ─────────────────────────────────────────
// NEVER log Authorization headers or request bodies (they carry master
// passwords / basic-auth credentials). this helper is the only sanctioned way
// to emit request diagnostics; it strips secrets first. it is silent unless
// BRIDGE_DEBUG=1, so production logs stay clean.
function safeLog(req, extra) {
  if (process.env.BRIDGE_DEBUG !== '1') return
  // eslint-disable-next-line no-console
  console.log(`[bridge] ${req.method} ${req.path}${extra ? ' ' + extra : ''}`)
}
// expose so later routes (e.g. option-b decrypt) can reuse it without
// accidentally reaching for console.log directly.
app.locals.safeLog = safeLog

// IMPORTANT: do NOT install a global body parser here.
//
// `express.json()` consumes (drains) the request body stream. If it runs before
// the proxy middlewares below, then any application/json POST that gets proxied
// (e.g. the JMAP API call to /jmap/, vaultwarden, aliases) is forwarded upstream
// with an already-consumed body. The upstream then blocks waiting for a body
// that never arrives, the socket hangs until it times out, and the client sees a
// 502 (this was the "jmap 502" after ~15s). Body parsing is instead scoped to
// the local, non-proxied routes that actually read req.body (see jsonParser).
const jsonParser = express.json()

// ── stalwart email proxy ──────────────────────────────────
// stalwart serves JMAP at /jmap/* and REST API at /api/*
app.use('/jmap', createProxyMiddleware({
  target: process.env.STALWART_URL || 'http://localhost:8080',
  changeOrigin: true,
  on: { proxyReq: fixRequestBody },
}))

// stalwart management API (auth, account, live, etc.)
app.use('/api/mail', createProxyMiddleware({
  target: (process.env.STALWART_URL || 'http://localhost:8080') + '/api',
  changeOrigin: true,
  pathRewrite: { '^/api/mail': '' },
  on: { proxyReq: fixRequestBody },
}))

// stalwart caldav/carddav (calendar + contacts) — used by the calendar view and
// reachable by external clients (thunderbird, apple calendar) at /dav/*
app.use('/dav', createProxyMiddleware({
  target: process.env.STALWART_URL || 'http://localhost:8080',
  changeOrigin: true,
  on: { proxyReq: fixRequestBody },
}))

// ── passwords: self-contained encrypted vault ─────────────
// no external password service. the bridge owns an encrypted vault file and
// serves decrypted json for the duration of an unlocked session. see
// credential-store.js for the envelope-encryption design.
const credentialStore = require('./credential-store')
app.use('/api/passwords', credentialStore.createRouter())

// ── simplelogin proxy (if configured) ─────────────────────
// which alias backend is active — the frontend uses this to decide whether to
// show the full simplelogin ui or the basic stalwart-store ui.
const SL_URL = process.env.SIMPLELOGIN_URL
const SL_KEY = process.env.SIMPLELOGIN_API_KEY
app.get('/api/aliases/config', (req, res) => {
  res.json({ provider: SL_URL && SL_KEY ? 'simplelogin' : 'stalwart' })
})

if (SL_URL && SL_KEY) {
  // full simplelogin feature set, with method/path translation (see simplelogin.js)
  const simplelogin = require('./simplelogin')
  app.use('/api/aliases', simplelogin.createRouter(SL_URL, SL_KEY))
} else {
  // fallback: stalwart's own alias store at /api/aliases (basic list/create/delete)
  app.use('/api/aliases', createProxyMiddleware({
    target: (process.env.STALWART_URL || 'http://localhost:8080') + '/api',
    changeOrigin: true,
    pathRewrite: { '^/api/aliases': '/aliases' },
    on: { proxyReq: fixRequestBody },
  }))
}

// ── proton mail forwarding ────────────────────────────────
// stores the proton bridge account used to pull mail into the local inbox and
// exposes a manual sync trigger. credentials are kept in memory only (and in the
// configured env for restart persistence); they are never returned to the client.
//
// note: for *outgoing* mail to appear as sent from a proton alias, stalwart's
// smtp sender / identity must also be configured for that address — forwarding
// here only covers the inbound pull.
const protonState = {
  email: process.env.PROTON_EMAIL || null,
  password: process.env.PROTON_PASSWORD || null,
  enabled: process.env.PROTON_FORWARDING === '1',
  lastSync: null,
}

app.get('/api/forwarding/status', (req, res) => {
  res.json({
    email: protonState.email,
    enabled: protonState.enabled,
    lastSync: protonState.lastSync,
    configured: !!(protonState.email && protonState.password),
  })
})

app.post('/api/forwarding/proton-login', jsonParser, (req, res) => {
  const { email, password, enabled } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' })
  }
  protonState.email = email
  protonState.password = password
  protonState.enabled = enabled !== false
  res.json({ ok: true, email: protonState.email, enabled: protonState.enabled })
})

app.post('/api/forwarding/proton-sync', jsonParser, async (req, res) => {
  if (!protonState.email || !protonState.password) {
    return res.status(400).json({ error: 'proton account not configured' })
  }
  if (!protonState.enabled) {
    return res.status(409).json({ error: 'forwarding disabled' })
  }
  try {
    // the actual pull is performed by the proton-bridge sidecar (configured out
    // of band); this endpoint kicks it and records the timestamp. wire the real
    // bridge call here when the sidecar url is provided via PROTON_BRIDGE_URL.
    const bridgeUrl = process.env.PROTON_BRIDGE_URL
    let synced = 0
    if (bridgeUrl) {
      const r = await fetch(`${bridgeUrl}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: protonState.email }),
      })
      const data = await r.json().catch(() => ({}))
      synced = data.synced || 0
    }
    protonState.lastSync = new Date().toISOString()
    res.json({ ok: true, synced, lastSync: protonState.lastSync })
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) })
  }
})

// ── serve frontend static build ───────────────────────────
const frontendDist = path.resolve(__dirname, '..', 'frontend', 'dist')
app.use(express.static(frontendDist))

// SPA fallback middleware - handle all non-API routes by serving index.html
app.use(function(req, res, next) {
  if (req.path.startsWith('/api/') || req.path.startsWith('/jmap/') || req.path.startsWith('/dav/')) {
    return res.status(404).send('not found')
  }
  res.sendFile(path.join(frontendDist, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`email bridge running on http://localhost:${PORT}`)
})