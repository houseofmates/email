const { loadVault, sanitize } = require('./vault')
const { analyzePasswordStrength } = require('./vault-intelligence')
const path = require('path')
const fs = require('fs')

const VAULTWARDEN_URL = process.env.VAULTWARDEN_URL || 'http://localhost:8085'
const VAULT_ADMIN_TOKEN = process.env.VAULTWARDEN_ADMIN_TOKEN
const VAULT_DATA_FILE = process.env.VAULT_DATA_FILE || path.resolve('/home/house/email/data', 'vault.json')
const FETCH_TIMEOUT = 5000

const ADMIN_CIPHER_CANDIDATES = [
  '/api/admin/ciphers',
  '/admin/api/ciphers',
  '/admin/ciphers',
  '/api/ciphers',
  '/admin/users',
]

function timedFetch(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer))
}

async function adminLogin() {
  if (!VAULT_ADMIN_TOKEN) {
    console.log('[vw-api] no VAULTWARDEN_ADMIN_TOKEN configured, skipping admin login')
    return null
  }
  try {
    const res = await timedFetch(`${VAULTWARDEN_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: VAULT_ADMIN_TOKEN }),
      redirect: 'manual',
    })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) {
      console.log('[vw-api] admin login successful')
      return setCookie
    }
    const body = await res.text().catch(() => '')
    if (body.includes('logged') || body.includes('success')) {
      console.log('[vw-api] admin login appears successful')
      return '*'
    }
    console.log('[vw-api] admin login failed, status:', res.status)
    return null
  } catch (err) {
    console.log('[vw-api] admin login error:', err.message)
    return null
  }
}

async function fetchAdminCiphers(cookie) {
  const headers = { Accept: 'application/json' }
  if (cookie && cookie !== '*') {
    headers['Cookie'] = cookie
  }
  if (VAULT_ADMIN_TOKEN) {
    headers['Authorization'] = `Bearer ${VAULT_ADMIN_TOKEN}`
  }
  for (const ep of ADMIN_CIPHER_CANDIDATES) {
    try {
      const url = `${VAULTWARDEN_URL}${ep}`
      const res = await timedFetch(url, { headers })
      if (res.ok) {
        const text = await res.text()
        try {
          const data = JSON.parse(text)
          console.log(`[vw-api] got data from ${ep}`)
          if (data.ciphers && Array.isArray(data.ciphers)) return data.ciphers
          if (Array.isArray(data)) return data
          if (data.data && Array.isArray(data.data)) return data.data
          if (data.users && Array.isArray(data.users)) return data.users
          continue
        } catch {
          continue
        }
      }
    } catch {
      continue
    }
  }
  return null
}

function loadLocalVault() {
  try {
    if (fs.existsSync(VAULT_DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(VAULT_DATA_FILE, 'utf-8'))
      console.log(`[vw-api] loaded ${raw.length} items from local vault`)
      return raw.map(sanitize)
    }
  } catch (err) {
    console.log('[vw-api] local vault load error:', err.message)
  }
  return []
}

function mapToCredential(item) {
  const loginData = item.type === 'login' ? item : {}
  const password = loginData.password || ''
  const hasOTP = !!(loginData.otpAuth && loginData.otpAuth.startsWith('otpauth://'))
  return {
    site: loginData.site || item.name || item.title || '',
    url: loginData.url || '',
    username: loginData.username || item.email || '',
    passwordExists: password.length > 0,
    passwordLength: password.length,
    hasOTP,
    notes: loginData.notes || item.body || item.notes || '',
    type: item.type || 'login',
  }
}

function mapVaultwardenCipher(cipher) {
  const login = cipher.login || {}
  const password = login.password || ''
  return {
    site: cipher.name || '',
    url: (login.uris && login.uris[0] && login.uris[0].uri) || '',
    username: login.username || '',
    passwordExists: password.length > 0,
    passwordLength: password.length,
    hasOTP: !!(login.totp && login.totp.startsWith('otpauth://')),
    notes: cipher.notes || '',
    type: cipher.type === 1 ? 'login' : cipher.type === 2 ? 'note' : cipher.type === 3 ? 'card' : 'other',
  }
}

async function exportCredentials() {
  const cookie = await adminLogin()
  let ciphers = null
  if (cookie) {
    ciphers = await fetchAdminCiphers(cookie)
  }
  if (ciphers && Array.isArray(ciphers) && ciphers.length > 0) {
    console.log(`[vw-api] returning ${ciphers.length} ciphers from vaultwarden API`)
    return ciphers.map(mapVaultwardenCipher)
  }
  console.log('[vw-api] falling back to local vault')
  const vault = loadLocalVault()
  const logins = vault.filter(i => i.type === 'login')
  return logins.map(mapToCredential)
}

async function exportCredentialsForAnalysis() {
  const cookie = await adminLogin()
  let ciphers = null
  if (cookie) {
    ciphers = await fetchAdminCiphers(cookie)
  }
  let items
  if (ciphers && Array.isArray(ciphers) && ciphers.length > 0) {
    items = ciphers.map(c => ({
      ...mapVaultwardenCipher(c),
      rawPassword: (c.login && c.login.password) || '',
    }))
  } else {
    const vault = loadLocalVault()
    items = vault.filter(i => i.type === 'login').map(item => ({
      ...mapToCredential(item),
      rawPassword: item.password || '',
    }))
  }
  return items.map(item => {
    const strength = analyzePasswordStrength(item.rawPassword)
    const { rawPassword, ...cred } = item
    return {
      ...cred,
      strength,
      passwordPresent: cred.passwordExists,
    }
  })
}

module.exports = { exportCredentials, exportCredentialsForAnalysis }
