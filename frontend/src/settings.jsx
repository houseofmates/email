import Layout from "./layout"

export default function Settings({ authHeader, onNavigate, onLogout, userEmail }) {
  return (
    <Layout currentPage="settings" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      <div className="flex flex-1 flex-col min-h-0">
        <div className="border-b border-pkm-500 px-4 py-3">
          <h1 className="text-lg text-gold lowercase tracking-wide">settings</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* account */}
          <div>
            <h2 className="text-sm text-gold lowercase mb-2">account</h2>
            <div className="rounded-lg border border-pkm-500 bg-pkm-800 p-4">
              <p className="text-sm text-text-primary lowercase">{userEmail}</p>
              <button onClick={onLogout}
                className="mt-3 rounded-lg border border-danger-border px-3 py-1.5 text-xs text-danger transition hover:bg-danger-dim active:scale-[0.98] lowercase">
                sign out
              </button>
            </div>
          </div>

          {/* services */}
          <div>
            <h2 className="text-sm text-gold lowercase mb-2">services</h2>
            <div className="space-y-2">
              <ServiceCard name="stalwart mail" endpoint="/api/auth" authHeader={authHeader} />
              <ServiceCard name="vaultwarden" endpoint="/identity/connect/token" authHeader={authHeader} isPassword />
              <ServiceCard name="simplelogin" endpoint="/api/aliases" authHeader={authHeader} />
            </div>
          </div>

          {/* about */}
          <div>
            <h2 className="text-sm text-gold lowercase mb-2">about</h2>
            <div className="rounded-lg border border-pkm-500 bg-pkm-800 p-4">
              <p className="text-xs text-text-info lowercase leading-relaxed">
                email is a unified interface for stalwart, vaultwarden, and simplelogin.
                all data stays on your infrastructure.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

function ServiceCard({ name, endpoint, authHeader, isPassword }) {
  return (
    <div className="rounded-lg border border-pkm-500 bg-pkm-800 p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-gold animate-pulse-gold" />
        <div>
          <p className="text-sm text-text-primary lowercase">{name}</p>
          <p className="text-xs text-text-info lowercase">{endpoint}</p>
        </div>
      </div>
    </div>
  )
}