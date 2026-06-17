require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })
const express = require('express')
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware')
const cors = require('cors')
const path = require('path')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

const app = express()
const PORT = process.env.BRIDGE_PORT || 3099

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://*"],
      connectSrc: ["'self'", "https://*", "wss://*"],
    },
  },
}))

app.use(cors())
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 20, message: { error: "too many attempts" } })

const createProxy = (target, pathRewrite = null) => createProxyMiddleware({
  target, changeOrigin: true, pathRewrite,
  on: {
    proxyReq: (pr, req) => { if (req.body) fixRequestBody(pr, req); },
    error: (err, req, res) => res.status(502).json({ error: 'service unavailable' })
  }
})

app.post('/api/crypto/decrypt', authLimiter, express.json(), (req, res) => {
  if (!req.body.masterPassword) return res.status(400).json({ error: "required" })
  res.json({ items: [], folders: [] })
})

app.use('/jmap', createProxy(process.env.STALWART_URL || 'http://stalwart:8080'))
app.use('/api/mail', authLimiter, createProxy((process.env.STALWART_URL || 'http://stalwart:8080') + '/api', { '^/api/mail': '' }))
app.use('/api/passwords', createProxy(process.env.VAULTWARDEN_URL || 'http://vaultwarden:80', { '^/api/passwords': '' }))
app.use('/identity', authLimiter, createProxy(process.env.VAULTWARDEN_URL || 'http://vaultwarden:80'))
app.use('/api/aliases', createProxy(process.env.SIMPLELOGIN_URL || 'http://simplelogin:5000', { '^/api/aliases': '' }))

const dist = path.resolve(__dirname, '..', 'frontend', 'dist')
app.use(express.static(dist))
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/jmap/') || req.path.startsWith('/identity/')) return res.status(404).send('not found')
  res.sendFile(path.join(dist, 'index.html'))
})

app.listen(PORT, () => console.log(`bridge listening on ${PORT}`))
