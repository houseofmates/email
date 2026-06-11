import { useEffect, useState, useRef } from "react"
import { listInbox, getEmail, emailText, sendEmail, setKeyword, searchEmails, listIdentities } from "./jmap"
import { parseSearchQuery } from "./services/search"
import { useSettings } from "./services/settings"
import { getTemplates, saveTemplate } from "./services/templates"
import { useHistory } from "./hooks/useHistory"
import { ToastProvider, useToast } from "./components/Toast"
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

function Compose({ authHeader, userEmail, initial, onSend, onClose }) {
  const [identities, setIdentities] = useState([])
  const [from, setFrom] = useState(initial?.from || userEmail || "")
  const [to, setTo] = useState(initial?.to || "")
  const [subject, setSubject] = useState(initial?.subject || "")
  const body = useHistory(initial?.body || "")
  const [err, setErr] = useState(null)
  const [templates, setTemplates] = useState(getTemplates)

  function insertTemplate(id) {
    const t = templates.find((x) => x.id === id)
    if (t) body.set((b) => (b ? `${b}\n\n${t.body}` : t.body))
  }
  function saveAsTemplate() {
    const name = (window.prompt("template name") || "").trim()
    if (!name) return
    setTemplates(saveTemplate({ name, body: body.value }))
  }

  // load send-as identities for the "from" selector
  useEffect(() => {
    let cancelled = false
    listIdentities(authHeader)
      .then((list) => {
        if (cancelled) return
        setIdentities(list)
        if (!initial?.from && list[0]?.email) setFrom(list[0].email)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [authHeader, initial?.from])

  function submit(e) {
    e.preventDefault()
    if (!to.trim()) { setErr("recipient required"); return }
    onSend({ from, to, subject, text: body.value })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-pkm-900/70 p-4" onClick={onClose}>
      <div className="flex w-full max-w-[560px] flex-col gap-3 rounded-xl border border-pkm-500 bg-pkm-800 p-5 animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base text-gold lowercase tracking-wide">new message</h2>
          <button onClick={onClose} className="rounded-md border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase active:scale-[0.98]">
            close
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          {identities.length > 1 && (
            <select value={from} onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary outline-none transition focus:border-sky lowercase">
              {identities.map((i) => <option key={i.id} value={i.email}>from: {i.name ? `${i.name} <${i.email}>` : i.email}</option>)}
            </select>
          )}
          <input type="text" inputMode="email" placeholder="to" value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-sky lowercase" />
          <input type="text" placeholder="subject" value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-sky lowercase" />
          <textarea placeholder="message" rows={8} value={body.value}
            onChange={(e) => body.set(e.target.value)} onKeyDown={body.onKeyDown} title="⌘/ctrl+z undo · ⇧+⌘/ctrl+z redo"
            className="resize-y rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-sky" />
          <div className="flex flex-wrap items-center gap-2">
            <select value="" onChange={(e) => { insertTemplate(e.target.value); e.target.value = "" }}
              className="rounded-md border border-pkm-500 bg-pkm-700 px-2 py-1.5 text-xs text-text-info outline-none focus:border-sky lowercase">
              <option value="">insert template…</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button type="button" onClick={saveAsTemplate} disabled={!body.trim()} className="rounded-md border border-pkm-500 px-2 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky disabled:opacity-50 lowercase">save as template</button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-danger lowercase">{err || ""}</span>
            <button type="submit"
              className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 lowercase">
              send
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Inbox(props) {
  return (
    <ToastProvider>
      <InboxInner {...props} />
    </ToastProvider>
  )
}

function InboxInner({ authHeader, userEmail, onLogout, onNavigate }) {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [active, setActive] = useState(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [draft, setDraft] = useState(null) // restored on undo, or signature on fresh compose
  const [query, setQuery] = useState("")
  const [results, setResults] = useState(null) // null = showing inbox; array = search results
  const [searching, setSearching] = useState(false)
  const [settings] = useSettings()
  const toast = useToast()
  const sendTimer = useRef(null)

  function openCompose() {
    const sig = settings.signature ? `\n\n--\n${settings.signature}` : ""
    setDraft(sig ? { body: sig } : null)
    setComposeOpen(true)
  }

  async function doSend(payload) {
    try {
      await sendEmail(authHeader, payload)
      toast.show({ message: "sent", kind: "ok" })
      refresh()
    } catch (err) {
      toast.show({ message: `send failed: ${String(err.message || err)}`, kind: "err", duration: 8000 })
      setDraft({ to: payload.to, subject: payload.subject, body: payload.text, from: payload.from })
      setComposeOpen(true)
    }
  }

  // undo-send: hold the message for the configured window before sending
  function scheduleSend(payload) {
    const secs = settings.undoSendSeconds || 0
    if (!secs) { doSend(payload); return }
    sendTimer.current = setTimeout(() => { sendTimer.current = null; doSend(payload) }, secs * 1000)
    toast.show({
      message: "sending…", actionLabel: "undo", duration: secs * 1000,
      onAction: () => {
        if (sendTimer.current) { clearTimeout(sendTimer.current); sendTimer.current = null }
        setDraft({ to: payload.to, subject: payload.subject, body: payload.text, from: payload.from })
        setComposeOpen(true)
        toast.show({ message: "send cancelled", kind: "info" })
      },
    })
  }

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

  // patch a message's keywords in the list(s) + the open message
  function patchKeyword(id, keyword, value) {
    const fn = (arr) => arr.map((m) => m.id === id ? { ...m, keywords: { ...m.keywords, [keyword]: value || undefined } } : m)
    setEmails(fn)
    setResults((r) => (r ? fn(r) : r))
    setActive((a) => (a && a.id === id ? { ...a, keywords: { ...a.keywords, [keyword]: value || undefined } } : a))
  }
  async function toggleFlag(id, value) {
    patchKeyword(id, "$flagged", value)
    try { await setKeyword(authHeader, id, "$flagged", value) } catch { /* best effort */ }
  }
  async function markUnread(id) {
    patchKeyword(id, "$seen", false)
    try { await setKeyword(authHeader, id, "$seen", false) } catch { /* best effort */ }
  }

  return (
    <Layout currentPage="inbox" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      {/* mobile header */}
      <div className="flex items-center justify-between border-b border-pkm-500 px-4 py-3 md:hidden">
        <h1 className="text-lg text-gold lowercase tracking-wide">inbox</h1>
        <div className="flex items-center gap-2">
          <button onClick={openCompose}
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
              <button onClick={openCompose}
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
                <button onClick={openCompose} className="mt-3 text-xs text-sky underline lowercase">
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
                      <span className="shrink-0 text-xs text-text-info lowercase">{m.keywords?.$flagged && <span className="text-gold">★ </span>}{fmtDate(m.receivedAt)}</span>
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
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg text-text-primary lowercase">{active.subject || "(no subject)"}</h2>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => toggleFlag(active.id, !active.keywords?.$flagged)}
                    className={`rounded-md border px-2 py-1 text-xs transition active:scale-[0.98] lowercase ${active.keywords?.$flagged ? "border-gold text-gold" : "border-pkm-500 text-text-info hover:border-gold hover:text-gold"}`}>
                    {active.keywords?.$flagged ? "★ flagged" : "☆ flag"}
                  </button>
                  <button onClick={() => markUnread(active.id)}
                    className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98] lowercase">
                    mark unread
                  </button>
                </div>
              </div>
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

      {composeOpen && <Compose authHeader={authHeader} userEmail={userEmail} initial={draft} onSend={scheduleSend} onClose={() => setComposeOpen(false)} />}
    </Layout>
  )
}