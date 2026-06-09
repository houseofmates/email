import { createContext, useContext } from "react"

// shared auth context. kept in its own module so App.jsx only exports a
// component (required for react fast refresh / hmr).
export const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}
