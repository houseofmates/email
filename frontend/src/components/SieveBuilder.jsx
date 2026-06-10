import { useState, useEffect, useMemo, useCallback } from "react"
import { buildScript } from "../services/sieve"
import { listSieveScripts, saveSieveScript } from "../jmap"

// visual sieve rule builder + vacation auto-responder. the structured rule
// model is kept in localStorage (sieve scripts on the server are plain text);
// the generated script is what's pushed to stalwart over jmap. always
// copy/downloadable so it works even if the server push isn't available.

const RULES_KEY = "sieve_rules"
const FIELDS = ["from", "to", "cc", "subject", "body", "attachment", "size"]
const OPS = [["contains", "contains"], ["is", "is"], ["matches", "matches"], ["not_contains", "does not contain"]]
const ACTIONS = [
  ["fileinto", "move to folder"], ["flag", "add flag"], ["forward", "forward to"],
  ["reject", "reject with"], ["discard", "discard"], ["keep", "keep"], ["stop", "stop"],
]
const ACTION_NEEDS_VALUE = { fileinto: "folder", flag: "\\Seen", forward: "email", reject: "reason" }

const newCondition = () => ({ field: "from", op: "contains", value: "" })
const newRule = () => ({ id: crypto.randomUUID(), name: "", match: "all", conditions: [newCondition()], actions: [{ type: "fileinto", value: "" }], stop: false })

function load() {
  try { return JSON.parse(localStorage.getItem(RULES_KEY)) || { rules: [], vacation: { enabled: false, subject: "", message: "", days: 7 } } }
  catch { return { rules: [], vacation: { enabled: false, subject: "", message: "", days: 7 } } }
}

const sel = "rounded-md border border-pkm-500 bg-pkm-700 px-2 py-1.5 text-xs text-text-primary outline-none focus:border-gold lowercase"
const inp = "rounded-md border border-pkm-500 bg-pkm-700 px-2 py-1.5 text-xs text-text-primary placeholder:text-text-info outline-none focus:border-gold lowercase"

