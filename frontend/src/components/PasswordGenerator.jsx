import { useState, useMemo } from "react"
import { generate, entropyBits } from "../services/generator"

// advanced password / passphrase generator, surfaced as a modal. reusable:
// pass onUse to show an "insert" button (e.g. into a form field); always offers
// copy. all options map to services/generator.js (the single source of truth).

const DEFAULTS = {
  length: 20, lowercase: true, uppercase: true, numbers: true, symbols: true, avoidAmbiguous: true,
  passphrase: false, words: 5, wordSeparator: "-", capitalize: true, includeNumber: true,
}

function strengthLabel(bits) {
  if (bits < 40) return { label: "weak", color: "text-danger", bar: "bg-danger" }
  if (bits < 80) return { label: "fair", color: "text-sky", bar: "bg-sky" }
  return { label: "strong", color: "text-gold", bar: "bg-gold" }
}

function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition active:scale-[0.98] ${checked ? "bg-gold" : "bg-pkm-500"}`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-pkm-900 transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </button>
  )
}

function Opt({ label, children }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-text-primary lowercase">
      <span>{label}</span>{children}
    </label>
  )
}

export default function PasswordGenerator({ onUse, onClose }) {
  const [opts, setOpts] = useState(DEFAULTS)
  const [nonce, setNonce] = useState(0) // bumped by the ↻ button to re-roll
  const [copied, setCopied] = useState(false)

  // derive a value from options + nonce — regenerates only when those change
  // (not on every render), so no setState-in-effect.
  const value = useMemo(() => {
    try { return generate(opts) } catch { return "" }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts, nonce])
  const regen = () => setNonce((n) => n + 1)

  const set = (k, v) => setOpts((p) => ({ ...p, [k]: v }))
  const bits = (() => { try { return entropyBits(opts) } catch { return 0 } })()
  const strength = strengthLabel(bits)
  const noClass = !opts.passphrase && !opts.lowercase && !opts.uppercase && !opts.numbers && !opts.symbols

  function copy() {
    if (!value) return
    try { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* unavailable */ }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-pkm-900/80 p-4 pt-12"
      role="dialog" aria-modal="true" aria-label="password generator" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in my-8" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-base text-gold lowercase tracking-wide">generator</h2>

        {/* preview */}
        <div className="rounded-lg border border-pkm-500 bg-pkm-700 p-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all font-mono text-sm text-text-primary">{value || (noClass ? "select a character set" : "")}</code>
            <button type="button" onClick={regen} aria-label="regenerate" className="shrink-0 rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98]">↻</button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-pkm-500">
              <div className={`h-full ${strength.bar} transition-all`} style={{ width: `${Math.min(100, Math.round((bits / 128) * 100))}%` }} />
            </div>
            <span className={`text-[11px] lowercase ${strength.color}`}>{strength.label} · {bits} bits</span>
          </div>
        </div>

        {/* mode */}
        <div className="mt-4 flex gap-1 rounded-lg bg-pkm-700 p-1">
          {[{ v: false, l: "password" }, { v: true, l: "passphrase" }].map((m) => (
            <button key={m.l} type="button" onClick={() => set("passphrase", m.v)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs transition lowercase ${opts.passphrase === m.v ? "bg-gold text-pkm-900 font-semibold" : "text-text-info hover:text-text-primary"}`}>{m.l}</button>
          ))}
        </div>

        {/* options */}
        <div className="mt-4 space-y-3">
          {!opts.passphrase ? (
            <>
              <Opt label={`length: ${opts.length}`}>
                <input type="range" min="8" max="64" value={opts.length} onChange={(e) => set("length", Number(e.target.value))}
                  className="w-40" style={{ accentColor: "#f6b012" }} aria-label="length" />
              </Opt>
              <Opt label="uppercase (A-Z)"><Toggle checked={opts.uppercase} onChange={(v) => set("uppercase", v)} label="uppercase" /></Opt>
              <Opt label="lowercase (a-z)"><Toggle checked={opts.lowercase} onChange={(v) => set("lowercase", v)} label="lowercase" /></Opt>
              <Opt label="numbers (0-9)"><Toggle checked={opts.numbers} onChange={(v) => set("numbers", v)} label="numbers" /></Opt>
              <Opt label="symbols (!@#)"><Toggle checked={opts.symbols} onChange={(v) => set("symbols", v)} label="symbols" /></Opt>
              <Opt label="avoid ambiguous (l o 0 1 I O)"><Toggle checked={opts.avoidAmbiguous} onChange={(v) => set("avoidAmbiguous", v)} label="avoid ambiguous" /></Opt>
            </>
          ) : (
            <>
              <Opt label={`words: ${opts.words}`}>
                <input type="range" min="3" max="10" value={opts.words} onChange={(e) => set("words", Number(e.target.value))}
                  className="w-40" style={{ accentColor: "#f6b012" }} aria-label="word count" />
              </Opt>
              <Opt label="separator">
                <input type="text" value={opts.wordSeparator} maxLength={3} onChange={(e) => set("wordSeparator", e.target.value)}
                  className="w-16 rounded-md border border-pkm-500 bg-pkm-700 px-2 py-1 text-center text-sm text-text-primary outline-none focus:border-gold" aria-label="separator" />
              </Opt>
              <Opt label="capitalize words"><Toggle checked={opts.capitalize} onChange={(v) => set("capitalize", v)} label="capitalize" /></Opt>
              <Opt label="include a number"><Toggle checked={opts.includeNumber} onChange={(v) => set("includeNumber", v)} label="include number" /></Opt>
            </>
          )}
        </div>

        {/* actions */}
        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-pkm-500 px-4 py-2 text-sm text-text-info transition hover:text-text-primary lowercase">close</button>
          <button type="button" onClick={copy} disabled={!value} className="rounded-lg border border-sky px-4 py-2 text-sm text-sky transition hover:bg-sky-dim active:scale-[0.98] disabled:opacity-50 lowercase">{copied ? "copied" : "copy"}</button>
          {onUse && (
            <button type="button" onClick={() => value && onUse(value)} disabled={!value}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 lowercase">use</button>
          )}
        </div>
      </div>
    </div>
  )
}
