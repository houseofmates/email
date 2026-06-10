import { useEffect, useState } from "react"
import { listInbox, getEmail, emailText, sendEmail, setKeyword, searchEmails } from "./jmap"
import { parseSearchQuery } from "./services/search"
import Layout from "./layout"

function fromName(email) {
  const f = email?.from?.[0]
  return f?.name || f?.email || "unknown"
}

function fmtDate(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  const diff = (now - d) / 1000
  if (diff < 86400) return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function Compose({ authHeader, userEmail, onClose }) {
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [status, setStatus] = useState(null)
  const [sending, setSending] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!to.trim()) { setStatus({ kind: "err", msg: "recipient required" }); return }
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
      <div className="flex w-full max-w-[560px] flex-col gap-3 rounded-xl border border-pkm-500 bg-pkm-800 p-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <h2 className="text-base text-gold lowercase tracking-wide">new message</h2>
          <button onClick={onClose} className="rounded-md border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase active:scale-[0.98]">
            close
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input type="text" inputMode="email" placeholder="to" value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-sky lowercase" />
          <input type="text" placeholder="subject" value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-sky lowercase" />
          <textarea placeholder="message" rows={8} value={body}
            onChange={(e) => setBody(e.target.value)}
            className="resize-y rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-sky" />
          <div className="flex items-center justify-between gap-3">
            <span className={`text-xs lowercase ${status?.kind === "err" ? "text-danger" : "text-gold"}`}>
              {status?.msg || ""}
            </span>
            <button type="submit" disabled={sending}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 lowercase">
              {sending ? "sending..." : "send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Inbox({ authHeader, userEmail, onLogout, onNavigate }) {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [active, setActive] = useState(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState(null) // null = showing inbox; array = search results
  const [searching, setSearching] = useState(false)

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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh() }, [])

  async function runSearch(e) {
    e?.preventDefault()
    const filter = parseSearchQuery(query)
    if (!filter) { setResults(null); return }
    setSearching(true)
    setError(null)
    setSelectedId(null)
    try {
      setResults(await searchEmails(authHeader, filter))
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setSearching(false)
    }
  }

  function clearSearch() { setQuery(""); setResults(null) }

  // what the list shows: search results when searching, else the inbox
  const list = results !== null ? results : emails

  async function open(id) {
    setSelectedId(id)
    setActive(null)
    try { setActive(await getEmail(authHeader, id)) } catch { setActive(null) }
    // mark as read on open and clear the unread styling locally
    const markRead = (arr) => arr.map((m) => m.id === id ? { ...m, keywords: { ...m.keywords, $seen: true } } : m)
    setEmails(markRead)
    setResults((r) => (r ? markRead(r) : r))
    try { await setKeyword(authHeader, id, "$seen", true) } catch { /* best effort */ }
  }

  return (
    <Layout currentPage="inbox" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      {/* mobile header */}
      <div className="flex items-center justify-between border-b border-pkm-500 px-4 py-3 md:hidden">
        <h1 className="text-lg text-gold lowercase tracking-wide">inbox</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setComposeOpen(true)}
            className="rounded-lg border border-sky px-3 py-1.5 text-xs text-sky transition hover:brightness-110 active:scale-[0.98] lowercase">
            compose
          </button>
          <button onClick={refresh}
            className="rounded-lg border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98] lowercase">
            refresh
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* email list */}
        <div className={`w-full shrink-0 overflow-y-auto border-r border-pkm-500 md:w-80 ${selectedId ? "hidden md:block" : "block"}`}>
          {/* desktop sidebar header */}
          <div className="hidden md:flex items-center justify-between border-b border-pkm-500 p-3">
            <h1 className="text-lg text-gold lowercase tracking-wide">inbox</h1>
            <div className="flex items-center gap-2">
              <button onClick={() => setComposeOpen(true)}
                className="rounded-lg bg-sky px-3 py-1.5 text-xs font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] lowercase">
                compose
              </button>
              <button onClick={refresh}
                className="rounded-lg border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98] lowercase">
                refresh
              </button>
            </div>
          </div>

          {/* search — supports from: to: subject: body: has:attachment before: after: */}
          <form onSubmit={runSearch} className="border-b border-pkm-500 p-2">
            <div className="flex items-center gap-2">
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="search mail (from: subject: has:attachment …)"
                className="w-full rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-sky focus:ring-1 focus:ring-sky lowercase" />
              {results !== null && (
                <button type="button" onClick={clearSearch} className="shrink-0 rounded-md border border-pkm-500 px-2 py-2 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase">clear</button>
              )}
            </div>
            {results !== null && <p className="mt-1 px-1 text-[11px] text-text-info lowercase">{results.length} result{results.length === 1 ? "" : "s"}</p>}
          </form>

          {(loading || searching) ? (
            <div className="flex items-center justify-center p-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-pkm-500 border-t-gold" />
            </div>
          ) : error ? (
            <div className="p-4">
              <p className="text-sm text-danger lowercase">{error}</p>
              <button onClick={results !== null ? runSearch : refresh} className="mt-3 rounded-md border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98] lowercase">
                retry
              </button>
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <p className="text-sm text-text-info lowercase">{results !== null ? "no matching mail" : "inbox is empty"}</p>
              {results === null && (
                <button onClick={() => setComposeOpen(true)} className="mt-3 text-xs text-sky underline lowercase">
                  compose a message
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-pkm-500">
              {list.map((m) => {
                const unread = !m.keywords?.$seen
                return (
                  <button key={m.id} onClick={() => open(m.id)}
                    className={`w-full px-4 py-3 text-left transition active:scale-[0.99] ${selectedId === m.id ? "bg-pkm-700" : "hover:bg-pkm-700/50"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-sm lowercase ${unread ? "text-gold font-semibold" : "text-text-primary"}`}>
                        {fromName(m)}
                      </p>
                      <span className="shrink-0 text-xs text-text-info lowercase">{fmtDate(m.receivedAt)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-text-primary lowercase">{m.subject || "(no subject)"}</p>
                    <p className="mt-0.5 truncate text-xs text-text-info lowercase">{m.preview || ""}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* reading pane */}
        <div className={`flex-1 overflow-y-auto p-4 sm:p-6 ${selectedId ? "block" : "hidden md:block"}`}>
          {selectedId && (
            <button onClick={() => setSelectedId(null)}
              className="mb-4 rounded-md border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98] lowercase md:hidden">
              back
            </button>
          )}
          {!selectedId ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-text-info lowercase">select a message to read</p>
            </div>
          ) : !active ? (
            <div className="flex items-center justify-center h-full">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-pkm-500 border-t-gold" />
            </div>
          ) : (
            <div className="animate-fade-in">
              <h2 className="text-lg text-text-primary lowercase">{active.subject || "(no subject)"}</h2>
              <p className="mt-2 text-xs text-text-info lowercase">
                from: {active.from?.[0]?.email || ""} &middot; {fmtDate(active.receivedAt)}
              </p>
              <div className="mt-4 whitespace-pre-wrap break-words font-sans text-sm text-text-primary leading-relaxed">
                {emailText(active) || active.preview || ""}
              </div>
            </div>
          )}
        </div>
      </div>

      {composeOpen && <Compose authHeader={authHeader} userEmail={userEmail} onClose={() => setComposeOpen(false)} />}
    </Layout>
  )
}