// passwords — popup (passwords + aliases tabs)

const $ = (id) => document.getElementById(id)

let tab = "passwords"
let items = []
let query = ""

function endpoint() {
  return tab === "passwords" ? "/credentials" : "/aliases"
}

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["apiBase", "authToken"], (r) => {
      resolve({
        apiBase: (r.apiBase || "http://localhost:8080/api").replace(/\/+$/, ""),
        authToken: r.authToken || null,
      })
    })
  })
}

function setStatus(msg, kind = "") {
  const el = $("status")
  el.textContent = msg
  el.className = "status" + (kind ? ` ${kind}` : "")
}

async function api(path, options = {}) {
  const cfg = await getConfig()
  if (!cfg.authToken) {
    const e = new Error("sign in via settings first")
    e.noAuth = true
    throw e
  }
  const headers = Object.assign(
    { "Content-Type": "application/json" },
    options.headers || {}
  )
  headers["Authorization"] = `Basic ${cfg.authToken}`
  const res = await fetch(`${cfg.apiBase}${path}`, { ...options, headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if (res.status === 204) return null
  return res.json().catch(() => null)
}

function genPassword(len = 20) {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_"
  const buf = new Uint32Array(len)
  crypto.getRandomValues(buf)
  let out = ""
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length]
  return out
}

function matches(it) {
  if (!query) return true
  const q = query.toLowerCase()
  if (tab === "passwords") {
    return (
      (it.site || "").toLowerCase().includes(q) ||
      (it.username || "").toLowerCase().includes(q) ||
      (it.url || "").toLowerCase().includes(q)
    )
  }
  return (
    (it.email || "").toLowerCase().includes(q) ||
    (it.username || "").toLowerCase().includes(q)
  )
}

function render() {
  const list = $("list")
  list.innerHTML = ""
  const shown = items.filter(matches)
  if (shown.length === 0) {
    const empty = document.createElement("div")
    empty.className = "empty"
    empty.textContent = query ? "no matches" : `no ${tab} yet`
    list.appendChild(empty)
    return
  }
  for (const it of shown) {
    list.appendChild(tab === "passwords" ? credItem(it) : aliasItem(it))
  }
}

function credItem(it) {
  const item = document.createElement("div")
  item.className = "item"

  const info = document.createElement("div")
  info.className = "item-info"
  const site = document.createElement("div")
  site.className = "item-site"
  site.textContent = it.site || it.url || "(no site)"
  const user = document.createElement("div")
  user.className = "item-user"
  user.textContent = it.username || ""
  const pw = document.createElement("div")
  pw.className = "item-pw"
  pw.textContent = "••••••••"
  let revealed = false
  info.append(site, user, pw)

  const actions = document.createElement("div")
  actions.className = "item-actions"

  const reveal = mkBtn("show", "btn", () => {
    revealed = !revealed
    pw.textContent = revealed ? it.password || "" : "••••••••"
    reveal.textContent = revealed ? "hide" : "show"
  })
  const copy = mkBtn("copy", "btn", () => {
    navigator.clipboard?.writeText(it.password || "")
    copy.textContent = "copied"
    setTimeout(() => (copy.textContent = "copy"), 1200)
  })
  const del = mkBtn("delete", "btn btn-del", () => remove(it.id))
  actions.append(reveal, copy, del)

  item.append(info, actions)
  return item
}

function aliasItem(it) {
  const item = document.createElement("div")
  item.className = "item"
  const info = document.createElement("div")
  info.className = "item-info"
  const email = document.createElement("div")
  email.className = "item-email"
  email.textContent = it.email || ""
  const user = document.createElement("div")
  user.className = "item-user"
  user.textContent = it.username || ""
  info.append(email, user)

  const actions = document.createElement("div")
  actions.className = "item-actions"
  const copy = mkBtn("copy", "btn", () => {
    navigator.clipboard?.writeText(it.email || "")
    copy.textContent = "copied"
    setTimeout(() => (copy.textContent = "copy"), 1200)
  })
  const del = mkBtn("delete", "btn btn-del", () => remove(it.id))
  actions.append(copy, del)
  item.append(info, actions)
  return item
}

function mkBtn(label, cls, onClick) {
  const b = document.createElement("button")
  b.className = cls
  b.textContent = label
  b.addEventListener("click", onClick)
  return b
}

async function load() {
  setStatus("loading...")
  try {
    items = (await api(endpoint())) || []
    setStatus("")
  } catch (e) {
    items = []
    setStatus(e.noAuth ? "sign in via settings first" : "failed to load", "err")
  }
  render()
}

async function remove(id) {
  try {
    await api(`${endpoint()}/${id}`, { method: "DELETE" })
    load()
  } catch {
    setStatus("delete failed", "err")
  }
}

function toggleForm(show) {
  $("addForm").classList.toggle("hidden", !show)
  $("addBtn").classList.toggle("hidden", show)
  $("pwFields").classList.toggle("hidden", tab !== "passwords")
  $("aliasFields").classList.toggle("hidden", tab !== "aliases")
}

async function save() {
  const username = $("username").value.trim()
  const password = $("password").value
  const notes = $("notes").value.trim() || null
  let payload
  if (tab === "passwords") {
    const site = $("site").value.trim()
    if (!site) return setStatus("site is required", "err")
    payload = { site, url: $("purl").value.trim() || null, username, password, notes }
  } else {
    const email = $("email").value.trim()
    if (!email || !username) return setStatus("email and username required", "err")
    payload = { email, username, password, notes }
  }
  setStatus("saving...")
  try {
    await api(endpoint(), { method: "POST", body: JSON.stringify(payload) })
    ;["site", "purl", "email", "username", "password", "notes"].forEach((id) => {
      if ($(id)) $(id).value = ""
    })
    toggleForm(false)
    setStatus("saved", "ok")
    load()
  } catch (e) {
    setStatus(e.noAuth ? "sign in via settings first" : "save failed", "err")
  }
}

function switchTab(next) {
  tab = next
  $("tabPasswords").classList.toggle("active", tab === "passwords")
  $("tabAliases").classList.toggle("active", tab === "aliases")
  $("sub").textContent = tab === "passwords" ? "your logins" : "your email aliases"
  $("search").value = ""
  query = ""
  toggleForm(false)
  load()
}

function exportItems() {
  const blob = new Blob([JSON.stringify(items, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${tab}-export.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function importItems(file) {
  let parsed
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    return setStatus("invalid json", "err")
  }
  if (!Array.isArray(parsed)) return setStatus("expected a json array", "err")
  setStatus("importing...")
  let ok = 0
  for (const it of parsed) {
    const { id, ...rest } = it || {}
    try {
      await api(endpoint(), { method: "POST", body: JSON.stringify(rest) })
      ok++
    } catch {
      /* skip bad row */
    }
  }
  setStatus(`imported ${ok}/${parsed.length}`, "ok")
  load()
}

document.addEventListener("DOMContentLoaded", () => {
  $("tabPasswords").addEventListener("click", () => switchTab("passwords"))
  $("tabAliases").addEventListener("click", () => switchTab("aliases"))
  $("search").addEventListener("input", (e) => {
    query = e.target.value
    render()
  })
  $("addBtn").addEventListener("click", () => toggleForm(true))
  $("cancelBtn").addEventListener("click", () => toggleForm(false))
  $("saveBtn").addEventListener("click", save)
  $("genBtn").addEventListener("click", () => ($("password").value = genPassword()))
  $("exportBtn").addEventListener("click", exportItems)
  $("importBtn").addEventListener("click", () => $("importFile").click())
  $("importFile").addEventListener("change", (e) => {
    if (e.target.files?.[0]) importItems(e.target.files[0])
  })
  $("optionsBtn").addEventListener("click", () => chrome.runtime.openOptionsPage())
  switchTab("passwords")
})
