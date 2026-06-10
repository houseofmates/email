import { useState, useEffect, useCallback, useRef } from "react"
import Layout from "./layout"
import { SkeletonList } from "./components/Skeleton"
import { fileRoot, list, mkcol, upload, remove, move, download } from "./services/webdav"

const prettySize = (n) => (!n ? "" : n < 1024 ? `${n} b` : n < 1048576 ? `${(n / 1024).toFixed(0)} kb` : `${(n / 1048576).toFixed(1)} mb`)
const PREVIEWABLE = /^(image\/|application\/pdf|text\/)/

export default function Drive({ authHeader, onNavigate, onLogout, userEmail }) {
  const root = fileRoot(userEmail)
  const [path, setPath] = useState(root)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null) // status text
  const [confirmDelete, setConfirmDelete] = useState(null)
  const fileRef = useRef(null)

  const load = useCallback(async (p) => {
    setLoading(true); setError(null)
    try { setEntries(await list(authHeader, p)) }
    catch (err) { setError(String(err.message || err)) }
    finally { setLoading(false) }
  }, [authHeader])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(path) }, [load, path])
  useEffect(() => {
    const onRefresh = () => load(path)
    window.addEventListener("shortcut:refresh", onRefresh)
    return () => window.removeEventListener("shortcut:refresh", onRefresh)
  }, [load, path])

  // breadcrumb segments relative to the user's root
  const rel = decodeURIComponent(path.slice(root.length)).replace(/\/$/, "")
  const segments = rel ? rel.split("/") : []
  function goToSegment(i) {
    setPath(root + segments.slice(0, i + 1).map(encodeURIComponent).join("/") + "/")
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ""
    if (!file) return
    setBusy(`uploading ${file.name}…`)
    try { await upload(authHeader, path + encodeURIComponent(file.name), file); await load(path) }
    catch (err) { setError(String(err.message || err)) } finally { setBusy(null) }
  }
  async function newFolder() {
    const name = (window.prompt("folder name") || "").trim()
    if (!name) return
    try { await mkcol(authHeader, path + encodeURIComponent(name) + "/"); await load(path) }
    catch (err) { setError(String(err.message || err)) }
  }
  async function rename(entry) {
    const name = (window.prompt("rename", entry.name) || "").trim()
    if (!name || name === entry.name) return
    try { await move(authHeader, entry.href, path + encodeURIComponent(name) + (entry.isDir ? "/" : "")); await load(path) }
    catch (err) { setError(String(err.message || err)) }
  }
  async function del(entry) {
    try { await remove(authHeader, entry.href); setEntries((p) => p.filter((x) => x.href !== entry.href)); setConfirmDelete(null) }
    catch (err) { setError(String(err.message || err)) }
  }
  async function save(entry) {
    setBusy(`downloading ${entry.name}…`)
    try {
      const blob = await download(authHeader, entry.href)
      const url = URL.createObjectURL(blob); const a = document.createElement("a")
      a.href = url; a.download = entry.name; a.click(); URL.revokeObjectURL(url)
    } catch (err) { setError(String(err.message || err)) } finally { setBusy(null) }
  }
  async function preview(entry) {
    setBusy(`opening ${entry.name}…`)
    try {
      const blob = await download(authHeader, entry.href)
      window.open(URL.createObjectURL(blob), "_blank", "noopener")
    } catch (err) { setError(String(err.message || err)) } finally { setBusy(null) }
  }

  function activate(entry) {
    if (entry.isDir) setPath(entry.href.startsWith("/") ? entry.href : path + encodeURIComponent(entry.name) + "/")
    else if (PREVIEWABLE.test(entry.contentType)) preview(entry)
    else save(entry)
  }

  return (
    <Layout currentPage="drive" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex items-center justify-between border-b border-pkm-500 px-4 py-3">
          <h1 className="text-lg text-gold lowercase tracking-wide">drive</h1>
          <div className="flex items-center gap-2">
            <button onClick={newFolder} className="rounded-lg border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98] lowercase">new folder</button>
            <button onClick={() => fileRef.current?.click()} className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] lowercase">upload</button>
            <input ref={fileRef} type="file" onChange={handleUpload} className="hidden" />
          </div>
        </div>

        {/* breadcrumbs */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-pkm-500 px-4 py-2 text-xs lowercase">
          <button onClick={() => setPath(root)} className={`shrink-0 transition hover:text-sky ${segments.length ? "text-text-info" : "text-gold"}`}>home</button>
          {segments.map((s, i) => (
            <span key={i} className="flex shrink-0 items-center gap-1">
              <span className="text-text-info">/</span>
              <button onClick={() => goToSegment(i)} className={`transition hover:text-sky ${i === segments.length - 1 ? "text-gold" : "text-text-info"}`}>{s}</button>
            </span>
          ))}
          {busy && <span className="ml-auto shrink-0 text-text-info">{busy}</span>}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? <SkeletonList /> : error ? (
            <div className="p-4"><p className="text-sm text-danger lowercase">{error}</p>
              <button onClick={() => load(path)} className="mt-3 rounded-md border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase">retry</button></div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center"><p className="text-sm text-text-info lowercase">empty folder</p></div>
          ) : (
            <div className="divide-y divide-pkm-500">
              {entries.map((e) => (
                <div key={e.href} className="flex items-center justify-between gap-2 px-4 py-3 transition hover:bg-pkm-700/50">
                  <button onClick={() => activate(e)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="shrink-0">{e.isDir ? "📁" : "📄"}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-text-primary lowercase">{e.name}</span>
                      {!e.isDir && <span className="block text-[11px] text-text-info lowercase">{prettySize(e.size)}{e.modified ? ` · ${new Date(e.modified).toLocaleDateString()}` : ""}</span>}
                    </span>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    {!e.isDir && <button onClick={() => save(e)} className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase">download</button>}
                    <button onClick={() => rename(e)} className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase">rename</button>
                    <button onClick={() => setConfirmDelete(e)} className="rounded-md border border-danger-border px-2 py-1 text-xs text-danger transition hover:bg-danger-dim lowercase">delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pkm-900/80 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in" onClick={(ev) => ev.stopPropagation()}>
            <h3 className="mb-2 text-base text-gold lowercase tracking-wide">delete</h3>
            <p className="mb-5 text-sm text-text-info lowercase">delete <span className="text-text-primary">{confirmDelete.name}</span>{confirmDelete.isDir ? " and its contents" : ""}?</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-text-info transition hover:text-text-primary lowercase">cancel</button>
              <button onClick={() => del(confirmDelete)} className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98] lowercase">delete</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
