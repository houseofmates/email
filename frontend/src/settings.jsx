import { useState } from "react"
import Layout from "./layout"
import { SettingsTabs } from "./components/SettingsTabs"

export default function Settings({ authHeader, onNavigate, onLogout, userEmail }) {
  const [activeTab, setTab] = useState('general')
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system')

  const changeTheme = (t) => {
    setTheme(t); localStorage.setItem('theme', t);
    const root = document.documentElement;
    if (t === 'dark') root.classList.add('dark'); else if (t === 'light') root.classList.remove('dark');
  }

  return (
    <Layout currentPage="settings" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      <div className="flex flex-1 flex-col min-h-0 bg-pkm-900">
        <div className="p-6 border-b border-pkm-500 flex justify-between items-center">
          <h1 className="text-xl text-gold font-bold lowercase tracking-tighter">settings</h1>
          <button onClick={onLogout} className="text-danger text-xs underline lowercase hover:text-white transition">logout</button>
        </div>
        <SettingsTabs active={activeTab} onChange={setTab} />
        <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full animate-fade-in">
          {activeTab === 'general' && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gold mb-6">appearance</h3>
              <div className="grid grid-cols-3 gap-4">
                {['system', 'light', 'dark'].map(t => (
                  <button key={t} onClick={() => changeTheme(t)}
                    className={`rounded-2xl border p-6 text-center transition ${theme === t ? 'border-gold bg-gold/5 text-gold shadow-lg shadow-gold/5' : 'border-pkm-500 text-text-info hover:border-sky'}`}>
                    <span className="text-sm lowercase font-medium">{t}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {activeTab === 'accounts' && (
             <div className="grid gap-4">
               {['stalwart mail', 'vaultwarden', 'simplelogin'].map(svc => (
                 <div key={svc} className="flex items-center justify-between p-6 rounded-3xl border border-pkm-500 bg-pkm-800 transition hover:bg-pkm-700/50">
                   <div className="flex items-center gap-4">
                     <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                     <span className="text-sm lowercase font-bold text-text-primary tracking-tight">{svc}</span>
                   </div>
                   <span className="text-[10px] px-3 py-1 rounded-full bg-green-500/10 text-green-500 font-bold uppercase tracking-widest border border-green-500/20">connected</span>
                 </div>
               ))}
             </div>
          )}
          {!['general', 'accounts'].includes(activeTab) && (
            <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-pkm-500 rounded-[3rem] p-12 text-center text-text-info lowercase italic opacity-50">
               coming soon
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
