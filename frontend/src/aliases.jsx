import { useState, useEffect } from "react"
import Layout from "./layout"
import { simpleloginService } from "./services/simplelogin"

export default function Aliases(props) {
  const [aliases, setAliases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    simpleloginService.getAliases(props.authHeader).then(d => {
      setAliases(d.aliases || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [props.authHeader])

  return (
    <Layout {...props} currentPage="aliases">
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between p-4 border-b border-pkm-500">
          <h1 className="text-gold font-bold lowercase">aliases</h1>
          <button className="bg-gold px-3 py-1 rounded text-xs text-pkm-900 font-bold lowercase">create</button>
        </div>
        <div className="p-4">
          {loading ? <div className="text-text-info lowercase">loading...</div> :
           aliases.length === 0 ? <div className="text-text-info lowercase italic">no aliases found</div> :
           aliases.map(a => <div key={a.id} className="p-4 border border-pkm-500 rounded mb-2 bg-pkm-800 text-sm lowercase">{a.email}</div>)
          }
        </div>
      </div>
    </Layout>
  )
}
