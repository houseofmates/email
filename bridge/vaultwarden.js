// option-b vaultwarden bridge — the bridge is the trusted decryptor.
//
// the browser sends the master password exactly once (POST /unlock). here we
// run the bitwarden login + key-derivation, decrypt the user's symmetric key,
// and keep ONLY that key (plus the access token) in memory, keyed by an opaque
// random session token returned to the browser. all subsequent reads return
// decrypted json; all writes re-encrypt before hitting vaultwarden.
//
// the master password is never stored, never logged (see server safeLog), and
// the derived key lives only in this process until /lock, ttl expiry, or exit.
//
// crypto reference (bitwarden):
//   masterKey      = KDF(masterPassword, lower(email))            // pbkdf2 or argon2id
//   masterPwHash   = pbkdf2(masterKey, masterPassword, 1)         // sent as login password
//   stretched      = hkdf-expand(masterKey,"enc"|"mac")           // unlocks the protected Key
//   userKey(64)    = decrypt(protected Key, stretched)            // enc(32)||mac(32)
//   field          = decrypt(EncString type2, userKey)            // per-field
//
// NOTE: this is implemented to the documented protocol. the crypto primitives
// are unit-tested (round-trip + a pbkdf2 known-answer), but the full login
// chain can only be validated against a live vaultwarden, which the build
// sandbox cannot reach. validate end-to-end against your instance before trust.

const crypto = require("crypto")
const express = require("express")
const { argon2id } = require("hash-wasm")

const VW = () => process.env.VAULTWARDEN_URL || "http://localhost:8085"
const SESSION_TTL_MS = 30 * 60 * 1000 // 30 min idle auto-lock

// ── crypto primitives (pure, exported for tests) ─────────────────────────────

// derive the 32-byte master key from the password + kdf params (prelogin).
async function deriveMasterKey(masterPassword, email, kdf) {
  const salt = String(email).trim().toLowerCase()
  const type = kdf.type ?? kdf.kdf ?? 0
  if (type === 1) {
    // argon2id — salt is sha256(email), memory is in MiB -> KiB
    const saltBuf = crypto.createHash("sha256").update(salt).digest()
    const hex = await argon2id({
      password: masterPassword,
      salt: saltBuf,
      parallelism: kdf.parallelism || 4,
      iterations: kdf.iterations || 3,
      memorySize: (kdf.memory || 64) * 1024,
      hashLength: 32,
      outputType: "hex",
    })
    return Buffer.from(hex, "hex")
  }
  // pbkdf2-sha256
  return crypto.pbkdf2Sync(masterPassword, salt, kdf.iterations || 600000, 32, "sha256")
}

// the hash sent to vaultwarden as the login "password"
function makeMasterPasswordHash(masterKey, masterPassword) {
  return crypto.pbkdf2Sync(masterKey, masterPassword, 1, 32, "sha256").toString("base64")
}

// hkdf-expand only (rfc 5869), prk = masterKey. bitwarden uses expand, not the
// full extract+expand. for 32-byte output this is a single hmac block.
function hkdfExpand(prk, info, length = 32) {
  const out = Buffer.alloc(length)
  let t = Buffer.alloc(0)
  let pos = 0
  let i = 1
  while (pos < length) {
    const h = crypto.createHmac("sha256", prk)
    h.update(t)
    h.update(Buffer.from(info, "utf8"))
    h.update(Buffer.from([i]))
    t = h.digest()
    t.copy(out, pos)
    pos += t.length
    i++
  }
  return out
}

// stretch the master key into a 64-byte (enc||mac) key for unlocking the
// protected account key.
function stretchMasterKey(masterKey) {
  return Buffer.concat([hkdfExpand(masterKey, "enc", 32), hkdfExpand(masterKey, "mac", 32)])
}

const encHalf = (key64) => key64.subarray(0, 32)
const macHalf = (key64) => key64.subarray(32, 64)

// decrypt an EncString of type 2 (AesCbc256_HmacSha256_B64): "2.iv|ct|mac"
function decryptEncString(encString, key64) {
  if (!encString) return ""
  const dot = encString.indexOf(".")
  const type = parseInt(encString.slice(0, dot), 10)
  if (type !== 2) throw new Error(`unsupported enc type ${type}`)
  const [ivB64, ctB64, macB64] = encString.slice(dot + 1).split("|")
  const iv = Buffer.from(ivB64, "base64")
  const ct = Buffer.from(ctB64, "base64")
  const mac = Buffer.from(macB64, "base64")

  const expected = crypto.createHmac("sha256", macHalf(key64)).update(iv).update(ct).digest()
  // constant-time compare; reject on tamper
  if (mac.length !== expected.length || !crypto.timingSafeEqual(mac, expected)) {
    throw new Error("mac verification failed")
  }
  const decipher = crypto.createDecipheriv("aes-256-cbc", encHalf(key64), iv)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8")
}

