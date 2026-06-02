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