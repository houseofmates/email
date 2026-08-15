import { useState, useMemo } from "react"
import { auditVault, checkBreaches } from "../services/security"

// vault health: weak + reused passwords (instant, local) and an on-demand
// breached-password check via the bridge's hibp range proxy. clicking an entry
// opens it for editing.

function Stat({ label, value, tone }) {
  const color = tone === "bad" ? "text-danger" : tone === "warn" ? "text-sky" : "text-gold"
  return (
    <div className="flex-1 rounded-lg border border-pkm-500 bg-pkm-700 p-3 text-center">
      <p className={`text-2xl ${color}`}>{value}</p>
      <p className="text-[11px] text-text-info lowercase">{label}</p>
    </div>
  )
}

function EntryRow({ name, meta, tone, onClick }) {
  const color = tone === "bad" ? "text-danger" : "text-sky"
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left transition hover:bg-pkm-700 lowercase">
      <span className="text-sm text-text-primary truncate">{name || "untitled"}</span>
      <span className={`shrink-0 text-[11px] ${color}`}>{meta}</span>
    </button>
  )
}

export default function SecurityDashboard({ items, authHeader, hibpRange, onOpenItem, onClose }) {
  const audit = useMemo(() => auditVault(items), [items])
  const [breaches, setBreaches] = useState(null) // Map<password,count> | null
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState(null)

  async function runBreachCheck() {
    setChecking(true); setError(null)
    try {
      setBreaches(await checkBreaches(items, (prefix) => hibpRange(authHeader, prefix)))
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setChecking(false)
    }
  }

  const breachedItems = breaches
    ? (items || []).filter((i) => i.password && (breaches.get(i.password) || 0) > 0)
    : []

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-pkm-900/80 p-4 pt-12"
      role="dialog" aria-modal="true" aria-label="security dashboard" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in my-8" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base text-gold lowercase tracking-wide">vault health</h2>
          <button onClick={onClose} className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase min-h-[36px]">close</button>
        </div>

        <div className="flex gap-2">
          <Stat label="logins" value={audit.counts.total} />
          <Stat label="weak" value={audit.counts.weak} tone={audit.counts.weak ? "bad" : "ok"} />
          <Stat label="reused" value={audit.counts.reused} tone={audit.counts.reused ? "warn" : "ok"} />
          <Stat label="breached" value={breaches ? breachedItems.length : "—"} tone={breachedItems.length ? "bad" : "ok"} />
        </div>

        {/* weak */}
        {audit.weak.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1 text-xs text-text-info uppercase tracking-wider">weak passwords</h3>
            <div className="rounded-lg border border-pkm-500">
              {audit.weak.map((w) => (
                <EntryRow key={w.item.id} name={w.item.name} meta={`${w.bits} bits`} tone="bad" onClick={() => onOpenItem(w.item)} />
              ))}
            </div>
          </div>
        )}

        {/* reused */}
        {audit.reused.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1 text-xs text-text-info uppercase tracking-wider">reused passwords</h3>
            <div className="space-y-2">
              {audit.reused.map((group, gi) => (
                <div key={gi} className="rounded-lg border border-pkm-500">
                  <p className="px-3 py-1 text-[11px] text-text-info lowercase">used by {group.length} items</p>
                  {group.map((it) => <EntryRow key={it.id} name={it.name} meta={it.username || ""} tone="warn" onClick={() => onOpenItem(it)} />)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* breached */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs text-text-info uppercase tracking-wider">breached passwords</h3>
            <button onClick={runBreachCheck} disabled={checking || !audit.counts.total}
              className="rounded-md border border-sky px-3 py-1.5 text-xs text-sky transition hover:bg-sky-dim active:scale-[0.98] disabled:opacity-50 lowercase">
              {checking ? "checking…" : breaches ? "re-check" : "check breaches"}
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-danger lowercase">{error}</p>}
          {breaches && breachedItems.length === 0 && !error && (
            <p className="mt-2 text-xs text-gold lowercase">no breached passwords found 🎉</p>
          )}
          {breachedItems.length > 0 && (
            <div className="mt-2 rounded-lg border border-danger-border">
              {breachedItems.map((it) => (
                <EntryRow key={it.id} name={it.name} meta={`seen ${breaches.get(it.password).toLocaleString()}×`} tone="bad" onClick={() => onOpenItem(it)} />
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-text-info lowercase leading-relaxed">
            only a 5-character hash prefix is sent (via your bridge) — your passwords never leave the server.
          </p>
        </div>

        {audit.counts.total === 0 && <p className="mt-4 text-sm text-text-info lowercase">no logins to analyze yet.</p>}
      </div>
    </div>
  )
}
