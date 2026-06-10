import { useEffect, useRef, useState } from "react"
import Layout from "./layout"
import { inputClass, goldBtn, ghostBtn } from "./components/ui"
import { caldavUrl } from "./services/calendar"
import { useSettings, getSettings, replaceSettings, DEFAULTS } from "./services/settings"

const TABS = [
  { key: "general", label: "general" },
  { key: "accounts", label: "accounts" },
  { key: "email", label: "email" },
  { key: "security", label: "security" },
  { key: "notifications", label: "notifications" },
  { key: "advanced", label: "advanced" },
]

export default function Settings({ authHeader, onNavigate, onLogout, userEmail }) {
  const [tab, setTab] = useState("general")
  const [settings, update] = useSettings()

  return (
    <Layout currentPage="settings" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      <div className="flex flex-1 flex-col min-h-0">
        <div className="border-b border-pkm-500 px-4 py-3">
          <h1 className="text-lg text-gold lowercase tracking-wide">settings</h1>
        </div>

        {/* tab pills — horizontal, scrollable on mobile (matches the vault bar) */}
        <div className="flex gap-1 overflow-x-auto border-b border-pkm-500 px-4 py-2" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition lowercase min-h-[36px] ${
                tab === t.key ? "bg-gold text-pkm-900" : "bg-pkm-700 text-text-info hover:text-text-primary"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-[760px] space-y-6">
            {tab === "general" && <GeneralTab settings={settings} update={update} />}
            {tab === "accounts" && <AccountsTab authHeader={authHeader} userEmail={userEmail} onLogout={onLogout} />}
            {tab === "email" && <EmailTab userEmail={userEmail} />}
            {tab === "security" && <SecurityTab onNavigate={onNavigate} onLogout={onLogout} />}
            {tab === "notifications" && <NotificationsTab settings={settings} update={update} />}
            {tab === "advanced" && <AdvancedTab settings={settings} update={update} />}
          </div>
        </div>
      </div>
    </Layout>
  )
}

// ── reusable primitives ──────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div>
      {title && <h2 className="mb-2 text-sm text-gold lowercase">{title}</h2>}
      <div className="rounded-lg border border-pkm-500 bg-pkm-800 p-4 space-y-4">{children}</div>
    </div>
  )
}

function Row({ label, hint, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-text-primary lowercase">{label}</p>
        {hint && <p className="text-xs text-text-info lowercase">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="flex gap-1 rounded-lg bg-pkm-700 p-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-xs transition lowercase min-h-[36px] ${
            value === o.value ? "bg-gold text-pkm-900 font-semibold" : "text-text-info hover:text-text-primary"
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition active:scale-[0.98] ${checked ? "bg-gold" : "bg-pkm-500"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-pkm-900 transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  )
}

// ── general ──────────────────────────────────────────────────────────────────
function GeneralTab({ settings, update }) {
  return (
    <Section title="appearance">
      <Row label="theme" hint="dark is the canonical look; system follows your os">
        <Segmented value={settings.theme} onChange={(v) => update("theme", v)}
          options={[{ value: "system", label: "system" }, { value: "dark", label: "dark" }, { value: "light", label: "light" }]} />
      </Row>
      <Row label="date format">
        <Segmented value={settings.dateFormat} onChange={(v) => update("dateFormat", v)}
          options={[{ value: "iso", label: "iso" }, { value: "us", label: "us" }, { value: "eu", label: "eu" }]} />
      </Row>
      <Row label="time format">
        <Segmented value={settings.timeFormat} onChange={(v) => update("timeFormat", v)}
          options={[{ value: "24h", label: "24h" }, { value: "12h", label: "12h" }]} />
      </Row>
      <Row label="default view" hint="page shown right after you sign in">
        <Segmented value={settings.defaultView} onChange={(v) => update("defaultView", v)}
          options={[{ value: "inbox", label: "inbox" }, { value: "calendar", label: "calendar" }, { value: "passwords", label: "passwords" }]} />
      </Row>
    </Section>
  )
}

// ── accounts ─────────────────────────────────────────────────────────────────
function AccountsTab({ authHeader, userEmail, onLogout }) {
  return (
    <>
      <Section title="account">
        <Row label={userEmail || "signed in"} hint="the account these services authenticate as" />
        <button onClick={onLogout}
          className="rounded-lg border border-danger-border px-3 py-1.5 text-xs text-danger transition hover:bg-danger-dim active:scale-[0.98] lowercase min-h-[40px]">
          sign out
        </button>
      </Section>

      <Section title="linked services">
        <ServiceCard name="stalwart mail" endpoint="/api/mail/oauth-metadata" authHeader={authHeader} />
        <ServiceCard name="vault (local encrypted file)" endpoint="/api/passwords/status" authHeader={authHeader} />
        <ServiceCard name="simplelogin" endpoint="/api/aliases" authHeader={authHeader} />
      </Section>

      <Section title="mail forwarding">
        <ProtonForwarding authHeader={authHeader} />
      </Section>
    </>
  )
}

// connection test — any http response means reachable; only a network error is
// treated as offline. never sends credentials beyond the existing auth header.
function ServiceCard({ name, endpoint, authHeader }) {
  const [status, setStatus] = useState("idle") // idle | testing | online | offline
  async function test() {
    setStatus("testing")
    try {
      await fetch(endpoint, { method: "GET", headers: { authorization: authHeader }, credentials: "same-origin" })
      setStatus("online")
    } catch {
      setStatus("offline")
    }
  }
  const dot = status === "online" ? "bg-gold" : status === "offline" ? "bg-danger" : "bg-text-info"
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`h-2 w-2 rounded-full ${dot} ${status === "testing" ? "animate-pulse-gold" : ""}`} />
        <div className="min-w-0">
          <p className="text-sm text-text-primary lowercase truncate">{name}</p>
          <p className="text-xs text-text-info lowercase truncate">{endpoint}</p>
        </div>
      </div>
      <button onClick={test} disabled={status === "testing"} className={`${ghostBtn} min-h-[40px]`}>
        {status === "testing" ? "testing..." : status === "online" ? "online" : status === "offline" ? "offline — retry" : "test"}
      </button>
    </div>
  )
}

