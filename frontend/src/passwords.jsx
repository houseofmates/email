import { useState, useEffect, useCallback, useRef } from "react"
import Layout from "./layout"
import { vault, VaultLockedError } from "./services/vault"
import { SkeletonCardGrid } from "./components/Skeleton"
import PasswordGenerator from "./components/PasswordGenerator"
import SecurityDashboard from "./components/SecurityDashboard"
import { parseImport, toJSON, toCSV } from "./services/vault-io"

function download(filename, content, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const TYPES = [
  { key: "login", label: "logins" },
  { key: "note", label: "notes" },
  { key: "card", label: "cards" },
  { key: "identity", label: "identities" },
]
const TYPE_SINGULAR = { login: "login", note: "note", card: "card", identity: "identity" }

// field definitions per cipher type — keys match the bridge cipher<->plain map
const TYPE_FIELDS = {
  login: [
    { k: "name", l: "name" }, { k: "uri", l: "url" }, { k: "username", l: "username" },
    { k: "password", l: "password", sensitive: true, gen: true },
    { k: "totp", l: "authenticator key (totp)", sensitive: true },
    { k: "notes", l: "notes", multiline: true },
  ],
  note: [{ k: "name", l: "name" }, { k: "notes", l: "note", multiline: true }],
  card: [
    { k: "name", l: "name" }, { k: "cardholderName", l: "cardholder name" }, { k: "brand", l: "brand" },
    { k: "number", l: "card number", sensitive: true }, { k: "expMonth", l: "exp. month" },
    { k: "expYear", l: "exp. year" }, { k: "code", l: "security code", sensitive: true },
    { k: "notes", l: "notes", multiline: true },
  ],
  identity: [
    { k: "name", l: "name" }, { k: "firstName", l: "first name" }, { k: "lastName", l: "last name" },
    { k: "username", l: "username" }, { k: "email", l: "email" }, { k: "phone", l: "phone" },
    { k: "address1", l: "address" }, { k: "city", l: "city" }, { k: "state", l: "state" },
    { k: "postalCode", l: "postal code" }, { k: "country", l: "country" }, { k: "company", l: "company" },
    { k: "notes", l: "notes", multiline: true },
  ],
}

function emptyItem(type) {
  const base = { type, folderId: "" }
  for (const f of TYPE_FIELDS[type] || []) base[f.k] = ""
  return base
}

function inputClass(err) {
  return `w-full rounded-lg border bg-pkm-700 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:ring-1 lowercase ${
    err ? "border-danger focus:border-danger focus:ring-danger" : "border-pkm-500 focus:border-gold focus:ring-gold"
  }`
}

// ── unlock / create screen ───────────────────────────────────────────────────
function UnlockScreen({ authHeader, userEmail, initialized, onUnlocked }) {
  const email = userEmail || "" // single-user: email is just a display label
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const creating = !initialized

  async function submit(e) {
    e.preventDefault()
    if (!password) { setError("master password required"); return }
    if (creating) {
      if (password.length < 8) { setError("use at least 8 characters"); return }
      if (password !== confirm) { setError("passwords do not match"); return }
    }
    setBusy(true); setError(null)
    try {
      if (creating) await vault.create(authHeader, email.trim(), password)
      else await vault.unlock(authHeader, email.trim(), password)
      setPassword(""); setConfirm("")
      onUnlocked()
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in space-y-4">
        <div>
          <h2 className="text-base text-gold lowercase tracking-wide">{creating ? "create vault" : "unlock vault"}</h2>
          <p className="mt-1 text-xs text-text-info lowercase">
            {creating
              ? "choose a master password. it encrypts your vault and cannot be recovered if lost."
              : "enter your master password to decrypt your vault."}
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-text-primary lowercase">master password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass(error)}
            autoComplete={creating ? "new-password" : "current-password"} autoFocus />
        </div>
        {creating && (
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-text-primary lowercase">confirm password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass(error)} autoComplete="new-password" />
          </div>
        )}
        {error && <p className="text-xs text-danger lowercase">{error}</p>}
        <button type="submit" disabled={busy}
          className="w-full rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 lowercase">
          {busy ? (creating ? "creating..." : "unlocking...") : creating ? "create vault" : "unlock"}
        </button>
        <p className="text-[11px] text-text-info lowercase leading-relaxed">
          your master password is sent to the bridge (your server) once to {creating ? "encrypt" : "decrypt"} a local
          vault file — never stored, never logged. run the bridge over https.
        </p>
      </form>
    </div>
  )
}

// ── main ─────────────────────────────────────────────────────────────────────
export default function Passwords({ authHeader, onNavigate, onLogout, userEmail }) {
  const [checking, setChecking] = useState(true)
  const [locked, setLocked] = useState(true)
  const [initialized, setInitialized] = useState(true)
  const [items, setItems] = useState([])
  const [folders, setFolders] = useState([])
  const [lastSync, setLastSync] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState("")
  const [activeType, setActiveType] = useState(null)
  const [activeFolder, setActiveFolder] = useState(undefined) // undefined=all, null=none, string=id
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [revealed, setRevealed] = useState({})
  const [manageFolders, setManageFolders] = useState(false)
  const [gen, setGen] = useState(null)       // null | { field? } — generator target
  const [importMsg, setImportMsg] = useState(null)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [showSecurity, setShowSecurity] = useState(false)
  const fileRef = useRef(null)

  const sync = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await vault.sync(authHeader)
      setItems(data.ciphers || [])
      setFolders(data.folders || [])
      setLastSync(data.lastSync || null)
      setLocked(false)
    } catch (err) {
      if (err instanceof VaultLockedError) { setLocked(true) }
      else setError(String(err.message || err))
    } finally {
      setLoading(false)
    }
  }, [authHeader])

  // on mount: is the vault already unlocked on the bridge?
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await vault.status(authHeader)
        if (cancelled) return
        setInitialized(s.initialized !== false)
        if (s.unlocked) { setLocked(false); await sync() }
        else setLocked(true)
      } catch { if (!cancelled) setLocked(true) }
      finally { if (!cancelled) setChecking(false) }
    })()
    return () => { cancelled = true }
  }, [authHeader, sync])

  // "u" shortcut reloads when unlocked
  useEffect(() => {
    const onRefresh = () => { if (!locked) sync() }
    window.addEventListener("shortcut:refresh", onRefresh)
    return () => window.removeEventListener("shortcut:refresh", onRefresh)
  }, [locked, sync])

  // esc closes the open overlay
  useEffect(() => {
    function onKey(e) {
      if (e.key !== "Escape") return
      if (gen) setGen(null)
      else if (showSecurity) setShowSecurity(false)
      else if (showForm) { setShowForm(false); setEditing(null); setForm({}) }
      else if (confirmDelete) setConfirmDelete(null)
      else if (manageFolders) setManageFolders(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [showForm, confirmDelete, manageFolders, gen, showSecurity])

  async function lock() {
    await vault.lock(authHeader)
    setLocked(true); setItems([]); setFolders([]); setQuery(""); setActiveType(null); setActiveFolder(undefined)
  }

  function startAdd(type) {
    setEditing(null); setForm(emptyItem(type)); setFormErrors({}); setShowForm(true)
  }
  function startEdit(item) {
    setEditing(item); setForm({ ...emptyItem(item.type), ...item, folderId: item.folderId || "" }); setFormErrors({}); setShowForm(true)
  }
  function handleChange(k, v) {
    setForm((p) => ({ ...p, [k]: v }))
    if (formErrors[k]) setFormErrors((p) => { const r = { ...p }; delete r[k]; return r })
  }
  function validate() {
    const errors = {}
    if (!form.name || !String(form.name).trim()) errors.name = "name is required"
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true); setError(null)
    try {
      const body = { ...form, folderId: form.folderId || null }
      const saved = editing ? await vault.saveCipher(authHeader, { ...body, id: editing.id }) : await vault.saveCipher(authHeader, body)
      setItems((prev) => editing ? prev.map((i) => i.id === editing.id ? saved : i) : [...prev, saved])
      setShowForm(false); setEditing(null); setForm({})
    } catch (err) {
      if (err instanceof VaultLockedError) setLocked(true)
      else setError(String(err.message || err))
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    setDeleting(true); setError(null)
    try {
      await vault.deleteCipher(authHeader, id)
      setItems((prev) => prev.filter((i) => i.id !== id))
      setConfirmDelete(null)
    } catch (err) {
      if (err instanceof VaultLockedError) setLocked(true)
      else setError(String(err.message || err))
    } finally { setDeleting(false) }
  }

  async function addFolder() {
    const name = (window.prompt("folder name") || "").trim()
    if (!name) return
    try { const f = await vault.createFolder(authHeader, name); setFolders((prev) => [...prev, f]) }
    catch (err) { setError(String(err.message || err)) }
  }
  async function renameFolder(folder) {
    const name = (window.prompt("rename folder", folder.name) || "").trim()
    if (!name || name === folder.name) return
    try { const f = await vault.renameFolder(authHeader, folder.id, name); setFolders((prev) => prev.map((x) => x.id === folder.id ? f : x)) }
    catch (err) { setError(String(err.message || err)) }
  }
  async function removeFolder(folder) {
    try {
      await vault.deleteFolder(authHeader, folder.id)
      setFolders((prev) => prev.filter((x) => x.id !== folder.id))
      // ciphers in a deleted folder become unfiled
      setItems((prev) => prev.map((i) => i.folderId === folder.id ? { ...i, folderId: null } : i))
      if (activeFolder === folder.id) setActiveFolder(undefined)
    } catch (err) { setError(String(err.message || err)) }
  }

  // ── import / export ──────────────────────────────────────────────────────
  const openImport = () => fileRef.current?.click()

  function exportVault(format) {
    if (format === "csv") download("vault.csv", toCSV(items, folderName), "text/csv")
    else download("vault.json", toJSON(items, folderName), "application/json")
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ""
    if (!file) return
    setImportMsg({ kind: "info", text: "importing…" }); setError(null)
    try {
      const { items: parsed, folders: parsedFolders } = parseImport(await file.text(), file.name)
      if (!parsed.length) throw new Error("no items found in file")
      // create any folders that don't exist yet, then map folder NAME -> id
      const nameToId = new Map(folders.map((f) => [f.name, f.id]))
      let liveFolders = folders
      for (const pf of parsedFolders) {
        if (!nameToId.has(pf.name)) {
          const created = await vault.createFolder(authHeader, pf.name)
          nameToId.set(created.name, created.id)
          liveFolders = [...liveFolders, created]
        }
      }
      setFolders(liveFolders)
      const normalized = parsed.map(({ folder, ...rest }) => ({ ...rest, folderId: folder ? nameToId.get(folder) || null : null }))
      const res = await vault.importItems(authHeader, normalized)
      setItems(res.ciphers || [])
      setImportMsg({ kind: "ok", text: `imported ${res.imported} item${res.imported === 1 ? "" : "s"}` })
    } catch (err) {
      if (err instanceof VaultLockedError) setLocked(true)
      else setImportMsg({ kind: "err", text: String(err.message || err) })
    }
  }

  // drag a card onto a folder chip to refile it
  async function moveToFolder(cipherId, folderId) {
    const item = items.find((i) => i.id === cipherId)
    if (!item || (item.folderId || null) === (folderId || null)) return
    const updated = { ...item, folderId: folderId || null }
    setItems((prev) => prev.map((i) => i.id === cipherId ? updated : i)) // optimistic
    try { await vault.saveCipher(authHeader, updated) }
    catch (err) {
      if (err instanceof VaultLockedError) setLocked(true)
      else { setError(String(err.message || err)); sync() }
    }
  }

  function toggleReveal(id) { setRevealed((p) => ({ ...p, [id]: !p[id] })) }
  function copy(v) { try { navigator.clipboard?.writeText(v) } catch { /* clipboard unavailable */ } }

  const filtered = items.filter((i) => {
    if (activeType && i.type !== activeType) return false
    if (activeFolder !== undefined && (i.folderId || null) !== activeFolder) return false
    if (!query.trim()) return true
    return JSON.stringify(i).toLowerCase().includes(query.toLowerCase())
  })
  const typeCount = (t) => items.filter((i) => i.type === t).length
  const folderName = (id) => folders.find((f) => f.id === id)?.name || "untitled"

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <Layout currentPage="passwords" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex items-center justify-between border-b border-pkm-500 px-4 py-3">
          <h1 className="text-lg text-gold lowercase tracking-wide">
            passwords{!locked && items.length > 0 && <span className="ml-2 text-xs font-normal text-text-info">({items.length})</span>}
          </h1>
          {!locked && (
            <div className="flex items-center gap-2">
              {lastSync && <span className="hidden lg:inline text-[11px] text-text-info lowercase">synced {new Date(lastSync).toLocaleTimeString()}</span>}
              <div className="relative">
                <button onClick={() => setToolsOpen((o) => !o)} className="rounded-lg border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98] lowercase">tools ▾</button>
                {toolsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setToolsOpen(false)} />
                    <div className="absolute right-0 z-50 mt-1 w-44 rounded-lg border border-pkm-500 bg-pkm-800 p-1 shadow-xl">
                      {(() => {
                        const ToolItem = ({ label, onClick }) => (
                          <button onClick={() => { onClick(); setToolsOpen(false) }}
                            className="block w-full rounded-md px-3 py-2 text-left text-xs text-text-primary transition hover:bg-pkm-700 lowercase">{label}</button>
                        )
                        return (
                          <>
                            <ToolItem label="generator" onClick={() => setGen({})} />
                            <ToolItem label="security check" onClick={() => setShowSecurity(true)} />
                            <ToolItem label="import" onClick={openImport} />
                            <ToolItem label="export json" onClick={() => exportVault("json")} />
                            <ToolItem label="export csv" onClick={() => exportVault("csv")} />
                          </>
                        )
                      })()}
                    </div>
                  </>
                )}
              </div>
              <button onClick={lock} className="rounded-lg border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98] lowercase">lock</button>
              <button onClick={() => startAdd(activeType || "login")}
                className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] lowercase">+ add</button>
              <input ref={fileRef} type="file" accept=".json,.csv" onChange={handleImportFile} className="hidden" />
            </div>
          )}
        </div>

        {checking ? (
          <div className="p-4"><SkeletonCardGrid /></div>
        ) : locked ? (
          <UnlockScreen authHeader={authHeader} userEmail={userEmail} initialized={initialized} onUnlocked={sync} />
        ) : (
          <>
            {/* type filter */}
            <div className="flex gap-1 overflow-x-auto border-b border-pkm-500 px-4 py-2">
              <button onClick={() => setActiveType(null)}
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition lowercase ${!activeType ? "bg-gold text-pkm-900" : "bg-pkm-700 text-text-info hover:text-text-primary"}`}>all</button>
              {TYPES.map((t) => (
                <button key={t.key} onClick={() => setActiveType(t.key)}
                  className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition lowercase ${activeType === t.key ? "bg-gold text-pkm-900" : "bg-pkm-700 text-text-info hover:text-text-primary"}`}>
                  {t.label}{typeCount(t.key) > 0 && ` (${typeCount(t.key)})`}
                </button>
              ))}
            </div>

            {/* folder filter */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-pkm-500 px-4 py-2">
              <button onClick={() => setActiveFolder(undefined)}
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition lowercase ${activeFolder === undefined ? "bg-sky text-pkm-900" : "bg-pkm-700 text-text-info hover:text-text-primary"}`}>all folders</button>
              <button onClick={() => setActiveFolder(null)}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); moveToFolder(e.dataTransfer.getData("text/cipher-id"), null) }}
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition lowercase ${activeFolder === null ? "bg-sky text-pkm-900" : "bg-pkm-700 text-text-info hover:text-text-primary"}`}>no folder</button>
              {folders.map((f) => (
                <button key={f.id} onClick={() => setActiveFolder(f.id)}
                  onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); moveToFolder(e.dataTransfer.getData("text/cipher-id"), f.id) }}
                  className={`shrink-0 rounded-md px-2.5 py-1 text-xs transition lowercase ${activeFolder === f.id ? "bg-sky text-pkm-900" : "bg-pkm-700 text-text-info hover:text-text-primary"}`}>{f.name}</button>
              ))}
              <button onClick={addFolder} className="shrink-0 rounded-md px-2 py-1 text-xs text-text-info transition hover:text-gold lowercase" aria-label="add folder">+ folder</button>
              {folders.length > 0 && <button onClick={() => setManageFolders(true)} className="shrink-0 rounded-md px-2 py-1 text-xs text-text-info transition hover:text-gold lowercase">manage</button>}
            </div>

            {/* search */}
            <div className="border-b border-pkm-500 px-4 py-2">
              <input type="text" placeholder="search passwords..." value={query} onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-sky focus:ring-1 focus:ring-sky lowercase" />
            </div>

            {importMsg && (
              <div className="flex items-center justify-between gap-2 border-b border-pkm-500 px-4 py-2">
                <span className={`text-xs lowercase ${importMsg.kind === "err" ? "text-danger" : importMsg.kind === "ok" ? "text-gold" : "text-text-info"}`}>{importMsg.text}</span>
                <button onClick={() => setImportMsg(null)} className="text-xs text-text-info transition hover:text-sky lowercase" aria-label="dismiss">dismiss</button>
              </div>
            )}

            {/* list */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <SkeletonCardGrid />
              ) : error ? (
                <div className="p-4">
                  <p className="text-sm text-danger lowercase">{error}</p>
                  <button onClick={sync} className="mt-3 rounded-md border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98] lowercase">retry</button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <p className="text-sm text-text-info lowercase">{query ? "no matches" : "nothing here yet"}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((item) => (
                    <ItemCard key={item.id} item={item} folderName={folderName} revealed={revealed}
                      onDragStart={(e) => e.dataTransfer.setData("text/cipher-id", item.id)}
                      onReveal={toggleReveal} onCopy={copy} onEdit={() => startEdit(item)} onDelete={() => setConfirmDelete(item.id)} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* add/edit modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-pkm-900/80 p-4 pt-12" onClick={() => { setShowForm(false); setEditing(null) }}>
            <div className="w-full max-w-lg rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in my-8" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base text-gold lowercase tracking-wide">{editing ? `edit ${TYPE_SINGULAR[form.type]}` : `new ${TYPE_SINGULAR[form.type]}`}</h2>
                {!editing && (
                  <select value={form.type} onChange={(e) => { const t = e.target.value; setForm({ ...emptyItem(t), name: form.name || "" }) }}
                    className="rounded-md border border-pkm-500 bg-pkm-700 px-2 py-1 text-xs text-text-primary lowercase">
                    {TYPES.map((t) => <option key={t.key} value={t.key}>{TYPE_SINGULAR[t.key]}</option>)}
                  </select>
                )}
              </div>
              <form onSubmit={handleSave} className="flex flex-col gap-4">
                {(TYPE_FIELDS[form.type] || []).map((f) => (
                  <div key={f.k}>
                    <label className="mb-1.5 block text-sm font-semibold text-text-primary lowercase">{f.l}</label>
                    {f.multiline ? (
                      <textarea value={form[f.k] || ""} onChange={(e) => handleChange(f.k, e.target.value)} rows={3}
                        className="w-full resize-none rounded-lg border border-pkm-500 bg-pkm-700 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-gold focus:ring-1 focus:ring-gold lowercase" />
                    ) : f.sensitive ? (
                      <div className="flex gap-2">
                        <input type="text" value={form[f.k] || ""} onChange={(e) => handleChange(f.k, e.target.value)} className={`flex-1 ${inputClass(formErrors[f.k])} font-mono`} />
                        {f.gen && <button type="button" onClick={() => setGen({ field: f.k })} className="shrink-0 rounded-lg border border-sky px-3 py-2 text-xs text-sky transition hover:bg-sky-dim lowercase">generate</button>}
                      </div>
                    ) : (
                      <input type="text" value={form[f.k] || ""} onChange={(e) => handleChange(f.k, e.target.value)} className={inputClass(formErrors[f.k])} />
                    )}
                    {formErrors[f.k] && <p className="mt-1 text-xs text-danger lowercase">{formErrors[f.k]}</p>}
                  </div>
                ))}
                {/* folder assignment */}
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-text-primary lowercase">folder</label>
                  <select value={form.folderId || ""} onChange={(e) => handleChange("folderId", e.target.value)}
                    className="w-full rounded-lg border border-pkm-500 bg-pkm-700 px-4 py-2.5 text-sm text-text-primary outline-none transition focus:border-gold focus:ring-1 focus:ring-gold lowercase">
                    <option value="">no folder</option>
                    {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>

                {/* attachments — stored inline, encrypted with the vault */}
                <AttachmentsField value={form.attachments || []} onChange={(arr) => handleChange("attachments", arr)} />
                <div className="flex items-center justify-end gap-3 mt-2">
                  <button type="button" onClick={() => { setShowForm(false); setEditing(null); setForm({}) }} disabled={saving}
                    className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-text-info transition hover:text-text-primary lowercase">cancel</button>
                  <button type="submit" disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 lowercase">
                    {saving ? "saving..." : editing ? "save changes" : "save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* manage folders modal */}
        {manageFolders && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-pkm-900/80 p-4" onClick={() => setManageFolders(false)}>
            <div className="w-full max-w-sm rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-3 text-base text-gold lowercase tracking-wide">folders</h3>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {folders.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-pkm-500 px-3 py-2">
                    <span className="text-sm text-text-primary lowercase truncate">{f.name}</span>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => renameFolder(f)} className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase">rename</button>
                      <button onClick={() => removeFolder(f)} className="rounded-md border border-danger-border px-2 py-1 text-xs text-danger transition hover:bg-danger-dim lowercase">delete</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end"><button onClick={() => setManageFolders(false)} className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-text-info transition hover:text-text-primary lowercase">close</button></div>
            </div>
          </div>
        )}

        {/* delete confirm */}
        {confirmDelete !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-pkm-900/80 p-4" onClick={() => setConfirmDelete(null)}>
            <div className="w-full max-w-sm rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-2 text-base text-gold lowercase tracking-wide">delete item</h3>
              <p className="mb-5 text-sm text-text-info lowercase">delete <span className="text-text-primary">{items.find((i) => i.id === confirmDelete)?.name || "this item"}</span>? this cannot be undone.</p>
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setConfirmDelete(null)} disabled={deleting} className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-text-info transition hover:text-text-primary lowercase">cancel</button>
                <button onClick={() => handleDelete(confirmDelete)} disabled={deleting}
                  className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 lowercase">{deleting ? "deleting..." : "delete"}</button>
              </div>
            </div>
          </div>
        )}

        {/* password generator (standalone or targeting a form field) */}
        {gen && (
          <PasswordGenerator
            onClose={() => setGen(null)}
            onUse={gen.field ? (v) => { handleChange(gen.field, v); setGen(null) } : undefined}
          />
        )}

        {/* security dashboard */}
        {showSecurity && (
          <SecurityDashboard
            items={items} authHeader={authHeader} hibpRange={vault.hibpRange}
            onOpenItem={(it) => { setShowSecurity(false); startEdit(it) }}
            onClose={() => setShowSecurity(false)}
          />
        )}
      </div>
    </Layout>
  )
}