// encrypt a string into an EncString type 2 with the given 64-byte key
function encryptToEncString(plaintext, key64) {
  if (plaintext == null || plaintext === "") return null
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv("aes-256-cbc", encHalf(key64), iv)
  const ct = Buffer.concat([cipher.update(Buffer.from(String(plaintext), "utf8")), cipher.final()])
  const mac = crypto.createHmac("sha256", macHalf(key64)).update(iv).update(ct).digest()
  return `2.${iv.toString("base64")}|${ct.toString("base64")}|${mac.toString("base64")}`
}

// ── cipher <-> normalized plain mapping ──────────────────────────────────────
const TYPE_NUM = { login: 1, note: 2, card: 3, identity: 4 }
const TYPE_NAME = { 1: "login", 2: "note", 3: "card", 4: "identity" }

function cipherToPlain(c, key64) {
  const d = (s) => decryptEncString(s, key64)
  const base = {
    id: c.id || c.Id,
    type: TYPE_NAME[c.type ?? c.Type] || "note",
    folderId: c.folderId ?? c.FolderId ?? null,
    favorite: c.favorite ?? c.Favorite ?? false,
    name: d(c.name ?? c.Name),
    notes: d(c.notes ?? c.Notes),
  }
  const login = c.login ?? c.Login
  const card = c.card ?? c.Card
  const identity = c.identity ?? c.Identity
  if (base.type === "login" && login) {
    const uris = login.uris ?? login.Uris ?? []
    base.username = d(login.username ?? login.Username)
    base.password = d(login.password ?? login.Password)
    base.uri = uris.length ? d(uris[0].uri ?? uris[0].Uri) : ""
    base.totp = d(login.totp ?? login.Totp)
  } else if (base.type === "card" && card) {
    base.cardholderName = d(card.cardholderName ?? card.CardholderName)
    base.brand = d(card.brand ?? card.Brand)
    base.number = d(card.number ?? card.Number)
    base.expMonth = d(card.expMonth ?? card.ExpMonth)
    base.expYear = d(card.expYear ?? card.ExpYear)
    base.code = d(card.code ?? card.Code)
  } else if (base.type === "identity" && identity) {
    for (const f of ["firstName", "lastName", "email", "phone", "address1", "city", "state", "postalCode", "country", "company", "username"]) {
      const cap = f[0].toUpperCase() + f.slice(1)
      base[f] = d(identity[f] ?? identity[cap])
    }
  }
  return base
}

function plainToCipher(p, key64) {
  const e = (v) => encryptToEncString(v, key64)
  const cipher = {
    type: TYPE_NUM[p.type] || 2,
    name: e(p.name) || e("untitled"),
    notes: e(p.notes),
    folderId: p.folderId || null,
    favorite: !!p.favorite,
  }
  if (p.type === "login") {
    cipher.login = {
      username: e(p.username),
      password: e(p.password),
      totp: e(p.totp),
      uris: p.uri ? [{ uri: e(p.uri), match: null }] : [],
    }
  } else if (p.type === "card") {
    cipher.card = {
      cardholderName: e(p.cardholderName), brand: e(p.brand), number: e(p.number),
      expMonth: e(p.expMonth), expYear: e(p.expYear), code: e(p.code),
    }
  } else if (p.type === "identity") {
    cipher.identity = {}
    for (const f of ["firstName", "lastName", "email", "phone", "address1", "city", "state", "postalCode", "country", "company", "username"]) {
      cipher.identity[f] = e(p[f])
    }
  }
  return cipher
}

// ── session store (in-memory, ttl) ───────────────────────────────────────────
const sessions = new Map() // token -> { userKey, accessToken, refreshToken, email, deviceId, lastUsed, lastSync }

function newToken() { return crypto.randomBytes(32).toString("base64url") }

function getSession(token) {
  const s = sessions.get(token)
  if (!s) return null
  if (Date.now() - s.lastUsed > SESSION_TTL_MS) { sessions.delete(token); return null }
  s.lastUsed = Date.now()
  return s
}