// ── email ────────────────────────────────────────────────────────────────────
function EmailTab({ userEmail }) {
  return (
    <>
      <Section title="external clients">
        <p className="text-xs text-text-info lowercase">
          connection details for desktop / mobile mail, calendar and contacts clients.
        </p>
        <ConnectionStrings userEmail={userEmail} />
      </Section>
      <Section title="storage">
        <Row label="quota" hint="storage usage appears here once the email vertical is wired to jmap" />
      </Section>
    </>
  )
}

function ConnectionStrings({ userEmail }) {
  const host = typeof window !== "undefined" ? window.location.host : "mail.example.com"
  const origin = typeof window !== "undefined" ? window.location.origin : "https://mail.example.com"
  const user = userEmail || "you@example.com"
  const caldav = caldavUrl(user)
  const carddav = `${origin}/dav/addressbooks/${encodeURIComponent(user)}/`
  const jmap = `${origin}/jmap/session`
  const mailConfig =
    `# calendar / contacts (caldav / carddav)\n` +
    `calendar: ${caldav}\n` +
    `contacts: ${carddav}\n\n` +
    `# mail — jmap\n` +
    `session:  ${jmap}\n\n` +
    `# mail — imap (incoming)\n` +
    `host: ${host}\nport: 993\nsecurity: ssl/tls\nuser: ${user}\n\n` +
    `# mail — smtp (outgoing)\n` +
    `host: ${host}\nport: 465\nsecurity: ssl/tls\nuser: ${user}`
  return (
    <div className="space-y-3">
      <CopyRow label="caldav url" value={caldav} />
      <CopyRow label="carddav url" value={carddav} />
      <CopyRow label="full client config" value={mailConfig} multiline />
    </div>
  )
}

