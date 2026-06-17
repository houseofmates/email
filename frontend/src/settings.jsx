import { useState } from "react"
import Layout from "./layout"
import { SettingsTabs } from "./components/SettingsTabs"

export default function Settings(props) {
  const [tab, setTab] = useState('general')
  return (
    <Layout {...props} currentPage="settings">
      <div className="flex flex-1 flex-col">
        <div className="p-4 border-b border-pkm-500 flex justify-between">
          <h1 className="text-gold font-bold lowercase">settings</h1>
          <button onClick={props.onLogout} className="text-danger text-xs underline lowercase">logout</button>
        </div>
        <SettingsTabs activeTab={tab} onTabChange={setTab} />
        <div className="p-8 max-w-2xl mx-auto w-full">
          <h3 className="text-gold text-xs font-bold uppercase mb-4">{tab} settings</h3>
          <div className="p-12 border-2 border-dashed border-pkm-500 rounded-3xl text-center text-text-info lowercase italic">
            coming soon
          </div>
        </div>
      </div>
    </Layout>
  )
}
