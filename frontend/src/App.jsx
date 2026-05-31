import { useState, useMemo } from "react"
import Login from "./login"
import Dashboard from "./dashboard"
import Aliases from "./aliases"
import Identities from "./identities"
import Credentials from "./credentials"
import Calendar from "./calendar"
import Contacts from "./contacts"
import Drive from "./drive"

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [page, setPage] = useState("dashboard")
  const [credentials, setCredentials] = useState(null)

  const authHeader = useMemo(() => {
    if (!credentials) return ""
    return "Basic " + btoa(`${credentials.email}:${credentials.password}`)
  }, [credentials])

  function handleLogin(creds) {
    setCredentials(creds)
    setAuthed(true)
  }

  function handleLogout() {
    setAuthed(false)
    setCredentials(null)
    setPage("dashboard")
  }

  if (!authed) return <Login onLogin={handleLogin} />

  const userEmail = credentials?.email || ""
  const shared = { onNavigate: setPage, onLogout: handleLogout, authHeader }
  const dav = { onNavigate: setPage, onLogout: handleLogout, userEmail }

  if (page === "aliases") return <Aliases {...shared} />
  if (page === "identities") return <Identities {...shared} />
  if (page === "passwords") return <Credentials {...shared} />
  if (page === "calendar") return <Calendar {...dav} />
  if (page === "contacts") return <Contacts {...dav} />
  if (page === "drive") return <Drive {...dav} />

  return <Dashboard {...shared} userEmail={userEmail} />
}
