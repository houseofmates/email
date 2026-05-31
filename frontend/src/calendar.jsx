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

export default function Calendar({ onNavigate, onLogout, userEmail }) {
  const [calName, setCalName] = useState("default")
  const [calendars, setCalendars] = useState(["default"])

  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const account = (userEmail || "").trim()

  const base = useMemo(() => {
    const httpsBase = `${origin}/dav/cal/${encodeURIComponent(account)}`
    return { httpsBase }
  }, [origin, account])

  function addCalendar(e) {
    e.preventDefault()
    const name = calName.trim().toLowerCase().replace(/\s+/g, "-")
    if (!name || calendars.includes(name)) return
    setCalendars((prev) => [...prev, name])
    setCalName("")
  }

  function linksFor(name) {
    const path = `${base.httpsBase}/${encodeURIComponent(name)}/`
    return {
      caldav: path,
      https: path,
      webcal: path.replace(/^https?:\/\//, "webcal://"),
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-pkm-900">
      <header className="flex items-center justify-between border-b border-pkm-500 px-6 py-3">
        <h1 className="text-lg text-gold lowercase tracking-wide">calendar</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("dashboard")}
            className="rounded-lg border border-pkm-500 px-4 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase"
          >
            inbox
          </button>
          <button
            onClick={onLogout}
            className="rounded-lg border border-pkm-500 px-4 py-1.5 text-xs text-text-info transition hover:border-sky hover:text-sky lowercase"
          >
            sign out
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[760px] flex-1 overflow-y-auto p-6">
        <section className="mb-8">
          <h2 className="mb-1 text-base text-text-accent lowercase tracking-wide">caldav account</h2>
          <p className="mb-4 text-sm text-text-info lowercase">
            connect any caldav client with your account address and password.
          </p>
          <div className="flex flex-col gap-4 rounded-xl border border-pkm-500 bg-pkm-800 p-5">
            <CopyRow label="caldav url" value={base.httpsBase + "/"} accent="gold" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-text-primary lowercase">username</span>
              <code className="rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 font-mono text-xs text-sky">
                {account || "your account email"}
              </code>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-1 text-base text-text-accent lowercase tracking-wide">shareable links</h2>
          <p className="mb-4 text-sm text-text-info lowercase">
            generate subscription links for each calendar to share read access.
          </p>

          <form onSubmit={addCalendar} className="mb-5 flex items-center gap-2">
            <input
              type="text"
              placeholder="calendar name"
              value={calName}
              onChange={(e) => setCalName(e.target.value)}
              className="flex-1 rounded-lg border border-pkm-500 bg-pkm-700 px-4 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-sky focus:ring-1 focus:ring-sky lowercase"
            />
            <button
              type="submit"
              className="rounded-lg bg-sky px-4 py-2 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] lowercase"
            >
              add calendar
            </button>
          </form>

          <div className="flex flex-col gap-4">
            {calendars.map((name) => {
              const links = linksFor(name)
              return (
                <div key={name} className="flex flex-col gap-3 rounded-xl border border-pkm-500 bg-pkm-800 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-primary lowercase">{name}</span>
                    {calendars.length > 1 && (
                      <button
                        onClick={() => setCalendars((prev) => prev.filter((c) => c !== name))}
                        className="rounded-md border border-danger-border px-3 py-1 text-xs text-danger transition hover:bg-danger-dim lowercase"
                      >
                        remove
                      </button>
                    )}
                  </div>
                  <CopyRow label="caldav" value={links.caldav} accent="gold" />
                  <CopyRow label="subscribe (webcal)" value={links.webcal} accent="sky" />
                  <CopyRow label="https" value={links.https} accent="sky" />
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
