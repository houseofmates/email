import { useState, useEffect, useCallback } from "react"
import Layout from "./layout"
import { SkeletonList } from "./components/Skeleton"
import { simplelogin as sl } from "./services/simplelogin"

const inputClass = (err) =>
  `w-full rounded-lg border bg-pkm-700 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:ring-1 lowercase ${
    err ? "border-danger focus:border-danger focus:ring-danger" : "border-pkm-500 focus:border-gold focus:ring-gold"
  }`

// ── entry point: pick the ui based on the active backend ─────────────────────
export default function Aliases(props) {
  const [provider, setProvider] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetch("/api/aliases/config", { headers: { Authorization: props.authHeader }, credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setProvider(d.provider || "stalwart") })
      .catch(() => { if (!cancelled) setProvider("stalwart") })
    return () => { cancelled = true }
  }, [props.authHeader])

  if (provider === null) {
    return (
      <Layout currentPage="aliases" {...props}>
        <div className="border-b border-pkm-500 px-4 py-3"><h1 className="text-lg text-gold lowercase tracking-wide">aliases</h1></div>
        <SkeletonList />
      </Layout>
    )
  }
  return provider === "simplelogin" ? <SimpleLoginAliases {...props} /> : <BasicAliases {...props} />
}

// ─────────────────────────────────────────────────────────────────────────────
// full simplelogin ui
// ─────────────────────────────────────────────────────────────────────────────
const VIEWS = [{ k: "aliases", l: "aliases" }, { k: "mailboxes", l: "mailboxes" }, { k: "domains", l: "domains" }]

