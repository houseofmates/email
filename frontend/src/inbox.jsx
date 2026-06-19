import { useState, useEffect } from "react"
import Layout from "./layout"
import { InboxSkeleton } from "./components/Skeleton"

export default function Inbox({ authHeader, userEmail, onLogout, onNavigate }) {
  const [loading, setLoading] = useState(true)
  const [emails, setEmails] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    setTimeout(() => {
      setEmails([
        { id: '1', subject: 'welcome to your secure suite', from: [{ name: 'mates team' }], preview: 'get started with secure mail and passwords...' }
      ])
      setLoading(false)
    }, 800)
  }, [])

  return (
    <Layout currentPage="inbox" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      <div className="flex flex-1 flex-col bg-pkm-900 min-h-0">
        <div className="p-4 border-b border-pkm-500 flex gap-4 bg-pkm-800/30">
          <input type="text" placeholder="search mail..." className="flex-1 bg-pkm-700 border border-pkm-500 rounded-xl px-4 py-2 text-sm outline-none focus:border-gold lowercase" />
          <button className="bg-gold px-6 py-2 rounded-xl text-xs text-pkm-900 font-bold lowercase active:scale-95 transition">compose</button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-80 border-r border-pkm-500 overflow-y-auto">
            {loading ? <InboxSkeleton /> : (
              <div className="divide-y divide-pkm-500">
                {emails.map(m => (
                  <button key={m.id} onClick={() => setSelectedId(m.id)}
                    className={`w-full px-6 py-6 text-left transition ${selectedId === m.id ? 'bg-gold/5 border-r-4 border-gold' : 'hover:bg-pkm-800'}`}>
                    <div className="text-[10px] text-text-info mb-1 uppercase font-black tracking-widest">{m.from[0].name}</div>
                    <div className="text-sm font-bold text-text-primary truncate lowercase tracking-tight">{m.subject}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 p-12 overflow-y-auto">
            {selectedId ? (
              <div className="animate-fade-in max-w-3xl">
                <h1 className="text-3xl text-text-primary lowercase font-bold tracking-tighter mb-8">{emails.find(e => e.id === selectedId)?.subject}</h1>
                <p className="text-text-primary font-sans leading-relaxed">{emails.find(e => e.id === selectedId)?.preview}</p>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-text-info lowercase italic opacity-50">select a message</div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
