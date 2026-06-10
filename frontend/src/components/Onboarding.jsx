import { useState } from "react"

// first-run wizard. shown once (gated on settings.onboarded in App). calm,
// skippable, a few steps that orient the user and point at the next action.

const STEPS = [
  {
    title: "welcome",
    body: "this is your unified suite — mail, calendar, contacts, drive, passwords and aliases, all on your own infrastructure. a quick tour:",
    points: ["everything stays on your server", "one sign-in across every view", "nothing phones home"],
  },
  {
    title: "your vault",
    body: "passwords live in a single encrypted file on your server (aes-256-gcm, argon2id). on first open you'll set a master password — it's never stored and can't be recovered, so keep it safe.",
    points: ["import from bitwarden / 1password / csv", "built-in generator + breach check", "auto-locks when idle"],
    action: { label: "open passwords", page: "passwords" },
  },
  {
    title: "mail & aliases",
    body: "search with operators (from: subject: has:attachment), build server-side filters and an auto-responder in settings, and generate email aliases to protect your real address.",
    points: ["undo-send + signatures", "visual sieve rule builder", "simplelogin aliases (optional)"],
    action: { label: "open inbox", page: "inbox" },
  },
  {
    title: "you're set",
    body: "press ? anytime for keyboard shortcuts. tweak theme, notifications and more in settings. enjoy.",
    points: ["g then i / c / p — jump around", "/ to search, u to refresh", "everything is tucked in settings"],
  },
]

export default function Onboarding({ onNavigate, onDone }) {
  const [i, setI] = useState(0)
  const step = STEPS[i]
  const last = i === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-pkm-900/85 p-4" role="dialog" aria-modal="true" aria-label="getting started">
      <div className="w-full max-w-md rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base text-gold lowercase tracking-wide">{step.title}</h2>
          <button onClick={onDone} className="text-xs text-text-info transition hover:text-sky lowercase">skip</button>
        </div>

        <p className="text-sm text-text-primary lowercase leading-relaxed">{step.body}</p>
        <ul className="mt-3 space-y-1.5">
          {step.points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-xs text-text-info lowercase">
              <span className="mt-0.5 text-gold">›</span><span>{p}</span>
            </li>
          ))}
        </ul>

        {step.action && (
          <button onClick={() => { onNavigate?.(step.action.page); onDone() }}
            className="mt-4 rounded-lg border border-sky px-3 py-1.5 text-xs text-sky transition hover:bg-sky-dim active:scale-[0.98] lowercase">
            {step.action.label} →
          </button>
        )}

        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, n) => <span key={n} className={`h-1.5 w-1.5 rounded-full transition ${n === i ? "bg-gold" : "bg-pkm-500"}`} />)}
          </div>
          <div className="flex items-center gap-2">
            {i > 0 && <button onClick={() => setI((n) => n - 1)} className="rounded-lg border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:text-text-primary lowercase">back</button>}
            <button onClick={() => (last ? onDone() : setI((n) => n + 1))}
              className="rounded-lg bg-gold px-4 py-1.5 text-xs font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] lowercase">
              {last ? "get started" : "next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
