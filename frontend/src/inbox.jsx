import { useState, useEffect } from "react"
import Layout from "./layout"
import { InboxSkeleton } from "./components/Skeleton"

export default function Inbox(props) {
  const [loading, setLoading] = useState(true)
  useEffect(() => { setTimeout(() => setLoading(false), 800) }, [])

  return (
    <Layout {...props} currentPage="inbox">
      <div className="flex flex-1 flex-col">
        <div className="p-4 border-b border-pkm-500 flex gap-4">
          <input type="text" placeholder="search..." className="flex-1 bg-pkm-700 border border-pkm-500 rounded px-3 py-1 text-sm outline-none focus:border-gold lowercase" />
          <button className="bg-gold px-4 py-1 rounded text-xs text-pkm-900 font-bold lowercase">compose</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <InboxSkeleton /> : <div className="p-8 text-center text-text-info lowercase italic">inbox is empty</div>}
        </div>
      </div>
    </Layout>
  )
}