// periodic sweep of idle sessions (also zeroes the key buffer)
setInterval(() => {
  const now = Date.now()
  for (const [t, s] of sessions) {
    if (now - s.lastUsed > SESSION_TTL_MS) { s.userKey?.fill(0); sessions.delete(t) }
  }
}, 5 * 60 * 1000).unref()

// ── vaultwarden protocol calls ───────────────────────────────────────────────
async function prelogin(email) {
  const r = await fetch(`${VW()}/identity/accounts/prelogin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  })
  if (!r.ok) throw new Error("prelogin failed")
  const j = await r.json()
  return {
    type: j.kdf ?? j.Kdf ?? 0,
    iterations: j.kdfIterations ?? j.KdfIterations ?? 600000,
    memory: j.kdfMemory ?? j.KdfMemory,
    parallelism: j.kdfParallelism ?? j.KdfParallelism,
  }
}

async function tokenLogin(email, masterPasswordHash, deviceId) {
  const form = new URLSearchParams({
    grant_type: "password",
    username: email,
    password: masterPasswordHash,
    scope: "api offline_access",
    client_id: "web",
    deviceType: "9",
    deviceIdentifier: deviceId,
    deviceName: "email-bridge",
  })
  const r = await fetch(`${VW()}/identity/connect/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      // vaultwarden requires the auth-email header to match the username
      "auth-email": Buffer.from(email, "utf8").toString("base64url"),
    },
    body: form,
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error_description || j.ErrorModel?.Message || "login failed")
  return j // { access_token, refresh_token, Key, PrivateKey, ... }
}

async function refreshToken(session) {
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: session.refreshToken,
    client_id: "web",
  })
  const r = await fetch(`${VW()}/identity/connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  })
  if (!r.ok) return false
  const j = await r.json()
  session.accessToken = j.access_token
  if (j.refresh_token) session.refreshToken = j.refresh_token
  return true
}

// call a vaultwarden /api endpoint with the session's bearer token; refresh once on 401
async function vwApi(session, path, { method = "GET", body } = {}) {
  const doCall = () =>
    fetch(`${VW()}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  let r = await doCall()
  if (r.status === 401 && session.refreshToken && (await refreshToken(session))) r = await doCall()
  if (!r.ok) {
    const j = await r.json().catch(() => ({}))
    throw new Error(j.message || j.ErrorModel?.Message || `vaultwarden ${r.status}`)
  }
  return r.status === 204 ? null : r.json()
}

