import { useState } from "react"
import Layout from "./layout"
import { TypeSelector } from "./components/TypeSelector"
import { vaultwardenService } from "./services/vaultwarden"

const TYPES = [
  { key: "login", label: "logins", icon: "🔑" },
  { key: "note", label: "notes", icon: "📝" },
  { key: "card", label: "cards", icon: "💳" },
  { key: "identity", label: "identities", icon: "👤" },
]

export default function Passwords(props) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [masterPw, setMasterPw] = useState("")
  const [type, setType] = useState('login')

  const unlock = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await vaultwardenService.fetchVault(masterPw, props.authHeader)
      setItems(data.items || [])
      setUnlocked(true)
    } catch (err) { alert("failed to unlock") } finally { setLoading(false) }
  }

  if (!unlocked) return (
    <Layout {...props} currentPage="passwords">
      <div className="flex flex-1 items-center justify-center">
        <form onSubmit={unlock} className="bg-pkm-800 p-8 rounded-xl border border-pkm-500 w-full max-w-sm">
          <h2 className="text-gold mb-6 text-center lowercase font-bold">vault locked</h2>
          <input type="password" placeholder="master password" value={masterPw} onChange={e=>setMasterPw(e.target.value)}
            className="w-full bg-pkm-700 border border-pkm-500 rounded p-2 mb-4 text-sm outline-none focus:border-gold" />
          <button className="w-full bg-gold p-2 rounded text-pkm-900 font-bold lowercase">unlock</button>
        </form>
      </div>
    </Layout>
  )

  return (
    <Layout {...props} currentPage="passwords">
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between p-4 border-b border-pkm-500">
          <h1 className="text-gold font-bold lowercase">passwords</h1>
          <button className="bg-gold px-3 py-1 rounded text-xs text-pkm-900 font-bold lowercase">add</button>
        </div>
        <TypeSelector types={TYPES} activeType={type} onSelect={setType} />
        <div className="p-4 text-text-info lowercase italic">vault is empty</div>
      </div>
    </Layout>
  )
}
