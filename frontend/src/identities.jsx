import { useState, useEffect } from "react"

function emptyForm() {
  return { name: "", email: "", display_name: "", signature: "", reply_to: "" }
}

function apiToIdentity(i) {
  return {
    id: i.id,
    name: i.name || "",
    email: i.email || "",
    display_name: i.display_name || "",
    signature: i.signature || "",
    reply_to: i.reply_to || "",
  }
}

function IdentityCard({ identity, onEdit, onDelete }) {
  return (
    <div className="group flex items-center justify-between rounded-lg border border-pkm-500 bg-pkm-800 p-4 transition hover:border-sky">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm text-text-primary lowercase">{identity.name}</p>
        <p className="text-xs text-text-info lowercase">
          {identity.display_name ? `${identity.display_name} ` : ""}&lt;{identity.email}&gt;
        </p>
        {identity.reply_to && (
          <p className="text-xs text-text-info lowercase">reply-to: {identity.reply_to}</p>
        )}
        {identity.signature && (
          <p className="mt-1 text-xs text-text-info lowercase">{identity.signature}</p>
        )}
      </div>
      <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
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

export default function Identities({ onNavigate, onLogout, authHeader }) {
  const [identities, setIdentities] = useState([])
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
    fetch("/api/identities", { headers: { Authorization: authHeader } })
      .then((res) => {
        if (!res.ok) throw new Error("failed to load identities")
        return res.json()
      })
      .then((data) => {
        setIdentities(data.map(apiToIdentity))
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

  function openEdit(identity) {
    setEditing(identity)
    setForm({
      name: identity.name,
      email: identity.email,
      display_name: identity.display_name,
      signature: identity.signature,
      reply_to: identity.reply_to,
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
    if (!form.name.trim()) {
      errors.name = "profile name is required"
    } else if (form.name.trim().length < 2) {
      errors.name = "min 2 characters"
    }
    if (!form.email.trim()) {
      errors.email = "email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = "invalid email format"
    }
    if (form.reply_to.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.reply_to.trim())) {
      errors.reply_to = "invalid email format"
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
        name: form.name.trim(),
        email: form.email.trim(),
        display_name: form.display_name.trim(),
        signature: form.signature.trim() || null,
        reply_to: form.reply_to.trim() || null,
      }
      if (editing) {
        const res = await fetch(`/api/identities/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error("failed to update identity")
        const updated = apiToIdentity(await res.json())
        setIdentities((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
      } else {
        const res = await fetch("/api/identities", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error("failed to create identity")
        const created = apiToIdentity(await res.json())
        setIdentities((prev) => [...prev, created])
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
      const res = await fetch(`/api/identities/${id}`, {
        method: "DELETE",
        headers: { Authorization: authHeader },
      })
      if (!res.ok) throw new Error("failed to delete identity")
      setIdentities((prev) => prev.filter((i) => i.id !== id))
      setDeleting(false)
      setConfirmDelete(null)
    } catch (err) {
      setDeleting(false)
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-pkm-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-pkm-500 border-t-gold" />
          <p className="text-sm text-text-info lowercase">loading identities...</p>
        </div>
      </div>
    )
  }

  const inputClass = (err) =>
    `w-full rounded-lg border bg-pkm-700 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:ring-1 lowercase ${
      err
        ? "border-danger focus:border-danger focus:ring-danger"
        : "border-pkm-500 focus:border-gold focus:ring-gold"
    }`

  return (
    <div className="flex min-h-[100dvh] flex-col bg-pkm-900">
      <header className="flex items-center justify-between border-b border-pkm-500 px-6 py-3">
        <h1 className="text-lg text-gold lowercase tracking-wide">identities</h1>
        <div className="flex items-center gap-3">
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
        <aside className="w-72 shrink-0 border-r border-pkm-500 p-4">
          <button
            onClick={openAdd}
            className="mb-4 w-full rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] lowercase"
          >
            add identity
          </button>
          <nav className="flex flex-col gap-1">
            <span className="rounded-md bg-pkm-600 px-3 py-2 text-sm text-text-primary lowercase">
              all identities
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

          {identities.length === 0 ? (
            <p className="text-sm text-text-info lowercase">
              no identities yet. create a sender profile to get started.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {identities.map((i) => (
                <IdentityCard
                  key={i.id}
                  identity={i}
                  onEdit={() => openEdit(i)}
                  onDelete={() => setConfirmDelete(i.id)}
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
              {editing ? "edit identity" : "add identity"}
            </h2>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div>
                <label htmlFor="id-name" className="block mb-1.5 text-sm font-semibold text-text-primary lowercase">
                  profile name
                </label>
                <input
                  id="id-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className={inputClass(formErrors.name)}
                  required
                />
                {formErrors.name && <p className="mt-1 text-xs text-danger lowercase">{formErrors.name}</p>}
              </div>

              <div>
                <label htmlFor="id-email" className="block mb-1.5 text-sm font-semibold text-text-primary lowercase">
                  sender email
                </label>
                <input
                  id="id-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className={inputClass(formErrors.email)}
                  required
                />
                {formErrors.email && <p className="mt-1 text-xs text-danger lowercase">{formErrors.email}</p>}
              </div>

              <div>
                <label htmlFor="id-display" className="block mb-1.5 text-sm font-semibold text-text-primary lowercase">
                  display name
                </label>
                <input
                  id="id-display"
                  type="text"
                  value={form.display_name}
                  onChange={(e) => handleChange("display_name", e.target.value)}
                  className={inputClass(false)}
                />
              </div>

              <div>
                <label htmlFor="id-reply" className="block mb-1.5 text-sm font-semibold text-text-primary lowercase">
                  reply-to
                </label>
                <input
                  id="id-reply"
                  type="email"
                  value={form.reply_to}
                  onChange={(e) => handleChange("reply_to", e.target.value)}
                  className={inputClass(formErrors.reply_to)}
                />
                {formErrors.reply_to && <p className="mt-1 text-xs text-danger lowercase">{formErrors.reply_to}</p>}
              </div>

              <div>
                <label htmlFor="id-sig" className="block mb-1.5 text-sm font-semibold text-text-primary lowercase">
                  signature
                </label>
                <textarea
                  id="id-sig"
                  value={form.signature}
                  onChange={(e) => handleChange("signature", e.target.value)}
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
                  {saving ? "saving..." : editing ? "save changes" : "create identity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pkm-900/80 p-4">
          <div className="w-full max-w-sm rounded-xl border border-pkm-500 bg-pkm-800 p-6">
            <h3 className="mb-2 text-base text-text-primary lowercase tracking-wide">delete identity</h3>
            <p className="mb-5 text-sm text-text-info lowercase">
              are you sure you want to delete{" "}
              <span className="text-text-primary">
                {identities.find((i) => i.id === confirmDelete)?.name}
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
