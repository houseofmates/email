// vaultwarden client — option b (bridge decrypts)
//
// the frontend holds NO bitwarden crypto. instead it talks to the bridge's
// option-b routes under /api/passwords/*, which:
//   1. log into vaultwarden with the master password (once, at /unlock),
//   2. derive the master key + decrypt the protected symmetric key,
//   3. keep that key in memory only, keyed by an opaque session token,
//   4. return fully-decrypted json to the frontend, and re-encrypt on writes.
//
// the master password is sent to the bridge exactly once (at unlock) over the
// same origin; it is never stored, never logged (see bridge safeLog), and the
// derived key lives only in bridge memory until /lock or process exit.
//
// the session token returned by /unlock is the ONLY secret the browser holds.
// it is kept in sessionStorage (cleared when the tab closes) and sent on every
// request via the x-vault-session header. it cannot decrypt anything by itself.
//
// ── bridge route contract (implemented in step 7) ────────────────────────────
//   POST   /api/passwords/unlock      { email, masterPassword }   -> { token, kdf, lastSync }
//   POST   /api/passwords/lock                                    -> { ok }
//   GET    /api/passwords/status                                  -> { unlocked, lastSync, email }
//   GET    /api/passwords/sync                                    -> { ciphers[], folders[], sends[], profile }
//   POST   /api/passwords/ciphers     <cipher>                    -> <cipher>
//   PUT    /api/passwords/ciphers/:id <cipher>                    -> <cipher>
//   DELETE /api/passwords/ciphers/:id                             -> { ok }
//   POST   /api/passwords/ciphers/:id/restore                     -> <cipher>   (un-trash)
//   POST   /api/passwords/folders     { name }                    -> <folder>
//   PUT    /api/passwords/folders/:id { name }                    -> <folder>
//   DELETE /api/passwords/folders/:id                             -> { ok }
//   POST   /api/passwords/ciphers/:id/attachment  (multipart)     -> <cipher>
//   GET    /api/passwords/ciphers/:id/attachment/:aid             -> binary (download)
//   DELETE /api/passwords/ciphers/:id/attachment/:aid             -> { ok }
//   GET    /api/passwords/sends                                   -> { sends[] }
//   POST   /api/passwords/sends       <send>                      -> <send>
//   DELETE /api/passwords/sends/:id                               -> { ok }
//   GET    /api/passwords/two-factor                              -> { providers[] }
//   POST   /api/passwords/two-factor/:type   <setup>              -> <result>
//   GET    /api/passwords/devices                                 -> { devices[] }
//   DELETE /api/passwords/devices/:id                             -> { ok }
//   POST   /api/passwords/hibp        { hashes[] }                -> { breached: { [hash]: count } }
//   GET    /api/passwords/export?format=json|csv                  -> file
//   POST   /api/passwords/import      { format, data }            -> { imported }
//
// every method below takes the app auth header (stalwart basic auth) as its
// first arg, matching the convention used across the existing components.

const SESSION_KEY = "vault_session"

// ── session token (the only secret the browser keeps) ────────────────────────
export function getSession() {
  try { return sessionStorage.getItem(SESSION_KEY) || null } catch { return null }
}
function setSession(token) {
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, token)
    else sessionStorage.removeItem(SESSION_KEY)
  } catch { /* storage unavailable — vault stays unlocked only in memory */ }
}
export function isUnlocked() { return !!getSession() }

// ── low-level request ────────────────────────────────────────────────────────
async function request(authHeader, path, { method = "GET", body, headers = {}, raw = false } = {}) {
  const session = getSession()
  const h = { authorization: authHeader, ...headers }
  if (session) h["x-vault-session"] = session
  const isForm = body instanceof FormData
  if (body != null && !isForm && !h["content-type"]) h["content-type"] = "application/json"

  const res = await fetch(`/api/passwords${path}`, {
    method,
    headers: h,
    body: body == null ? undefined : isForm ? body : JSON.stringify(body),
    credentials: "same-origin",
  })

  // a 401 means the bridge lost / never had our key — surface as locked
  if (res.status === 401) {
    setSession(null)
    throw new VaultLockedError()
  }
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}))
    throw new Error(msg.error || msg.message || `request failed (${res.status})`)
  }
  if (raw) return res
  if (res.status === 204) return { ok: true }
  return res.json()
}

