// passwords — content script
// detects email/username fields, distinguishes signup vs login,
// offers alias generation on signup pages and autofill on login pages.

;(() => {
  const HOST = location.hostname
  const ORIGIN = location.origin
  let activeChip = null
  let pending = null

  function looksLikeEmailField(el) {
    if (!el || el.tagName !== "INPUT") return false
    const type = (el.type || "").toLowerCase()
    if (type === "password" || type === "hidden" || type === "checkbox") return false
    const hay = [el.name, el.id, el.autocomplete, el.placeholder, el.getAttribute("aria-label") || ""]
      .join(" ").toLowerCase()
    if (type === "email") return true
    return /e-?mail|user(name)?|login/.test(hay)
  }

  // improved signup detection — looks at page text AND the form context
  function isSignupContext() {
    const url = location.href.toLowerCase()
    const bodyText = (document.body?.innerText || "").toLowerCase().slice(0, 6000)

    // explicit signup signals in url
    if (/signup|register|join|create.account|sign.up|welcome|get.started/.test(url)) return true

    // explicit signup signals in text
    if (/sign\s?up|create.{0,20}account|register|join|get started/.test(bodyText)) return true

    // form-level detection: if a form has both email + password + confirm password fields
    const forms = document.querySelectorAll("form")
    for (const form of forms) {
      const inputs = form.querySelectorAll("input")
      const types = Array.from(inputs).map(i => (i.type || "").toLowerCase())
      const names = Array.from(inputs).map(i => (i.name || i.id || "").toLowerCase()).join(" ")
      const hasConfirm = types.filter(t => t === "password").length >= 2
      if (hasConfirm) return true
      if (names.includes("confirm") || names.includes("confirm_password") || names.includes("password2")) return true
    }

    // login-only signals override signup
    if (/sign\s?in|log\s?in|signin|login/.test(url) && !/signup|register/.test(url)) return false
    if (/sign\s?in|log\s?in/.test(bodyText) && !/sign\s?up|create.{0,20}account/.test(bodyText)) return false

    return false
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
    if (activeChip) { activeChip.remove(); activeChip = null }
  }

  // create chip — generate alias
  function placeChip(field) {
    removeChip()
    const rect = field.getBoundingClientRect()
    const chip = document.createElement("button")
    chip.type = "button"
    chip.style.cssText = `
      position: fixed; z-index: 2147483647;
      top: ${window.scrollY + rect.top - 36}px;
      left: ${Math.max(8, window.scrollX + rect.left)}px;
      padding: 6px 12px; border-radius: 8px;
      border: 1px solid #f6b012;
      background: #050505; color: #f6b012;
      font-family: "Varela Round", sans-serif;
      font-size: 12px; cursor: pointer;
      text-transform: lowercase;
      transition: all 0.15s ease;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    `
    chip.textContent = "✦ generate alias"
    chip.onmouseenter = () => { chip.style.background = "#111111"; chip.style.borderColor = "#fff" }
    chip.onmouseleave = () => { chip.style.background = "#050505"; chip.style.borderColor = "#f6b012" }

    chip.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation() })
    chip.addEventListener("click", async (e) => {
      e.preventDefault(); e.stopPropagation()
      chip.disabled = true; chip.textContent = "creating..."
      const resp = await chrome.runtime.sendMessage({ type: "CREATE_ALIAS", payload: { host: HOST } })
      if (resp?.ok) {
        setNativeValue(field, resp.email)
        pending = { site: HOST, url: ORIGIN, username: resp.email, password: resp.password }
        toast("alias filled", "ok")
        offerSave()
      } else {
        toast(resp?.error || "failed", "err")
      }
      removeChip()
    })
    document.body.appendChild(chip)
    activeChip = chip
  }

  function toast(message, kind) {
    const t = document.createElement("div")
    t.style.cssText = `
      position: fixed; z-index: 2147483647;
      bottom: 16px; right: 16px;
      padding: 8px 14px; border-radius: 8px;
      border: 1px solid ${kind === "err" ? "#ff4444" : "#f6b012"};
      background: #050505; color: ${kind === "err" ? "#ff4444" : "#f6b012"};
      font-family: "Varela Round", sans-serif;
      font-size: 12px; text-transform: lowercase;
      transition: opacity 0.2s ease;
      opacity: 0;
    `
    t.textContent = message
    document.body.appendChild(t)
    requestAnimationFrame(() => t.style.opacity = "1")
    setTimeout(() => {
      t.style.opacity = "0"
      setTimeout(() => t.remove(), 250)
    }, 3000)
  }

  function offerSave() {
    if (!pending) return
    const existing = document.querySelector(".pw-save")
    if (existing) existing.remove()

    const box = document.createElement("div")
    box.className = "pw-save"
    box.style.cssText = `
      position: fixed; z-index: 2147483647;
      bottom: 60px; right: 16px;
      width: 280px; padding: 12px; border-radius: 8px;
      border: 1px solid #2a2a2a;
      background: #0a0a0a; color: #ffffff;
      font-family: "Varela Round", sans-serif;
      font-size: 12px; text-transform: lowercase;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6);
    `
    box.innerHTML = `
      <div style="color:#f6b012;margin-bottom:6px;font-weight:600;">save to passwords?</div>
      <div style="color:#3c9fdd;font-size:11px;margin-bottom:2px;">site: ${pending.site}</div>
      <div style="color:#3c9fdd;font-size:11px;margin-bottom:8px;">user: ${pending.username}</div>
      <div style="display:flex;gap:6px;justify-content:flex-end;">
        <button class="pw-btn pw-btn-ghost" data-act="dismiss" style="padding:4px 10px;border-radius:6px;border:1px solid #2a2a2a;background:transparent;color:#3c9fdd;font-family:inherit;font-size:11px;cursor:pointer;">not now</button>
        <button class="pw-btn pw-btn-gold" data-act="save" style="padding:4px 10px;border-radius:6px;border:none;background:#f6b012;color:#050505;font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;">save</button>
      </div>`

    box.querySelector('[data-act="dismiss"]').addEventListener("click", () => box.remove())
    box.querySelector('[data-act="save"]').addEventListener("click", async () => {
      const btn = box.querySelector('[data-act="save"]')
      btn.textContent = "saving..."
      const resp = await chrome.runtime.sendMessage({ type: "SAVE_CREDENTIAL", payload: pending })
      box.remove()
      toast(resp?.ok ? "saved" : resp?.error || "save failed", resp?.ok ? "ok" : "err")
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
    chip.style.cssText = `
      position: fixed; z-index: 2147483647;
      top: ${window.scrollY + rect.top - 36}px;
      left: ${Math.max(8, window.scrollX + rect.left)}px;
      padding: 6px 12px; border-radius: 8px;
      border: 1px solid #3c9fdd;
      background: #050505; color: #3c9fdd;
      font-family: "Varela Round", sans-serif;
      font-size: 12px; cursor: pointer;
      text-transform: lowercase;
      transition: all 0.15s ease;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    `
    chip.textContent = matches.length > 1 ? `↳ fill login (${matches.length})` : "↳ fill login"
    chip.onmouseenter = () => { chip.style.background = "#111111" }
    chip.onmouseleave = () => { chip.style.background = "#050505" }
    chip.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation() })
    chip.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation()
      if (matches.length > 1) placeChooser(field, matches)
      else { fillLogin(field, matches[0]); removeChip() }
    })
    document.body.appendChild(chip)
    activeChip = chip
  }

  // when several logins match, show a small dropdown to choose
  function placeChooser(field, matches) {
    removeChip()
    const rect = field.getBoundingClientRect()
    const menu = document.createElement("div")
    menu.style.cssText = `
      position: fixed; z-index: 2147483647;
      top: ${window.scrollY + rect.bottom + 4}px;
      left: ${Math.max(8, window.scrollX + rect.left)}px;
      min-width: 220px; max-width: 320px; padding: 4px;
      border-radius: 8px; border: 1px solid #2a2a2a; background: #0a0a0a;
      font-family: "Varela Round", sans-serif; text-transform: lowercase;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6);
    `
    for (const m of matches) {
      const item = document.createElement("button")
      item.type = "button"
      item.style.cssText = "display:block;width:100%;text-align:left;padding:6px 10px;border:none;background:transparent;color:#ffffff;font-family:inherit;font-size:12px;cursor:pointer;border-radius:6px;"
      item.innerHTML = `<span style="color:#fff">${m.username || m.name}</span><br><span style="color:#3c9fdd;font-size:11px">${m.name}</span>`
      item.onmouseenter = () => { item.style.background = "#111111" }
      item.onmouseleave = () => { item.style.background = "transparent" }
      item.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation() })
      item.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); fillLogin(field, m); removeChip() })
      menu.appendChild(item)
    }
    document.body.appendChild(menu)
    activeChip = menu
  }

  async function maybeOfferAutofill(field) {
    try {
      const resp = await chrome.runtime.sendMessage({ type: "MATCH_CREDENTIALS", payload: { host: HOST } })
      if (resp?.ok && resp.matches?.length) placeFillChip(field, resp.matches)
    } catch { /* background unavailable */ }
  }

  // on focus: offer alias generation on signup, autofill on login
  document.addEventListener("focusin", (e) => {
    const el = e.target
    if (!(el instanceof HTMLInputElement)) return
    const signup = isSignupContext()
    if (signup && looksLikeEmailField(el)) {
      placeChip(el)
    } else if (!signup && (el.type === "password" || looksLikeEmailField(el))) {
      maybeOfferAutofill(el)
    }
  }, true)

  document.addEventListener("focusout", () => setTimeout(removeChip, 200), true)

  // form submit → offer to save credentials
  document.addEventListener("submit", (e) => {
    const form = e.target
    if (!(form instanceof HTMLFormElement)) return
    const pw = form.querySelector('input[type="password"]')
    const em = [...form.querySelectorAll("input")].find(looksLikeEmailField)
    if (pw && pw.value) {
      pending = { site: HOST, url: ORIGIN, username: em ? em.value : pending?.username || "", password: pw.value }
      offerSave()
    }
  }, true)

  window.addEventListener("scroll", removeChip, { passive: true })

  // messages driven by the context menu (background service worker)
  chrome.runtime.onMessage.addListener((req) => {
    if (req?.type === "FILL_FIELD") {
      const el = document.activeElement
      if (el && "value" in el) setNativeValue(el, req.payload?.value || "")
      else toast("click a field first", "err")
    } else if (req?.type === "FILL_LOGIN") {
      if (req.payload?.ok && req.payload.matches?.length) {
        const el = document.activeElement instanceof HTMLInputElement ? document.activeElement : document.querySelector('input[type="password"], input')
        if (req.payload.matches.length > 1 && el) placeChooser(el, req.payload.matches)
        else fillLogin(el || document.body, req.payload.matches[0])
      } else {
        toast(req.payload?.error || "no matching login", "err")
      }
    }
  })
})()