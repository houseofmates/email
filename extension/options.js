// passwords — options page
//
// Persists the API base, alias domain, and an HTTP Basic auth token (derived
// from email + password) into chrome.storage.local, where both the popup and
// the background service worker read them.

const $ = (id) => document.getElementById(id)

function setStatus(message, kind = "") {
  const el = $("status")
  el.textContent = message
  el.className = "status" + (kind ? ` ${kind}` : "")
}

function load() {
  chrome.storage.local.get(
    ["apiBase", "aliasDomain", "authToken", "authUser"],
    (result) => {
      $("apiBase").value = result.apiBase || "http://localhost:8080/api"
      $("aliasDomain").value = result.aliasDomain || ""
      $("username").value = result.authUser || ""
      // never re-populate the password; show a placeholder if a token exists
      if (result.authToken) {
        $("password").placeholder = "•••••••• (saved)"
      }
    }
  )
}

function save() {
  const apiBase = $("apiBase").value.trim() || "http://localhost:8080/api"
  const aliasDomain = $("aliasDomain").value.trim()
  const username = $("username").value.trim()
  const password = $("password").value

  const update = { apiBase, aliasDomain, authUser: username }

  // Only recompute the token when a password was entered, so saving other
  // fields doesn't wipe an existing credential.
  if (username && password) {
    update.authToken = btoa(`${username}:${password}`)
  }

  chrome.storage.local.set(update, () => {
    setStatus("settings saved", "ok")
    $("password").value = ""
    if (update.authToken) $("password").placeholder = "•••••••• (saved)"
    setTimeout(() => setStatus(""), 2000)
  })
}

document.addEventListener("DOMContentLoaded", () => {
  load()
  $("saveBtn").addEventListener("click", save)
})
