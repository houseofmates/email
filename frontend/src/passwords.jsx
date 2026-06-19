import { useState, useMemo } from "react"
import Layout from "./layout"
import { TypeSelector } from "./components/TypeSelector"
import { vaultwardenService } from "./services/vaultwarden"

const TYPES = [
  { key: "login", label: "logins", icon: "🔑" },
  { key: "note", label: "notes", icon: "📝" },
  { key: "card", label: "cards", icon: "💳" },
  { key: "identity", label: "identities", icon: "👤" },
]

export default function Passwords({ authHeader, onNavigate, onLogout, userEmail }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [masterPw, setMasterPw] = useState("")
  const [type, setType] = useState('login')
  const [query, setQuery] = useState("")

  const unlock = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const data = await vaultwardenService.fetchVault(masterPw, authHeader)
      setItems(data.items || []); setUnlocked(true);
    } catch (err) { alert("failed to unlock: verify master password") } finally { setLoading(false) }
  }

  const filtered = useMemo(() => {
    return items.filter(i => {
      const tMatch = i.type === type;
      const qMatch = !query || i.name?.toLowerCase().includes(query.toLowerCase());
      return tMatch && qMatch;
    })
  }, [items, type, query])

  if (!unlocked) return (
    <Layout currentPage="passwords" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      <div className="flex flex-1 items-center justify-center p-4 bg-pkm-900">
        <div className="bg-pkm-800 p-10 rounded-[2.5rem] border border-pkm-500 w-full max-w-sm shadow-2xl animate-fade-in">
          <div className="text-4xl mb-8 text-center">🔐</div>
          <h2 className="text-gold font-bold text-center text-xl mb-8 tracking-tighter lowercase">vault locked</h2>
          <form onSubmit={unlock} className="flex flex-col gap-6">
            <input type="password" placeholder="master password" value={masterPw} onChange={e=>setMasterPw(e.target.value)}
              className="w-full bg-pkm-700 border border-pkm-500 rounded-2xl p-4 text-sm outline-none focus:border-gold lowercase" />
            <button className="w-full bg-gold p-4 rounded-2xl text-pkm-900 font-black lowercase active:scale-95 transition">unlock vault</button>
          </form>
          <div className="mt-10 p-4 bg-gold/5 border border-gold/10 rounded-2xl">
            <p className="text-[10px] text-gold/50 text-center leading-relaxed lowercase">
              master password is sent to your bridge for decryption. ensure https and trust your network.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  )

  return (
    <Layout currentPage="passwords" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      <div className="flex flex-1 flex-col bg-pkm-900">
        <div className="flex items-center justify-between p-6 border-b border-pkm-500">
          <h1 className="text-xl text-gold font-bold lowercase tracking-tighter">passwords</h1>
          <div className="flex gap-2">
            <button className="bg-pkm-800 border border-pkm-500 px-4 py-2 rounded-xl text-xs text-text-info lowercase">import</button>
            <button className="bg-gold px-4 py-2 rounded-xl text-xs text-pkm-900 font-bold lowercase">add item</button>
          </div>
        </div>
        <div className="px-6 py-4 border-b border-pkm-500">
          <input type="text" placeholder="search passwords..." value={query} onChange={e=>setQuery(e.target.value)}
            className="w-full bg-pkm-800 border border-pkm-500 rounded-xl px-4 py-2 text-sm outline-none focus:border-gold lowercase" />
        </div>
        <TypeSelector types={TYPES} active={type} onSelect={setType} />
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="h-full flex items-center justify-center text-text-info lowercase italic opacity-50">your vault is empty</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
              {filtered.map(i => (
                <div key={i.id} className="p-6 bg-pkm-800 border border-pkm-500 rounded-[2rem] transition hover:border-gold">
                   <div className="flex justify-between mb-4">
                     <span className="text-2xl">{TYPES.find(t=>t.key===i.type)?.icon}</span>
                     <span className="text-[10px] font-bold uppercase tracking-widest text-text-info">details</span>
                   </div>
                   <p className="font-bold text-sm text-text-primary lowercase truncate">{i.name}</p>
                   <p className="text-xs text-text-info lowercase mt-1 truncate">{i.username || i.site}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
