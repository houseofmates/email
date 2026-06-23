require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })
const express = require('express')
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware')
const cors = require('cors')
const path = require('path')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const crypto = require('crypto')

const app = express()
const PORT = process.env.BRIDGE_PORT || 3099

// --- SECURITY HARDENING ---
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

// Force HTTPS in production (if detected via headers from Caddy)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

app.use(cors())
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 20, message: { error: "too many attempts" } })

const jsonParser = express.json()

// Sanitize logs
app.use((req, res, next) => {
  const oldLog = console.log;
  console.log = (...args) => {
    const sanitized = args.map(arg => {
      if (typeof arg === 'string') {
        return arg.replace(/Authorization: [^ ]+/g, 'Authorization: [REDACTED]')
                  .replace(/"masterPassword":"[^"]+"/g, '"masterPassword":"[REDACTED]"');
      }
      return arg;
    });
    oldLog(...sanitized);
  };
  next();
});

// Option B Decryptor
app.post('/api/crypto/decrypt', authLimiter, jsonParser, async (req, res) => {
  const { masterPassword, cipher } = req.body
  if (!masterPassword || !cipher) return res.status(400).json({ error: "missing data" })

  try {
    // Bitwarden spec decryption logic placeholder
    console.log('[Crypto] Decrypting vault item...');
    res.json({ ...cipher, decrypted: true, data: { username: "decrypted", password: "pw" } })
  } catch (err) {
    res.status(500).json({ error: "decryption failed" })
  }
})

const proxy = (target, pathRewrite = null) => createProxyMiddleware({
  target, changeOrigin: true, pathRewrite,
  on: {
    proxyReq: (pr, req) => { if (req.body) fixRequestBody(pr, req); },
    error: (err, req, res) => res.status(502).json({ error: 'service unavailable' })
  }
})

app.use('/jmap', proxy(process.env.STALWART_URL || 'http://stalwart:8080'))
app.use('/api/mail', authLimiter, proxy((process.env.STALWART_URL || 'http://stalwart:8080') + '/api', { '^/api/mail': '' }))
app.use('/api/passwords', proxy(process.env.VAULTWARDEN_URL || 'http://vaultwarden:80', { '^/api/passwords': '' }))
app.use('/identity', authLimiter, proxy(process.env.VAULTWARDEN_URL || 'http://vaultwarden:80'))
app.use('/api/aliases', proxy(process.env.SIMPLELOGIN_URL || 'http://simplelogin:5000/api', { '^/api/aliases': '' }))

const dist = path.resolve(__dirname, '..', 'frontend', 'dist')
app.use(express.static(dist))
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/jmap/')) return res.status(404).send('not found')
  res.sendFile(path.join(dist, 'index.html'))
})

app.listen(PORT, () => console.log(`bridge listening on ${PORT}`))
