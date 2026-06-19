import { useState, useEffect } from "react"
import Layout from "./layout"
import { simpleloginService } from "./services/simplelogin"
import { Skeleton } from "./components/Skeleton"

export default function Aliases({ authHeader, onNavigate, onLogout, userEmail }) {
  const [aliases, setAliases] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setTab] = useState('aliases')

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await simpleloginService.listAliases(authHeader)
        setAliases(data.aliases || [])
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    load()
  }, [authHeader])

  const tabs = [
    { id: 'aliases', label: 'my aliases', icon: '📧' },
    { id: 'mailboxes', label: 'mailboxes', icon: '📥' },
    { id: 'domains', label: 'domains', icon: '🌐' },
    { id: 'activity', label: 'activity', icon: '📜' },
  ]

  return (
    <Layout currentPage="aliases" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      <div className="flex flex-1 flex-col bg-pkm-900 min-h-0">
        <div className="flex items-center justify-between p-6 border-b border-pkm-500">
          <h1 className="text-xl text-gold font-bold lowercase tracking-tighter">aliases</h1>
          <button className="bg-gold px-4 py-2 rounded-xl text-xs text-pkm-900 font-bold lowercase active:scale-95 transition shadow-lg shadow-gold/10">create alias</button>
        </div>
        <div className="flex border-b border-pkm-500 overflow-x-auto scrollbar-hide bg-pkm-800/50">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition ${activeTab === t.id ? 'text-gold border-b-2 border-gold bg-gold/5' : 'text-text-info hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
             <div className="grid gap-4">
               <Skeleton className="h-24 w-full rounded-3xl" /><Skeleton className="h-24 w-full rounded-3xl" />
             </div>
          ) : aliases.length === 0 ? (
             <div className="h-full flex items-center justify-center text-text-info lowercase italic opacity-50 animate-fade-in">no aliases found</div>
          ) : (
             <div className="grid gap-4 animate-fade-in">
               {aliases.map(a => (
                 <div key={a.id} className="p-6 bg-pkm-800 border border-pkm-500 rounded-[2rem] flex items-center justify-between transition hover:border-sky/50 group">
                   <div>
                     <p className="font-bold text-sm text-text-primary lowercase tracking-tight">{a.email}</p>
                     <p className="text-[10px] text-text-info lowercase mt-1">forwarding to: {a.mailbox?.email || 'primary'}</p>
                   </div>
                   <div className="flex items-center gap-4">
                     <button className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${a.enabled ? 'border-green-500/30 text-green-500 bg-green-500/5' : 'border-danger/30 text-danger bg-danger/5'}`}>
                       {a.enabled ? 'active' : 'disabled'}
                     </button>
                   </div>
                 </div>
               ))}
             </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
