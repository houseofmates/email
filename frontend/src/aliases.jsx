import { useState, useEffect } from "react"
import Layout from "./layout"
import { simpleloginService } from "./services/simplelogin"
import { Skeleton } from "./components/Skeleton"

export default function Aliases(props) {
  const [aliases, setAliases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('aliases');

  const fetchAliases = () => {
    setLoading(true);
    simpleloginService.listAliases(props.authHeader).then(d => {
      setAliases(d.aliases || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchAliases(); }, [props.authHeader]);

  const toggleAlias = async (id) => {
    // Mock toggle logic
    setAliases(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const tabs = [ { id: 'aliases', label: 'aliases', icon: '📧' }, { id: 'mailboxes', label: 'mailboxes', icon: '📥' }, { id: 'domains', label: 'domains', icon: '🌐' } ]

  return (
    <Layout {...props} currentPage="aliases">
      <div className="flex flex-1 flex-col bg-pkm-900 min-h-0">
        <div className="flex items-center justify-between p-8 border-b border-pkm-500">
          <h1 className="text-2xl text-gold font-black lowercase tracking-tighter">aliases</h1>
          <button className="bg-gold px-4 py-2 rounded-xl text-xs text-pkm-900 font-bold lowercase active:scale-95 transition shadow-lg">create alias</button>
        </div>
        <div className="flex border-b border-pkm-500 bg-pkm-800/30 overflow-x-auto">{tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition ${tab === t.id ? 'text-gold border-b-2 border-gold bg-gold/5' : 'text-text-info'}`}>
            {t.label}
          </button>
        ))}</div>
        <div className="p-8 overflow-y-auto flex-1">
          {tab === 'aliases' ? (
            loading ? <Skeleton className="h-32 w-full rounded-[2.5rem]" /> :
            aliases.length === 0 ?
            <div className="p-20 text-center text-text-info lowercase italic opacity-40 flex flex-col items-center justify-center h-full">
              <div className="text-6xl mb-8">💨</div>no aliases found
            </div> :
            aliases.map(a => (
              <div key={a.id} className="p-8 bg-pkm-800 border border-pkm-500 rounded-[2.5rem] mb-6 flex justify-between items-center group transition-all">
                <div className="flex flex-col">
                  <span className="font-black text-sm lowercase">{a.email}</span>
                  <span className="text-[10px] text-text-info lowercase mt-1">forwarding to {a.mailbox}</span>
                </div>
                <button onClick={() => toggleAlias(a.id)} className={`px-4 py-1 rounded-full text-[10px] font-black uppercase transition ${a.enabled !== false ? 'bg-green-500/20 text-green-400' : 'bg-pkm-600 text-text-info'}`}>
                  {a.enabled !== false ? 'active' : 'disabled'}
                </button>
              </div>
            ))
          ) : (
            <div className="p-20 text-center text-text-info lowercase italic opacity-40 flex flex-col items-center justify-center h-full">
              <div className="text-6xl mb-8">🚧</div>{tab} feature coming soon
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
