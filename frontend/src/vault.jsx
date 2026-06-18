import { useState, useEffect, useCallback } from "react"
import Layout from "./layout"
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

const TYPES = [
  { key: "login",    label: "logins",   icon: "🔑" },
  { key: "note",     label: "notes",    icon: "📝" },
  { key: "card",     label: "cards",    icon: "💳" },
  { key: "identity", label: "identities", icon: "👤" },
  { key: "alias",    label: "aliases",  icon: "📧" },
  { key: "api-key",  label: "api keys", icon: "🔐" },
]
const TYPE_ICONS = Object.fromEntries(TYPES.map(t => [t.key, t.icon]))
const TYPE_FIELDS = {
  login:     [{ k: "site", l: "site" }, { k: "url", l: "url" }, { k: "username", l: "username" }, { k: "password", l: "password", sensitive: true }, { k: "otpAuth", l: "otp auth", multiline: true }, { k: "notes", l: "notes", multiline: true }],
  note:      [{ k: "title", l: "title" }, { k: "body", l: "body", multiline: true }],
  card:      [{ k: "cardholderName", l: "cardholder name" }, { k: "number", l: "card number", sensitive: true }, { k: "expMonth", l: "exp. month" }, { k: "expYear", l: "exp. year" }, { k: "cvv", l: "cvv", sensitive: true }, { k: "pin", l: "pin", sensitive: true }, { k: "notes", l: "notes", multiline: true }],
  identity:  [{ k: "firstName", l: "first name" }, { k: "lastName", l: "last name" }, { k: "email", l: "email" }, { k: "phone", l: "phone" }, { k: "address1", l: "address line 1" }, { k: "address2", l: "address line 2" }, { k: "city", l: "city" }, { k: "state", l: "state" }, { k: "zip", l: "zip/postal" }, { k: "country", l: "country" }, { k: "notes", l: "notes", multiline: true }],
  alias:     [{ k: "email", l: "email" }, { k: "forwardTo", l: "forward to" }, { k: "description", l: "description" }, { k: "notes", l: "notes", multiline: true }],
  "api-key": [{ k: "name", l: "name" }, { k: "apiKey", l: "api key", sensitive: true }, { k: "url", l: "url" }, { k: "notes", l: "notes", multiline: true }],
}
const REQUIRED_FIELDS = { login: ["site","username"], note: ["title"], card: ["cardholderName","number"], identity: ["firstName","lastName"], alias: ["email"], "api-key": ["name","apiKey"] }

function emptyItem(type) {
  const base = { type }
  for (const f of (TYPE_FIELDS[type] || [])) base[f.k] = ""
  return base
}

function inputClass(err) {
  return `w-full rounded-lg border bg-pkm-700 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:ring-1 lowercase ${err ? "border-danger focus:border-danger focus:ring-danger" : "border-pkm-500 focus:border-gold focus:ring-gold"}`
}

function genPassword(len = 24) {
  const c = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_"
  const a = new Uint32Array(len)
  crypto.getRandomValues(a)
  let o = ""
  for (let i = 0; i < len; i++) o += c[a[i] % c.length]
  return o
}

function genApiKey(len = 32) {
  const c = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-"
  const a = new Uint32Array(len)
  crypto.getRandomValues(a)
  let o = ""
  for (let i = 0; i < len; i++) o += c[a[i] % c.length]
  return o
}

