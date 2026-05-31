import { useEffect, useState } from "react"
import { listInbox, getEmail, emailText, sendEmail } from "./jmap"

const APPS = [
  { key: "aliases", label: "aliases" },
  { key: "identities", label: "identities" },
  { key: "passwords", label: "passwords" },
  { key: "calendar", label: "calendar" },
  { key: "contacts", label: "contacts" },
  { key: "drive", label: "drive" },
]

function fromName(email) {
  const f = email?.from?.[0]
  return f?.name || f?.email || "unknown"
}

function fmtDate(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function Compose({ authHeader, userEmail, onClose }) {
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [status, setStatus] = useState(null) // {kind, msg}
  const [sending, setSending] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!to.trim()) {
      setStatus({ kind: "err", msg: "recipient required" })
      return
    }
    setSending(true)
    setStatus(null)
    try {
      await sendEmail(authHeader, { from: userEmail, to, subject, text: body })
      setStatus({ kind: "ok", msg: "sent" })
      setTimeout(onClose, 800)
    } catch (err) {
      setStatus({ kind: "err", msg: String(err.message || err) })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-pkm-900/70 p-4">
      <div className="flex w-full max-w-[560px] flex-col gap-3 rounded-xl border border-pkm-500 bg-pkm-800 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base text-text-accent lowercase tracking-wide">new message</h2>
          <button
            onClick={onClose}
            className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase"
          >
            close
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="text"
            inputMode="email"
            placeholder="to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-sky lowercase"
          />
          <input
            type="text"
            placeholder="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-sky lowercase"
          />
          <textarea
            placeholder="message"
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="resize-y rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-sky"
          />
          <div className="flex items-center justify-between gap-3">
            <span
              className={`text-xs lowercase ${
                status?.kind === "err" ? "text-danger" : "text-gold"
              }`}
            >
              {status?.msg || ""}
            </span>
            <button
              type="submit"
              disabled={sending}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 lowercase"
            >
              {sending ? "sending..." : "send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Dashboard({ onLogout, onNavigate, authHeader, userEmail }) {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [active, setActive] = useState(null)
  const [navOpen, setNavOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      setEmails(await listInbox(authHeader))
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function open(id) {
    setSelectedId(id)
    setActive(null)
    try {
      setActive(await getEmail(authHeader, id))
    } catch {
      setActive(null)
    }
  }

  function go(key) {
    setNavOpen(false)
    onNavigate?.(key)
  }

  const Sidebar = (
    <nav className="flex flex-col gap-1">
      <button
        onClick={() => {
          setNavOpen(false)
          setComposeOpen(true)
        }}
        className="mb-3 w-full rounded-lg bg-sky px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] lowercase"
      >
        compose
      </button>
      <span className="rounded-md bg-pkm-600 px-3 py-2 text-sm text-text-primary lowercase">inbox</span>
      <button
        onClick={refresh}
        className="rounded-md px-3 py-2 text-left text-sm text-text-info transition hover:text-text-primary lowercase"
      >
        refresh
      </button>
      <div className="my-2 border-t border-pkm-500" />
      {APPS.map((a) => (
        <button
          key={a.key}
          onClick={() => go(a.key)}
          className="rounded-md px-3 py-2 text-left text-sm text-text-info transition hover:text-text-primary lowercase"
        >
          {a.label}
        </button>
      ))}
    </nav>
  )

  return (
    <div className="flex min-h-[100dvh] flex-col bg-pkm-900">
      {/* header */}
      <header className="flex items-center justify-between gap-3 border-b border-pkm-500 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNavOpen((v) => !v)}
            aria-label="toggle navigation"
            className="rounded-md border border-pkm-500 p-2 text-text-info transition hover:border-sky hover:text-sky md:hidden"
          >
            <span className="block h-0.5 w-4 bg-current" />
            <span className="mt-1 block h-0.5 w-4 bg-current" />
            <span className="mt-1 block h-0.5 w-4 bg-current" />
          </button>
          <h1 className="text-lg text-gold lowercase tracking-wide">email</h1>
        </div>
        <button
          onClick={onLogout}
          className="rounded-lg border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase sm:px-4"
        >
          sign out
        </button>
      </header>

      {/* body */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* sidebar (desktop) */}
        <aside className="hidden w-60 shrink-0 border-r border-pkm-500 p-4 md:block">
          {Sidebar}
        </aside>

        {/* sidebar (mobile overlay) */}
        {navOpen && (
          <div className="absolute inset-0 z-30 flex md:hidden">
            <div className="w-64 max-w-[80%] border-r border-pkm-500 bg-pkm-800 p-4">
              {Sidebar}
            </div>
            <button
              aria-label="close navigation"
              onClick={() => setNavOpen(false)}
              className="flex-1 bg-pkm-900/60"
            />
          </div>
        )}

        {/* list */}
        <div
          className={`w-full shrink-0 overflow-y-auto border-r border-pkm-500 md:w-80 ${
            selectedId ? "hidden md:block" : "block"
          }`}
        >
          {loading ? (
            <p className="p-4 text-sm text-text-info lowercase">loading inbox...</p>
          ) : error ? (
            <div className="p-4">
              <p className="text-sm text-danger lowercase">could not load mail: {error}</p>
              <button
                onClick={refresh}
                className="mt-3 rounded-md border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase"
              >
                retry
              </button>
            </div>
          ) : emails.length === 0 ? (
            <p className="p-4 text-sm text-text-info lowercase">inbox is empty</p>
          ) : (
            emails.map((m) => {
              const unread = !m.keywords?.$seen
              return (
                <button
                  key={m.id}
                  onClick={() => open(m.id)}
                  className={`w-full border-b border-pkm-500 px-4 py-3 text-left transition hover:bg-pkm-700 ${
                    selectedId === m.id ? "bg-pkm-700" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm lowercase ${unread ? "text-gold" : "text-text-primary"}`}>
                      {fromName(m)}
                    </p>
                    <span className="shrink-0 text-xs text-text-info lowercase">{fmtDate(m.receivedAt)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-text-primary lowercase">{m.subject || "(no subject)"}</p>
                  <p className="mt-0.5 truncate text-xs text-text-info lowercase">{m.preview || ""}</p>
                </button>
              )
            })
          )}
        </div>

        {/* reading pane */}
        <div
          className={`flex-1 overflow-y-auto p-4 sm:p-6 ${
            selectedId ? "block" : "hidden md:block"
          }`}
        >
          {selectedId && (
            <button
              onClick={() => setSelectedId(null)}
              className="mb-4 rounded-md border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase md:hidden"
            >
              back
            </button>
          )}
          {!selectedId ? (
            <p className="text-sm text-text-info lowercase">select a message to read</p>
          ) : !active ? (
            <p className="text-sm text-text-info lowercase">loading message...</p>
          ) : (
            <div>
              <h2 className="text-lg text-text-primary lowercase">{active.subject || "(no subject)"}</h2>
              <p className="mt-2 text-xs text-text-info lowercase">
                from: {active.from?.[0]?.email || ""} · {fmtDate(active.receivedAt)}
              </p>
              <pre className="mt-4 whitespace-pre-wrap break-words font-sans text-sm text-text-primary">
                {emailText(active) || active.preview || ""}
              </pre>
            </div>
          )}
        </div>
      </div>

      {composeOpen && (
        <Compose
          authHeader={authHeader}
          userEmail={userEmail}
          onClose={() => setComposeOpen(false)}
        />
      )}
    </div>
  )
}
