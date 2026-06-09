import { useState, useMemo, useEffect } from "react"
import Login from "./login"
import Inbox from "./inbox"
import Mail from "./mail"
import Calendar from "./calendar"
import Passwords from "./passwords"
import Aliases from "./aliases"
import Settings from "./settings"
import { useSettings, getSettings } from "./services/settings"
import { applyTheme } from "./services/theme"
import { AuthContext } from "./auth-context"

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [page, setPage] = useState(() => getSettings().defaultView || "inbox")
  const [credentials, setCredentials] = useState(null)
  const [settings] = useSettings()

  const authHeader = useMemo(() => {
    if (!credentials) return ""
    return "Basic " + btoa(`${credentials.email}:${credentials.password}`)
  }, [credentials])

  // apply the theme whenever the preference changes; when "system", also follow
  // live os changes via the media query.
  useEffect(() => {
    applyTheme(settings.theme)
    if (settings.theme !== "system" || !window.matchMedia) return
    const mq = window.matchMedia("(prefers-color-scheme: light)")
    const onChange = () => applyTheme("system")
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [settings.theme])

  // restore session from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("email_creds")
      if (saved) {
        const parsed = JSON.parse(saved)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCredentials(parsed)
        setAuthed(true)
      }
    } catch { /* not restored */ }
  }, [])

  function handleLogin(creds) {
    setCredentials(creds)
    setAuthed(true)
    setPage(getSettings().defaultView || "inbox") // land on the user's chosen view
    try {
      localStorage.setItem("email_creds", JSON.stringify(creds))
    } catch { /* storage fail */ }
  }

  function handleLogout() {
    setAuthed(false)
    setCredentials(null)
    setPage(getSettings().defaultView || "inbox")
    try {
      localStorage.removeItem("email_creds")
    } catch { /* storage fail */ }
  }

  const auth = { authed, authHeader, credentials, onLogout: handleLogout, onNavigate: setPage }

  if (!authed) return <Login onLogin={handleLogin} />

  const shared = { authHeader, onNavigate: setPage, onLogout: handleLogout, userEmail: credentials?.email || "" }

  return (
    <AuthContext.Provider value={auth}>
      {page === "inbox" && <Inbox {...shared} />}
      {page === "mail" && <Mail {...shared} />}
      {page === "calendar" && <Calendar {...shared} />}
      {page === "passwords" && <Passwords {...shared} />}
      {page === "aliases" && <Aliases {...shared} />}
      {page === "settings" && <Settings {...shared} />}
    </AuthContext.Provider>
  )
}