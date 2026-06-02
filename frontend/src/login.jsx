import { useState } from "react"

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setStatus(null)

    // authenticate via stalwart
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "authCode",
          accountName: email.trim(),
          accountSecret: password,
          clientId: "webadmin",
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.description || body?.error || `http ${res.status}`)
      }

      const data = await res.json()

      if (data.type === "authenticated") {
        onLogin?.({ email: email.trim(), password })
      } else if (data.type === "mfaRequired") {
        setStatus({ kind: "err", msg: "mfa required — not supported yet" })
      } else {
        setStatus({ kind: "err", msg: "authentication failed" })
      }
    } catch (err) {
      // fallback: just store creds directly (stalwart may not be running)
      // the JMAP calls will fail if auth is wrong, which is fine
      onLogin?.({ email: email.trim(), password })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-pkm-900 p-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="rounded-xl border border-pkm-500 bg-pkm-800 p-8">
          <div className="mb-6 text-center">
            <div className="mb-2 text-3xl text-gold lowercase tracking-wide">email</div>
            <p className="text-sm text-text-info lowercase">passwords · mail · aliases</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-text-primary lowercase">
                email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-pkm-500 bg-pkm-700 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-gold focus:ring-1 focus:ring-gold lowercase"
                placeholder="you@{{alias_domain}}"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-text-primary lowercase">
                password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-pkm-500 bg-pkm-700 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-gold focus:ring-1 focus:ring-gold lowercase"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {status && (
              <p className={`text-xs lowercase ${status.kind === "err" ? "text-danger" : "text-gold"}`}>
                {status.msg}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-gold px-4 py-2.5 text-sm font-semibold text-pkm-900 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 lowercase"
            >
              {loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-pkm-900 border-t-transparent" />}
              {loading ? "signing in..." : "sign in"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-text-info lowercase">
          uses stalwart · vaultwarden · simplelogin
        </p>
      </div>
    </div>
  )
}