export class VaultLockedError extends Error {
  constructor() { super("vault is locked"); this.name = "VaultLockedError"; this.locked = true }
}

// ── unlock / lock / status ───────────────────────────────────────────────────
export const vault = {
  async unlock(authHeader, email, masterPassword) {
    const r = await request(authHeader, "/unlock", { method: "POST", body: { email, masterPassword } })
    if (r.token) setSession(r.token)
    return r
  },
  async lock(authHeader) {
    try { await request(authHeader, "/lock", { method: "POST" }) } catch { /* best effort */ }
    setSession(null)
    return { ok: true }
  },
  status: (a) => request(a, "/status"),

  // ── sync (decrypted vault snapshot) ──────────────────────────────────────
  sync: (a) => request(a, "/sync"),

  // ── ciphers (login / note / card / identity) ─────────────────────────────
  saveCipher: (a, cipher) =>
    request(a, cipher.id ? `/ciphers/${cipher.id}` : "/ciphers", {
      method: cipher.id ? "PUT" : "POST",
      body: cipher,
    }),
  deleteCipher: (a, id) => request(a, `/ciphers/${id}`, { method: "DELETE" }),
  restoreCipher: (a, id) => request(a, `/ciphers/${id}/restore`, { method: "POST" }),

  // ── folders ──────────────────────────────────────────────────────────────
  createFolder: (a, name) => request(a, "/folders", { method: "POST", body: { name } }),
  renameFolder: (a, id, name) => request(a, `/folders/${id}`, { method: "PUT", body: { name } }),
  deleteFolder: (a, id) => request(a, `/folders/${id}`, { method: "DELETE" }),

  // ── attachments ────────────────────────────────────────────────────────────
  uploadAttachment(a, cipherId, file) {
    const fd = new FormData()
    fd.append("file", file, file.name)
    return request(a, `/ciphers/${cipherId}/attachment`, { method: "POST", body: fd })
  },
  // returns a Response so the caller can stream / save the decrypted blob
  downloadAttachment: (a, cipherId, attId) =>
    request(a, `/ciphers/${cipherId}/attachment/${attId}`, { raw: true }),
  deleteAttachment: (a, cipherId, attId) =>
    request(a, `/ciphers/${cipherId}/attachment/${attId}`, { method: "DELETE" }),

  // ── send (expiring text / file links) ────────────────────────────────────
  listSends: (a) => request(a, "/sends"),
  createSend: (a, send) => request(a, "/sends", { method: "POST", body: send }),
  deleteSend: (a, id) => request(a, `/sends/${id}`, { method: "DELETE" }),

  // ── two-factor management ────────────────────────────────────────────────
  twoFactor: (a) => request(a, "/two-factor"),
  setupTwoFactor: (a, type, setup) => request(a, `/two-factor/${type}`, { method: "POST", body: setup }),

  // ── devices / sessions ───────────────────────────────────────────────────
  listDevices: (a) => request(a, "/devices"),
  revokeDevice: (a, id) => request(a, `/devices/${id}`, { method: "DELETE" }),

  // ── security dashboard: breach check ─────────────────────────────────────
  // sends sha-1 prefixes only (k-anonymity) — the bridge proxies hibp so the
  // browser never talks to a third party directly. the pure weak/reused/breach
  // analysis helpers land in services/security.js alongside the dashboard ui.
  checkBreaches: (a, hashes) => request(a, "/hibp", { method: "POST", body: { hashes } }),

  // ── import / export ──────────────────────────────────────────────────────
  exportVault: (a, format = "json") => request(a, `/export?format=${encodeURIComponent(format)}`, { raw: true }),
  importVault: (a, format, data) => request(a, "/import", { method: "POST", body: { format, data } }),
}

export default vault
