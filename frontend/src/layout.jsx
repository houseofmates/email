const NAV_ITEMS = [
  { key: "inbox", label: "inbox" },
  { key: "mail", label: "mail" },
  { key: "calendar", label: "calendar" },
  { key: "contacts", label: "contacts" },
  { key: "passwords", label: "passwords" },
  { key: "aliases", label: "aliases" },
  { key: "settings", label: "settings" },
]

export default function Layout({ currentPage, onNavigate, onLogout, userEmail, children }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-pkm-900">
      {/* desktop header */}
      <header className="hidden md:flex items-center justify-between border-b border-pkm-500 px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg text-gold lowercase tracking-wide">email</h1>
          <span className="text-xs text-text-info lowercase">unified</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-info lowercase truncate max-w-[200px]">{userEmail}</span>
          <button onClick={onLogout}
            className="rounded-lg border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky active:scale-[0.98] lowercase">
            sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* desktop sidebar */}
        <nav className="hidden md:flex w-48 shrink-0 flex-col border-r border-pkm-500 p-3 gap-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => onNavigate?.(item.key)}
              className={`rounded-md px-3 py-2 text-left text-sm transition active:scale-[0.98] lowercase ${
                currentPage === item.key
                  ? "bg-pkm-600 text-gold font-semibold"
                  : "text-text-info hover:text-text-primary hover:bg-pkm-700/50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* main content */}
        <main className="flex flex-1 flex-col min-h-0">
          {children}
        </main>
      </div>

      {/* mobile bottom nav */}
      <nav className="flex md:hidden items-center justify-around border-t border-pkm-500 bg-pkm-800 px-2 py-1 safe-area-pb">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate?.(item.key)}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition active:scale-[0.98] min-w-[56px] lowercase ${
              currentPage === item.key
                ? "text-gold"
                : "text-text-info"
            }`}
            aria-label={item.label}
          >
            <span className="text-xs font-semibold">{item.label}</span>
            {currentPage === item.key && <span className="h-0.5 w-4 rounded-full bg-gold" />}
          </button>
        ))}
      </nav>
    </div>
  )
}

// add safe area padding for notched phones
const style = document.createElement("style")
style.textContent = `
  .safe-area-pb {
    padding-bottom: max(env(safe-area-inset-bottom, 0px), 8px);
  }
`
document.head?.appendChild(style)