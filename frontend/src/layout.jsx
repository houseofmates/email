import { useState } from "react"
import { useStore } from "./store"
import { Shortcuts, ShortcutsHelp } from "./components/Shortcuts"

export default function Layout({ children, currentPage, onNavigate, onLogout, userEmail }) {
  const { sidebarCollapsed, toggleSidebar } = useStore()
  const [showHelp, setShowHelp] = useState(false)

  const nav = [
    { id: 'inbox', label: 'inbox', icon: '📥' },
    { id: 'calendar', label: 'calendar', icon: '📅' },
    { id: 'passwords', label: 'passwords', icon: '🔑' },
    { id: 'aliases', label: 'aliases', icon: '📧' },
    { id: 'settings', label: 'settings', icon: '⚙️' },
  ]

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-pkm-900 text-text-primary font-varela">
      <Shortcuts onShortcut={(a) => a === 'help' && setShowHelp(true)} />
      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}

      <aside className={`flex flex-col border-r border-pkm-500 transition-all duration-500 ${sidebarCollapsed ? 'w-20' : 'w-72'}`}>
        <div className="flex h-16 items-center justify-between px-6 border-b border-pkm-500">
          {!sidebarCollapsed && <span className="text-gold font-bold tracking-tighter text-lg lowercase">email suite</span>}
          <button onClick={toggleSidebar} className="text-text-info hover:text-gold transition">
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>
        <nav className="flex-1 py-6 flex flex-col gap-2">
          {nav.map(item => (
            <button key={item.id} onClick={() => onNavigate(item.id)}
              className={`flex items-center gap-4 px-6 py-3.5 transition ${currentPage === item.id ? 'bg-gold/10 text-gold border-r-4 border-gold' : 'text-text-info hover:bg-pkm-800'} ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <span className="text-2xl shrink-0">{item.icon}</span>
              {!sidebarCollapsed && <span className="text-sm font-bold lowercase">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-6 border-t border-pkm-500">
          <div className={`flex items-center gap-4 overflow-hidden ${sidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="h-10 w-10 rounded-2xl bg-sky/20 flex items-center justify-center shrink-0 border border-sky/30">
              <span className="text-sm text-sky font-black">{userEmail?.charAt(0).toUpperCase()}</span>
            </div>
            {!sidebarCollapsed && <span className="text-xs text-text-info truncate lowercase">{userEmail}</span>}
          </div>
        </div>
      </aside>
      <main className="flex flex-1 flex-col overflow-hidden relative">{children}</main>
    </div>
  )
}