// ── attachments (stored inline as base64; the vault file encrypts them) ──────
const MAX_ATTACHMENT = 2 * 1024 * 1024 // 2mb — keep the single vault blob sane
const prettySize = (n) => (n < 1024 ? `${n} b` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} kb` : `${(n / 1024 / 1024).toFixed(1)} mb`)

function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve({ id: crypto.randomUUID(), name: file.name, size: file.size, type: file.type, data: String(r.result).split(",")[1] })
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

function AttachmentsField({ value, onChange }) {
  const ref = useRef(null)
  const [err, setErr] = useState(null)

  async function add(e) {
    const file = e.target.files?.[0]
    if (ref.current) ref.current.value = ""
    if (!file) return
    if (file.size > MAX_ATTACHMENT) { setErr(`max ${prettySize(MAX_ATTACHMENT)} per file`); return }
    setErr(null)
    onChange([...(value || []), await fileToAttachment(file)])
  }
  function downloadAtt(att) {
    const bytes = Uint8Array.from(atob(att.data), (c) => c.charCodeAt(0))
    download(att.name, bytes, att.type || "application/octet-stream")
  }
  function remove(id) { onChange((value || []).filter((a) => a.id !== id)) }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-text-primary lowercase">attachments</label>
      <div className="space-y-2">
        {(value || []).map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2">
            <span className="min-w-0 truncate text-sm text-text-primary lowercase">📎 {a.name} <span className="text-text-info">· {prettySize(a.size)}</span></span>
            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={() => downloadAtt(a)} className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase">save</button>
              <button type="button" onClick={() => remove(a.id)} className="rounded-md border border-danger-border px-2 py-1 text-xs text-danger transition hover:bg-danger-dim lowercase">remove</button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => ref.current?.click()} className="rounded-lg border border-dashed border-pkm-500 px-3 py-2 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase w-full">+ attach file</button>
        <input ref={ref} type="file" onChange={add} className="hidden" />
        {err && <p className="text-xs text-danger lowercase">{err}</p>}
      </div>
    </div>
  )
}

// ── item card ────────────────────────────────────────────────────────────────
function ItemCard({ item, folderName, revealed, onReveal, onCopy, onEdit, onDelete, onDragStart }) {
  const fields = TYPE_FIELDS[item.type] || []
  const subtitle = item.type === "login" ? item.username
    : item.type === "card" ? (item.number ? `•••• ${String(item.number).slice(-4)}` : "")
    : item.type === "identity" ? [item.firstName, item.lastName].filter(Boolean).join(" ")
    : ""
  const secret = fields.find((f) => f.sensitive && item[f.k])
  const attachments = item.attachments?.length || 0
  return (
    <div draggable onDragStart={onDragStart} title="drag onto a folder to refile"
      className="cursor-grab rounded-lg border border-pkm-500 bg-pkm-800 px-4 py-3 transition hover:border-gold active:cursor-grabbing">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-primary lowercase truncate">{item.name || "untitled"}</p>
          {subtitle && <p className="text-xs text-text-info lowercase truncate">{subtitle}</p>}
          {secret && (
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-xs text-text-info truncate">{revealed[item.id] ? item[secret.k] : "•".repeat(Math.min(String(item[secret.k]).length, 16))}</span>
              <button onClick={() => onReveal(item.id)} className="text-xs text-sky underline lowercase">{revealed[item.id] ? "hide" : "show"}</button>
              <button onClick={() => onCopy(item[secret.k])} className="text-xs text-sky underline lowercase">copy</button>
            </div>
          )}
          <div className="mt-1 flex items-center gap-2">
            {item.folderId && <span className="text-[11px] text-text-info lowercase">📁 {folderName(item.folderId)}</span>}
            {attachments > 0 && <span className="text-[11px] text-text-info lowercase">📎 {attachments}</span>}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button onClick={onEdit} className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98] lowercase">edit</button>
          <button onClick={onDelete} className="rounded-md border border-danger-border px-2 py-1 text-xs text-danger transition hover:bg-danger-dim active:scale-[0.98] lowercase">delete</button>
        </div>
      </div>
    </div>
  )
}