function ImportJSON({ onImport, authHeader }) {
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState("bitwarden")

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true); setResult(null); setError(null)
    try {
      const text = await file.text()
      if (tab === "bitwarden") {
        const res = await fetch("/api/vault/import-bitwarden", { method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify(JSON.parse(text)) })
        const r = await res.json()
        if (!res.ok) throw new Error(r.error || "import failed")
        setResult(r)
      } else {
        const res = await fetch("/api/vault/import-proton", { method: "POST", headers: { "Content-Type": "text/plain", Authorization: authHeader }, body: text })
        const r = await res.json()
        if (!res.ok) throw new Error(r.error || "import failed")
        setResult(r)
      }
      onImport?.()
    } catch (err) { setError(err.message) }
    finally { setImporting(false) }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button onClick={() => setTab("bitwarden")} className={`rounded-md px-3 py-1.5 text-xs transition lowercase ${tab === "bitwarden" ? "bg-gold text-pkm-900" : "bg-pkm-700 text-text-info"}`}>bitwarden json</button>
        <button onClick={() => setTab("proton")} className={`rounded-md px-3 py-1.5 text-xs transition lowercase ${tab === "proton" ? "bg-gold text-pkm-900" : "bg-pkm-700 text-text-info"}`}>proton pass csv</button>
      </div>
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-pkm-500 px-3 py-2 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase">
        <input type="file" accept={tab === "bitwarden" ? ".json" : ".csv"} onChange={handleFile} className="hidden" disabled={importing} />
        {importing ? "importing..." : result ? `imported ${result.imported} items` : `upload ${tab === "bitwarden" ? "bitwarden json" : "proton pass csv"}`}
      </label>
      {error && <p className="text-xs text-danger lowercase">{error}</p>}
    </div>
  )
}