// ── router ───────────────────────────────────────────────────────────────────
function createRouter() {
  const router = express.Router()
  // IMPORTANT: do NOT apply a body parser to the whole router. unmatched
  // requests fall through to the raw /api/passwords proxy (bitwarden mobile /
  // extension clients), and draining their body would hang the upstream (the
  // documented "jmap 502" failure mode). json is scoped to write routes only.
  const json = express.json({ limit: "1mb" })

  // resolve the session from the header; 401 if missing/expired (frontend
  // treats this as "locked").
  function requireSession(req, res, next) {
    const token = req.get("x-vault-session")
    const session = token && getSession(token)
    if (!session) return res.status(401).json({ error: "vault locked" })
    req.vault = session
    next()
  }

  // unlock: derive key, login, decrypt user key, open a session
  router.post("/unlock", json, async (req, res) => {
    const { email, masterPassword } = req.body || {}
    if (!email || !masterPassword) return res.status(400).json({ error: "email and master password required" })
    try {
      const kdf = await prelogin(email)
      const masterKey = await deriveMasterKey(masterPassword, email, kdf)
      const hash = makeMasterPasswordHash(masterKey, masterPassword)
      const deviceId = crypto.randomUUID()
      const tok = await tokenLogin(email, hash, deviceId)
      const protectedKey = tok.Key || tok.key
      if (!protectedKey) throw new Error("no key in login response")
      const userKey = Buffer.from(decryptEncStringRaw(protectedKey, stretchMasterKey(masterKey)))

      const token = newToken()
      sessions.set(token, {
        userKey, accessToken: tok.access_token, refreshToken: tok.refresh_token,
        email, deviceId, lastUsed: Date.now(), lastSync: null,
      })
      res.json({ token, kdf: kdf.type, lastSync: null })
    } catch (err) {
      res.status(401).json({ error: String(err.message || err) })
    }
  })

  router.post("/lock", (req, res) => {
    const token = req.get("x-vault-session")
    const s = token && sessions.get(token)
    if (s) { s.userKey?.fill(0); sessions.delete(token) }
    res.json({ ok: true })
  })

  router.get("/status", (req, res) => {
    const token = req.get("x-vault-session")
    const s = token && getSession(token)
    res.json({ unlocked: !!s, email: s?.email || null, lastSync: s?.lastSync || null })
  })

  // sync: return decrypted ciphers + folders
  router.get("/sync", requireSession, async (req, res) => {
    try {
      const data = await vwApi(req.vault, "/sync?excludeDomains=true")
      const key = req.vault.userKey
      const ciphers = (data.ciphers || data.Ciphers || []).map((c) => cipherToPlain(c, key))
      const folders = (data.folders || data.Folders || []).map((f) => ({
        id: f.id ?? f.Id, name: decryptEncString(f.name ?? f.Name, key),
      }))
      req.vault.lastSync = new Date().toISOString()
      res.json({ ciphers, folders, lastSync: req.vault.lastSync })
    } catch (err) {
      res.status(502).json({ error: String(err.message || err) })
    }
  })

  // create / update / delete ciphers
  router.post("/ciphers", requireSession, json, async (req, res) => {
    try {
      const cipher = plainToCipher(req.body || {}, req.vault.userKey)
      const created = await vwApi(req.vault, "/ciphers", { method: "POST", body: cipher })
      res.json(cipherToPlain(created, req.vault.userKey))
    } catch (err) { res.status(502).json({ error: String(err.message || err) }) }
  })

  router.put("/ciphers/:id", requireSession, json, async (req, res) => {
    try {
      const cipher = plainToCipher(req.body || {}, req.vault.userKey)
      const updated = await vwApi(req.vault, `/ciphers/${req.params.id}`, { method: "PUT", body: cipher })
      res.json(cipherToPlain(updated, req.vault.userKey))
    } catch (err) { res.status(502).json({ error: String(err.message || err) }) }
  })

  router.delete("/ciphers/:id", requireSession, async (req, res) => {
    try { await vwApi(req.vault, `/ciphers/${req.params.id}`, { method: "DELETE" }); res.json({ ok: true }) }
    catch (err) { res.status(502).json({ error: String(err.message || err) }) }
  })

  // folders
  router.post("/folders", requireSession, json, async (req, res) => {
    try {
      const f = await vwApi(req.vault, "/folders", { method: "POST", body: { name: encryptToEncString(req.body?.name, req.vault.userKey) } })
      res.json({ id: f.id ?? f.Id, name: decryptEncString(f.name ?? f.Name, req.vault.userKey) })
    } catch (err) { res.status(502).json({ error: String(err.message || err) }) }
  })

  router.put("/folders/:id", requireSession, json, async (req, res) => {
    try {
      const f = await vwApi(req.vault, `/folders/${req.params.id}`, { method: "PUT", body: { name: encryptToEncString(req.body?.name, req.vault.userKey) } })
      res.json({ id: f.id ?? f.Id, name: decryptEncString(f.name ?? f.Name, req.vault.userKey) })
    } catch (err) { res.status(502).json({ error: String(err.message || err) }) }
  })

  router.delete("/folders/:id", requireSession, async (req, res) => {
    try { await vwApi(req.vault, `/folders/${req.params.id}`, { method: "DELETE" }); res.json({ ok: true }) }
    catch (err) { res.status(502).json({ error: String(err.message || err) }) }
  })

  return router
}

// decryptEncString returns utf8; for the binary user key we need raw bytes.
function decryptEncStringRaw(encString, key64) {
  const dot = encString.indexOf(".")
  const type = parseInt(encString.slice(0, dot), 10)
  if (type !== 2) throw new Error(`unsupported enc type ${type}`)
  const [ivB64, ctB64, macB64] = encString.slice(dot + 1).split("|")
  const iv = Buffer.from(ivB64, "base64")
  const ct = Buffer.from(ctB64, "base64")
  const mac = Buffer.from(macB64, "base64")
  const expected = crypto.createHmac("sha256", macHalf(key64)).update(iv).update(ct).digest()
  if (mac.length !== expected.length || !crypto.timingSafeEqual(mac, expected)) throw new Error("mac verification failed")
  const decipher = crypto.createDecipheriv("aes-256-cbc", encHalf(key64), iv)
  return Buffer.concat([decipher.update(ct), decipher.final()])
}

module.exports = {
  createRouter,
  // exported for unit tests
  _internal: {
    deriveMasterKey, makeMasterPasswordHash, hkdfExpand, stretchMasterKey,
    decryptEncString, encryptToEncString, decryptEncStringRaw,
    cipherToPlain, plainToCipher,
  },
}
