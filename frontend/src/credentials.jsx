import { useState, useEffect } from "react"

function emptyForm() {
  return { site: "", url: "", username: "", password: "", notes: "" }
}

function apiToCredential(c) {
  return {
    id: c.id,
    site: c.site || "",
    url: c.url || "",
    username: c.username || "",
    password: c.password || "",
    notes: c.notes || "",
  }
}

export function generatePassword(len = 20) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_"
  const arr = new Uint32Array(len)
  crypto.getRandomValues(arr)
  let out = ""
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length]
  return out
}

function CredentialCard({ credential, onEdit, onDelete }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard?.writeText(credential.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="group flex items-center justify-between rounded-lg border border-pkm-500 bg-pkm-800 p-4 transition hover:border-sky">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm text-text-primary lowercase truncate">{credential.site}</p>
        {credential.url && (
          <p className="text-xs text-text-info lowercase truncate">{credential.url}</p>
        )}
        <p className="text-xs text-text-info lowercase truncate">username: {credential.username}</p>
        <div className="flex items-center gap-2">
          <p className="font-mono text-xs text-text-info">
            {revealed ? credential.password : "•".repeat(Math.min(credential.password.length, 16))}
          </p>
          <button
            onClick={() => setRevealed((v) => !v)}
            className="text-xs text-sky underline lowercase"
          >
            {revealed ? "hide" : "show"}
          </button>
          <button onClick={copy} className="text-xs text-sky underline lowercase">
            {copied ? "copied" : "copy"}
          </button>
        </div>
        {credential.notes && (
          <p className="mt-1 text-xs text-text-info lowercase">{credential.notes}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={onEdit}
          className="rounded-md border border-pkm-500 px-3 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase"
        >
          edit
        </button>
        <button
          onClick={onDelete}
          className="rounded-md border border-danger-border px-3 py-1 text-xs text-danger transition hover:bg-danger-dim lowercase"
        >
          delete
        </button>
      </div>
    </div>
  )
}

export default function Credentials({ onNavigate, onLogout, authHeader }) {
  const [credentials, setCredentials] = useState([])
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

  useEffect(() => {
    fetch("/api/credentials", { headers: { Authorization: authHeader } })
      .then((res) => {
        if (!res.ok) throw new Error("failed to load passwords")
        return res.json()
      })
      .then((data) => {
        setCredentials(data.map(apiToCredential))
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [authHeader])

  function openAdd() {
    setEditing(null)
    setForm(emptyForm())
    setFormErrors({})
    setShowForm(true)
  }

  function openEdit(credential) {
    setEditing(credential)
    setForm({
      site: credential.site,
      url: credential.url,
      username: credential.username,
      password: "",
      notes: credential.notes,
    })
    setFormErrors({})
    setShowForm(true)
  }

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: null }))
    }
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
        site: form.site.trim(),
        url: form.url.trim() || null,
        username: form.username.trim(),
        password: form.password || editing.password,
        notes: form.notes.trim() || null,
      }
      if (editing) {
        const res = await fetch(`/api/credentials/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error("failed to update password")
        const updated = apiToCredential(await res.json())
        setCredentials((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      } else {
        const res = await fetch("/api/credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error("failed to create password")
        const created = apiToCredential(await res.json())
        setCredentials((prev) => [...prev, created])
      }
      setSaving(false)
      setShowForm(false)
      setEditing(null)
      setForm(emptyForm())
      setFormErrors({})
    } catch (err) {
      setSaving(false)
      setError(err.message)
    }
  }

  async function handleDelete(id) {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/credentials/${id}`, {
        method: "DELETE",
        headers: { Authorization: authHeader },
      })
      if (!res.ok) throw new Error("failed to delete password")
      setCredentials((prev) => prev.filter((c) => c.id !== id))
      setDeleting(false)
      setConfirmDelete(null)
    } catch (err) {
      setDeleting(false)
      setError(err.message)
    }
  }

  const inputClass = (err) =>
    `w-full rounded-lg border bg-pkm-700 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:ring-1 lowercase ${
      err
        ? "border-danger focus:border-danger focus:ring-danger"
        : "border-pkm-500 focus:border-gold focus:ring-gold"
    }`

  const filtered = credentials.filter((c) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      c.site.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q) ||
      c.url.toLowerCase().includes(q)
    )
  })

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-pkm-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-pkm-500 border-t-gold" />
          <p className="text-sm text-text-info lowercase">loading passwords...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-pkm-900">
      <header className="flex items-center justify-between border-b border-pkm-500 px-6 py-3">
        <h1 className="text-lg text-gold lowercase tracking-wide">passwords</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={openAdd}
            className="rounded-lg border border-gold px-3 py-1.5 text-xs text-gold transition hover:brightness-110 lowercase md:hidden"
          >
            add
          </button>
          <button
            onClick={() => onNavigate("dashboard")}
            className="rounded-lg border border-pkm-500 px-4 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase"
          >
            inbox
          </button>
          <button
            onClick={onLogout}
            className="rounded-lg border border-pkm-500 px-4 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase"
          >
            sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-pkm-500 p-4 md:block">
          <button
            onClick={openAdd}
            className="mb-4 w-full rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] lowercase"
          >
            add password
          </button>
          <input
            type="text"
            placeholder="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-4 w-full rounded-lg border border-pkm-500 bg-pkm-700 px-4 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-sky focus:ring-1 focus:ring-sky lowercase"
          />
          <nav className="flex flex-col gap-1">
            <span className="rounded-md bg-pkm-600 px-3 py-2 text-sm text-text-primary lowercase">
              all passwords
            </span>
          </nav>
        </aside>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-lg border border-danger-border bg-danger-dim px-4 py-3 text-sm text-danger lowercase">
              {error}
              <button onClick={() => setError(null)} className="ml-2 text-danger underline">
                dismiss
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="text-sm text-text-info lowercase">
              {query
                ? "no passwords match your search."
                : "no passwords yet. save one to get started."}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((c) => (
                <CredentialCard
                  key={c.id}
                  credential={c}
                  onEdit={() => openEdit(c)}
                  onDelete={() => setConfirmDelete(c.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pkm-900/80 p-4">
          <div className="w-full max-w-md rounded-xl border border-pkm-500 bg-pkm-800 p-6">
            <h2 className="mb-4 text-base text-text-primary lowercase tracking-wide">
              {editing ? "edit password" : "add password"}
            </h2>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div>
                <label htmlFor="cr-site" className="block mb-1.5 text-sm font-semibold text-text-primary lowercase">
                  site
                </label>
                <input
                  id="cr-site"
                  type="text"
                  value={form.site}
                  onChange={(e) => handleChange("site", e.target.value)}
                  className={inputClass(formErrors.site)}
                  required
                />
                {formErrors.site && <p className="mt-1 text-xs text-danger lowercase">{formErrors.site}</p>}
              </div>

              <div>
                <label htmlFor="cr-url" className="block mb-1.5 text-sm font-semibold text-text-primary lowercase">
                  url
                </label>
                <input
                  id="cr-url"
                  type="text"
                  value={form.url}
                  onChange={(e) => handleChange("url", e.target.value)}
                  className={inputClass(false)}
                />
              </div>

              <div>
                <label htmlFor="cr-username" className="block mb-1.5 text-sm font-semibold text-text-primary lowercase">
                  username
                </label>
                <input
                  id="cr-username"
                  type="text"
                  value={form.username}
                  onChange={(e) => handleChange("username", e.target.value)}
                  className={inputClass(formErrors.username)}
                  required
                />
                {formErrors.username && <p className="mt-1 text-xs text-danger lowercase">{formErrors.username}</p>}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="cr-password" className="text-sm font-semibold text-text-primary lowercase">
                    password
                  </label>
                  <button
                    type="button"
                    onClick={() => handleChange("password", generatePassword())}
                    className="text-xs text-sky underline lowercase"
                  >
                    generate
                  </button>
                </div>
                <input
                  id="cr-password"
                  type="text"
                  placeholder={editing ? "leave blank to keep" : "password"}
                  value={form.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  className={`font-mono ${inputClass(formErrors.password)}`}
                  required={!editing}
                />
                {formErrors.password && <p className="mt-1 text-xs text-danger lowercase">{formErrors.password}</p>}
              </div>

              <div>
                <label htmlFor="cr-notes" className="block mb-1.5 text-sm font-semibold text-text-primary lowercase">
                  notes
                </label>
                <textarea
                  id="cr-notes"
                  value={form.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-pkm-500 bg-pkm-700 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-gold focus:ring-1 focus:ring-gold lowercase"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditing(null)
                    setFormErrors({})
                  }}
                  className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-text-info transition hover:text-text-primary lowercase"
                  disabled={saving}
                >
                  cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 lowercase"
                >
                  {saving && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-pkm-900 border-t-transparent" />
                  )}
                  {saving ? "saving..." : editing ? "save changes" : "save password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pkm-900/80 p-4">
          <div className="w-full max-w-sm rounded-xl border border-pkm-500 bg-pkm-800 p-6">
            <h3 className="mb-2 text-base text-text-primary lowercase tracking-wide">delete password</h3>
            <p className="mb-5 text-sm text-text-info lowercase">
              are you sure you want to delete{" "}
              <span className="text-text-primary">
                {credentials.find((c) => c.id === confirmDelete)?.site}
              </span>
              ? this cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-text-info transition hover:text-text-primary lowercase"
                disabled={deleting}
              >
                cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 lowercase"
              >
                {deleting && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {deleting ? "deleting..." : "delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
