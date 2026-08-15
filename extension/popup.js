// passwords — popup (passwords via the vault, aliases via the bridge)

const $ = (id) => document.getElementById(id)
const msg = (type, payload) => new Promise((res) => chrome.runtime.sendMessage({ type, payload }, res))

let tab = "passwords"
let items = []
let query = ""
let unlocked = false

function getApiBase() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["apiBase"], (r) => resolve((r.apiBase || "http://localhost:3099").replace(/\/+$/, "")))
  })
}

function setStatus(m, kind = "") {
  const el = $("status")
  el.textContent = m
  el.className = "status" + (kind ? ` ${kind}` : "")
}

function genPassword(len = 20) {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*-_"
  const buf = new Uint32Array(len)
  crypto.getRandomValues(buf)
  let out = ""
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length]
  return out
}

function filtered() {
  if (!query) return items
  const q = query.toLowerCase()
  return items.filter((it) =>
    tab === "passwords"
      ? `${it.name || ""} ${it.username || ""} ${it.uri || ""}`.toLowerCase().includes(q)
      : `${it.email || ""} ${it.note || ""}`.toLowerCase().includes(q)
  )
}

function render() {
  const list = $("list")
  list.innerHTML = ""

  if (tab === "passwords" && !unlocked) { renderUnlock(list); return }

  const shown = filtered()
  if (shown.length === 0) {
    const empty = document.createElement("div")
    empty.className = "empty"
    empty.textContent = query ? "no matches" : `no ${tab} yet`
    list.appendChild(empty)
    return
  }
  for (const it of shown) list.appendChild(tab === "passwords" ? credItem(it) : aliasItem(it))
}

function renderUnlock(list) {
  const box = document.createElement("div")
  box.className = "item-info"
  const label = document.createElement("div")
  label.className = "item-site"
  label.textContent = "unlock your vault"
  const input = document.createElement("input")
  input.type = "password"
  input.placeholder = "master password"
  input.className = "field"
  const btn = mkBtn("unlock", "btn btn-gold", async () => {
    setStatus("unlocking…")
    const r = await msg("VAULT_UNLOCK", { masterPassword: input.value })
    if (r?.ok) { unlocked = true; setStatus(""); load() } else setStatus(r?.error || "unlock failed", "err")
  })
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") btn.click() })
  box.append(label, input, btn)
  list.appendChild(box)
}

function credItem(it) {
  const item = document.createElement("div")
  item.className = "item"
  const info = document.createElement("div")
  info.className = "item-info"
  const site = document.createElement("div"); site.className = "item-site"; site.textContent = it.name || it.uri || "(no name)"
  const user = document.createElement("div"); user.className = "item-user"; user.textContent = it.username || ""
  const pw = document.createElement("div"); pw.className = "item-pw"; pw.textContent = "••••••••"
  let revealed = false
  info.append(site, user, pw)
  const actions = document.createElement("div"); actions.className = "item-actions"
  const reveal = mkBtn("show", "btn", () => { revealed = !revealed; pw.textContent = revealed ? it.password || "" : "••••••••"; reveal.textContent = revealed ? "hide" : "show" })
  const copy = mkBtn("copy", "btn", () => { navigator.clipboard?.writeText(it.password || ""); copy.textContent = "copied"; setTimeout(() => (copy.textContent = "copy"), 1200) })
  const del = mkBtn("delete", "btn btn-del", async () => { await msg("VAULT_DELETE", { id: it.id }); load() })
  actions.append(reveal, copy, del)
  item.append(info, actions)
  return item
}

function aliasItem(it) {
  const item = document.createElement("div")
  item.className = "item"
  const info = document.createElement("div"); info.className = "item-info"
  const email = document.createElement("div"); email.className = "item-email"; email.textContent = it.email || it.alias || ""
  const note = document.createElement("div"); note.className = "item-user"; note.textContent = it.note || ""
  info.append(email, note)
  const actions = document.createElement("div"); actions.className = "item-actions"
  const copy = mkBtn("copy", "btn", () => { navigator.clipboard?.writeText(it.email || it.alias || ""); copy.textContent = "copied"; setTimeout(() => (copy.textContent = "copy"), 1200) })
  actions.append(copy)
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
    if (tab === "passwords") {
      const st = await msg("VAULT_STATUS")
      unlocked = !!st?.unlocked
      if (!unlocked) { items = []; setStatus(""); render(); return }
      const sync = await msg("VAULT_SYNC")
      items = (sync?.ciphers || []).filter((c) => c.type === "login")
    } else {
      const base = await getApiBase()
      const res = await fetch(`${base}/api/aliases`)
      const data = await res.json().catch(() => [])
      items = data.aliases || (Array.isArray(data) ? data : [])
    }
    setStatus("")
  } catch (e) {
    items = []
    setStatus(String(e.message || e), "err")
  }
  render()
}

function toggleForm(show) {
  $("addForm").classList.toggle("hidden", !show)
  $("addBtn").classList.toggle("hidden", show)
  $("pwFields").classList.toggle("hidden", tab !== "passwords")
  $("aliasFields").classList.toggle("hidden", tab !== "aliases")
}

async function save() {
  if (tab === "passwords") {
    const site = $("site").value.trim()
    if (!site) return setStatus("site is required", "err")
    setStatus("saving...")
    const r = await msg("SAVE_CREDENTIAL", { site, url: $("purl").value.trim() || null, username: $("username").value.trim(), password: $("password").value })
    if (!r?.ok) return setStatus(r?.error || "save failed", "err")
  } else {
    setStatus("creating alias…")
    const r = await msg("CREATE_ALIAS", { host: $("email").value.trim() || "" })
    if (!r?.ok) return setStatus(r?.error || "alias failed", "err")
  }
  ;["site", "purl", "email", "username", "password", "notes"].forEach((id) => { if ($(id)) $(id).value = "" })
  toggleForm(false)
  setStatus("saved", "ok")
  load()
}

function switchTab(next) {
  tab = next
  $("tabPasswords").classList.toggle("active", tab === "passwords")
  $("tabAliases").classList.toggle("active", tab === "aliases")
  $("sub").textContent = tab === "passwords" ? "your logins" : "your email aliases"
  $("search").value = ""; query = ""
  toggleForm(false)
  load()
}

function exportItems() {
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a"); a.href = url; a.download = `${tab}-export.json`; a.click()
  URL.revokeObjectURL(url)
}

document.addEventListener("DOMContentLoaded", () => {
  $("tabPasswords").addEventListener("click", () => switchTab("passwords"))
  $("tabAliases").addEventListener("click", () => switchTab("aliases"))
  $("search").addEventListener("input", (e) => { query = e.target.value; render() })
  $("addBtn").addEventListener("click", () => toggleForm(true))
  $("cancelBtn").addEventListener("click", () => toggleForm(false))
  $("saveBtn").addEventListener("click", save)
  $("genBtn").addEventListener("click", () => ($("password").value = genPassword()))
  $("exportBtn").addEventListener("click", exportItems)
  if ($("importBtn")) $("importBtn").style.display = "none" // import handled in the web app
  $("optionsBtn").addEventListener("click", () => chrome.runtime.openOptionsPage())
  switchTab("passwords")
})