function VaultCard({ item, revealed, pinned, onToggleReveal, onCopy, onEdit, onDelete, onPin, onContextMenu }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : "auto",
  }

  const fields = TYPE_FIELDS[item.type] || []
  const first = fields[0]
  const second = fields.find(f => f.k !== first?.k && !f.sensitive)

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="border rounded-lg border-pkm-500 bg-pkm-800 px-4 py-3 transition hover:bg-pkm-700/50 hover:border-gold cursor-pointer"
      onClick={() => { onEdit(item) }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(item, e.clientX, e.clientY) }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="mr-1.5 text-xs">{TYPE_ICONS[item.type] || "📄"}</span>
          <p className="inline text-sm text-text-primary lowercase truncate">{item[first?.k] || "untitled"}</p>
          {second && <p className="text-xs text-text-info lowercase truncate mt-0.5">{item[second.k]}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <button onClick={(e) => { e.stopPropagation(); onPin(item.id) }}
            className={`rounded-md border px-2 py-1 text-xs transition active:scale-[0.98] lowercase ${
              pinned ? "border-gold text-gold bg-gold/10" : "border-pkm-500 text-text-info hover:border-gold hover:text-gold"
            }`}>
            📌
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(item) }}
            className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98] lowercase">
            edit
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
            className="rounded-md border border-danger-border px-2 py-1 text-xs text-danger transition hover:bg-danger-dim active:scale-[0.98] lowercase">
            delete
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Vault({ authHeader, onNavigate, onLogout, userEmail }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState("")
  const [activeType, setActiveType] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [revealed, setRevealed] = useState({})
  const [showImport, setShowImport] = useState(false)
  const [formType, setFormType] = useState("login")
  const [selectedItem, setSelectedItem] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [pinned, setPinned] = useState(() => {
    try {
      const saved = localStorage.getItem("email_pinned_vault")
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })

  useEffect(() => { load() }, [])

  useEffect(() => {
    try { localStorage.setItem("email_pinned_vault", JSON.stringify(pinned)) }
    catch { /* storage fail */ }
  }, [pinned])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // close any open modal/popup on Esc
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        if (showForm) { setShowForm(false); setEditing(null); setForm({}) }
        else if (confirmDelete !== null) { setConfirmDelete(null) }
        else if (contextMenu) { setContextMenu(null) }
        else if (showImport) { setShowImport(false) }
        else if (selectedItem) { setSelectedItem(null) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showForm, confirmDelete, contextMenu, showImport, selectedItem])

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await fetch("/api/vault/", { headers: { Authorization: authHeader } })
      if (!res.ok) throw new Error("failed to load")
      setItems(await res.json())
    } catch (err) { setError(String(err.message || err)) }
    finally { setLoading(false) }
  }

  function togglePin(id) {
    setPinned((prev) => prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id])
  }

  const sortedItems = [...items].sort((a, b) => {
    const aPinned = pinned.includes(a.id) ? 0 : 1
    const bPinned = pinned.includes(b.id) ? 0 : 1
    if (aPinned !== bPinned) return aPinned - bPinned
    return 0
  })

  const filtered = sortedItems.filter(i => {
    if (activeType && i.type !== activeType) return false
    if (!query.trim()) return true
    const q = query.toLowerCase()
    const flat = JSON.stringify(i).toLowerCase()
    return flat.includes(q)
  })

  function startAdd(type) {
    setEditing(null)
    setForm(emptyItem(type))
    setFormErrors({})
    setFormType(type)
    setShowForm(true)
    setSelectedItem(null)
  }

  function startEdit(item) {
    setEditing(item)
    setForm({ ...item })
    setFormErrors({})
    setFormType(item.type)
    setShowForm(true)
    setSelectedItem(null)
  }

  function openItem(item) {
    setSelectedItem(item)
  }

  function handleChange(k, v) {
    setForm(p => ({ ...p, [k]: v }))
    if (formErrors[k]) setFormErrors(p => ({ ...p, [k]: null }))
  }

  function validate() {
    const errors = {}
    const req = REQUIRED_FIELDS[form.type] || []
    for (const f of req) {
      if (!form[f] || !String(form[f]).trim()) errors[f] = `${f} is required`
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true); setError(null)
    try {
      const body = { ...form }
      const ep = editing ? `/api/vault/${editing.id}` : "/api/vault/"
      const method = editing ? "PUT" : "POST"
      const res = await fetch(ep, { method, headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(editing ? "failed to update" : "failed to create")
      const result = await res.json()
      if (editing) setItems(prev => prev.map(i => i.id === editing.id ? result : i))
      else setItems(prev => [...prev, result])
      setShowForm(false); setEditing(null); setForm({})
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    setDeleting(true); setError(null)
    try {
      const res = await fetch(`/api/vault/${id}`, { method: "DELETE", headers: { Authorization: authHeader } })
      if (!res.ok) throw new Error("failed to delete")
      setItems(prev => prev.filter(i => i.id !== id))
      setPinned(prev => prev.filter(pid => pid !== id))
      setConfirmDelete(null)
      setSelectedItem(null)
    } catch (err) { setError(err.message) }
    finally { setDeleting(false) }
  }

  async function handleRecategorize(item, newType) {
    setLoading(true); setError(null)
    try {
      const body = { ...item, type: newType }
      delete body.id
      const res = await fetch(`/api/vault/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error("failed to re-categorize")
      const updated = await res.json()
      setItems(prev => prev.map(i => i.id === item.id ? updated : i))
      setSelectedItem(updated)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  function toggleReveal(id) {
    setRevealed(p => ({ ...p, [id]: !p[id] }))
  }

  function copy(v) {
    try { navigator.clipboard?.writeText(v) } catch {}
  }

  function typeCount(t) {
    return items.filter(i => i.type === t).length
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id)
      const newIndex = prev.findIndex((i) => i.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  return (
    <Layout currentPage="passwords" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      <div className="flex flex-1 flex-col min-h-0">
        {/* header */}
        <div className="flex items-center justify-between border-b border-pkm-500 px-4 py-3">
          <h1 className="text-lg text-gold lowercase tracking-wide">
            vault
            {items.length > 0 && <span className="ml-2 text-xs font-normal text-text-info">({items.length})</span>}
          </h1>
          <div className="flex items-center gap-2">
            <a href="/vault-extension.xpi" download className="rounded-lg border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98] lowercase no-underline">firefox extension</a>
            <button onClick={() => setShowImport(true)} className="rounded-lg border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98] lowercase">import</button>
            <div className="relative">
              <button onClick={() => startAdd(activeType || "login")} disabled={!activeType}
                className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 lowercase">+ add</button>
              {!activeType && <span className="absolute -bottom-4 right-0 text-[10px] text-text-info whitespace-nowrap lowercase">select a type first</span>}
            </div>
          </div>
        </div>

        {/* type filter bar */}
        <div className="flex gap-1 overflow-x-auto border-b border-pkm-500 px-4 py-2">
          <button onClick={() => { setActiveType(null); setShowForm(false); setSelectedItem(null) }}
            className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition lowercase ${!activeType ? "bg-gold text-pkm-900" : "bg-pkm-700 text-text-info hover:text-text-primary"}`}>all</button>
          {TYPES.map(t => (
            <button key={t.key} onClick={() => { setActiveType(t.key); setShowForm(false); setSelectedItem(null) }}
              className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition lowercase ${activeType === t.key ? "bg-gold text-pkm-900" : "bg-pkm-700 text-text-info hover:text-text-primary"}`}>
              {t.icon} {t.label} {typeCount(t.key) > 0 && `(${typeCount(t.key)})`}
            </button>
          ))}
        </div>

        {/* search */}
        <div className="border-b border-pkm-500 px-4 py-2">
          <input type="text" placeholder="search vault..." value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-sky focus:ring-1 focus:ring-sky lowercase" />
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-pkm-500 border-t-gold" />
            </div>
          ) : error ? (
            <div className="p-4">
              <p className="text-sm text-danger lowercase">{error}</p>
              <button onClick={load} className="mt-3 rounded-md border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98] lowercase">retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <p className="text-sm text-text-info lowercase">{query ? "no matches" : activeType ? `no ${activeType}s yet` : "vault is empty"}</p>
              {!query && <p className="mt-1 text-xs text-text-info">add one above, or import from bitwarden/proton pass</p>}
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filtered.map(i => i.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map(item => (
                    <VaultCard key={item.id} item={item} revealed={revealed} pinned={pinned.includes(item.id)}
                      onToggleReveal={toggleReveal} onCopy={copy}
                      onEdit={startEdit} onDelete={(id) => setConfirmDelete(id)} onPin={togglePin}
                      onContextMenu={(item, x, y) => setContextMenu({ item, x, y })} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* context menu */}
        {contextMenu && (
          <div className="fixed inset-0 z-[70]" onContextMenu={(e) => e.preventDefault()} onClick={() => setContextMenu(null)}>
            <div className="absolute rounded-lg border border-pkm-500 bg-pkm-800 p-1.5 shadow-xl"
              style={{ left: Math.min(contextMenu.x, window.innerWidth - 190), top: Math.min(contextMenu.y, window.innerHeight - 220) }}>
              <button onClick={() => { togglePin(contextMenu.item.id); setContextMenu(null) }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text-primary transition hover:bg-pkm-700 lowercase">
                📌 {pinned.includes(contextMenu.item.id) ? "unpin" : "pin"}
              </button>
              <div className="my-1 border-t border-pkm-500" />
              <button onClick={() => { startEdit(contextMenu.item); setContextMenu(null) }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text-primary transition hover:bg-pkm-700 lowercase">✏️ edit</button>
              <div className="my-1 border-t border-pkm-500" />
              <button onClick={() => { openItem(contextMenu.item); setContextMenu(null) }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text-primary transition hover:bg-pkm-700 lowercase">👁 view</button>
              <div className="my-1 border-t border-pkm-500" />
              <div className="px-3 py-1 text-[10px] text-text-info uppercase tracking-wider lowercase">move to</div>
              {TYPES.filter(t => t.key !== contextMenu.item.type).map(t => (
                <button key={t.key} onClick={() => { handleRecategorize(contextMenu.item, t.key); setContextMenu(null) }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text-primary transition hover:bg-pkm-700 lowercase">{t.icon} {t.label}</button>
              ))}
              <div className="my-1 border-t border-pkm-500" />
              <button onClick={() => { setConfirmDelete(contextMenu.item.id); setContextMenu(null) }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-danger transition hover:bg-danger-dim lowercase">🗑 delete</button>
            </div>
          </div>
        )}
        {/* add/edit modal */}
        {showForm && formType && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-pkm-900/80 p-4 pt-12">
            <div className="w-full max-w-lg rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in my-8">
              <h2 className="mb-4 text-base text-gold lowercase tracking-wide">
                {editing ? `edit ${formType}` : `new ${formType}`}
              </h2>
              <form onSubmit={handleSave} className="flex flex-col gap-4">
                {(TYPE_FIELDS[formType] || []).map(f => (
                  <div key={f.k}>
                    <label className="mb-1.5 block text-sm font-semibold text-text-primary lowercase">{f.l}</label>
                    {f.multiline ? (
                      <textarea value={form[f.k] || ""} onChange={(e) => handleChange(f.k, e.target.value)} rows={3}
                        className="w-full resize-none rounded-lg border border-pkm-500 bg-pkm-700 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-gold focus:ring-1 focus:ring-gold lowercase" />
                    ) : f.sensitive ? (
                      <div className="flex gap-2">
                        <input type="text" value={form[f.k] || ""} onChange={(e) => handleChange(f.k, e.target.value)}
                          placeholder={editing ? "leave blank to keep" : f.l}
                          className={`flex-1 ${inputClass(formErrors[f.k])} font-mono`} />
                        <button type="button" onClick={() => handleChange(f.k, formType === "api-key" ? genApiKey() : genPassword())}
                          className="shrink-0 rounded-lg border border-sky px-3 py-2 text-xs text-sky transition hover:bg-sky/10 lowercase">generate</button>
                      </div>
                    ) : (
                      <input type="text" value={form[f.k] || ""} onChange={(e) => handleChange(f.k, e.target.value)}
                        className={inputClass(formErrors[f.k])} />
                    )}
                    {formErrors[f.k] && <p className="mt-1 text-xs text-danger lowercase">{formErrors[f.k]}</p>}
                  </div>
                ))}
                <div className="flex items-center justify-end gap-3 mt-2">
                  <button type="button" onClick={() => { setShowForm(false); setEditing(null); setForm({}) }}
                    className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-text-info transition hover:text-text-primary lowercase" disabled={saving}>cancel</button>
                  <button type="submit" disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 lowercase">
                    {saving ? "saving..." : editing ? "save changes" : "save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* import modal */}
        {showImport && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-pkm-900/80 p-4 pt-12">
            <div className="w-full max-w-md rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in my-8">
              <h2 className="mb-4 text-base text-gold lowercase tracking-wide">import</h2>
              <ImportJSON onImport={() => { load(); setShowImport(false) }} authHeader={authHeader} />
              <div className="mt-4 flex justify-end">
                <button onClick={() => setShowImport(false)}
                  className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-text-info transition hover:text-text-primary lowercase">close</button>
              </div>
            </div>
          </div>
        )}

        {/* delete confirm modal */}
        {confirmDelete !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-pkm-900/80 p-4">
            <div className="w-full max-w-sm rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in">
              <h3 className="mb-2 text-base text-gold lowercase tracking-wide">delete item</h3>
              <p className="mb-5 text-sm text-text-info lowercase">are you sure you want to delete this {items.find(i => i.id === confirmDelete)?.type}?</p>
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setConfirmDelete(null)}
                  className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-text-info transition hover:text-text-primary lowercase" disabled={deleting}>cancel</button>
                <button onClick={() => handleDelete(confirmDelete)} disabled={deleting}
                  className="flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 lowercase">
                  {deleting ? "deleting..." : "delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}