function SimpleLoginAliases({ authHeader, onNavigate, onLogout, userEmail }) {
  const [view, setView] = useState("aliases")
  const [aliases, setAliases] = useState([])
  const [mailboxes, setMailboxes] = useState([])
  const [domains, setDomains] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState(null) // alias id whose contacts/activity is open
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [a, m, d] = await Promise.all([
        sl.list(authHeader).catch(() => ({})),
        sl.mailboxes(authHeader).catch(() => ({})),
        sl.domains(authHeader).catch(() => ({})),
      ])
      setAliases(a.aliases || a || [])
      setMailboxes(m.mailboxes || m || [])
      setDomains(d.custom_domains || d || [])
    } catch (err) { setError(String(err.message || err)) }
    finally { setLoading(false) }
  }, [authHeader])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const onRefresh = () => load()
    window.addEventListener("shortcut:refresh", onRefresh)
    return () => window.removeEventListener("shortcut:refresh", onRefresh)
  }, [load])

  async function act(fn, optimistic) {
    if (optimistic) optimistic()
    try { await fn() } catch (err) { setError(String(err.message || err)); load() }
  }

  async function toggle(a) {
    await act(() => sl.toggle(authHeader, a.id),
      () => setAliases((prev) => prev.map((x) => x.id === a.id ? { ...x, enabled: !x.enabled } : x)))
  }
  async function updateAlias(a, patch) {
    await act(() => sl.update(authHeader, a.id, patch),
      () => setAliases((prev) => prev.map((x) => x.id === a.id ? { ...x, ...patch } : x)))
  }
  async function removeAlias(id) {
    await act(() => sl.remove(authHeader, id), () => setAliases((prev) => prev.filter((x) => x.id !== id)))
  }

  const filtered = aliases.filter((a) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (a.email || "").toLowerCase().includes(q) || (a.note || "").toLowerCase().includes(q)
  })

  return (
    <Layout currentPage="aliases" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex items-center justify-between border-b border-pkm-500 px-4 py-3">
          <h1 className="text-lg text-gold lowercase tracking-wide">aliases</h1>
          {view === "aliases" && (
            <button onClick={() => setShowCreate(true)} className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] lowercase">+ new alias</button>
          )}
        </div>

        {/* sub-nav */}
        <div className="flex gap-1 overflow-x-auto border-b border-pkm-500 px-4 py-2">
          {VIEWS.map((v) => (
            <button key={v.k} onClick={() => setView(v.k)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition lowercase ${view === v.k ? "bg-gold text-pkm-900" : "bg-pkm-700 text-text-info hover:text-text-primary"}`}>{v.l}</button>
          ))}
        </div>

        {view === "aliases" && (
          <div className="border-b border-pkm-500 px-4 py-2">
            <input type="text" placeholder="search aliases..." value={query} onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-sky focus:ring-1 focus:ring-sky lowercase" />
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? <SkeletonList /> : error ? (
            <div className="p-4">
              <p className="text-sm text-danger lowercase">{error}</p>
              <button onClick={load} className="mt-3 rounded-md border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98] lowercase">retry</button>
            </div>
          ) : view === "aliases" ? (
            filtered.length === 0 ? <EmptyState text={query ? "no matches" : "no aliases yet"} />
              : <div className="divide-y divide-pkm-500">
                  {filtered.map((a) => (
                    <AliasRow key={a.id} alias={a} authHeader={authHeader} mailboxes={mailboxes}
                      expanded={expanded === a.id} onExpand={() => setExpanded(expanded === a.id ? null : a.id)}
                      onToggle={() => toggle(a)} onUpdate={(p) => updateAlias(a, p)} onDelete={() => removeAlias(a.id)} />
                  ))}
                </div>
          ) : view === "mailboxes" ? (
            <MailboxManager authHeader={authHeader} mailboxes={mailboxes} reload={load} />
          ) : (
            <DomainManager authHeader={authHeader} domains={domains} mailboxes={mailboxes} reload={load} />
          )}
        </div>
      </div>

      {showCreate && (
        <CreateAlias authHeader={authHeader} mailboxes={mailboxes} onClose={() => setShowCreate(false)}
          onCreated={(a) => { setAliases((prev) => [a, ...prev]); setShowCreate(false) }} />
      )}
    </Layout>
  )
}

function EmptyState({ text }) {
  return <div className="flex flex-col items-center justify-center p-8 text-center"><p className="text-sm text-text-info lowercase">{text}</p></div>
}

// a single alias with inline toggle, note, mailbox, counts, and expandable
// contacts + activity.
function AliasRow({ alias, authHeader, mailboxes, expanded, onExpand, onToggle, onUpdate, onDelete }) {
  const [editingNote, setEditingNote] = useState(false)
  const [note, setNote] = useState(alias.note || "")
  const [confirm, setConfirm] = useState(false)
  const mailboxLabel = alias.mailbox?.email || alias.mailboxes?.[0]?.email || ""

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button onClick={onToggle} role="switch" aria-checked={alias.enabled} aria-label="enabled"
              className={`relative h-5 w-9 shrink-0 rounded-full transition active:scale-[0.98] ${alias.enabled ? "bg-gold" : "bg-pkm-500"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-pkm-900 transition-transform ${alias.enabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
            </button>
            <p className={`truncate text-sm lowercase ${alias.enabled ? "text-text-primary" : "text-text-info line-through"}`}>{alias.email}</p>
            {alias.pinned && <span className="text-gold" title="pinned">★</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-info lowercase">
            <span>→ {mailboxLabel || "default"}</span>
            <span>{alias.nb_forward ?? 0} fwd · {alias.nb_reply ?? 0} reply · {alias.nb_block ?? 0} blocked</span>
          </div>
          {editingNote ? (
            <div className="mt-2 flex gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="note" className={inputClass(false)} />
              <button onClick={() => { onUpdate({ note }); setEditingNote(false) }} className="shrink-0 rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-pkm-900 lowercase">save</button>
            </div>
          ) : alias.note ? (
            <p className="mt-1 text-xs text-text-info lowercase">{alias.note}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex gap-1">
            <button onClick={() => navigator.clipboard?.writeText(alias.email)} className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase">copy</button>
            <button onClick={onExpand} className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase">{expanded ? "less" : "more"}</button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 rounded-lg border border-pkm-500 bg-pkm-800 p-3">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditingNote((v) => !v)} className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase">{editingNote ? "cancel note" : "edit note"}</button>
            <button onClick={() => onUpdate({ pinned: !alias.pinned })} className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-gold hover:text-gold lowercase">{alias.pinned ? "unpin" : "pin"}</button>
            <select value={alias.mailbox?.id || ""} onChange={(e) => onUpdate({ mailbox_ids: [Number(e.target.value)] })}
              className="rounded-md border border-pkm-500 bg-pkm-700 px-2 py-1 text-xs text-text-primary lowercase">
              <option value="">change mailbox…</option>
              {mailboxes.map((m) => <option key={m.id} value={m.id}>{m.email}</option>)}
            </select>
            <button onClick={() => setConfirm(true)} className="rounded-md border border-danger-border px-2 py-1 text-xs text-danger transition hover:bg-danger-dim lowercase">delete</button>
          </div>
          <AliasContacts aliasId={alias.id} authHeader={authHeader} />
          <AliasActivity aliasId={alias.id} authHeader={authHeader} />
        </div>
      )}

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pkm-900/80 p-4" onClick={() => setConfirm(false)}>
          <div className="w-full max-w-sm rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-base text-gold lowercase tracking-wide">delete alias</h3>
            <p className="mb-5 text-sm text-text-info lowercase">delete <span className="text-text-primary">{alias.email}</span>? mail sent to it will no longer be forwarded.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setConfirm(false)} className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-text-info transition hover:text-text-primary lowercase">cancel</button>
              <button onClick={() => { setConfirm(false); onDelete() }} className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98] lowercase">delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AliasContacts({ aliasId, authHeader }) {
  const [contacts, setContacts] = useState(null)
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    sl.contacts(authHeader, aliasId).then((d) => setContacts(d.contacts || d || [])).catch(() => setContacts([]))
  }, [authHeader, aliasId])
  useEffect(() => { load() }, [load])

  async function add(e) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    try { await sl.addContact(authHeader, aliasId, email.trim()); setEmail(""); load() } finally { setBusy(false) }
  }
  async function remove(cid) { await sl.removeContact(authHeader, cid); load() }

  return (
    <div>
      <h4 className="mb-1 text-[11px] text-text-info uppercase tracking-wider">contacts (reply-from)</h4>
      {contacts === null ? <p className="text-xs text-text-info lowercase">loading…</p>
        : contacts.length === 0 ? <p className="text-xs text-text-info lowercase">none yet</p>
        : <div className="space-y-1">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-text-primary lowercase">{c.contact}</span>
                <button onClick={() => remove(c.id)} className="shrink-0 text-danger underline lowercase">remove</button>
              </div>
            ))}
          </div>}
      <form onSubmit={add} className="mt-2 flex gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="add contact email" className={inputClass(false)} />
        <button type="submit" disabled={busy} className="shrink-0 rounded-lg border border-sky px-3 py-2 text-xs text-sky transition hover:bg-sky-dim disabled:opacity-50 lowercase">add</button>
      </form>
    </div>
  )
}

