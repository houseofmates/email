import { useState, useEffect } from "react"
import { Shortcuts, ShortcutsHelp } from "./components/Shortcuts"

export default function Layout({ children, currentPage, onNavigate, onLogout, userEmail }) {
  const [collapsed, setCollapsed] = useState(localStorage.getItem('sidebar_collapsed') === 'true')
  const [showShortcuts, setShowShortcuts] = useState(false)

  const toggleSidebar = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar_collapsed', String(next))
  }

  const handleShortcut = (action) => {
    if (action === 'show-help') setShowShortcuts(true)
  }

  const nav = [
    { id: 'inbox', label: 'inbox', icon: '📥' },
    { id: 'calendar', label: 'calendar', icon: '📅' },
    { id: 'passwords', label: 'passwords', icon: '🔑' },
    { id: 'aliases', label: 'aliases', icon: '📧' },
    { id: 'settings', label: 'settings', icon: '⚙️' },
  ]

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-pkm-900 text-text-primary font-varela">
      <Shortcuts onShortcut={handleShortcut} />
      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}

      <aside className={`flex flex-col border-r border-pkm-500 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
        <div className="flex h-14 items-center justify-between px-4 border-b border-pkm-500">
          {!collapsed && <span className="text-gold font-bold tracking-tight lowercase">email</span>}
          <button onClick={toggleSidebar} className="text-text-info hover:text-gold transition-colors">
            {collapsed ? '→' : '←'}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          {nav.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 transition-colors ${
                currentPage === item.id ? 'bg-gold/10 text-gold border-r-2 border-gold' : 'text-text-info hover:bg-pkm-800'
              }`}
            >
              <span className="text-xl shrink-0">{item.icon}</span>
              {!collapsed && <span className="text-sm lowercase truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-pkm-500">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-8 w-8 rounded-full bg-sky/20 flex items-center justify-center shrink-0">
              <span className="text-xs text-sky font-bold uppercase">{userEmail.charAt(0)}</span>
            </div>
            {!collapsed && <span className="text-xs text-text-info truncate lowercase">{userEmail}</span>}
          </div>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden relative">
        {children}
      </main>
    </div>
  )
}
