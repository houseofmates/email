require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })

const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')
const cors = require('cors')
const path = require('path')

const app = express()
const PORT = process.env.BRIDGE_PORT || 3099

app.use(cors())
app.use(express.json())

// ── stalwart email proxy ──────────────────────────────────
// stalwart serves JMAP at /jmap/* and REST API at /api/*
app.use('/jmap', createProxyMiddleware({
  target: process.env.STALWART_URL || 'http://localhost:8080',
  changeOrigin: true,
}))

// stalwart management API (auth, account, live, etc.)
app.use('/api/mail', createProxyMiddleware({
  target: (process.env.STALWART_URL || 'http://localhost:8080') + '/api',
  changeOrigin: true,
  pathRewrite: { '^/api/mail': '' },
}))

// ── vaultwarden proxy ─────────────────────────────────────
app.use('/api/passwords', createProxyMiddleware({
  target: process.env.VAULTWARDEN_URL || 'http://localhost:8085',
  changeOrigin: true,
  pathRewrite: { '^/api/passwords': '' },
}))

app.use('/identity', createProxyMiddleware({
  target: process.env.VAULTWARDEN_URL || 'http://localhost:8085',
  changeOrigin: true,
}))

// ── simplelogin proxy (if configured) ─────────────────────
app.use('/api/aliases', (req, res, next) => {
  const slUrl = process.env.SIMPLELOGIN_URL
  if (slUrl) {
    return createProxyMiddleware({
      target: slUrl,
      changeOrigin: true,
      on: {
        proxyReq: (proxyReq) => {
          if (process.env.SIMPLELOGIN_API_KEY) {
            proxyReq.setHeader('Authentication', process.env.SIMPLELOGIN_API_KEY)
          }
        },
      },
    })(req, res, next)
  }
  // fallback: use stalwart's own alias store at /api/aliases
  return createProxyMiddleware({
    target: (process.env.STALWART_URL || 'http://localhost:8080') + '/api',
    changeOrigin: true,
    pathRewrite: { '^/api/aliases': '/aliases' },
  })(req, res, next)
})

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

app.post('/api/forwarding/proton-login', (req, res) => {
  const { email, password, enabled } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' })
  }
  protonState.email = email
  protonState.password = password
  protonState.enabled = enabled !== false
  res.json({ ok: true, email: protonState.email, enabled: protonState.enabled })
})

app.post('/api/forwarding/proton-sync', async (req, res) => {
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
  if (req.path.startsWith('/api/') || req.path.startsWith('/jmap/') || req.path.startsWith('/identity/')) {
    return res.status(404).send('not found')
  }
  res.sendFile(path.join(frontendDist, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`email bridge running on http://localhost:${PORT}`)
})