function AliasActivity({ aliasId, authHeader }) {
  const [acts, setActs] = useState(null)
  useEffect(() => {
    sl.activities(authHeader, aliasId).then((d) => setActs(d.activities || d || [])).catch(() => setActs([]))
  }, [authHeader, aliasId])
  return (
    <div>
      <h4 className="mb-1 text-[11px] text-text-info uppercase tracking-wider">recent activity</h4>
      {acts === null ? <p className="text-xs text-text-info lowercase">loading…</p>
        : acts.length === 0 ? <p className="text-xs text-text-info lowercase">no activity</p>
        : <div className="space-y-1">
            {acts.slice(0, 8).map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-[11px] text-text-info lowercase">
                <span className={a.action === "block" ? "text-danger" : a.action === "reply" ? "text-sky" : "text-gold"}>{a.action}</span>
                <span className="truncate">{a.from || a.to}</span>
                <span className="shrink-0">{a.timestamp ? new Date(a.timestamp * 1000).toLocaleDateString() : ""}</span>
              </div>
            ))}
          </div>}
    </div>
  )
}

// create modal — random or custom alias
function CreateAlias({ authHeader, mailboxes, onClose, onCreated }) {
  const [mode, setMode] = useState("random")
  const [note, setNote] = useState("")
  const [prefix, setPrefix] = useState("")
  const [options, setOptions] = useState(null)
  const [suffix, setSuffix] = useState("")
  const [mailboxId, setMailboxId] = useState(mailboxes[0]?.id || "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    sl.options(authHeader).then((o) => {
      setOptions(o)
      const first = (o.suffixes || [])[0]
      if (first) setSuffix(first.signed_suffix)
    }).catch(() => setOptions({ suffixes: [] }))
  }, [authHeader])

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const created = mode === "random"
        ? await sl.createRandom(authHeader, { note })
        : await sl.createCustom(authHeader, { prefix: prefix.trim(), signedSuffix: suffix, mailboxIds: mailboxId ? [Number(mailboxId)] : undefined, note })
      onCreated(created)
    } catch (err) { setError(String(err.message || err)) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-pkm-900/80 p-4 pt-12" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in my-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-base text-gold lowercase tracking-wide">new alias</h2>
        <div className="mb-4 flex gap-1 rounded-lg bg-pkm-700 p-1">
          {[{ v: "random", l: "random" }, { v: "custom", l: "custom" }].map((m) => (
            <button key={m.v} onClick={() => setMode(m.v)} className={`flex-1 rounded-md px-3 py-1.5 text-xs transition lowercase ${mode === m.v ? "bg-gold text-pkm-900 font-semibold" : "text-text-info"}`}>{m.l}</button>
          ))}
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === "custom" && (
            <>
              <div className="flex items-center gap-2">
                <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="prefix" className={inputClass(false)} />
                <select value={suffix} onChange={(e) => setSuffix(e.target.value)} className="shrink-0 rounded-lg border border-pkm-500 bg-pkm-700 px-2 py-2.5 text-sm text-text-primary lowercase max-w-[55%]">
                  {(options?.suffixes || []).map((s) => <option key={s.signed_suffix} value={s.signed_suffix}>{s.suffix}</option>)}
                </select>
              </div>
              {mailboxes.length > 0 && (
                <select value={mailboxId} onChange={(e) => setMailboxId(e.target.value)} className="rounded-lg border border-pkm-500 bg-pkm-700 px-4 py-2.5 text-sm text-text-primary lowercase">
                  {mailboxes.map((m) => <option key={m.id} value={m.id}>→ {m.email}</option>)}
                </select>
              )}
            </>
          )}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="note (optional)" className={inputClass(false)} />
          {error && <p className="text-xs text-danger lowercase">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-text-info transition hover:text-text-primary lowercase">cancel</button>
            <button type="submit" disabled={busy} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 lowercase">{busy ? "creating…" : "create"}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function MailboxManager({ authHeader, mailboxes, reload }) {
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function add(e) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true); setError(null)
    try { await sl.addMailbox(authHeader, email.trim()); setEmail(""); reload() }
    catch (err) { setError(String(err.message || err)) } finally { setBusy(false) }
  }
  async function setDefault(id) { try { await sl.updateMailbox(authHeader, id, { default: true }); reload() } catch (err) { setError(String(err.message || err)) } }
  async function remove(id) { try { await sl.removeMailbox(authHeader, id); reload() } catch (err) { setError(String(err.message || err)) } }

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-text-info lowercase">mailboxes are the real addresses that receive forwarded mail.</p>
      <form onSubmit={add} className="flex gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="add mailbox email" className={inputClass(false)} />
        <button type="submit" disabled={busy} className="shrink-0 rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-pkm-900 disabled:opacity-50 lowercase">add</button>
      </form>
      {error && <p className="text-xs text-danger lowercase">{error}</p>}
      <div className="divide-y divide-pkm-500 rounded-lg border border-pkm-500">
        {mailboxes.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm text-text-primary lowercase">{m.email}</p>
              <p className="text-[11px] text-text-info lowercase">{m.default ? "default · " : ""}{m.verified === false ? "unverified" : "verified"} · {m.nb_alias ?? 0} aliases</p>
            </div>
            <div className="flex shrink-0 gap-1">
              {!m.default && <button onClick={() => setDefault(m.id)} className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-gold hover:text-gold lowercase">make default</button>}
              {!m.default && <button onClick={() => remove(m.id)} className="rounded-md border border-danger-border px-2 py-1 text-xs text-danger transition hover:bg-danger-dim lowercase">remove</button>}
            </div>
          </div>
        ))}
        {mailboxes.length === 0 && <p className="px-3 py-2 text-xs text-text-info lowercase">no mailboxes</p>}
      </div>
    </div>
  )
}

