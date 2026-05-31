import { useState } from "react"

const mails = [
  { id: 1, from: "alice@example.com", subject: "meeting tomorrow", preview: "hey, just confirming we're on for 10am..." },
  { id: 2, from: "bob@corp.net", subject: "q3 numbers", preview: "attached are the latest quarterly figures..." },
  { id: 3, from: "carol@hello.org", subject: "lunch?", preview: "want to grab something around noon?" },
  { id: 4, from: "dan@dev.io", subject: "pr review", preview: "could you take a look at the draft when you get a chance?" },
]

export default function Dashboard({ onLogout, onNavigate }) {
  const [selected, setSelected] = useState(null)
  const active = mails.find((m) => m.id === selected)

  return (
    <div className="flex min-h-screen flex-col bg-pkm-900">
      {/* header */}
      <header className="flex items-center justify-between border-b border-pkm-500 px-6 py-3">
        <h1 className="text-lg text-gold lowercase tracking-wide">email</h1>
        <button
          onClick={onLogout}
          className="rounded-lg border border-pkm-500 px-4 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase"
        >
          sign out
        </button>
      </header>

      {/* body */}
      <div className="flex flex-1">
        {/* sidebar */}
        <aside className="w-72 shrink-0 border-r border-pkm-500 p-4">
          <button className="mb-4 w-full rounded-lg bg-sky px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] lowercase">
            compose
          </button>

          <nav className="flex flex-col gap-1">
            <span className="rounded-md bg-pkm-600 px-3 py-2 text-sm text-text-primary lowercase">inbox</span>
            <span className="rounded-md px-3 py-2 text-sm text-text-info transition hover:text-text-primary cursor-pointer lowercase">sent</span>
            <span className="rounded-md px-3 py-2 text-sm text-text-info transition hover:text-text-primary cursor-pointer lowercase">drafts</span>
            <span className="rounded-md px-3 py-2 text-sm text-text-info transition hover:text-text-primary cursor-pointer lowercase">archive</span>
            <span className="rounded-md px-3 py-2 text-sm text-text-info transition hover:text-text-primary cursor-pointer lowercase">trash</span>
            <span
              onClick={() => onNavigate?.("aliases")}
              className="rounded-md px-3 py-2 text-sm text-text-info transition hover:text-text-primary cursor-pointer lowercase"
            >
              aliases
            </span>
            <span
              onClick={() => onNavigate?.("identities")}
              className="rounded-md px-3 py-2 text-sm text-text-info transition hover:text-text-primary cursor-pointer lowercase"
            >
              identities
            </span>
            <span
              onClick={() => onNavigate?.("passwords")}
              className="rounded-md px-3 py-2 text-sm text-text-info transition hover:text-text-primary cursor-pointer lowercase"
            >
              passwords
            </span>
            <span
              onClick={() => onNavigate?.("calendar")}
              className="rounded-md px-3 py-2 text-sm text-text-info transition hover:text-text-primary cursor-pointer lowercase"
            >
              calendar
            </span>
          </nav>
        </aside>

        {/* list */}
        <div className="w-80 shrink-0 border-r border-pkm-500 overflow-y-auto">
          {mails.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelected(m.id)}
              className={`w-full border-b border-pkm-500 px-4 py-3 text-left transition hover:bg-pkm-700 ${
                selected === m.id ? "bg-pkm-700" : ""
              }`}
            >
              <p className="text-sm text-text-primary lowercase truncate">{m.from}</p>
              <p className="mt-0.5 text-sm text-text-primary lowercase truncate">{m.subject}</p>
              <p className="mt-0.5 text-xs text-text-info lowercase truncate">{m.preview}</p>
            </button>
          ))}
        </div>

        {/* preview pane */}
        <div className="flex-1 p-6">
          {active ? (
            <div>
              <p className="text-xs text-text-info lowercase">from: {active.from}</p>
              <h2 className="mt-2 text-lg text-text-primary lowercase">{active.subject}</h2>
              <p className="mt-4 text-sm text-text-info lowercase leading-relaxed">{active.preview}</p>
            </div>
          ) : (
            <p className="text-sm text-text-info lowercase">select a message to read</p>
          )}
        </div>
      </div>
    </div>
  )
}
