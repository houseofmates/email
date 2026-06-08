import { useEffect, useState } from "react"
import Layout from "./layout"
import { inputClass, goldBtn, ghostBtn } from "./components/ui"
import { caldavUrl } from "./services/calendar"

export default function Settings({ authHeader, onNavigate, onLogout, userEmail }) {
  return (
    <Layout currentPage="settings" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      <div className="flex flex-1 flex-col min-h-0">
        <div className="border-b border-pkm-500 px-4 py-3">
          <h1 className="text-lg text-gold lowercase tracking-wide">settings</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* account */}
          <div>
            <h2 className="text-sm text-gold lowercase mb-2">account</h2>
            <div className="rounded-lg border border-pkm-500 bg-pkm-800 p-4">
              <p className="text-sm text-text-primary lowercase">{userEmail}</p>
              <button onClick={onLogout}
                className="mt-3 rounded-lg border border-danger-border px-3 py-1.5 text-xs text-danger transition hover:bg-danger-dim active:scale-[0.98] lowercase">
                sign out
              </button>
            </div>
          </div>

          {/* mail accounts / forwarding */}
          <div>
            <h2 className="text-sm text-gold lowercase mb-2">mail accounts</h2>
            <ProtonForwarding authHeader={authHeader} />
          </div>

          {/* services */}
          <div>
            <h2 className="text-sm text-gold lowercase mb-2">services</h2>
            <div className="space-y-2">
              <ServiceCard name="stalwart mail" endpoint="/api/auth" />
              <ServiceCard name="vaultwarden" endpoint="/identity/connect/token" />
              <ServiceCard name="simplelogin" endpoint="/api/aliases" />
            </div>
          </div>

          {/* advanced — hidden behind a click; holds connection details for
              external desktop / mobile clients */}
          <AdvancedSection userEmail={userEmail} />

          {/* about */}
          <div>
            <h2 className="text-sm text-gold lowercase mb-2">about</h2>
            <div className="rounded-lg border border-pkm-500 bg-pkm-800 p-4">
              <p className="text-xs text-text-info lowercase leading-relaxed">
                email is a unified interface for stalwart, vaultwarden, and simplelogin.
                all data stays on your infrastructure.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

// proton forwarding — pulls proton mail into the local inbox via the bridge.
function ProtonForwarding({ authHeader }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [status, setStatus] = useState(null) // server status
  const [msg, setMsg] = useState(null) // { kind, text }
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
    <div className="rounded-lg border border-pkm-500 bg-pkm-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-primary lowercase">proton forwarding</p>
        {status?.lastSync && (
          <span className="text-xs text-text-info lowercase">
            last sync {new Date(status.lastSync).toLocaleString()}
          </span>
        )}
      </div>

      <input
        type="email"
        placeholder="proton email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputClass(false)}
      />
      <input
        type="password"
        placeholder="password or app-specific password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputClass(false)}
      />

      <label className="flex cursor-pointer items-center gap-2 text-xs text-text-info lowercase">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        enable forwarding
      </label>

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving} className={goldBtn}>
          {saving ? "saving..." : "save"}
        </button>
        <button onClick={sync} disabled={syncing || !status?.configured} className={ghostBtn}>
          {syncing ? "syncing..." : "sync now"}
        </button>
      </div>

      {msg && (
        <p className={`text-xs lowercase ${msg.kind === "err" ? "text-danger" : "text-gold"}`}>{msg.text}</p>
      )}

      <p className="text-xs text-text-info lowercase leading-relaxed">
        pulls proton mail into your inbox. to also send outgoing mail as your
        proton alias, stalwart's smtp sender / identity must be configured for
        that address — forwarding here only covers inbound mail.
      </p>
    </div>
  )
}

// advanced section — connection details for external desktop / mobile clients.
// collapsed by default so the settings screen stays calm and uncluttered.
function AdvancedSection({ userEmail }) {
  const [open, setOpen] = useState(false)
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
    <div>
      <button onClick={() => setOpen((v) => !v)} className="mb-2 flex items-center gap-2 text-sm text-gold lowercase">
        <span>{open ? "▾" : "▸"}</span> advanced
      </button>
      {open && (
        <div className="space-y-3">
          <div className="rounded-lg border border-pkm-500 bg-pkm-800 p-4 space-y-3">
            <p className="text-xs text-text-info lowercase">calendar &amp; contacts (caldav / carddav)</p>
            <CopyRow label="caldav url" value={caldav} />
            <CopyRow label="carddav url" value={carddav} />
          </div>
          <div className="rounded-lg border border-pkm-500 bg-pkm-800 p-4 space-y-3">
            <p className="text-xs text-text-info lowercase">desktop mail clients (jmap / imap / smtp)</p>
            <CopyRow label="full config" value={mailConfig} multiline />
          </div>
        </div>
      )}
    </div>
  )
}

// a label + value with a copy button. shows a brief "copied" confirmation.
function CopyRow({ label, value, multiline }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
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

function ServiceCard({ name, endpoint }) {
  return (
    <div className="rounded-lg border border-pkm-500 bg-pkm-800 p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-gold animate-pulse-gold" />
        <div>
          <p className="text-sm text-text-primary lowercase">{name}</p>
          <p className="text-xs text-text-info lowercase">{endpoint}</p>
        </div>
      </div>
    </div>
  )
}
