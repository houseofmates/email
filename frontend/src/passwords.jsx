import { useState, useEffect } from "react"
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

export function generatePassword(len = 20) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_"
  const arr = new Uint32Array(len)
  crypto.getRandomValues(arr)
  let out = ""
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length]
  return out
}

function emptyForm() {
  return { site: "", url: "", username: "", password: "", notes: "" }
}

const inputClass = (err) =>
  `w-full rounded-lg border bg-pkm-700 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:ring-1 lowercase ${
    err ? "border-danger focus:border-danger focus:ring-danger" : "border-pkm-500 focus:border-gold focus:ring-gold"
  }`

function PasswordsItem({ item, revealed, onToggleReveal, onCopy, onEdit, onDelete, onPin, pinned }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative",
    zIndex: isDragging ? 10 : "auto",
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="px-4 py-3 transition hover:bg-pkm-700/50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-primary lowercase truncate">{item.site}</p>
          <p className="text-xs text-text-info lowercase truncate">{item.username}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-xs text-text-info">
              {revealed[item.id] ? item.password : "\u2022".repeat(Math.min(item.password?.length || 0, 16))}
            </span>
            <button onClick={(e) => { e.stopPropagation(); onToggleReveal(item.id) }}
              className="text-xs text-sky underline lowercase">
              {revealed[item.id] ? "hide" : "show"}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onCopy(item.password) }}
              className="text-xs text-sky underline lowercase">
              copy
            </button>
          </div>
          {item.notes && <p className="mt-0.5 text-xs text-text-info lowercase">{item.notes}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <button onClick={(e) => { e.stopPropagation(); onPin(item.id) }}
            className={`rounded-md border px-2 py-1 text-xs transition active:scale-[0.98] lowercase ${
              pinned ? "border-gold text-gold bg-gold/10" : "border-pkm-500 text-text-info hover:border-gold hover:text-gold"
            }`}>
            {pinned ? "pinned" : "pin"}
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

export default function Passwords({ authHeader, onNavigate, onLogout, userEmail }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [revealed, setRevealed] = useState({})
  const [pinned, setPinned] = useState(() => {
    try {
      const saved = localStorage.getItem("email_pinned_passwords")
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })

  useEffect(() => { load() }, [])

  useEffect(() => {
    try { localStorage.setItem("email_pinned_passwords", JSON.stringify(pinned)) }
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

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/aliases", { headers: { Authorization: authHeader } })
      if (!res.ok) throw new Error("failed to load")
      const data = await res.json()
      setItems(data.map((c) => ({
        id: c.id, site: c.site || "", url: c.url || "",
        username: c.username || "", password: c.password || "", notes: c.notes || "",
      })))
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setLoading(false)
    }
  }

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: null }))
  }

  function validate() {
    const errors = {}
    if (!form.site.trim()) errors.site = "site is required"
    if (!form.username.trim()) errors.username = "username is required"
    if (!editing || form.password) {
      if (!form.password) errors.password = "password is required"
      else if (form.password.length < 4) errors.password = "min 4 characters"
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setError(null)
    try {
      const body = {
        site: form.site.trim(), url: form.url.trim() || null,
        username: form.username.trim(), password: form.password || editing.password,
        notes: form.notes.trim() || null,
      }
      const ep = editing ? `/api/aliases/${editing.id}` : "/api/aliases"
      const method = editing ? "PUT" : "POST"
      const res = await fetch(ep, {
        method, headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(editing ? "failed to update" : "failed to create")
      const result = editing ? { ...editing, ...body } : { id: Date.now(), ...body }
      if (editing) setItems((prev) => prev.map((c) => c.id === editing.id ? result : c))
      else setItems((prev) => [...prev, result])
      setShowForm(false); setEditing(null); setForm(emptyForm()); setFormErrors({})
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    setDeleting(true); setError(null)
    try {
      const res = await fetch(`/api/aliases/${id}`, { method: "DELETE", headers: { Authorization: authHeader } })
      if (!res.ok) throw new Error("failed to delete")
      setItems((prev) => prev.filter((c) => c.id !== id))
      setPinned((prev) => prev.filter((pid) => pid !== id))
      setConfirmDelete(null)
    } catch (err) { setError(err.message) }
    finally { setDeleting(false) }
  }

  function toggleReveal(id) {
    setRevealed((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function copyPassword(pw) {
    navigator.clipboard?.writeText(pw)
  }

  function togglePin(id) {
    setPinned((prev) => prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id])
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

  const sortedItems = [...items].sort((a, b) => {
    const aPinned = pinned.includes(a.id) ? 0 : 1
    const bPinned = pinned.includes(b.id) ? 0 : 1
    if (aPinned !== bPinned) return aPinned - bPinned
    return (a.site || "").localeCompare(b.site || "")
  })

  const filtered = sortedItems.filter((c) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return c.site.toLowerCase().includes(q) || c.username.toLowerCase().includes(q) || c.url.toLowerCase().includes(q)
  })

  return (
    <Layout currentPage="passwords" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      <div className="flex flex-1 flex-col min-h-0">
        {/* header */}
        <div className="flex items-center justify-between border-b border-pkm-500 px-4 py-3">
          <h1 className="text-lg text-gold lowercase tracking-wide">passwords</h1>
          <button onClick={() => { setEditing(null); setForm(emptyForm()); setFormErrors({}); setShowForm(true) }}
            className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] lowercase">
            add
          </button>
        </div>

        {/* search */}
        <div className="border-b border-pkm-500 px-4 py-2">
          <input type="text" placeholder="search passwords..." value={query}
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
              <p className="text-sm text-text-info lowercase">{query ? "no matches" : "no passwords yet"}</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filtered.map((c) => c.id)} strategy={rectSortingStrategy}>
                <div className="divide-y divide-pkm-500">
                  {filtered.map((c) => (
                    <PasswordsItem key={c.id} item={c} revealed={revealed} pinned={pinned.includes(c.id)}
                      onToggleReveal={toggleReveal} onCopy={copyPassword} onPin={togglePin}
                      onEdit={(item) => { setEditing(item); setForm({ site: item.site, url: item.url, username: item.username, password: "", notes: item.notes }); setFormErrors({}); setShowForm(true) }}
                      onDelete={(id) => setConfirmDelete(id)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* add/edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pkm-900/80 p-4">
          <div className="w-full max-w-md rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in">
            <h2 className="mb-4 text-base text-gold lowercase tracking-wide">
              {editing ? "edit password" : "add password"}
            </h2>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-text-primary lowercase">site</label>
                <input type="text" value={form.site} onChange={(e) => handleChange("site", e.target.value)} className={inputClass(formErrors.site)} required />
                {formErrors.site && <p className="mt-1 text-xs text-danger lowercase">{formErrors.site}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-text-primary lowercase">url</label>
                <input type="text" value={form.url} onChange={(e) => handleChange("url", e.target.value)} className={inputClass(false)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-text-primary lowercase">username</label>
                <input type="text" value={form.username} onChange={(e) => handleChange("username", e.target.value)} className={inputClass(formErrors.username)} required />
                {formErrors.username && <p className="mt-1 text-xs text-danger lowercase">{formErrors.username}</p>}
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-semibold text-text-primary lowercase">password</label>
                  <button type="button" onClick={() => handleChange("password", generatePassword())}
                    className="text-xs text-sky underline lowercase">generate</button>
                </div>
                <input type="text" value={form.password} onChange={(e) => handleChange("password", e.target.value)}
                  placeholder={editing ? "leave blank to keep" : "password"}
                  className={`font-mono ${inputClass(formErrors.password)}`} required={!editing} />
                {formErrors.password && <p className="mt-1 text-xs text-danger lowercase">{formErrors.password}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-text-primary lowercase">notes</label>
                <textarea value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} rows={3}
                  className="w-full resize-none rounded-lg border border-pkm-500 bg-pkm-700 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-gold focus:ring-1 focus:ring-gold lowercase" />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); setFormErrors({}) }}
                  className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-text-info transition hover:text-text-primary lowercase"
                  disabled={saving}>cancel</button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 lowercase">
                  {saving ? "saving..." : editing ? "save changes" : "save password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* delete confirm */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pkm-900/80 p-4">
          <div className="w-full max-w-sm rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in">
            <h3 className="mb-2 text-base text-gold lowercase tracking-wide">delete password</h3>
            <p className="mb-5 text-sm text-text-info lowercase">
              are you sure you want to delete <span className="text-text-primary">{items.find((c) => c.id === confirmDelete)?.site}</span>?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-text-info transition hover:text-text-primary lowercase"
                disabled={deleting}>cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 lowercase">
                {deleting ? "deleting..." : "delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}