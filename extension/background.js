// passwords — background service worker (mv3)
// integrates the self-contained vault (unlock/sync/lock) + alias generation.
//
// the vault session token lives in chrome.storage.session (in-memory, cleared
// when the browser closes); decrypted ciphers are cached there too for the
// popup + autofill. auto-lock is enforced via chrome.alarms. the master
// password is sent only to the configured bridge at /api/passwords/unlock.

const DEFAULTS = { apiBase: "http://localhost:3099", aliasDomain: "", autoLockMinutes: 15 }
const PW_HISTORY_MAX = 20

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["apiBase", "aliasDomain", "autoLockMinutes"], (r) => {
      resolve({
        apiBase: (r.apiBase || DEFAULTS.apiBase).replace(/\/+$/, ""),
        aliasDomain: (r.aliasDomain || DEFAULTS.aliasDomain).trim(),
        autoLockMinutes: Number(r.autoLockMinutes) || DEFAULTS.autoLockMinutes,
      })
    })
  })
}

const session = {
  get: () => new Promise((res) => chrome.storage.session.get(["vaultToken", "ciphers", "unlockedAt"], res)),
  set: (obj) => new Promise((res) => chrome.storage.session.set(obj, res)),
  clear: () => new Promise((res) => chrome.storage.session.remove(["vaultToken", "ciphers", "unlockedAt"], res)),
}

// ── crypto-free helpers ──────────────────────────────────────────────────────
function generatePassword(len = 20, opts = {}) {
  let chars = ""
  if (opts.lower !== false) chars += "abcdefghijkmnpqrstuvwxyz"
  if (opts.upper !== false) chars += "ABCDEFGHJKLMNPQRSTUVWXYZ"
  if (opts.numbers !== false) chars += "23456789"
  if (opts.symbols !== false) chars += "!@#$%^&*-_=+"
  const buf = new Uint32Array(len)
  crypto.getRandomValues(buf)
  let out = ""
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length]
  return out
}
function randomToken(len = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  const buf = new Uint32Array(len)
  crypto.getRandomValues(buf)
  let out = ""
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length]
  return out
}
function slugFromHost(host) {
  if (!host) return "alias"
  const parts = host.replace(/^www\./, "").split(".")
  const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
  return base.toLowerCase().replace(/[^a-z0-9]/g, "") || "alias"
}

async function recordPassword(pw) {
  const { pwHistory = [] } = await new Promise((res) => chrome.storage.local.get(["pwHistory"], res))
  const next = [{ pw, at: Date.now() }, ...pwHistory].slice(0, PW_HISTORY_MAX)
  await new Promise((res) => chrome.storage.local.set({ pwHistory: next }, res))
  return pw
}

