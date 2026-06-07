import { useEffect, useState } from "react"
import { getFolders, STANDARD_FOLDERS } from "../services/mail"

// the fixed set of items shown, in order. favorites is a virtual view backed by
// the \Flagged keyword rather than a real mailbox.
const ITEMS = [
  ...STANDARD_FOLDERS,
  { key: "favorites", role: null, label: "favorites", icon: "★" },
]

const ICONS = {
  inbox: "📥",
  sent: "📤",
  drafts: "📝",
  spam: "🚫",
  trash: "🗑",
  favorites: "★",
}

/**
 * mail folder navigation.
 * @param {object} props
 * @param {string} props.active currently selected folder key
 * @param {(key:string, folderId:string|null) => void} props.onSelect
 * @param {(map:object) => void} [props.onFolders] reports the resolved name->id map
 */
export default function MailSidebar({ active, onSelect, onFolders }) {
  const [folders, setFolders] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getFolders()
      .then((list) => {
        if (cancelled) return
        setFolders(list)
        const map = {}
        for (const std of STANDARD_FOLDERS) {
          const hit = list.find((f) => f.role === std.role)
          if (hit) map[std.key] = hit.id
        }
        onFolders?.(map)
      })
      .catch((err) => !cancelled && setError(String(err.message || err)))
    return () => {
      cancelled = true
    }
  }, [onFolders])

  function folderId(key) {
    if (key === "favorites") return "favorites"
    const std = STANDARD_FOLDERS.find((s) => s.key === key)
    const hit = folders.find((f) => f.role === std?.role)
    return hit?.id || null
  }

  function unreadFor(key) {
    if (key === "favorites") return 0
    const std = STANDARD_FOLDERS.find((s) => s.key === key)
    const hit = folders.find((f) => f.role === std?.role)
    return hit?.unreadEmails || 0
  }

  return (
    <nav className="flex flex-col gap-1 p-3">
      {ITEMS.map((item) => {
        const isActive = active === item.key
        const unread = unreadFor(item.key)
        return (
          <button
            key={item.key}
            onClick={() => onSelect?.(item.key, folderId(item.key))}
            className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition active:scale-[0.98] lowercase ${
              isActive
                ? "bg-gold text-pkm-900 font-semibold"
                : "text-text-info hover:text-text-primary hover:bg-pkm-700/50"
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <span aria-hidden>{ICONS[item.key] || "📁"}</span>
              <span className="truncate">{item.label}</span>
            </span>
            {unread > 0 && (
              <span className={`shrink-0 text-xs ${isActive ? "text-pkm-900" : "text-gold"}`}>{unread}</span>
            )}
          </button>
        )
      })}
      {error && <p className="px-3 pt-2 text-xs text-danger lowercase">{error}</p>}
    </nav>
  )
}
