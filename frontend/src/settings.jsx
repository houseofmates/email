import { useState } from "react"
import Layout from "./layout"
import { SettingsTabs } from "./components/SettingsTabs"
import { useStore } from "./store"

export default function Settings(props) {
  const [tab, setTab] = useState('general')
  const { theme, setTheme } = useStore()

  const renderContent = () => {
    switch(tab) {
      case 'general':
        return (
          <div className="space-y-12">
            <div className="flex items-center justify-between p-8 bg-pkm-800/50 rounded-3xl border border-pkm-500">
              <div>
                <h4 className="text-gold font-bold lowercase">dark mode</h4>
                <p className="text-[10px] text-text-info lowercase">reduce eye strain in low light</p>
              </div>
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-12 h-6 bg-pkm-700 rounded-full relative p-1 transition-colors border border-pkm-500">
                <div className={`w-4 h-4 bg-gold rounded-full transition-all ${theme === 'dark' ? 'translate-x-6' : ''}`} />
              </button>
            </div>
          </div>
        )
      case 'email':
        return (
          <div className="space-y-8">
            <h4 className="text-gold font-bold lowercase text-xs">sieve filters</h4>
            <div className="p-8 bg-pkm-800 border border-pkm-500 rounded-3xl border-dashed text-center">
              <button className="text-gold text-[10px] font-black uppercase tracking-widest">+ create rule</button>
            </div>
          </div>
        )
      default:
        return (
          <div className="p-20 border-2 border-dashed border-pkm-500 rounded-[3rem] text-center text-text-info lowercase italic opacity-40 flex flex-col items-center justify-center h-64">
            <div className="text-4xl mb-4">⚙️</div>coming soon
          </div>
        )
    }
  }

  return (
    <Layout {...props} currentPage="settings">
      <div className="flex flex-1 flex-col bg-pkm-900">
        <div className="p-8 border-b border-pkm-500 flex justify-between items-center">
          <h1 className="text-2xl text-gold font-black lowercase tracking-tighter">settings</h1>
          <button onClick={props.onLogout} className="text-danger text-xs underline font-bold hover:text-white transition">logout</button>
        </div>
        <SettingsTabs active={tab} onChange={setTab} />
        <div className="p-12 max-w-4xl mx-auto w-full animate-fade-in">
          <h3 className="text-gold text-[10px] font-black uppercase mb-8 tracking-[0.3em]">{tab} configuration</h3>
          {renderContent()}
        </div>
      </div>
    </Layout>
  )
}
