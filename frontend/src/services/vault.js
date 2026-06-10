// vault client — talks to the bridge's self-contained encrypted vault.
//
// there is no external password service. the bridge owns an encrypted file and
// decrypts it in memory for the duration of an unlocked session. the browser
// holds only an opaque session token (x-vault-session) in sessionStorage; it is
// useless on its own and is cleared on tab close. the master password is sent
// once (create/unlock) over the same origin and never stored client-side.
//
// bridge routes (see bridge/credential-store.js):
//   GET    /api/passwords/status                          -> { initialized, unlocked, email, lastSync }
//   POST   /api/passwords/create   { email, masterPassword }   -> { token, created }
//   POST   /api/passwords/unlock   { email, masterPassword }   -> { token, created }
//   POST   /api/passwords/lock                            -> { ok }
//   POST   /api/passwords/change-password { newPassword } -> { ok }
//   GET    /api/passwords/sync                            -> { ciphers[], folders[], lastSync }
//   POST   /api/passwords/ciphers <cipher>                -> <cipher with id>
//   PUT    /api/passwords/ciphers/:id <cipher>            -> <cipher>
//   DELETE /api/passwords/ciphers/:id                     -> { ok }
//   POST   /api/passwords/folders { name }                -> { id, name }
//   PUT    /api/passwords/folders/:id { name }            -> { id, name }
//   DELETE /api/passwords/folders/:id                     -> { ok }

const SESSION_KEY = "vault_session"

export function getSession() {
  try { return sessionStorage.getItem(SESSION_KEY) || null } catch { return null }
}
function setSession(token) {
  try {
    if (token) sessionStorage.setItem(SESSION_KEY, token)
    else sessionStorage.removeItem(SESSION_KEY)
  } catch { /* storage unavailable — session lives only in memory */ }
}
export function isUnlocked() { return !!getSession() }

export class VaultLockedError extends Error {
  constructor() { super("vault is locked"); this.name = "VaultLockedError"; this.locked = true }
}

async function request(authHeader, path, { method = "GET", body } = {}) {
  const session = getSession()
  const headers = { authorization: authHeader }
  if (session) headers["x-vault-session"] = session
  if (body != null) headers["content-type"] = "application/json"

  const res = await fetch(`/api/passwords${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  })

  if (res.status === 401) {
    // /unlock and /create legitimately 401 on bad password — surface their
    // message rather than treating those as a lost session.
    if (path === "/unlock" || path === "/create") {
      const msg = await res.json().catch(() => ({}))
      throw new Error(msg.error || "invalid master password")
    }
    setSession(null)
    throw new VaultLockedError()
  }
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}))
    throw new Error(msg.error || msg.message || `request failed (${res.status})`)
  }
  if (res.status === 204) return { ok: true }
  return res.json()
}

export const vault = {
  status: (a) => request(a, "/status"),

  async create(a, email, masterPassword) {
    const r = await request(a, "/create", { method: "POST", body: { email, masterPassword } })
    if (r.token) setSession(r.token)
    return r
  },
  async unlock(a, email, masterPassword) {
    const r = await request(a, "/unlock", { method: "POST", body: { email, masterPassword } })
    if (r.token) setSession(r.token)
    return r
  },
  async lock(a) {
    try { await request(a, "/lock", { method: "POST" }) } catch { /* best effort */ }
    setSession(null)
    return { ok: true }
  },
  changePassword: (a, newPassword) => request(a, "/change-password", { method: "POST", body: { newPassword } }),

  sync: (a) => request(a, "/sync"),

  saveCipher: (a, cipher) =>
    request(a, cipher.id ? `/ciphers/${cipher.id}` : "/ciphers", { method: cipher.id ? "PUT" : "POST", body: cipher }),
  deleteCipher: (a, id) => request(a, `/ciphers/${id}`, { method: "DELETE" }),

  createFolder: (a, name) => request(a, "/folders", { method: "POST", body: { name } }),
  renameFolder: (a, id, name) => request(a, `/folders/${id}`, { method: "PUT", body: { name } }),
  deleteFolder: (a, id) => request(a, `/folders/${id}`, { method: "DELETE" }),
}

export default vault
