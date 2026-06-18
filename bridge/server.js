require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })

const http = require('http')
const httpProxy = require('http-proxy')
const express = require('express')
const cors = require('cors')
const path = require('path')

const app = express()
const PORT = process.env.BRIDGE_PORT || 3099

app.use(cors())

// IMPORTANT: no global body parser here
const jsonParser = express.json()

// ── proxy: forward to stalwart ──────────────────────────
const STALWART = process.env.STALWART_URL || 'http://localhost:8080'
const stalwartProxy = httpProxy.createProxyServer({ changeOrigin: true, proxyTimeout: 30000, timeout: 30000 })

// ── stalwart auth proxy ────────────────────────────────────
app.post('/api/auth', jsonParser, async (req, res) => {
  const { type, accountName, accountSecret } = req.body || {}
  try {
    const authRes = await fetch(`${STALWART}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, accountName, accountSecret }),
    })
    const data = await authRes.json()
    res.status(authRes.status).json(data)
  } catch (err) {
    res.status(502).json({ error: 'auth proxy failed: ' + err.message })
  }
})

app.use('/jmap', (req, res) => {
  req.url = req.originalUrl
  stalwartProxy.web(req, res, { target: STALWART })
})

app.use('/api/mail', (req, res) => {
  req.url = req.originalUrl.replace(/^\/api\/mail/, '/api')
  stalwartProxy.web(req, res, { target: STALWART })
})

app.use('/dav', (req, res) => {
  req.url = req.originalUrl
  stalwartProxy.web(req, res, { target: STALWART })
})

// ── vaultwarden proxy ───────────────────────────────────
const VAULTWARDEN = process.env.VAULTWARDEN_URL || 'http://localhost:8085'
const vwProxy = httpProxy.createProxyServer({ changeOrigin: true })

app.use('/api/passwords', (req, res) => {
  req.url = req.originalUrl.replace(/^\/api\/passwords/, '')
  vwProxy.web(req, res, { target: VAULTWARDEN })
})

app.use('/identity', (req, res) => {
  req.url = req.originalUrl
  vwProxy.web(req, res, { target: VAULTWARDEN })
})

// ── aliases: serve from vault data store ─────────────────
app.use('/api/aliases', (req, res, next) => {
  const slUrl = process.env.SIMPLELOGIN_URL
  if (slUrl && (slUrl.startsWith('http://') || slUrl.startsWith('https://'))) {
    const proxy = httpProxy.createProxyServer({ changeOrigin: true })
    // remap /api/aliases to simplelogin /api/v2/aliases
    req.url = req.originalUrl.replace(/^\/api\/aliases/, '/api/v2/aliases')
    if (process.env.SIMPLELOGIN_API_KEY) {
      req.headers['Authentication'] = process.env.SIMPLELOGIN_API_KEY
    }
    return proxy.web(req, res, { target: slUrl })
  }
  const vaultRouter = require('./src/vault')
  const aliases = vaultRouter.loadVault().filter(i => i.type === 'alias').map(vaultRouter.sanitize)
  const id = req.path.slice(1)
  if (id) {
    const item = aliases.find(a => a.id === id)
    return item ? res.json(item) : res.status(404).json({ error: 'not found' })
  }
  res.json(aliases)
})

// ── vault API ─────────────────────────────────────────────
const vaultRouter = require('./src/vault')
app.use('/api/vault', vaultRouter.router)

// ── proton mail forwarding (IMAP bridge) ──────────────────
const protonState = {
  email: process.env.PROTON_EMAIL || null,
  password: process.env.PROTON_PASSWORD || null,
  enabled: process.env.PROTON_FORWARDING === '1',
  lastSync: null,
  twoFactorPending: false,
  sessionId: null,
}

app.get('/api/forwarding/status', (req, res) => {
  res.json({
    email: protonState.email,
    enabled: protonState.enabled,
    lastSync: protonState.lastSync,
    configured: !!(protonState.email && protonState.password),
    twoFactorPending: protonState.twoFactorPending,
  })
})

app.post('/api/forwarding/proton-login', jsonParser, (req, res) => {
  const { email, password, enabled, twoFactorCode } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' })
  }
  protonState.email = email
  protonState.password = password
  protonState.enabled = enabled !== false

  const Imap = require('imap')
  const pw = twoFactorCode ? password + ':' + twoFactorCode : password
  const imap = new Imap({
    user: email,
    password: pw,
    host: '127.0.0.1',
    port: 1143,
    tls: false,
  })
  imap.once('ready', () => {
    imap.end()
    protonState.twoFactorPending = false
    res.json({ ok: true, email, enabled: enabled !== false })
  })
  imap.once('error', (err) => {
    const msg = err.message || ''
    if (msg.toLowerCase().includes('2fa') || msg.toLowerCase().includes('two factor') || msg.toLowerCase().includes('authentication failed')) {
      protonState.twoFactorPending = true
      res.json({ ok: false, twoFactorPending: true, error: '2FA code required' })
    } else {
      res.status(400).json({ ok: false, error: msg })
    }
  })
  imap.connect()
})

app.post('/api/forwarding/proton-sync', jsonParser, async (req, res) => {
  if (!protonState.email || !protonState.password) {
    return res.status(400).json({ error: 'proton account not configured' })
  }
  if (!protonState.enabled) {
    return res.status(409).json({ error: 'forwarding disabled' })
  }
  try {
    const { spawn } = require('child_process')
    const config = JSON.stringify({
      bridgeHost: '127.0.0.1',
      bridgePort: 1143,
      username: protonState.email,
      password: protonState.password,
      forwardTo: 'admin@houseofmates.space',
      stalwartPassword: process.env.STALWART_ADMIN_PASSWORD || 'DSAzOWnlQdE18VMc',
      addresses: ['admin@houseofmates.space'],
    })
    const child = spawn('node', [require('path').resolve(__dirname, 'proton-sync.js'), config], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    })
    let out = ''
    let errOut = ''
    child.stdout.on('data', c => out += c)
    child.stderr.on('data', c => errOut += c)
    child.on('close', (code) => {
      protonState.lastSync = new Date().toISOString()
      if (code === 0) {
        res.json({ ok: true, synced: 1, lastSync: protonState.lastSync, output: out.trim() })
      } else {
        res.status(500).json({ error: 'sync failed: ' + (errOut || out).trim() })
      }
    })
  } catch (err) {
    res.status(502).json({ error: String(err.message || err) })
  }
})

// ── AI suite routes ─────────────────────────────────────────
const aiRoutes = require('./src/ai-routes')
app.use('/api', aiRoutes)

// ── serve frontend static build ───────────────────────────
const frontendDist = path.resolve(__dirname, '..', 'frontend', 'dist')
app.use(express.static(frontendDist))

// SPA fallback
app.use(function(req, res, next) {
  if (req.path.startsWith('/api/') || req.path.startsWith('/jmap/') || req.path.startsWith('/identity/') || req.path.startsWith('/dav/')) {
    return res.status(404).send('not found')
  }
  res.sendFile(path.join(frontendDist, 'index.html'))
})

// error handling
app.use((err, req, res, next) => {
  console.error('bridge error:', err.stack || err.message)
  if (!res.headersSent) {
    res.status(502).json({ error: 'bridge error: ' + err.message })
  }
})

app.listen(PORT, () => {
  console.log(`email bridge running on http://localhost:${PORT}`)
})