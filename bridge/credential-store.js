// self-contained encrypted vault — no external service, no bitwarden protocol.
//
// the vault is a single json file on disk owned by the bridge. it is encrypted
// at rest with envelope encryption:
//
//   KEK = argon2id(masterPassword, salt)          // key-encryption-key
//   DEK = random 32 bytes                          // data-encryption-key
//   file.wrappedKey = aes-256-gcm(KEK, DEK)        // DEK sealed by KEK
//   file.vault      = aes-256-gcm(DEK, vaultJson)  // vault sealed by DEK
//
// gcm auth tags make a wrong password (KEK can't unwrap DEK) or a tampered file
// fail to decrypt rather than return garbage. changing the master password only
// re-wraps the DEK — the bulk vault ciphertext is untouched.
//
// the master password reaches the bridge once (POST /unlock or /create), is
// never stored and never logged (see server safeLog). the DEK + decrypted vault
// live only in process memory under an opaque session token, dropped on /lock,
// 30-min idle expiry, or exit. on writes the in-memory vault is mutated and the
// file atomically rewritten (temp + rename, mode 0600).

const crypto = require("crypto")
const fs = require("fs")
const fsp = fs.promises
const path = require("path")
const express = require("express")
const { argon2id } = require("hash-wasm")

const VAULT_FILE = process.env.VAULT_FILE || path.join(__dirname, ".vault.enc")
const SESSION_TTL_MS = 30 * 60 * 1000
// argon2id defaults for new vaults (owasp-ish). stored in the file header so
// existing vaults keep their original params.
const ARGON_DEFAULTS = { memory: 65536, iterations: 3, parallelism: 4 }

// ── gcm helpers ──────────────────────────────────────────────────────────────
function gcmEncrypt(key, plaintext) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return { iv: iv.toString("base64"), ct: ct.toString("base64"), tag: cipher.getAuthTag().toString("base64") }
}

function gcmDecrypt(key, blob) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "base64"))
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"))
  return Buffer.concat([decipher.update(Buffer.from(blob.ct, "base64")), decipher.final()]) // throws on auth failure
}

async function deriveKEK(masterPassword, saltBuf, params) {
  const hex = await argon2id({
    password: masterPassword,
    salt: saltBuf,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memory,
    hashLength: 32,
    outputType: "hex",
  })
  return Buffer.from(hex, "hex")
}

// ── file io (atomic) ─────────────────────────────────────────────────────────
async function readVaultFile() {
  try {
    return JSON.parse(await fsp.readFile(VAULT_FILE, "utf8"))
  } catch (e) {
    if (e.code === "ENOENT") return null
    throw e
  }
}

async function writeVaultFile(obj) {
  const tmp = `${VAULT_FILE}.tmp`
  await fsp.writeFile(tmp, JSON.stringify(obj), { mode: 0o600 })
  await fsp.rename(tmp, VAULT_FILE)
}

function emptyVault() {
  return { version: 1, ciphers: [], folders: [] }
}

// ── create / unlock / persist ────────────────────────────────────────────────
async function createVault(masterPassword) {
  if (await readVaultFile()) throw new Error("vault already exists")
  const salt = crypto.randomBytes(16)
  const params = { ...ARGON_DEFAULTS }
  const kek = await deriveKEK(masterPassword, salt, params)
  const dek = crypto.randomBytes(32)
  const data = emptyVault()
  const header = {
    version: 1,
    kdf: { type: "argon2id", salt: salt.toString("base64"), ...params },
    wrappedKey: gcmEncrypt(kek, dek),
  }
  await writeVaultFile({ ...header, vault: gcmEncrypt(dek, Buffer.from(JSON.stringify(data))) })
  return { dek, data, header }
}

async function unlockVault(masterPassword) {
  const file = await readVaultFile()
  if (!file) throw new Error("vault not initialized")
  const kek = await deriveKEK(masterPassword, Buffer.from(file.kdf.salt, "base64"), file.kdf)
  let dek
  try {
    dek = gcmDecrypt(kek, file.wrappedKey)
  } catch {
    throw new Error("invalid master password")
  }
  const data = JSON.parse(gcmDecrypt(dek, file.vault).toString("utf8"))
  const header = { version: file.version, kdf: file.kdf, wrappedKey: file.wrappedKey }
  return { dek, data, header }
}

// re-encrypt the (mutated) vault with the session DEK and rewrite the file,
// preserving the kdf + wrappedKey header.
async function persist(session) {
  await writeVaultFile({ ...session.header, vault: gcmEncrypt(session.dek, Buffer.from(JSON.stringify(session.data))) })
}

// change master password: re-derive a fresh KEK from a new salt and re-wrap the
// existing DEK (vault ciphertext is unchanged).
async function changePassword(session, newPassword) {
  const salt = crypto.randomBytes(16)
  const params = { ...ARGON_DEFAULTS }
  const kek = await deriveKEK(newPassword, salt, params)
  session.header = {
    version: session.header.version,
    kdf: { type: "argon2id", salt: salt.toString("base64"), ...params },
    wrappedKey: gcmEncrypt(kek, session.dek),
  }
  await persist(session)
}

// ── session store ────────────────────────────────────────────────────────────
const sessions = new Map() // token -> { dek, data, header, email, lastUsed }
const newToken = () => crypto.randomBytes(32).toString("base64url")

