// passwords — popup
//
// Lists, creates, and deletes email aliases against the local suite API.
// Config (api base + auth token) lives in chrome.storage.local and is managed
// from the options page.

const $ = (id) => document.getElementById(id)

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["apiBase", "authToken"], (result) => {
      resolve({
        apiBase: (result.apiBase || "http://localhost:8080/api").replace(/\/+$/, ""),
        authToken: result.authToken || null,
      })
    })
  })
}

function setStatus(message, kind = "") {
  const el = $("status")
  el.textContent = message
  el.className = "status" + (kind ? ` ${kind}` : "")
}

async function api(path, options = {}) {
  const cfg = await getConfig()
  if (!cfg.authToken) {
    const err = new Error("sign in via settings first")
    err.noAuth = true
    throw err
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

function render(aliases) {
  const list = $("list")
  list.innerHTML = ""
  if (!aliases || aliases.length === 0) {
    const empty = document.createElement("div")
    empty.className = "empty"
    empty.textContent = "no aliases yet"
    list.appendChild(empty)
    return
  }
  for (const alias of aliases) {
    const item = document.createElement("div")
    item.className = "item"

    const info = document.createElement("div")
    info.className = "item-info"
    const email = document.createElement("div")
    email.className = "item-email"
    email.textContent = alias.email || ""
    const user = document.createElement("div")
    user.className = "item-user"
    user.textContent = alias.username || ""
    info.appendChild(email)
    info.appendChild(user)

    const actions = document.createElement("div")
    actions.className = "item-actions"
    const del = document.createElement("button")
    del.className = "btn btn-del"
    del.textContent = "delete"
    del.addEventListener("click", () => removeAlias(alias.id))
    actions.appendChild(del)

    item.appendChild(info)
    item.appendChild(actions)
    list.appendChild(item)
  }
}

async function loadAliases() {
  setStatus("loading...")
  try {
    const aliases = await api("/aliases")
    render(aliases || [])
    setStatus("")
  } catch (e) {
    render([])
    setStatus(e.noAuth ? "sign in via settings first" : "failed to load aliases", "err")
  }
}

async function removeAlias(id) {
  try {
    await api(`/aliases/${id}`, { method: "DELETE" })
    loadAliases()
  } catch (e) {
    setStatus("failed to delete alias", "err")
  }
}

function toggleForm(show) {
  $("addForm").classList.toggle("hidden", !show)
  $("addBtn").classList.toggle("hidden", show)
}

async function saveAlias() {
  const email = $("email").value.trim()
  const username = $("username").value.trim()
  const password = $("password").value
  const notes = $("notes").value.trim() || null

  if (!email || !username) {
    setStatus("email and username are required", "err")
    return
  }
  setStatus("saving...")
  try {
    await api("/aliases", {
      method: "POST",
      body: JSON.stringify({ email, username, password, notes }),
    })
    $("email").value = ""
    $("username").value = ""
    $("password").value = ""
    $("notes").value = ""
    toggleForm(false)
    setStatus("alias added", "ok")
    loadAliases()
  } catch (e) {
    setStatus(e.noAuth ? "sign in via settings first" : "failed to add alias", "err")
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("addBtn").addEventListener("click", () => toggleForm(true))
  $("cancelBtn").addEventListener("click", () => toggleForm(false))
  $("saveBtn").addEventListener("click", saveAlias)
  $("optionsBtn").addEventListener("click", () => chrome.runtime.openOptionsPage())
  loadAliases()
})
