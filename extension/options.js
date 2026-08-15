// passwords — options page
const $ = (id) => document.getElementById(id)

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["apiBase", "aliasDomain", "autoLockMinutes"], (result) => {
    $("apiBase").value = result.apiBase || "http://localhost:3099"
    $("aliasDomain").value = result.aliasDomain || ""
    if ($("autoLockMinutes")) $("autoLockMinutes").value = result.autoLockMinutes || 15
  })

  $("saveBtn").addEventListener("click", () => {
    const apiBase = $("apiBase").value.trim()
    const aliasDomain = $("aliasDomain").value.trim()
    const autoLockMinutes = Math.max(1, Number($("autoLockMinutes")?.value) || 15)

    if (!apiBase) return setStatus("api endpoint is required", "err")
    // aliasDomain is only needed for the stalwart alias store (optional with simplelogin)

    chrome.storage.local.set({ apiBase, aliasDomain, autoLockMinutes }, () => {
      setStatus("saved!", "ok")
    })
  })
})

function setStatus(msg, kind = "") {
  $("status").textContent = msg
  $("status").className = "status" + (kind ? ` ${kind}` : "")
}
