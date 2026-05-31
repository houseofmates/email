import { useMemo, useState } from "react"

function CopyRow({ label, value, accent = "sky" }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard?.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const accentCls = accent === "gold" ? "text-gold" : "text-sky"
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-text-primary lowercase">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2">
        <code className={`min-w-0 flex-1 truncate font-mono text-xs ${accentCls}`}>{value}</code>
        <button
          onClick={copy}
          className="shrink-0 rounded-md border border-pkm-500 px-2 py-1 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
    </div>
  )
}

export default function Drive({ onNavigate, onLogout, userEmail }) {
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const account = (userEmail || "").trim()

  const webdavUrl = useMemo(
    () => `${origin}/dav/file/${encodeURIComponent(account)}/`,
    [origin, account]
  )

  return (
    <div className="flex min-h-[100dvh] flex-col bg-pkm-900">
      <header className="flex items-center justify-between gap-3 border-b border-pkm-500 px-4 py-3 sm:px-6">
        <h1 className="text-lg text-gold lowercase tracking-wide">drive</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => onNavigate("dashboard")}
            className="rounded-lg border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase sm:px-4"
          >
            inbox
          </button>
          <button
            onClick={onLogout}
            className="rounded-lg border border-pkm-500 px-3 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase sm:px-4"
          >
            sign out
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[760px] flex-1 overflow-y-auto p-4 sm:p-6">
        <section className="mb-8">
          <h2 className="mb-1 text-base text-text-accent lowercase tracking-wide">webdav storage</h2>
          <p className="mb-4 text-sm text-text-info lowercase">
            mount your file storage over webdav with your account address and
            password — drag files in from any device.
          </p>
          <div className="flex flex-col gap-4 rounded-xl border border-pkm-500 bg-pkm-800 p-5">
            <CopyRow label="webdav url" value={webdavUrl} accent="gold" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-text-primary lowercase">username</span>
              <code className="rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 font-mono text-xs text-sky">
                {account || "your account email"}
              </code>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-1 text-base text-text-accent lowercase tracking-wide">how to mount</h2>
          <div className="flex flex-col gap-3 rounded-xl border border-pkm-500 bg-pkm-800 p-5 text-sm text-text-info lowercase">
            <p>
              <span className="text-text-primary">macos:</span> finder → go →
              connect to server → paste the url.
            </p>
            <p>
              <span className="text-text-primary">windows:</span> file explorer →
              map network drive → connect to a web site → paste the url.
            </p>
            <p>
              <span className="text-text-primary">android / ios:</span> use a
              webdav app (e.g. cx file explorer, documents) with the url + your
              password.
            </p>
            <p>
              <span className="text-text-primary">sharing:</span> generate share
              links per file/folder from a webdav client that supports it, or set
              acls in the admin ui.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
