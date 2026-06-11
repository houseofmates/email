import { useState, useEffect, useCallback } from "react"
import Layout from "./layout"
import { SkeletonList } from "./components/Skeleton"
import { listContacts, listAddressBooks, saveContact, deleteContact } from "./jmap"
import { toCard, fromCard } from "./services/jscontact"

const inputClass = (err) =>
  `w-full rounded-lg border bg-pkm-700 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:ring-1 lowercase ${
    err ? "border-danger focus:border-danger focus:ring-danger" : "border-pkm-500 focus:border-gold focus:ring-gold"
  }`

const emptyForm = () => ({ name: "", emails: "", phones: "", org: "", note: "", addressBookId: "" })

export default function Contacts({ authHeader, onNavigate, onLogout, userEmail }) {
  const [contacts, setContacts] = useState([])
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState("")
  const [form, setForm] = useState(null)       // null | flat-with-csv form
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [cards, abs] = await Promise.all([
        listContacts(authHeader),
        listAddressBooks(authHeader).catch(() => []),
      ])
      setContacts(cards.map(fromCard).filter(Boolean))
      setBooks(abs)
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

  function startAdd() { setEditingId(null); setForm({ ...emptyForm(), addressBookId: books[0]?.id || "" }) }
  function startEdit(c) {
    setEditingId(c.id)
    setForm({ name: c.name, emails: c.emails.join(", "), phones: c.phones.join(", "), org: c.org, note: c.note, addressBookId: c.addressBookId || books[0]?.id || "" })
  }
  const change = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function save(e) {
    e.preventDefault()
    if (!form.name.trim() && !form.emails.trim()) { setError("a name or email is required"); return }
    setSaving(true); setError(null)
    try {
      const flat = {
        name: form.name.trim(),
        emails: form.emails.split(",").map((s) => s.trim()).filter(Boolean),
        phones: form.phones.split(",").map((s) => s.trim()).filter(Boolean),
        org: form.org.trim(), note: form.note.trim(),
      }
      const card = toCard(flat, { addressBookId: form.addressBookId })
      const saved = await saveContact(authHeader, card, editingId)
      const flatSaved = fromCard({ id: saved.id || editingId, ...card })
      setContacts((prev) => editingId ? prev.map((c) => c.id === editingId ? flatSaved : c) : [...prev, flatSaved])
      setForm(null); setEditingId(null)
    } catch (err) { setError(String(err.message || err)) }
    finally { setSaving(false) }
  }

  async function remove(id) {
    try { await deleteContact(authHeader, id); setContacts((prev) => prev.filter((c) => c.id !== id)); setConfirmDelete(null) }
    catch (err) { setError(String(err.message || err)) }
  }

  const filtered = contacts.filter((c) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return [c.name, c.org, ...c.emails].join(" ").toLowerCase().includes(q)
  })

  return (
    <Layout currentPage="contacts" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex items-center justify-between border-b border-pkm-500 px-4 py-3">
          <h1 className="text-lg text-gold lowercase tracking-wide">contacts{contacts.length > 0 && <span className="ml-2 text-xs font-normal text-text-info">({contacts.length})</span>}</h1>
          <button onClick={startAdd} className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] lowercase">+ add</button>
        </div>
        <div className="border-b border-pkm-500 px-4 py-2">
          <input type="text" placeholder="search contacts..." value={query} onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-sky focus:ring-1 focus:ring-sky lowercase" />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? <SkeletonList /> : error && !form ? (
            <div className="p-4"><p className="text-sm text-danger lowercase">{error}</p>
              <button onClick={load} className="mt-3 rounded-md border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase">retry</button></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center"><p className="text-sm text-text-info lowercase">{query ? "no matches" : "no contacts yet"}</p></div>
          ) : (
            <div className="divide-y divide-pkm-500">
              {filtered.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-2 px-4 py-3 transition hover:bg-pkm-700/50">
                  <button onClick={() => startEdit(c)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm text-text-primary lowercase">{c.name || c.emails[0] || "untitled"}</p>
                    {c.emails[0] && <p className="truncate text-xs text-text-info lowercase">{c.emails[0]}</p>}
                    {(c.org || c.phones[0]) && <p className="truncate text-xs text-text-info lowercase">{[c.org, c.phones[0]].filter(Boolean).join(" · ")}</p>}
                  </button>
                  <div className="flex shrink-0 gap-1">
                    {c.emails[0] && <button onClick={() => navigator.clipboard?.writeText(c.emails[0])} className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase">copy</button>}
                    <button onClick={() => setConfirmDelete(c.id)} className="rounded-md border border-danger-border px-2 py-1 text-xs text-danger transition hover:bg-danger-dim lowercase">delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-pkm-900/80 p-4 pt-12" onClick={() => setForm(null)}>
          <div className="w-full max-w-md rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in my-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-base text-gold lowercase tracking-wide">{editingId ? "edit contact" : "new contact"}</h2>
            <form onSubmit={save} className="flex flex-col gap-3">
              <Field label="name"><input value={form.name} onChange={(e) => change("name", e.target.value)} className={inputClass(false)} /></Field>
              <Field label="emails (comma-separated)"><input value={form.emails} onChange={(e) => change("emails", e.target.value)} className={inputClass(false)} /></Field>
              <Field label="phones (comma-separated)"><input value={form.phones} onChange={(e) => change("phones", e.target.value)} className={inputClass(false)} /></Field>
              <Field label="organization"><input value={form.org} onChange={(e) => change("org", e.target.value)} className={inputClass(false)} /></Field>
              <Field label="note"><textarea value={form.note} onChange={(e) => change("note", e.target.value)} rows={2} className={`resize-none ${inputClass(false)}`} /></Field>
              {books.length > 1 && (
                <Field label="address book">
                  <select value={form.addressBookId} onChange={(e) => change("addressBookId", e.target.value)} className={inputClass(false)}>
                    {books.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </Field>
              )}
              {error && <p className="text-xs text-danger lowercase">{error}</p>}
              <div className="flex items-center justify-end gap-3">
                <button type="button" onClick={() => { setForm(null); setError(null) }} className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-text-info transition hover:text-text-primary lowercase">cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 lowercase">{saving ? "saving…" : "save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pkm-900/80 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-base text-gold lowercase tracking-wide">delete contact</h3>
            <p className="mb-5 text-sm text-text-info lowercase">delete this contact?</p>
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

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-text-primary lowercase">{label}</label>
      {children}
    </div>
  )
}
