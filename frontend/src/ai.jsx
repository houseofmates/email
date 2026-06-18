import React, { useState, useEffect, useRef } from "react"
import Layout from "./layout"

// ── error boundary ───────────────────────────────────────────
class AIErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 m-4">
          <p className="text-sm text-danger lowercase">something went wrong in this section</p>
          <p className="mt-1 text-xs text-text-info lowercase">{this.state.error.message}</p>
          <button onClick={() => this.setState({ error: null })}
            className="mt-2 rounded-md border border-pkm-500 px-3 py-1 text-xs text-text-info hover:border-sky lowercase">
            retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

function scoreColor(score) {
  if (score >= 80) return "text-emerald"
  if (score >= 60) return "text-gold"
  if (score >= 40) return "text-orange"
  return "text-danger"
}

function scoreBg(score) {
  if (score >= 80) return "bg-emerald/10 border-emerald/30"
  if (score >= 60) return "bg-gold/10 border-gold/30"
  if (score >= 40) return "bg-orange/10 border-orange/30"
  return "bg-danger/10 border-danger/30"
}

// ── tabs ──────────────────────────────────────────────────

function Tab({ active, label, icon, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition lowercase ${
        active
          ? "bg-gold text-pkm-900 font-semibold"
          : "text-text-info hover:text-text-primary hover:bg-pkm-700"
      }`}>
      {icon && <span>{icon}</span>}
      {label}
    </button>
  )
}

// ── inbox summary panel ──────────────────────────────────

function SummaryPanel({ authHeader }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function run() {
    setLoading(true); setError(null); setSummary(null)
    try {
      const res = await fetch("/api/ai/summary", {
        headers: { Authorization: authHeader },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `server error ${res.status}`)
      }
      setSummary(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-sm text-gold lowercase tracking-wide">inbox intelligence</h2>
        <button onClick={run} disabled={loading}
          className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 lowercase">
          {loading ? "summarizing..." : "summarize inbox"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3">
          <p className="text-xs text-danger lowercase">{error}</p>
        </div>
      )}

      {summary && (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-pkm-500 bg-pkm-800 px-4 py-3">
            <p className="text-xs text-text-info uppercase tracking-wider mb-1 lowercase">summary</p>
            <p className="text-sm text-text-primary leading-relaxed lowercase">{summary.summary}</p>
          </div>

          {summary.priority?.length > 0 && (
            <div className="rounded-lg border border-pkm-500 bg-pkm-800 px-4 py-3">
              <p className="text-xs text-text-info uppercase tracking-wider mb-2 lowercase">priority items</p>
              <ul className="flex flex-col gap-1.5">
                {summary.priority.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                    <span className="mt-0.5 shrink-0 text-danger">●</span>
                    <span className="lowercase">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.actionItems?.length > 0 && (
            <div className="rounded-lg border border-pkm-500 bg-pkm-800 px-4 py-3">
              <p className="text-xs text-text-info uppercase tracking-wider mb-2 lowercase">action items</p>
              <ul className="flex flex-col gap-1.5">
                {summary.actionItems.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                    <span className="mt-0.5 shrink-0 text-gold">☐</span>
                    <span className="lowercase">{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!summary && !loading && !error && (
        <p className="text-xs text-text-info lowercase">click "summarize inbox" to analyze your unread emails</p>
      )}
    </div>
  )
}

// ── security report panel ────────────────────────────────

function SecurityPanel({ authHeader }) {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true); setError(null); setReport(null)
    try {
      const res = await fetch("/api/ai/vault-report", {
        headers: { Authorization: authHeader },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `server error ${res.status}`)
      }
      setReport(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-pkm-500 border-t-gold" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3">
        <p className="text-xs text-danger lowercase">{error}</p>
        <button onClick={load} className="mt-2 rounded-md border border-pkm-500 px-3 py-1 text-xs text-text-info hover:border-sky lowercase">retry</button>
      </div>
    )
  }

  if (!report) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm text-gold lowercase tracking-wide">security scorecard</h2>
        <span className="text-xs text-text-info lowercase">generated {new Date(report.generated).toLocaleString()}</span>
      </div>

      {/* overall score */}
      <div className={`rounded-lg border p-4 flex items-center gap-4 ${scoreBg(report.overallScore)}`}>
        <div className="shrink-0">
          <div className={`text-3xl font-bold ${scoreColor(report.overallScore)}`}>
            {clamp(report.overallScore, 0, 100)}
          </div>
          <div className="text-[10px] text-text-info mt-0.5 lowercase">/ 100</div>
        </div>
        <div className="flex-1">
          <div className="h-2 rounded-full bg-pkm-700 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${report.overallScore >= 80 ? "bg-emerald" : report.overallScore >= 60 ? "bg-gold" : report.overallScore >= 40 ? "bg-orange" : "bg-danger"}`}
              style={{ width: `${report.overallScore}%` }} />
          </div>
          <div className="mt-2 flex gap-3 text-xs text-text-info lowercase">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald" /> strong: {report.passwordStats?.strong || 0}</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gold" /> fair: {report.passwordStats?.fair || 0}</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-danger" /> weak: {report.passwordStats?.weak || 0}</span>
          </div>
        </div>
      </div>

      {/* reused passwords */}
      {report.reusedPasswords?.length > 0 && (
        <div className="rounded-lg border border-pkm-500 bg-pkm-800 px-4 py-3">
          <p className="text-xs text-text-info uppercase tracking-wider mb-2 lowercase">
            reused passwords ({report.reusedPasswords.length})
          </p>
          <div className="flex flex-col gap-2">
            {report.reusedPasswords.slice(0, 5).map((r, i) => (
              <div key={i} className="rounded-md bg-pkm-700 px-3 py-2">
                <p className="text-xs text-danger lowercase">used on {r.count} sites</p>
                <p className="text-xs text-text-primary lowercase truncate">{r.sites.join(", ")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* breached passwords */}
      {report.breachedPasswords?.length > 0 && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3">
          <p className="text-xs text-danger uppercase tracking-wider mb-2 lowercase">
            breached passwords ({report.breachedPasswords.length})
          </p>
          {report.breachedPasswords.map((b, i) => (
            <p key={i} className="text-xs text-text-primary lowercase">
              "{b.passwordHint}" — found in {b.count.toLocaleString()} breaches
            </p>
          ))}
        </div>
      )}

      {/* LLM recommendations */}
      {report.recommendations && (
        <div className="rounded-lg border border-sky/30 bg-sky/5 px-4 py-3">
          <p className="text-xs text-sky uppercase tracking-wider mb-1 lowercase">recommendations</p>
          <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap lowercase">{report.recommendations}</p>
        </div>
      )}
    </div>
  )
}

// ── unified assistant chat ───────────────────────────────

function UnifiedChat({ authHeader }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function send(e) {
    e?.preventDefault()
    const q = input.trim()
    if (!q || sending) return
    setInput("")
    setMessages(prev => [...prev, { role: "user", content: q }])
    setSending(true)

    try {
      const res = await fetch("/api/ai/unified", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ query: q }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `server error ${res.status}`)
      }
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.answer,
        sources: data.sources,
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `error: ${err.message}`,
        error: true,
      }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm text-gold lowercase tracking-wide">unified ai assistant</h2>
      <p className="text-xs text-text-info lowercase">ask about your email, passwords, aliases — or anything across your accounts</p>

      <div className="flex flex-col gap-3 rounded-lg border border-pkm-500 bg-pkm-800 p-3 max-h-[60vh] overflow-y-auto min-h-[200px]">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-text-info lowercase">try: "what's in my inbox today?" or "do i have any weak passwords?"</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-2.5 ${
              m.role === "user"
                ? "bg-gold text-pkm-900"
                : m.error
                  ? "bg-danger/10 border border-danger/30 text-danger"
                  : "bg-pkm-700 text-text-primary"
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap lowercase">{m.content}</p>
              {m.sources?.length > 0 && (
                <p className="mt-1 text-[10px] text-text-info lowercase">sources: {m.sources.join(", ")}</p>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-pkm-700 px-4 py-2.5">
              <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-text-info animate-bounce" />
                <div className="h-2 w-2 rounded-full bg-text-info animate-bounce" style={{ animationDelay: "0.1s" }} />
                <div className="h-2 w-2 rounded-full bg-text-info animate-bounce" style={{ animationDelay: "0.2s" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex gap-2">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          placeholder="ask anything..."
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              send(e)
            }
          }}
          className="flex-1 rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-gold lowercase" />
        <button type="submit" disabled={sending || !input.trim()}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 lowercase">
          send
        </button>
      </form>
    </div>
  )
}

// ── smart draft panel ────────────────────────────────────

function DraftPanel() {
  const [thread, setThread] = useState("")
  const [tone, setTone] = useState("professional")
  const [instructions, setInstructions] = useState("")
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function generate() {
    if (!thread.trim()) return
    setLoading(true); setError(null); setDraft(null)
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadContext: thread, tone, instructions }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `server error ${res.status}`)
      }
      setDraft(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function copy(text) {
    try { navigator.clipboard?.writeText(text) } catch {}
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm text-gold lowercase tracking-wide">smart draft</h2>

      <div>
        <label className="mb-1 block text-xs text-text-info lowercase">email thread context</label>
        <textarea value={thread} onChange={e => setThread(e.target.value)} rows={6}
          placeholder="paste the email thread you want to reply to..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              generate()
            }
          }}
          className="w-full rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-gold resize-y lowercase" />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-text-info lowercase">tone</label>
          <select value={tone} onChange={e => setTone(e.target.value)}
            className="w-full rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary outline-none lowercase">
            <option value="professional">professional</option>
            <option value="casual">casual</option>
            <option value="friendly">friendly</option>
            <option value="formal">formal</option>
          </select>
        </div>
        <div className="flex-[2]">
          <label className="mb-1 block text-xs text-text-info lowercase">additional instructions (optional)</label>
          <input type="text" value={instructions} onChange={e => setInstructions(e.target.value)}
            placeholder="e.g., mention the meeting tomorrow"
            className="w-full rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none focus:border-gold lowercase" />
        </div>
      </div>

      <button onClick={generate} disabled={loading || !thread.trim()}
        className="self-start rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 lowercase">
        {loading ? "generating..." : "generate draft"}
      </button>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3">
          <p className="text-xs text-danger lowercase">{error}</p>
        </div>
      )}

      {draft && (
        <div className="flex flex-col gap-3 rounded-lg border border-pkm-500 bg-pkm-800 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-info lowercase">subject: {draft.subject}</p>
            <button onClick={() => copy(draft.subject + "\n\n" + draft.body)}
              className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info hover:border-sky lowercase">
              copy
            </button>
          </div>
          <textarea readOnly value={draft.body} rows={8}
            className="w-full rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary outline-none resize-y lowercase" />
        </div>
      )}
    </div>
  )
}

