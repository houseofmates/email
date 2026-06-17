import { useState } from "react"
import { Shortcuts, ShortcutsHelp } from "./components/Shortcuts"

export default function Layout({ children, currentPage, onNavigate, onLogout, userEmail }) {
  const [collapsed, setCollapsed] = useState(localStorage.getItem('sidebar_collapsed') === 'true')
  const [showShortcuts, setShowShortcuts] = useState(false)

  const nav = [
    { id: 'inbox', label: 'inbox', icon: '📥' },
    { id: 'calendar', label: 'calendar', icon: '📅' },
    { id: 'passwords', label: 'passwords', icon: '🔑' },
    { id: 'aliases', label: 'aliases', icon: '📧' },
    { id: 'settings', label: 'settings', icon: '⚙️' },
  ]

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-pkm-900 text-text-primary">
      <Shortcuts onShortcut={(a) => a === 'show-help' && setShowShortcuts(true)} />
      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}
      <aside className={`flex flex-col border-r border-pkm-500 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
        <div className="flex h-14 items-center justify-between px-4 border-b border-pkm-500">
          {!collapsed && <span className="text-gold font-bold lowercase">email</span>}
          <button onClick={() => { setCollapsed(!collapsed); localStorage.setItem('sidebar_collapsed', !collapsed) }} className="text-text-info">
            {collapsed ? '→' : '←'}
          </button>
        </div>
        <nav className="flex-1 py-4">
          {nav.map(item => (
            <button key={item.id} onClick={() => onNavigate(item.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 ${currentPage === item.id ? 'bg-gold/10 text-gold border-r-2 border-gold' : 'text-text-info'}`}>
              <span className="text-xl">{item.icon}</span>
              {!collapsed && <span className="text-sm lowercase">{item.label}</span>}
            </button>
          ))}
        </nav>
      </aside>
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  )
}