function DomainManager({ authHeader, domains, reload }) {
  const [error, setError] = useState(null)
  async function patch(id, body) { try { await sl.updateDomain(authHeader, id, body); reload() } catch (err) { setError(String(err.message || err)) } }
  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-text-info lowercase">custom domains let you receive at <span className="text-text-primary">anything@your.domain</span>.</p>
      {error && <p className="text-xs text-danger lowercase">{error}</p>}
      <div className="space-y-2">
        {domains.map((d) => (
          <div key={d.id} className="rounded-lg border border-pkm-500 bg-pkm-800 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm text-text-primary lowercase">{d.domain_name}</p>
              <span className={`text-[11px] lowercase ${d.is_verified ? "text-gold" : "text-danger"}`}>{d.is_verified ? "verified" : "unverified"}</span>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-center justify-between text-xs text-text-info lowercase">
                catch-all (accept any address)
                <input type="checkbox" checked={!!d.catch_all} onChange={(e) => patch(d.id, { catch_all: e.target.checked })} />
              </label>
              <label className="flex items-center justify-between text-xs text-text-info lowercase">
                random prefix on new aliases
                <input type="checkbox" checked={!!d.random_prefix_generation} onChange={(e) => patch(d.id, { random_prefix_generation: e.target.checked })} />
              </label>
            </div>
          </div>
        ))}
        {domains.length === 0 && <p className="text-xs text-text-info lowercase">no custom domains. add one in your simplelogin dashboard, then manage it here.</p>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// basic stalwart-store ui (fallback when simplelogin isn't configured)
// ─────────────────────────────────────────────────────────────────────────────
function BasicAliases({ authHeader, onNavigate, onLogout, userEmail }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState("")
  const [form, setForm] = useState(null) // null | { email, note }
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/aliases", { headers: { Authorization: authHeader } })
      if (!res.ok) throw new Error("failed to load")
      const data = await res.json()
      setItems((data || []).map((a) => ({ id: a.id ?? a.email ?? a.alias, email: a.email || a.alias || "", note: a.note || a.notes || "" })))
    } catch (err) { setError(String(err.message || err)) } finally { setLoading(false) }
  }, [authHeader])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function save(e) {
    e.preventDefault()
    if (!form.email.trim()) return
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/aliases", { method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify({ email: form.email.trim(), note: form.note.trim() || null }) })
      if (!res.ok) throw new Error("failed to create")
      setForm(null); load()
    } catch (err) { setError(String(err.message || err)) } finally { setSaving(false) }
  }
  async function remove(id) {
    try { const res = await fetch(`/api/aliases/${id}`, { method: "DELETE", headers: { Authorization: authHeader } }); if (!res.ok) throw new Error("failed to delete"); setItems((p) => p.filter((x) => x.id !== id)); setConfirmDelete(null) }
    catch (err) { setError(String(err.message || err)) }
  }

  const filtered = items.filter((a) => !query.trim() || a.email.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <Layout currentPage="aliases" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex items-center justify-between border-b border-pkm-500 px-4 py-3">
          <h1 className="text-lg text-gold lowercase tracking-wide">aliases</h1>
          <button onClick={() => setForm({ email: "", note: "" })} className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] lowercase">add</button>
        </div>
        <div className="border-b border-pkm-500 px-4 py-2">
          <p className="text-[11px] text-text-info lowercase">basic mode (stalwart alias store). configure simplelogin for toggles, mailboxes, contacts, domains and activity.</p>
        </div>
        <div className="border-b border-pkm-500 px-4 py-2">
          <input type="text" placeholder="search aliases..." value={query} onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-sky focus:ring-1 focus:ring-sky lowercase" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <SkeletonList /> : error ? (
            <div className="p-4"><p className="text-sm text-danger lowercase">{error}</p><button onClick={load} className="mt-3 rounded-md border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase">retry</button></div>
          ) : filtered.length === 0 ? <EmptyState text={query ? "no matches" : "no aliases yet"} /> : (
            <div className="divide-y divide-pkm-500">
              {filtered.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary lowercase">{a.email}</p>
                    {a.note && <p className="text-xs text-text-info lowercase">{a.note}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => navigator.clipboard?.writeText(a.email)} className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase">copy</button>
                    <button onClick={() => setConfirmDelete(a.id)} className="rounded-md border border-danger-border px-2 py-1 text-xs text-danger transition hover:bg-danger-dim lowercase">delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pkm-900/80 p-4" onClick={() => setForm(null)}>
          <div className="w-full max-w-md rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-base text-gold lowercase tracking-wide">add alias</h2>
            <form onSubmit={save} className="flex flex-col gap-4">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="alias@your.domain" className={inputClass(false)} required />
              <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="note (optional)" className={inputClass(false)} />
              <div className="flex items-center justify-end gap-3">
                <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-text-info transition hover:text-text-primary lowercase">cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 lowercase">{saving ? "saving…" : "create"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pkm-900/80 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-base text-gold lowercase tracking-wide">delete alias</h3>
            <p className="mb-5 text-sm text-text-info lowercase">delete this alias?</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-text-info transition hover:text-text-primary lowercase">cancel</button>
              <button onClick={() => remove(confirmDelete)} className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98] lowercase">delete</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
