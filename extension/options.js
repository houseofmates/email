// passwords — options page
const $ = (id) => document.getElementById(id)

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["apiBase", "aliasDomain", "authToken"], (result) => {
    $("apiBase").value = result.apiBase || "http://localhost:3099"
    $("aliasDomain").value = result.aliasDomain || ""
    $("authToken").value = result.authToken || ""
  })

  $("saveBtn").addEventListener("click", () => {
    const apiBase = $("apiBase").value.trim()
    const aliasDomain = $("aliasDomain").value.trim()
    const authToken = $("authToken").value.trim()

    if (!apiBase) return setStatus("api endpoint is required", "err")
    if (!aliasDomain) return setStatus("alias domain is required", "err")
    if (!authToken) return setStatus("auth token is required", "err")

    chrome.storage.local.set({ apiBase, aliasDomain, authToken }, () => {
      setStatus("saved!", "ok")
    })
  })
})

function setStatus(msg, kind = "") {
  $("status").textContent = msg
  $("status").className = "status" + (kind ? ` ${kind}` : "")
}