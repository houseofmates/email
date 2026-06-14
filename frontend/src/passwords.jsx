import { useState, useEffect } from "react"
import Layout from "./layout"
import { TypeSelector } from "./components/TypeSelector"
import { vaultwardenService } from "./services/vaultwarden"
import { useStore } from "./store"

const TYPES = [
  { key: "login",    label: "logins",   icon: "🔑" },
  { key: "note",     label: "notes",    icon: "📝" },
  { key: "card",     label: "cards",    icon: "💳" },
  { key: "identity", label: "identities", icon: "👤" },
]

export default function Passwords({ authHeader, onNavigate, onLogout, userEmail }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [masterPassword, setMasterPassword] = useState("")
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [activeType, setActiveType] = useState('login')
  const { folders, setFolders } = useStore()

  const handleUnlock = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await vaultwardenService.fetchVault(masterPassword, authHeader)
      setItems(data.items || [])
      setFolders(data.folders || [])
      setIsUnlocked(true)
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isUnlocked) {
    return (
      <Layout currentPage="passwords" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
        <div className="flex flex-1 flex-col items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-pkm-500 bg-pkm-800 p-8 shadow-2xl animate-fade-in">
            <h2 className="mb-6 text-xl text-gold lowercase text-center">unlock vault</h2>
            <form onSubmit={handleUnlock} className="flex flex-col gap-4">
              <input
                type="password"
                placeholder="master password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                className="w-full rounded-lg border border-pkm-500 bg-pkm-700 px-4 py-3 text-sm text-text-primary outline-none focus:border-gold lowercase"
                required
              />
              <button type="submit" disabled={loading} className="w-full rounded-lg bg-gold py-3 text-sm font-bold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] lowercase">
                {loading ? "unlocking..." : "unlock"}
              </button>
            </form>
            <p className="mt-6 text-[10px] text-text-info text-center leading-relaxed lowercase">
              master password is sent to your bridge for decryption — ensure https and trust your network
            </p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout currentPage="passwords" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      <div className="flex flex-1 flex-col min-h-0 bg-pkm-900">
        <div className="flex items-center justify-between border-b border-pkm-500 px-4 py-3">
          <h1 className="text-lg text-gold lowercase tracking-wide">passwords</h1>
          <div className="flex gap-2">
            <button className="rounded-lg border border-pkm-500 px-3 py-1.5 text-xs text-text-info hover:text-text-primary lowercase active:scale-[0.98]">import</button>
            <button className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] lowercase">add</button>
          </div>
        </div>

        <TypeSelector types={TYPES} activeType={activeType} onSelect={setActiveType} />

        <div className="flex-1 overflow-y-auto p-4">
           <div className="flex flex-col items-center justify-center h-full text-text-info lowercase italic animate-fade-in">
             your vault is currently empty
           </div>
        </div>
      </div>
    </Layout>
  )
}
