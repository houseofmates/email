import { useEffect, useRef, useState } from "react"
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

          {/* vault import */}
          <div>
            <h2 className="text-sm text-gold lowercase mb-2">vault import</h2>
            <VaultImport authHeader={authHeader} />
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

          {/* vault stats */}
          <VaultStats authHeader={authHeader} />

          {/* advanced — connection details */}
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

// ── vault import section ─────────────────────────────
function VaultImport({ authHeader }) {
  const [tab, setTab] = useState("proton-csv")
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true); setResult(null); setError(null)
    try {
      const text = await file.text()

      if (tab === "bitwarden") {
        const res = await fetch("/api/vault/import-bitwarden", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify(JSON.parse(text)),
        })
        const r = await res.json()
        if (!res.ok) throw new Error(r.error || "import failed")
        setResult(r)
      } else {
        // proton pass csv
        const res = await fetch("/api/vault/import-proton", {
          method: "POST",
          headers: { "Content-Type": "text/plain", Authorization: authHeader },
          body: text,
        })
        const r = await res.json()
        if (!res.ok) throw new Error(r.error || "import failed")
        setResult(r)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
      // reset file input so the same file can be re-imported
      e.target.value = ""
    }
  }

  return (
    <div className="rounded-lg border border-pkm-500 bg-pkm-800 p-4 space-y-3">
      <p className="text-xs text-text-info lowercase leading-relaxed">
        import existing passwords and secrets from another manager. items are added to
        your vault and can be edited, pinned, recategorized, or renamed afterwards.
      </p>

      <div className="flex gap-2">
        <button onClick={() => setTab("proton-csv")}
          className={`rounded-md px-3 py-1.5 text-xs transition lowercase ${tab === "proton-csv" ? "bg-gold text-pkm-900" : "bg-pkm-700 text-text-info hover:text-text-primary"}`}>
          proton pass csv
        </button>
        <button onClick={() => setTab("bitwarden")}
          className={`rounded-md px-3 py-1.5 text-xs transition lowercase ${tab === "bitwarden" ? "bg-gold text-pkm-900" : "bg-pkm-700 text-text-info hover:text-text-primary"}`}>
          bitwarden json
        </button>
      </div>

      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-pkm-500 px-3 py-3 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase">
        <input type="file" accept={tab === "bitwarden" ? ".json" : ".csv"} onChange={handleFile} className="hidden" disabled={importing} />
        {importing ? "importing..." : result ? `imported ${result.imported} items` : `choose ${tab === "bitwarden" ? "bitwarden json" : "proton pass csv"} file`}
      </label>

      {error && <p className="text-xs text-danger lowercase">{error}</p>}

      {result && (
        <div className="text-xs text-gold lowercase">
          <p>{result.imported} of {result.total} items imported</p>
          <p className="mt-1 text-text-info">go to the vault tab to edit, pin, rename, or recategorize them.</p>
        </div>
      )}
    </div>
  )
}

// ── vault stats ──────────────────────────────────────
function VaultStats({ authHeader }) {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/vault/", { headers: { Authorization: authHeader } })
        if (!res.ok) throw new Error("failed to load vault")
        const items = await res.json()
        const counts = {}
        for (const i of items) {
          counts[i.type] = (counts[i.type] || 0) + 1
        }
        setStats({ total: items.length, counts })
      } catch (err) {
        setError(err.message)
      }
    })()
  }, [authHeader])

  if (!stats) return null

  return (
    <div>
      <h2 className="text-sm text-gold lowercase mb-2">vault</h2>
      <div className="rounded-lg border border-pkm-500 bg-pkm-800 p-4">
        <p className="text-sm text-text-primary lowercase">{stats.total} total items</p>
        {Object.entries(stats.counts).map(([type, count]) => (
          <p key={type} className="text-xs text-text-info lowercase mt-1">{type}: {count}</p>
        ))}
      </div>
    </div>
  )
}

// ── proton forwarding ────────────────────────────────
function ProtonForwarding({ authHeader }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [status, setStatus] = useState(null)
  const [msg, setMsg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [twoFactorPending, setTwoFactorPending] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState("")

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
      if (data.twoFactorPending) setTwoFactorPending(true)
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
      setMsg({ kind: "ok", text: `sync done` })
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
      const body = { email: email.trim(), password, enabled }
      if (twoFactorCode) body.twoFactorCode = twoFactorCode
      const res = await fetch("/api/forwarding/proton-login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.twoFactorPending) {
        setTwoFactorPending(true)
        setMsg({ kind: "err", text: data.error || "2FA code required" })
        return
      }
      setMsg({ kind: "ok", text: "saved" })
      setPassword("")
      setTwoFactorCode("")
      setTwoFactorPending(false)
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
        <p className="text-sm text-text-primary lowercase">proton mail sync</p>
        <span className="text-xs text-text-info lowercase">
          pulls all mail from your proton account (including aliases &amp; connected gmail) into admin@houseofmates.space
        </span>
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

      {twoFactorPending && (
        <input
          type="text"
          inputMode="numeric"
          placeholder="2FA authentication code"
          value={twoFactorCode}
          onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className={inputClass(false)}
          autoFocus
        />
      )}

      <label className="flex cursor-pointer items-center gap-2 text-xs text-text-info lowercase">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        enable forwarding
      </label>

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving} className={goldBtn}>
          {saving ? "saving..." : twoFactorPending ? "verify &amp; save" : "save"}
        </button>
        <button onClick={sync} disabled={syncing || !status?.configured} className={ghostBtn}>
          {syncing ? "syncing..." : "sync now"}
        </button>
      </div>

      {msg && (
        <p className={`text-xs lowercase ${msg.kind === "err" ? "text-danger" : "text-gold"}`}>{msg.text}</p>
      )}

      <p className="text-xs text-text-info lowercase leading-relaxed">
        connects to the proton mail bridge on localhost:1143 via IMAP. if 2FA is enabled
        on your account, the server will prompt for a one-time code. all emails sent to
        your proton address — including from aliases and connected gmail accounts — are
        pulled into your admin@houseofmates.space inbox.
      </p>
    </div>
  )
}

// ── advanced section ─────────────────────────────────
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

// ── copy row ─────────────────────────────────────────
function CopyRow({ label, value, multiline }) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

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

// ── service card ─────────────────────────────────────
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