export default function SieveBuilder({ authHeader }) {
  const [state, setState] = useState(load)
  const [scriptId, setScriptId] = useState(null)
  const [msg, setMsg] = useState(null)
  const [saving, setSaving] = useState(false)

  const { rules, vacation } = state
  const script = useMemo(() => buildScript(rules, vacation), [rules, vacation])

  const persist = useCallback((next) => {
    setState(next)
    try { localStorage.setItem(RULES_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }, [])

  // find the active server script so save updates it instead of creating dupes
  useEffect(() => {
    let cancelled = false
    listSieveScripts(authHeader)
      .then((list) => { if (!cancelled) setScriptId((list.find((s) => s.isActive) || list.find((s) => s.name === "filters") || {}).id || null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [authHeader])

  const setRules = (rs) => persist({ ...state, rules: rs })
  const setVacation = (v) => persist({ ...state, vacation: { ...vacation, ...v } })
  const updateRule = (id, patch) => setRules(rules.map((r) => r.id === id ? { ...r, ...patch } : r))

  async function save() {
    setSaving(true); setMsg(null)
    try {
      await saveSieveScript(authHeader, { name: "filters", content: script, scriptId })
      setMsg({ kind: "ok", text: "rules saved + activated on the server" })
    } catch (err) {
      setMsg({ kind: "err", text: `${err.message || err} — you can still copy/download the script below` })
    } finally { setSaving(false) }
  }
  function copy() { navigator.clipboard?.writeText(script); setMsg({ kind: "ok", text: "script copied" }) }
  function downloadScript() {
    const blob = new Blob([script], { type: "application/sieve" })
    const url = URL.createObjectURL(blob); const a = document.createElement("a")
    a.href = url; a.download = "filters.sieve"; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* rules */}
      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="rounded-lg border border-pkm-500 bg-pkm-700 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input value={rule.name} onChange={(e) => updateRule(rule.id, { name: e.target.value })} placeholder="rule name" className={`flex-1 ${inp}`} />
              <button onClick={() => setRules(rules.filter((r) => r.id !== rule.id))} className="rounded-md border border-danger-border px-2 py-1 text-xs text-danger transition hover:bg-danger-dim lowercase">remove</button>
            </div>

            <div className="flex items-center gap-2 text-xs text-text-info lowercase">
              <span>match</span>
              <select value={rule.match} onChange={(e) => updateRule(rule.id, { match: e.target.value })} className={sel}>
                <option value="all">all</option><option value="any">any</option>
              </select>
              <span>of:</span>
            </div>

            {/* conditions */}
            {rule.conditions.map((c, ci) => (
              <div key={ci} className="flex flex-wrap items-center gap-2">
                <select value={c.field} onChange={(e) => updateRule(rule.id, { conditions: rule.conditions.map((x, i) => i === ci ? { ...x, field: e.target.value } : x) })} className={sel}>
                  {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                {c.field !== "attachment" && (
                  <select value={c.op} onChange={(e) => updateRule(rule.id, { conditions: rule.conditions.map((x, i) => i === ci ? { ...x, op: e.target.value } : x) })} className={sel}>
                    {OPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                )}
                {c.field !== "attachment" && (
                  <input value={c.value} onChange={(e) => updateRule(rule.id, { conditions: rule.conditions.map((x, i) => i === ci ? { ...x, value: e.target.value } : x) })}
                    placeholder={c.field === "size" ? "e.g. 5M" : "value"} className={`flex-1 ${inp}`} />
                )}
                {rule.conditions.length > 1 && (
                  <button onClick={() => updateRule(rule.id, { conditions: rule.conditions.filter((_, i) => i !== ci) })} className="text-xs text-danger lowercase">×</button>
                )}
              </div>
            ))}
            <button onClick={() => updateRule(rule.id, { conditions: [...rule.conditions, newCondition()] })} className="text-xs text-sky underline lowercase">+ condition</button>

            {/* actions */}
            <div className="border-t border-pkm-500 pt-2 text-xs text-text-info lowercase">then:</div>
            {rule.actions.map((a, ai) => (
              <div key={ai} className="flex flex-wrap items-center gap-2">
                <select value={a.type} onChange={(e) => updateRule(rule.id, { actions: rule.actions.map((x, i) => i === ai ? { type: e.target.value, value: ACTION_NEEDS_VALUE[e.target.value] && e.target.value === "flag" ? "\\Seen" : "" } : x) })} className={sel}>
                  {ACTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {ACTION_NEEDS_VALUE[a.type] && (
                  <input value={a.value} onChange={(e) => updateRule(rule.id, { actions: rule.actions.map((x, i) => i === ai ? { ...x, value: e.target.value } : x) })}
                    placeholder={ACTION_NEEDS_VALUE[a.type]} className={`flex-1 ${inp}`} />
                )}
                {rule.actions.length > 1 && (
                  <button onClick={() => updateRule(rule.id, { actions: rule.actions.filter((_, i) => i !== ai) })} className="text-xs text-danger lowercase">×</button>
                )}
              </div>
            ))}
            <button onClick={() => updateRule(rule.id, { actions: [...rule.actions, { type: "keep", value: "" }] })} className="text-xs text-sky underline lowercase">+ action</button>

            <label className="flex items-center gap-2 text-xs text-text-info lowercase">
              <input type="checkbox" checked={rule.stop} onChange={(e) => updateRule(rule.id, { stop: e.target.checked })} />
              stop processing further rules if this matches
            </label>
          </div>
        ))}
        <button onClick={() => setRules([...rules, newRule()])} className="rounded-lg border border-dashed border-pkm-500 px-3 py-2 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase w-full">+ add rule</button>
      </div>

      {/* vacation */}
      <div className="rounded-lg border border-pkm-500 bg-pkm-700 p-3 space-y-2">
        <label className="flex items-center justify-between text-sm text-text-primary lowercase">
          auto-responder (vacation)
          <input type="checkbox" checked={vacation.enabled} onChange={(e) => setVacation({ enabled: e.target.checked })} />
        </label>
        {vacation.enabled && (
          <div className="space-y-2">
            <input value={vacation.subject} onChange={(e) => setVacation({ subject: e.target.value })} placeholder="subject" className={`w-full ${inp}`} />
            <textarea value={vacation.message} onChange={(e) => setVacation({ message: e.target.value })} placeholder="message" rows={3} className={`w-full resize-none ${inp}`} />
            <label className="flex items-center gap-2 text-xs text-text-info lowercase">re-send at most every
              <input type="number" min="1" value={vacation.days} onChange={(e) => setVacation({ days: Number(e.target.value) })} className={`w-16 ${inp}`} /> days
            </label>
          </div>
        )}
      </div>

      {/* preview + actions */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-text-info uppercase tracking-wider">generated sieve</span>
          <div className="flex gap-2">
            <button onClick={copy} className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase">copy</button>
            <button onClick={downloadScript} className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase">download</button>
            <button onClick={save} disabled={saving} className="rounded-md bg-gold px-3 py-1 text-xs font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 lowercase">{saving ? "saving…" : "save to server"}</button>
          </div>
        </div>
        <pre className="overflow-x-auto rounded-lg bg-pkm-900 p-3 text-[11px] text-text-primary whitespace-pre-wrap">{script}</pre>
        {msg && <p className={`mt-1 text-xs lowercase ${msg.kind === "err" ? "text-danger" : "text-gold"}`}>{msg.text}</p>}
      </div>
    </div>
  )
}