function getSession(token) {
  const s = sessions.get(token)
  if (!s) return null
  if (Date.now() - s.lastUsed > SESSION_TTL_MS) { dropSession(token); return null }
  s.lastUsed = Date.now()
  return s
}
function dropSession(token) {
  const s = sessions.get(token)
  if (s) { s.dek?.fill(0); sessions.delete(token) }
}
setInterval(() => {
  const now = Date.now()
  for (const [t, s] of sessions) if (now - s.lastUsed > SESSION_TTL_MS) dropSession(t)
}, 5 * 60 * 1000).unref()

// ── router ───────────────────────────────────────────────────────────────────
function createRouter() {
  const router = express.Router()
  const json = express.json({ limit: "2mb" })

  function requireSession(req, res, next) {
    const token = req.get("x-vault-session")
    const session = token && getSession(token)
    if (!session) return res.status(401).json({ error: "vault locked" })
    req.vault = session
    req.token = token
    next()
  }

  function openSession(parts, email) {
    const token = newToken()
    sessions.set(token, { ...parts, email: email || null, lastUsed: Date.now() })
    return token
  }

  router.get("/status", async (req, res) => {
    const token = req.get("x-vault-session")
    const s = token && getSession(token)
    let initialized = false
    try { initialized = !!(await readVaultFile()) } catch { /* treat as uninitialized */ }
    res.json({ initialized, unlocked: !!s, email: s?.email || null, lastSync: s?.lastUsed ? new Date(s.lastUsed).toISOString() : null })
  })

  router.post("/create", json, async (req, res) => {
    const { masterPassword, email } = req.body || {}
    if (!masterPassword || String(masterPassword).length < 8) {
      return res.status(400).json({ error: "master password must be at least 8 characters" })
    }
    try {
      const parts = await createVault(masterPassword)
      res.json({ token: openSession(parts, email), created: true })
    } catch (err) {
      res.status(409).json({ error: String(err.message || err) })
    }
  })

  router.post("/unlock", json, async (req, res) => {
    const { masterPassword, email } = req.body || {}
    if (!masterPassword) return res.status(400).json({ error: "master password required" })
    try {
      const parts = await unlockVault(masterPassword)
      res.json({ token: openSession(parts, email), created: false })
    } catch (err) {
      res.status(401).json({ error: String(err.message || err) })
    }
  })

  router.post("/lock", (req, res) => {
    const token = req.get("x-vault-session")
    if (token) dropSession(token)
    res.json({ ok: true })
  })

  router.post("/change-password", requireSession, json, async (req, res) => {
    const { newPassword } = req.body || {}
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ error: "new password must be at least 8 characters" })
    }
    try { await changePassword(req.vault, newPassword); res.json({ ok: true }) }
    catch (err) { res.status(500).json({ error: String(err.message || err) }) }
  })

  router.get("/sync", requireSession, (req, res) => {
    const { ciphers, folders } = req.vault.data
    res.json({ ciphers: ciphers || [], folders: folders || [], lastSync: new Date().toISOString() })
  })

  // ── ciphers (plain objects; the whole vault is encrypted as one blob) ─────
  router.post("/ciphers", requireSession, json, async (req, res) => {
    try {
      const item = { ...(req.body || {}), id: crypto.randomUUID() }
      req.vault.data.ciphers.push(item)
      await persist(req.vault)
      res.json(item)
    } catch (err) { res.status(500).json({ error: String(err.message || err) }) }
  })

  router.put("/ciphers/:id", requireSession, json, async (req, res) => {
    try {
      const list = req.vault.data.ciphers
      const i = list.findIndex((c) => c.id === req.params.id)
      if (i === -1) return res.status(404).json({ error: "not found" })
      list[i] = { ...(req.body || {}), id: req.params.id }
      await persist(req.vault)
      res.json(list[i])
    } catch (err) { res.status(500).json({ error: String(err.message || err) }) }
  })

  router.delete("/ciphers/:id", requireSession, async (req, res) => {
    try {
      req.vault.data.ciphers = req.vault.data.ciphers.filter((c) => c.id !== req.params.id)
      await persist(req.vault)
      res.json({ ok: true })
    } catch (err) { res.status(500).json({ error: String(err.message || err) }) }
  })

  // ── folders ────────────────────────────────────────────────────────────────
  router.post("/folders", requireSession, json, async (req, res) => {
    try {
      const folder = { id: crypto.randomUUID(), name: String(req.body?.name || "").trim() || "untitled" }
      req.vault.data.folders.push(folder)
      await persist(req.vault)
      res.json(folder)
    } catch (err) { res.status(500).json({ error: String(err.message || err) }) }
  })

  router.put("/folders/:id", requireSession, json, async (req, res) => {
    try {
      const f = req.vault.data.folders.find((x) => x.id === req.params.id)
      if (!f) return res.status(404).json({ error: "not found" })
      f.name = String(req.body?.name || "").trim() || f.name
      await persist(req.vault)
      res.json(f)
    } catch (err) { res.status(500).json({ error: String(err.message || err) }) }
  })

  router.delete("/folders/:id", requireSession, async (req, res) => {
    try {
      req.vault.data.folders = req.vault.data.folders.filter((x) => x.id !== req.params.id)
      // unfile ciphers that pointed at the deleted folder
      for (const c of req.vault.data.ciphers) if (c.folderId === req.params.id) c.folderId = null
      await persist(req.vault)
      res.json({ ok: true })
    } catch (err) { res.status(500).json({ error: String(err.message || err) }) }
  })

  return router
}

module.exports = {
  createRouter,
  _internal: {
    gcmEncrypt, gcmDecrypt, deriveKEK, createVault, unlockVault, persist, changePassword,
    emptyVault, readVaultFile, writeVaultFile, VAULT_FILE, ARGON_DEFAULTS,
  },
}