// ── main page ────────────────────────────────────────────

const TABS = [
  { key: "chat", label: "unified assistant", icon: "💬" },
  { key: "summary", label: "inbox summary", icon: "📋" },
  { key: "security", label: "security report", icon: "🔒" },
  { key: "draft", label: "smart draft", icon: "✍️" },
]

export default function AIPage({ authHeader, onNavigate, onLogout, userEmail }) {
  const [tab, setTab] = useState("chat")

  return (
    <Layout currentPage="ai" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      <div className="flex flex-1 flex-col min-h-0">
        {/* header */}
        <div className="flex items-center gap-2 border-b border-pkm-500 px-4 py-3 overflow-x-auto">
          {TABS.map(t => (
            <Tab key={t.key} active={tab === t.key} label={t.label} icon={t.icon} onClick={() => setTab(t.key)} />
          ))}
        </div>

        {/* content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === "chat" && <AIErrorBoundary><UnifiedChat authHeader={authHeader} /></AIErrorBoundary>}
          {tab === "summary" && <AIErrorBoundary><SummaryPanel authHeader={authHeader} /></AIErrorBoundary>}
          {tab === "security" && <AIErrorBoundary><SecurityPanel authHeader={authHeader} /></AIErrorBoundary>}
          {tab === "draft" && <AIErrorBoundary><DraftPanel /></AIErrorBoundary>}
        </div>
      </div>
    </Layout>
  )
}