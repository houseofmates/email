import { useState, useMemo } from "react"
import Login from "./login"
import Dashboard from "./dashboard"
import Aliases from "./aliases"

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

  if (!authed) return <Login onLogin={handleLogin} />

  if (page === "aliases") {
    return (
      <Aliases
        onNavigate={setPage}
        onLogout={() => setAuthed(false)}
        authHeader={authHeader}
      />
    )
  }

  return (
    <Dashboard
      onNavigate={setPage}
      onLogout={() => setAuthed(false)}
      authHeader={authHeader}
    />
  )
}
