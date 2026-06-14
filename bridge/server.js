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
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://*"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
}))

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "too many login attempts" }
})

app.use(cors())
const jsonParser = express.json()

// Option B Crypto
app.post('/api/crypto/decrypt', authLimiter, jsonParser, async (req, res) => {
  const { masterPassword } = req.body
  if (!masterPassword) return res.status(400).json({ error: "master password required" })
  // Bridge handles decryption here
  res.json({ items: [], folders: [] })
})

app.use('/jmap', createProxyMiddleware({ target: process.env.STALWART_URL || 'http://stalwart:8080', changeOrigin: true, on: { proxyReq: fixRequestBody } }))
app.use('/api/mail', authLimiter, createProxyMiddleware({ target: (process.env.STALWART_URL || 'http://stalwart:8080') + '/api', changeOrigin: true, pathRewrite: { '^/api/mail': '' }, on: { proxyReq: fixRequestBody } }))
app.use('/api/passwords', createProxyMiddleware({ target: process.env.VAULTWARDEN_URL || 'http://vaultwarden:80', changeOrigin: true, pathRewrite: { '^/api/passwords': '' }, on: { proxyReq: fixRequestBody } }))
app.use('/identity', authLimiter, createProxyMiddleware({ target: process.env.VAULTWARDEN_URL || 'http://vaultwarden:80', changeOrigin: true, on: { proxyReq: fixRequestBody } }))
app.use('/api/aliases', createProxyMiddleware({ target: process.env.SIMPLELOGIN_URL || 'http://simplelogin:5000', changeOrigin: true, on: { proxyReq: (pr) => { if (process.env.SIMPLELOGIN_API_KEY) pr.setHeader('Authentication', process.env.SIMPLELOGIN_API_KEY); } } }))

const frontendDist = path.resolve(__dirname, '..', 'frontend', 'dist')
app.use(express.static(frontendDist))
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/jmap/') || req.path.startsWith('/identity/')) return res.status(404).send('not found')
  res.sendFile(path.join(frontendDist, 'index.html'))
})

app.listen(PORT, () => console.log(`bridge running on ${PORT}`))
