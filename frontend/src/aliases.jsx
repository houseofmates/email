import { useState, useEffect } from "react"

function emptyForm() {
  return { alias: "", username: "", password: "", notes: "" }
}

function AliasCard({ alias, onEdit, onDelete }) {
  return (
    <div className="group flex items-center justify-between rounded-lg border border-pkm-500 bg-pkm-800 p-4 transition hover:border-sky">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm text-white lowercase">{alias.alias}</p>
        <p className="text-xs text-pkm-400 lowercase">username: {alias.username}</p>
        <p className="text-xs text-pkm-400 lowercase">
          password: {"\u2022".repeat(alias.password.length)}
        </p>
        {alias.notes && (
          <p className="mt-1 text-xs text-pkm-400 lowercase">{alias.notes}</p>
        )}
      </div>
      <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
        <button
          onClick={onEdit}
          className="rounded-md border border-pkm-500 px-3 py-1 text-xs text-pkm-400 transition hover:border-sky hover:text-sky lowercase"
        >
          edit
        </button>
        <button
          onClick={onDelete}
          className="rounded-md border border-pkm-500 px-3 py-1 text-xs text-pkm-400 transition hover:border-red-400 hover:text-red-400 lowercase"
        >
          delete
        </button>
      </div>
    </div>
  )
}

function apiToAlias(a) {
  return { id: a.id, alias: a.email, username: a.username, password: a.password, notes: a.notes || "" }
}