// ── vault api (option-b bridge) ──────────────────────────────────────────────
async function vaultFetch(path, { method = "GET", body, token } = {}) {
  const cfg = await getConfig()
  const headers = {}
  if (body) headers["Content-Type"] = "application/json"
  if (token) headers["x-vault-session"] = token
  const res = await fetch(`${cfg.apiBase}/api/passwords${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  if (res.status === 401) throw Object.assign(new Error("locked"), { locked: true })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `http ${res.status}`)
  return res.status === 204 ? {} : res.json()
}

async function scheduleAutoLock() {
  const cfg = await getConfig()
  chrome.alarms.create("vault-autolock", { delayInMinutes: cfg.autoLockMinutes })
}

async function vaultUnlock(masterPassword) {
  try {
    const r = await vaultFetch("/unlock", { method: "POST", body: { masterPassword } })
    await session.set({ vaultToken: r.token, unlockedAt: Date.now() })
    await vaultSync()
    await scheduleAutoLock()
    return { ok: true }
  } catch (e) { return { ok: false, error: String(e.message || e) } }
}

async function vaultLock() {
  const { vaultToken } = await session.get()
  if (vaultToken) { try { await vaultFetch("/lock", { method: "POST", token: vaultToken }) } catch { /* ignore */ } }
  await session.clear()
  chrome.alarms.clear("vault-autolock")
  return { ok: true }
}

async function vaultSync() {
  const { vaultToken } = await session.get()
  if (!vaultToken) return { ok: false, locked: true }
  try {
    const data = await vaultFetch("/sync", { token: vaultToken })
    await session.set({ ciphers: data.ciphers || [] })
    return { ok: true, ciphers: data.ciphers || [] }
  } catch (e) {
    if (e.locked) { await session.clear() }
    return { ok: false, locked: !!e.locked, error: String(e.message || e) }
  }
}

async function vaultStatus() {
  const { vaultToken, ciphers } = await session.get()
  return { ok: true, unlocked: !!vaultToken, count: (ciphers || []).length }
}

// match login ciphers against the current host (uri or name contains host)
async function matchCredentials(host) {
  const { vaultToken, ciphers } = await session.get()
  if (!vaultToken) return { ok: false, locked: true, error: "vault locked — unlock in the popup" }
  if (!host) return { ok: true, matches: [] }
  const h = host.toLowerCase().replace(/^www\./, "")
  const matches = (ciphers || [])
    .filter((c) => c.type === "login")
    .filter((c) => {
      const hay = `${c.uri || ""} ${c.name || ""}`.toLowerCase()
      return hay.includes(h) || h.includes((c.name || "").toLowerCase().replace(/^www\./, ""))
    })
    .map((c) => ({ id: c.id, name: c.name || c.uri || "", username: c.username || "", password: c.password || "" }))
  return { ok: true, matches }
}

// save a login to the vault (used by the content-script save prompt)
async function saveCredential(p) {
  const { vaultToken } = await session.get()
  if (!vaultToken) return { ok: false, error: "vault locked — unlock in the popup" }
  try {
    await vaultFetch("/ciphers", { method: "POST", token: vaultToken, body: {
      type: "login", name: p.site || p.url || "saved login",
      username: p.username || p.email || "", password: p.password || "", uri: p.url || "",
    } })
    await vaultSync()
    return { ok: true }
  } catch (e) { return { ok: false, error: String(e.message || e) } }
}

// ── alias creation (provider-aware) ──────────────────────────────────────────
async function aliasProvider(cfg) {
  try {
    const r = await fetch(`${cfg.apiBase}/api/aliases/config`)
    return (await r.json()).provider || "stalwart"
  } catch { return "stalwart" }
}

async function createAlias(host) {
  const cfg = await getConfig()
  const provider = await aliasProvider(cfg)
  try {
    if (provider === "simplelogin") {
      const r = await fetch(`${cfg.apiBase}/api/aliases/random`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: host ? `auto for ${host}` : undefined }),
      })
      if (!r.ok) throw new Error(`http ${r.status}`)
      const a = await r.json()
      return { ok: true, email: a.alias || a.email }
    }
    // stalwart store: build a local alias under the configured domain
    if (!cfg.aliasDomain) return { ok: false, error: "set an alias domain in extension options" }
    const email = `${slugFromHost(host)}.${randomToken(6)}@${cfg.aliasDomain}`
    const r = await fetch(`${cfg.apiBase}/api/aliases`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, note: host ? `auto-generated for ${host}` : null }),
    })
    if (!r.ok) throw new Error(`http ${r.status}`)
    return { ok: true, email }
  } catch (e) { return { ok: false, error: String(e.message || e) } }
}

// ── context menu ─────────────────────────────────────────────────────────────
function buildContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "fill-login", title: "fill login here", contexts: ["editable"] })
    chrome.contextMenus.create({ id: "gen-password", title: "generate password", contexts: ["editable"] })
    chrome.contextMenus.create({ id: "gen-alias", title: "generate email alias", contexts: ["editable", "page"] })
  })
}

chrome.contextMenus?.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return
  if (info.menuItemId === "gen-password") {
    const pw = await recordPassword(generatePassword())
    chrome.tabs.sendMessage(tab.id, { type: "FILL_FIELD", payload: { value: pw } })
  } else if (info.menuItemId === "fill-login") {
    const host = tab.url ? new URL(tab.url).hostname : ""
    const res = await matchCredentials(host)
    chrome.tabs.sendMessage(tab.id, { type: "FILL_LOGIN", payload: res })
  } else if (info.menuItemId === "gen-alias") {
    const host = tab.url ? new URL(tab.url).hostname : ""
    const res = await createAlias(host)
    if (res.ok) chrome.tabs.sendMessage(tab.id, { type: "FILL_FIELD", payload: { value: res.email } })
  }
})

// ── messaging ────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (!request?.type) return false
  const handlers = {
    VAULT_UNLOCK: () => vaultUnlock(request.payload?.masterPassword),
    VAULT_LOCK: () => vaultLock(),
    VAULT_STATUS: () => vaultStatus(),
    VAULT_SYNC: () => vaultSync(),
    MATCH_CREDENTIALS: () => matchCredentials(request.payload?.host),
    SAVE_CREDENTIAL: () => saveCredential(request.payload || {}),
    CREATE_ALIAS: () => createAlias(request.payload?.host),
    GEN_PASSWORD: async () => ({ ok: true, password: await recordPassword(generatePassword(request.payload?.len || 20, request.payload || {})) }),
  }
  const fn = handlers[request.type]
  if (!fn) return false
  fn().then(sendResponse)
  return true
})

chrome.alarms?.onAlarm.addListener((a) => { if (a.name === "vault-autolock") vaultLock() })
chrome.runtime.onInstalled.addListener(buildContextMenu)
chrome.runtime.onStartup?.addListener(buildContextMenu)
