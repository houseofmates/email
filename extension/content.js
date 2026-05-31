// passwords — content script
// detects email/username fields on signup pages, generates aliases on demand,
// and offers to save site credentials back to the store.

;(() => {
  const HOST = location.hostname
  const ORIGIN = location.origin
  let activeChip = null
  let pending = null // { site, url, username, password }

  function looksLikeEmailField(el) {
    if (!el || el.tagName !== "INPUT") return false
    const type = (el.type || "").toLowerCase()
    if (type === "password" || type === "hidden" || type === "checkbox") return false
    const hay = [
      el.name,
      el.id,
      el.autocomplete,
      el.placeholder,
      el.getAttribute("aria-label") || "",
    ]
      .join(" ")
      .toLowerCase()
    if (type === "email") return true
    return /e-?mail|user(name)?|login/.test(hay)
  }

  function isSignupContext() {
    const hay = (document.body?.innerText || "").toLowerCase().slice(0, 4000)
    const url = location.href.toLowerCase()
    return (
      /sign\s?up|create.{0,12}account|register|join|get started/.test(hay) ||
      /signup|register|join|create-account/.test(url) ||
      document.querySelector('input[type="password"]') != null
    )
  }

  function setNativeValue(el, value) {
    const proto = Object.getPrototypeOf(el)
    const desc = Object.getOwnPropertyDescriptor(proto, "value")
    if (desc && desc.set) desc.set.call(el, value)
    else el.value = value
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  }

  function removeChip() {
    if (activeChip) {
      activeChip.remove()
      activeChip = null
    }
  }

  function placeChip(field) {
    removeChip()
    const rect = field.getBoundingClientRect()
    const chip = document.createElement("button")
    chip.type = "button"
    chip.className = "pw-chip"
    chip.textContent = "✦ generate alias"
    chip.style.top = `${window.scrollY + rect.top - 32}px`
    chip.style.left = `${window.scrollX + rect.left}px`
    chip.addEventListener("mousedown", (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    chip.addEventListener("click", async (e) => {
      e.preventDefault()
      e.stopPropagation()
      chip.disabled = true
      chip.textContent = "creating..."
      const resp = await chrome.runtime.sendMessage({
        type: "CREATE_ALIAS",
        payload: { host: HOST },
      })
      if (resp?.ok) {
        setNativeValue(field, resp.email)
        pending = {
          site: HOST,
          url: ORIGIN,
          username: resp.email,
          password: resp.password,
        }
        toast(`alias filled · password saved for save`, "ok")
        offerSave()
      } else {
        toast(resp?.error || "failed to create alias", "err")
      }
      removeChip()
    })
    document.body.appendChild(chip)
    activeChip = chip
  }

  function toast(message, kind) {
    const t = document.createElement("div")
    t.className = `pw-toast ${kind === "err" ? "pw-toast-err" : "pw-toast-ok"}`
    t.textContent = message
    document.body.appendChild(t)
    setTimeout(() => t.classList.add("pw-toast-in"), 10)
    setTimeout(() => {
      t.classList.remove("pw-toast-in")
      setTimeout(() => t.remove(), 250)
    }, 3500)
  }

  function offerSave() {
    if (!pending) return
    const existing = document.querySelector(".pw-save")
    if (existing) existing.remove()

    const box = document.createElement("div")
    box.className = "pw-save"
    box.innerHTML = `
      <div class="pw-save-title">save to passwords?</div>
      <div class="pw-save-row pw-save-site"></div>
      <div class="pw-save-row pw-save-user"></div>
      <div class="pw-save-actions">
        <button type="button" class="pw-btn pw-btn-ghost" data-act="dismiss">not now</button>
        <button type="button" class="pw-btn pw-btn-gold" data-act="save">save</button>
      </div>`
    box.querySelector(".pw-save-site").textContent = `site: ${pending.site}`
    box.querySelector(".pw-save-user").textContent = `username: ${pending.username}`

    box.querySelector('[data-act="dismiss"]').addEventListener("click", () => box.remove())
    box.querySelector('[data-act="save"]').addEventListener("click", async () => {
      box.querySelector('[data-act="save"]').textContent = "saving..."
      const resp = await chrome.runtime.sendMessage({
        type: "SAVE_CREDENTIAL",
        payload: pending,
      })
      box.remove()
      toast(resp?.ok ? "saved to passwords" : resp?.error || "save failed", resp?.ok ? "ok" : "err")
      pending = null
    })
    document.body.appendChild(box)
  }

  function fillLogin(field, cred) {
    const form = field.closest("form") || document
    const pw = form.querySelector('input[type="password"]')
    const user = [...form.querySelectorAll("input")].find(looksLikeEmailField)
    if (user && cred.username) setNativeValue(user, cred.username)
    if (pw && cred.password) setNativeValue(pw, cred.password)
    toast("login filled", "ok")
  }

  function placeFillChip(field, matches) {
    removeChip()
    const rect = field.getBoundingClientRect()
    const chip = document.createElement("button")
    chip.type = "button"
    chip.className = "pw-chip"
    chip.textContent =
      matches.length > 1 ? `↳ fill login (${matches.length})` : "↳ fill login"
    chip.style.top = `${window.scrollY + rect.top - 32}px`
    chip.style.left = `${window.scrollX + rect.left}px`
    chip.addEventListener("mousedown", (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    chip.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      fillLogin(field, matches[0])
      removeChip()
    })
    document.body.appendChild(chip)
    activeChip = chip
  }

  async function maybeOfferAutofill(field) {
    try {
      const resp = await chrome.runtime.sendMessage({
        type: "MATCH_CREDENTIALS",
        payload: { host: HOST },
      })
      if (resp?.ok && resp.matches?.length) placeFillChip(field, resp.matches)
    } catch {
      /* background unavailable */
    }
  }

  // on focus: offer alias generation on signup pages, login autofill otherwise
  document.addEventListener(
    "focusin",
    (e) => {
      const el = e.target
      if (!(el instanceof HTMLInputElement)) return
      if (isSignupContext()) {
        if (looksLikeEmailField(el)) placeChip(el)
      } else if (el.type === "password" || looksLikeEmailField(el)) {
        maybeOfferAutofill(el)
      }
    },
    true
  )

  document.addEventListener(
    "focusout",
    () => {
      setTimeout(removeChip, 200)
    },
    true
  )

  // when a form with a password is submitted, offer to save whatever was used
  document.addEventListener(
    "submit",
    (e) => {
      const form = e.target
      if (!(form instanceof HTMLFormElement)) return
      const pw = form.querySelector('input[type="password"]')
      const em = [...form.querySelectorAll("input")].find(looksLikeEmailField)
      if (pw && pw.value) {
        pending = {
          site: HOST,
          url: ORIGIN,
          username: em ? em.value : pending?.username || "",
          password: pw.value,
        }
        offerSave()
      }
    },
    true
  )

  window.addEventListener("scroll", removeChip, { passive: true })
})()