export default function Aliases({ onNavigate, onLogout, authHeader }) {
  const [aliases, setAliases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch("/api/aliases", {
      headers: { Authorization: authHeader },
    })
      .then((res) => {
        if (!res.ok) throw new Error("failed to load aliases")
        return res.json()
      })
      .then((data) => {
        setAliases(data.map(apiToAlias))
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

  function openEdit(alias) {
    setEditing(alias)
    setForm({
      alias: alias.alias,
      username: alias.username,
      password: "",
      notes: alias.notes,
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
    if (!form.alias.trim()) {
      errors.alias = "alias is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.alias.trim())) {
      errors.alias = "invalid email format"
    }
    if (!form.username.trim()) {
      errors.username = "username is required"
    } else if (form.username.trim().length < 2) {
      errors.username = "min 2 characters"
    }
    if (!editing || form.password) {
      if (!form.password) {
        errors.password = "password is required"
      } else if (form.password.length < 4) {
        errors.password = "min 4 characters"
      }
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
        email: form.alias.trim(),
        username: form.username.trim(),
        password: form.password || editing.password,
        notes: form.notes.trim() || null,
      }
      if (editing) {
        const res = await fetch(`/api/aliases/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error("failed to update alias")
        const updated = apiToAlias(await res.json())
        setAliases((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
      } else {
        const res = await fetch("/api/aliases", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error("failed to create alias")
        const created = apiToAlias(await res.json())
        setAliases((prev) => [...prev, created])
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
      const res = await fetch(`/api/aliases/${id}`, {
        method: "DELETE",
        headers: { Authorization: authHeader },
      })
      if (!res.ok) throw new Error("failed to delete alias")
      setAliases((prev) => prev.filter((a) => a.id !== id))
      setDeleting(false)
      setConfirmDelete(null)
    } catch (err) {
      setDeleting(false)
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-pkm-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-pkm-500 border-t-gold" />
          <p className="text-sm text-pkm-400 lowercase">loading aliases...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-pkm-900">
      <header className="flex items-center justify-between border-b border-pkm-600 px-6 py-3">
        <h1 className="text-lg text-white lowercase tracking-wide">aliases</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("dashboard")}
            className="rounded-lg border border-pkm-500 px-4 py-1.5 text-xs text-pkm-400 transition hover:border-sky hover:text-sky lowercase"
          >
            inbox
          </button>
          <button
            onClick={onLogout}
            className="rounded-lg border border-pkm-500 px-4 py-1.5 text-xs text-pkm-400 transition hover:border-sky hover:text-sky lowercase"
          >
            sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="w-72 shrink-0 border-r border-pkm-600 p-4">
          <button
            onClick={openAdd}
            className="mb-4 w-full rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] lowercase"
          >
            add alias
          </button>

          <nav className="flex flex-col gap-1">
            <span className="rounded-md bg-pkm-600 px-3 py-2 text-sm text-white lowercase">
              all aliases
            </span>
          </nav>
        </aside>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 lowercase">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-2 text-red-400 underline"
              >
                dismiss
              </button>
            </div>
          )}

          {aliases.length === 0 ? (
            <p className="text-sm text-pkm-400 lowercase">
              no aliases yet. create one to get started.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {aliases.map((a) => (
                <AliasCard
                  key={a.id}
                  alias={a}
                  onEdit={() => openEdit(a)}
                  onDelete={() => setConfirmDelete(a.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-pkm-500 bg-pkm-800 p-6 shadow-lg">
            <h2 className="mb-4 text-base text-white lowercase tracking-wide">
              {editing ? "edit alias" : "add alias"}
            </h2>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div>
                <label htmlFor="alias" className="sr-only">
                  email alias
                </label>
                <input
                  id="alias"
                  type="text"
                  placeholder="email alias"
                  value={form.alias}
                  onChange={(e) => handleChange("alias", e.target.value)}
                  className={`w-full rounded-lg border bg-pkm-700 px-4 py-2.5 text-sm text-white placeholder-pkm-400 outline-none transition focus:ring-1 lowercase ${
                    formErrors.alias
                      ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                      : "border-pkm-500 focus:border-gold focus:ring-gold"
                  }`}
                  required
                />
                {formErrors.alias && (
                  <p className="mt-1 text-xs text-red-400 lowercase">
                    {formErrors.alias}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="username" className="sr-only">
                  username
                </label>
                <input
                  id="username"
                  type="text"
                  placeholder="username"
                  value={form.username}
                  onChange={(e) => handleChange("username", e.target.value)}
                  className={`w-full rounded-lg border bg-pkm-700 px-4 py-2.5 text-sm text-white placeholder-pkm-400 outline-none transition focus:ring-1 lowercase ${
                    formErrors.username
                      ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                      : "border-pkm-500 focus:border-gold focus:ring-gold"
                  }`}
                  required
                />
                {formErrors.username && (
                  <p className="mt-1 text-xs text-red-400 lowercase">
                    {formErrors.username}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="sr-only">
                  password
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder={editing ? "password (leave blank to keep)" : "password"}
                  value={form.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  className={`w-full rounded-lg border bg-pkm-700 px-4 py-2.5 text-sm text-white placeholder-pkm-400 outline-none transition focus:ring-1 lowercase ${
                    formErrors.password
                      ? "border-red-400 focus:border-red-400 focus:ring-red-400"
                      : "border-pkm-500 focus:border-gold focus:ring-gold"
                  }`}
                  required={!editing}
                />
                {formErrors.password && (
                  <p className="mt-1 text-xs text-red-400 lowercase">
                    {formErrors.password}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="notes" className="sr-only">
                  notes
                </label>
                <textarea
                  id="notes"
                  placeholder="notes"
                  value={form.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-pkm-500 bg-pkm-700 px-4 py-2.5 text-sm text-white placeholder-pkm-400 outline-none transition focus:border-gold focus:ring-1 focus:ring-gold lowercase"
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
                  className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-pkm-400 transition hover:text-white lowercase"
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
                  {saving ? "saving..." : editing ? "save changes" : "create alias"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl border border-pkm-500 bg-pkm-800 p-6 shadow-lg">
            <h3 className="mb-2 text-base text-white lowercase tracking-wide">
              delete alias
            </h3>
            <p className="mb-5 text-sm text-pkm-400 lowercase">
              are you sure you want to delete{" "}
              <span className="text-white">
                {aliases.find((a) => a.id === confirmDelete)?.alias}
              </span>
              ? this cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-pkm-400 transition hover:text-white lowercase"
                disabled={deleting}
              >
                cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 lowercase"
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
