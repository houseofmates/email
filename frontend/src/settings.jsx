import { useState } from "react"
import Layout from "./layout"
import { SettingsTabs } from "./components/SettingsTabs"

export default function Settings({ authHeader, onNavigate, onLogout, userEmail }) {
  const [activeTab, setActiveTab] = useState('general')
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system')

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    if (newTheme === 'dark') document.documentElement.classList.add('dark')
    else if (newTheme === 'light') document.documentElement.classList.remove('dark')
  }

  return (
    <Layout currentPage="settings" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      <div className="flex flex-1 flex-col min-h-0 bg-pkm-900">
        <div className="flex items-center justify-between border-b border-pkm-500 px-4 py-3">
          <h1 className="text-lg text-gold lowercase tracking-wide">settings</h1>
          <button onClick={onLogout} className="text-xs text-danger underline lowercase active:scale-[0.98]">logout</button>
        </div>

        <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
          {activeTab === 'general' && (
            <div className="flex flex-col gap-6 animate-fade-in">
              <section>
                <h3 className="text-sm text-gold lowercase mb-3">appearance</h3>
                <div className="flex gap-2">
                  {['system', 'light', 'dark'].map(t => (
                    <button key={t} onClick={() => handleThemeChange(t)}
                      className={`rounded-md border px-4 py-2 text-xs transition lowercase ${
                        theme === t ? 'border-gold bg-gold/10 text-gold' : 'border-pkm-500 text-text-info'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="text-sm text-gold lowercase mb-3">language</h3>
                <select className="w-full rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary outline-none transition focus:border-gold lowercase">
                  <option>english</option>
                  <option>français</option>
                  <option>deutsch</option>
                </select>
              </section>
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="rounded-lg border border-pkm-500 bg-pkm-800 p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm lowercase font-medium">stalwart mail</span>
                  <span className="text-xs text-green-500 lowercase px-2 py-0.5 bg-green-500/10 rounded">connected</span>
                </div>
              </div>
              <div className="rounded-lg border border-pkm-500 bg-pkm-800 p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm lowercase font-medium">vaultwarden</span>
                  <span className="text-xs text-green-500 lowercase px-2 py-0.5 bg-green-500/10 rounded">connected</span>
                </div>
              </div>
            </div>
          )}

          {['email', 'security', 'notifications', 'advanced'].includes(activeTab) && (
            <div className="flex items-center justify-center h-40 text-text-info lowercase italic">
              {activeTab} settings coming soon
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
