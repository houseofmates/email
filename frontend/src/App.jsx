import { useState, useMemo, useEffect, createContext, useContext } from "react"
import Login from "./login"
import Inbox from "./inbox"
import Mail from "./mail"
import Calendar from "./calendar"
import Vault from "./vault"
import Aliases from "./aliases"
import Settings from "./settings"
import AIPage from "./ai"

export const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [page, setPage] = useState("inbox")
  const [credentials, setCredentials] = useState(null)

  const authHeader = useMemo(() => {
    if (!credentials) return ""
    return "Basic " + btoa(`${credentials.email}:${credentials.password}`)
  }, [credentials])

  // restore session from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("email_creds")
      if (saved) {
        const parsed = JSON.parse(saved)
        setCredentials(parsed)
        setAuthed(true)
      }
    } catch { /* not restored */ }
  }, [])

  function handleLogin(creds) {
    setCredentials(creds)
    setAuthed(true)
    setPage("inbox")
    try {
      localStorage.setItem("email_creds", JSON.stringify(creds))
    } catch { /* storage fail */ }
  }

  function handleLogout() {
    setAuthed(false)
    setCredentials(null)
    setPage("inbox")
    try {
      localStorage.removeItem("email_creds")
    } catch { /* storage fail */ }
  }

  const auth = { authed, authHeader, credentials, onLogout: handleLogout, onNavigate: setPage }

  if (!authed) return <Login onLogin={handleLogin} />

  const shared = { authHeader, onNavigate: setPage, onLogout: handleLogout, userEmail: credentials?.email || "" }

  return (
    <AuthContext.Provider value={auth}>
      {page === "inbox" && <Mail {...shared} />}
      {page === "mail" && <Mail {...shared} />}
      {page === "calendar" && <Calendar {...shared} />}
      {page === "passwords" && <Vault {...shared} />}
      {page === "aliases" && <Aliases {...shared} />}
      {page === "ai" && <AIPage {...shared} />}
      {page === "settings" && <Settings {...shared} />}
    </AuthContext.Provider>
  )
}