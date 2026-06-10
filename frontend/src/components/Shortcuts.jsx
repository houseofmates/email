import { useEffect, useState, useCallback } from "react"

// global keyboard shortcuts + a "?" cheat sheet.
//
// gmail-style. mounted once (App.jsx) while authed. only lists shortcuts that
// actually do something today; list-selection actions (j/k navigate, # delete,
// c compose) arrive with each vertical's selection model and get added to the
// sheet then, so nothing here is a dead key.
//
// event contract for the verticals: pressing "u" dispatches a window
// CustomEvent "shortcut:refresh" — any page can listen and reload. (passwords
// and aliases already do.)

const GO_TO = {
  i: { page: "inbox", label: "inbox" },
  m: { page: "mail", label: "mail" },
  c: { page: "calendar", label: "calendar" },
  p: { page: "passwords", label: "passwords" },
  a: { page: "aliases", label: "aliases" },
  s: { page: "settings", label: "settings" },
}

// the sheet content (grouped). keep keys lowercase to match the aesthetic.
const GROUPS = [
  {
    title: "go to",
    items: [
      { keys: ["g", "i"], desc: "inbox" },
      { keys: ["g", "m"], desc: "mail" },
      { keys: ["g", "c"], desc: "calendar" },
      { keys: ["g", "p"], desc: "passwords" },
      { keys: ["g", "a"], desc: "aliases" },
      { keys: ["g", "s"], desc: "settings" },
    ],
  },
  {
    title: "actions",
    items: [
      { keys: ["/"], desc: "focus search" },
      { keys: ["u"], desc: "refresh list" },
      { keys: ["?"], desc: "toggle this cheat sheet" },
      { keys: ["esc"], desc: "close dialogs" },
    ],
  },
]

// is the user currently typing somewhere we must not hijack?
function isEditable(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable
}

export default function Shortcuts({ onNavigate }) {
  const [open, setOpen] = useState(false)

  const navigate = useCallback((page) => { onNavigate?.(page) }, [onNavigate])

  useEffect(() => {
    let pendingG = false
    let pendingTimer = null

    function clearPending() {
      pendingG = false
      if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null }
    }

    function onKey(e) {
      // never interfere with browser/system chords
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // escape closes the sheet wherever focus is
      if (e.key === "Escape") { if (open) { setOpen(false); clearPending() } return }

      // while typing, only "?" outside of editable matters; bail otherwise
      if (isEditable(e.target)) return

      // "?" toggles the cheat sheet
      if (e.key === "?") { e.preventDefault(); setOpen((v) => !v); clearPending(); return }

      // when the sheet is open, swallow other keys (esc/"?" handled above)
      if (open) return

      // go-to sequences: "g" then a destination key
      if (pendingG) {
        const dest = GO_TO[e.key]
        clearPending()
        if (dest) { e.preventDefault(); navigate(dest.page) }
        return
      }
      if (e.key === "g") {
        pendingG = true
        pendingTimer = setTimeout(clearPending, 1500)
        e.preventDefault()
        return
      }

      // single-key actions
      if (e.key === "/") {
        const search = document.querySelector('input[placeholder^="search"]')
        if (search) { e.preventDefault(); search.focus() }
        return
      }
      if (e.key === "u") {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent("shortcut:refresh"))
        return
      }
    }

    window.addEventListener("keydown", onKey)
    return () => { window.removeEventListener("keydown", onKey); clearPending() }
  }, [open, navigate])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-pkm-900/80 p-4"
      role="dialog" aria-modal="true" aria-label="keyboard shortcuts" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-xl border border-pkm-500 bg-pkm-800 p-6 animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base text-gold lowercase tracking-wide">keyboard shortcuts</h2>
          <button onClick={() => setOpen(false)} aria-label="close"
            className="rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98] lowercase min-h-[36px]">
            esc
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-xs text-text-info uppercase tracking-wider">{g.title}</h3>
              <ul className="space-y-2">
                {g.items.map((it) => (
                  <li key={it.desc} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-text-primary lowercase">{it.desc}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {it.keys.map((k, i) => (
                        <kbd key={i}
                          className="rounded border border-pkm-500 bg-pkm-700 px-2 py-0.5 font-mono text-[11px] text-text-primary">
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs text-text-info lowercase">press <kbd className="rounded border border-pkm-500 bg-pkm-700 px-1.5 py-0.5 font-mono">?</kbd> any time to open this.</p>
      </div>
    </div>
  )
}
