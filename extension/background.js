// passwords — background service worker
//
// Bridges the in-page content script to the local suite API. The content
// script never talks to the API directly (it lives on arbitrary origins and
// shouldn't hold the auth token); instead it posts messages here and we make
// the authenticated fetch from the privileged extension context.
//
// Messages handled:
//   CREATE_ALIAS    { host }                 -> { ok, email, password }
//   SAVE_CREDENTIAL { site, url, username, password } -> { ok }

const DEFAULTS = {
  apiBase: "http://localhost:8080/api",
  aliasDomain: "",
}

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ["apiBase", "aliasDomain", "authToken"],
      (result) => {
        resolve({
          apiBase: (result.apiBase || DEFAULTS.apiBase).replace(/\/+$/, ""),
          aliasDomain: (result.aliasDomain || DEFAULTS.aliasDomain).trim(),
          authToken: result.authToken || null,
        })
      }
    )
  })
}

// strong-ish password generator (mirrors the web app's generatePassword)
function generatePassword(len = 20) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_"
  const out = []
  const buf = new Uint32Array(len)
  crypto.getRandomValues(buf)
  for (let i = 0; i < len; i++) {
    out.push(chars[buf[i] % chars.length])
  }
  return out.join("")
}

function randomToken(len = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  const buf = new Uint32Array(len)
  crypto.getRandomValues(buf)
  let out = ""
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length]
  return out
}

// derive a readable local-part slug from a hostname, e.g. www.example.co.uk -> example
function slugFromHost(host) {
  if (!host) return "alias"
  const parts = host.replace(/^www\./, "").split(".")
  const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
  const slug = base.toLowerCase().replace(/[^a-z0-9]/g, "")
  return slug || "alias"
}

async function apiFetch(path, options, cfg) {
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    options.headers || {}
  )
  if (cfg.authToken) headers["Authorization"] = `Basic ${cfg.authToken}`
  const res = await fetch(`${cfg.apiBase}${path}`, { ...options, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ""}`)
  }
  // 201/200 return JSON; 204 has no body
  if (res.status === 204) return null
  return res.json().catch(() => null)
}

async function createAlias(host) {
  const cfg = await getConfig()
  if (!cfg.authToken) {
    return { ok: false, error: "sign in via the popup first" }
  }
  if (!cfg.aliasDomain) {
    return { ok: false, error: "set an alias domain in extension options" }
  }
  const email = `${slugFromHost(host)}.${randomToken(6)}@${cfg.aliasDomain}`
  const password = generatePassword()
  try {
    await apiFetch(
      "/aliases",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          username: email,
          password,
          notes: host ? `auto-generated for ${host}` : null,
        }),
      },
      cfg
    )
    return { ok: true, email, password }
  } catch (e) {
    return { ok: false, error: String(e.message || e) }
  }
}

// Return saved credentials whose site/url matches the given host, so the
// content script can offer to autofill a login form.
async function matchCredentials(host) {
  const cfg = await getConfig()
  if (!cfg.authToken) return { ok: false, error: "not signed in" }
  if (!host) return { ok: true, matches: [] }
  try {
    const list = (await apiFetch("/credentials", { method: "GET" }, cfg)) || []
    const h = host.toLowerCase().replace(/^www\./, "")
    const matches = list
      .filter((c) => {
        const hay = `${c.site || ""} ${c.url || ""}`.toLowerCase()
        const site = (c.site || "").toLowerCase().replace(/^www\./, "")
        return hay.includes(h) || (site && (h.includes(site) || site.includes(h)))
      })
      .map((c) => ({ username: c.username || "", password: c.password || "", site: c.site || "" }))
    return { ok: true, matches }
  } catch (e) {
    return { ok: false, error: String(e.message || e) }
  }
}

async function saveCredential(payload) {
  const cfg = await getConfig()
  if (!cfg.authToken) {
    return { ok: false, error: "sign in via the popup first" }
  }
  try {
    await apiFetch(
      "/credentials",
      {
        method: "POST",
        body: JSON.stringify({
          site: payload.site || "",
          url: payload.url || null,
          username: payload.username || "",
          password: payload.password || "",
          notes: null,
        }),
      },
      cfg
    )
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e.message || e) }
  }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (!request || !request.type) return false
  switch (request.type) {
    case "CREATE_ALIAS":
      createAlias(request.payload?.host).then(sendResponse)
      return true // async response
    case "SAVE_CREDENTIAL":
      saveCredential(request.payload || {}).then(sendResponse)
      return true
    case "MATCH_CREDENTIALS":
      matchCredentials(request.payload?.host).then(sendResponse)
      return true
    default:
      return false
  }
})

chrome.runtime.onInstalled.addListener(() => {
  console.log("passwords extension installed")
})