// ── security ─────────────────────────────────────────────────────────────────
function SecurityTab({ onNavigate, onLogout }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <>
      {/* trust note — the bridge decrypts a local encrypted vault file */}
      <div className="rounded-lg border border-gold bg-gold-dim p-4">
        <p className="text-sm text-gold lowercase">how your passwords are stored</p>
        <p className="mt-1 text-xs text-text-primary lowercase leading-relaxed">
          your vault is a single file on your server, encrypted at rest with aes-256-gcm under a
          key derived from your master password (argon2id). the master password is sent to the
          bridge once when you unlock so it can decrypt the file in memory — never stored, never
          logged. it cannot be recovered if lost. run the bridge over https (a reverse proxy with
          hsts) and only on a network you trust.
        </p>
      </div>

      <Section title="two-factor & keys">
        <Row label="manage 2fa, recovery codes, security keys" hint="totp, duo, yubikey — handled in the vault">
          <button onClick={() => onNavigate?.("passwords")} className={`${ghostBtn} min-h-[40px]`}>open vault</button>
        </Row>
      </Section>

      <Section title="your data">
        <Row label="export everything" hint="email, calendar, contacts, passwords, aliases (takeout)">
          <button onClick={() => onNavigate?.("passwords")} className={`${ghostBtn} min-h-[40px]`}>export</button>
        </Row>
        <Row label="security log" hint="login attempts, ip addresses, permission changes — coming with the security vertical" />
      </Section>

      <Section title="danger zone">
        <Row label="sign out of this device">
          <button onClick={onLogout} className={`${ghostBtn} min-h-[40px]`}>sign out</button>
        </Row>
        <Row label="delete account" hint="permanently removes your data. cannot be undone.">
          <button onClick={() => setConfirmDelete(true)}
            className="rounded-md border border-danger-border px-3 py-1.5 text-xs text-danger transition hover:bg-danger-dim active:scale-[0.98] lowercase min-h-[40px]">
            delete…
          </button>
        </Row>
      </Section>

      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-pkm-900/80 p-4" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-sm rounded-xl border border-danger-border bg-pkm-800 p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-base text-danger lowercase tracking-wide">delete account</h3>
            <p className="mb-5 text-sm text-text-info lowercase">
              account deletion runs against stalwart and is wired with the security vertical. for now,
              delete the account from your stalwart admin console.
            </p>
            <div className="flex justify-end">
              <button onClick={() => setConfirmDelete(false)} className={`${ghostBtn} min-h-[40px]`}>close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── notifications ────────────────────────────────────────────────────────────
function NotificationsTab({ settings, update }) {
  return (
    <Section title="alerts">
      <Row label="new mail" hint="notify on incoming messages">
        <Toggle checked={settings.notifyMail} onChange={(v) => update("notifyMail", v)} label="new mail" />
      </Row>
      <Row label="calendar reminders" hint="notify ahead of events">
        <Toggle checked={settings.notifyCalendar} onChange={(v) => update("notifyCalendar", v)} label="calendar reminders" />
      </Row>
      <Row label="security events" hint="new sign-ins, permission changes">
        <Toggle checked={settings.notifySecurity} onChange={(v) => update("notifySecurity", v)} label="security events" />
      </Row>
    </Section>
  )
}

// ── advanced ─────────────────────────────────────────────────────────────────
function AdvancedTab({ settings, update }) {
  return (
    <>
      <Section title="developer">
        <Row label="debug mode" hint="mirror api request/response logs to the browser console">
          <Toggle checked={settings.debug} onChange={(v) => update("debug", v)} label="debug mode" />
        </Row>
        <Row label="endpoint override" hint="base path when running behind a reverse proxy" />
        <input type="text" value={settings.endpointOverride} placeholder="e.g. /mail"
          onChange={(e) => update("endpointOverride", e.target.value)} className={inputClass(false)} />
      </Section>

      <Section title="privacy">
        <Row label="anonymous usage stats" hint="off by default — nothing is sent unless you enable this">
          <Toggle checked={settings.telemetry} onChange={(v) => update("telemetry", v)} label="anonymous usage stats" />
        </Row>
      </Section>

      <Section title="backup & restore">
        <Row label="app settings" hint="export or import your preferences as a json file">
          <div className="flex gap-2">
            <BackupButtons />
          </div>
        </Row>
      </Section>

      <div>
        <h2 className="mb-2 text-sm text-gold lowercase">about</h2>
        <div className="rounded-lg border border-pkm-500 bg-pkm-800 p-4">
          <p className="text-xs text-text-info lowercase leading-relaxed">
            email is a unified interface for stalwart, vaultwarden, and simplelogin.
            all data stays on your infrastructure.
          </p>
        </div>
      </div>
    </>
  )
}

function BackupButtons() {
  const fileRef = useRef(null)
  const [msg, setMsg] = useState(null)

  function exportSettings() {
    const blob = new Blob([JSON.stringify(getSettings(), null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "email-settings.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importSettings(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      // keep only known keys so a tampered file can't inject arbitrary state
      const clean = {}
      for (const k of Object.keys(DEFAULTS)) if (k in parsed) clean[k] = parsed[k]
      replaceSettings(clean)
      setMsg({ kind: "ok", text: "settings restored" })
    } catch {
      setMsg({ kind: "err", text: "invalid settings file" })
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <>
      <button onClick={exportSettings} className={`${ghostBtn} min-h-[40px]`}>export</button>
      <button onClick={() => fileRef.current?.click()} className={`${ghostBtn} min-h-[40px]`}>import</button>
      <input ref={fileRef} type="file" accept=".json" onChange={importSettings} className="hidden" />
      {msg && <span className={`self-center text-xs lowercase ${msg.kind === "err" ? "text-danger" : "text-gold"}`}>{msg.text}</span>}
    </>
  )
}

// ── proton forwarding (unchanged behaviour, relocated to the accounts tab) ────
function ProtonForwarding({ authHeader }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [status, setStatus] = useState(null)
  const [msg, setMsg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)

  async function loadStatus() {
    try {
      const res = await fetch("/api/forwarding/status", {
        credentials: "same-origin",
        headers: { Authorization: authHeader },
      })
      if (!res.ok) return
      const data = await res.json()
      setStatus(data)
      if (data.email) setEmail(data.email)
      if (typeof data.enabled === "boolean") setEnabled(data.enabled)
    } catch { /* status optional */ }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function sync() {
    setSyncing(true)
    try {
      const res = await fetch("/api/forwarding/proton-sync", {
        method: "POST",
        credentials: "same-origin",
        headers: { Authorization: authHeader },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "sync failed")
      setMsg({ kind: "ok", text: `synced ${data.synced || 0} messages` })
      await loadStatus()
    } catch (err) {
      setMsg({ kind: "err", text: String(err.message || err) })
    } finally {
      setSyncing(false)
    }
  }

  async function save() {
    if (!email.trim() || !password.trim()) {
      setMsg({ kind: "err", text: "email and password required" })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch("/api/forwarding/proton-login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ email, password, enabled }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "save failed")
      setMsg({ kind: "ok", text: "saved" })
      setPassword("")
      await loadStatus()
      if (enabled) await sync()
    } catch (err) {
      setMsg({ kind: "err", text: String(err.message || err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-primary lowercase">proton forwarding</p>
        {status?.lastSync && (
          <span className="text-xs text-text-info lowercase">
            last sync {new Date(status.lastSync).toLocaleString()}
          </span>
        )}
      </div>

      <input type="email" placeholder="proton email" value={email}
        onChange={(e) => setEmail(e.target.value)} className={inputClass(false)} />
      <input type="password" placeholder="password or app-specific password" value={password}
        onChange={(e) => setPassword(e.target.value)} className={inputClass(false)} />

      <label className="flex cursor-pointer items-center gap-2 text-xs text-text-info lowercase">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        enable forwarding
      </label>

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving} className={goldBtn}>{saving ? "saving..." : "save"}</button>
        <button onClick={sync} disabled={syncing || !status?.configured} className={ghostBtn}>
          {syncing ? "syncing..." : "sync now"}
        </button>
      </div>

      {msg && <p className={`text-xs lowercase ${msg.kind === "err" ? "text-danger" : "text-gold"}`}>{msg.text}</p>}

      <p className="text-xs text-text-info lowercase leading-relaxed">
        pulls proton mail into your inbox. to also send outgoing mail as your proton alias,
        stalwart's smtp sender / identity must be configured for that address — forwarding here
        only covers inbound mail.
      </p>
    </div>
  )
}

// label + value with a copy button and brief "copied" confirmation.
function CopyRow({ label, value, multiline }) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef(null)
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard unavailable */ }
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-text-info lowercase">{label}</span>
        <button onClick={copy} className={`${ghostBtn} min-h-[44px]`}>{copied ? "copied" : "copy"}</button>
      </div>
      {multiline ? (
        <pre className="overflow-x-auto rounded bg-pkm-700 p-2 text-[11px] text-text-primary whitespace-pre-wrap">{value}</pre>
      ) : (
        <code className="block break-all rounded bg-pkm-700 px-2 py-1 text-[11px] text-text-primary">{value}</code>
      )}
    </div>
  )
}
