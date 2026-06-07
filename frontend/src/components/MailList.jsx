import { useCallback, useEffect, useRef, useState } from "react"
import { loadFolder, moveEmail, toggleFlag, deleteEmail } from "../services/mail"
import { useToast } from "./Toast"
import { ghostBtn, dangerBtn } from "./ui"

const PAGE = 30

function fromName(email) {
  const f = email?.from?.[0]
  return f?.name || f?.email || "unknown"
}

function toLine(email) {
  const t = email?.to?.[0]
  return t?.name || t?.email || ""
}

function fmtDate(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  if (now - d < 86400000) return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

/**
 * scrollable, paginated list of emails for one folder.
 * @param {object} props
 * @param {string} props.folderKey inbox|sent|drafts|spam|trash|favorites
 * @param {string} props.folderId mailbox id or "favorites"
 * @param {object} props.folderMap resolved { inbox, sent, drafts, spam, trash }
 * @param {string} [props.query] search text
 * @param {string} [props.selectedId] currently open email
 * @param {(email:object)=>void} props.onOpen
 * @param {(email:object)=>void} props.onReply
 * @param {number} [props.refreshSignal] bump to force a reload
 */
export default function MailList({
  folderKey,
  folderId,
  folderMap,
  query = "",
  selectedId,
  onOpen,
  onReply,
  refreshSignal = 0,
}) {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [offset, setOffset] = useState(0)
  const [done, setDone] = useState(false)
  const toast = useToast()

  // monotonically increasing token so stale folder/query responses are ignored
  const reqRef = useRef(0)

  const applyInboxRule = useCallback(
    (list) => {
      // inbox view excludes copies that live in other mailboxes
      if (folderKey === "inbox" && folderId) {
        return list.filter((m) => m.mailboxIds?.[folderId])
      }
      return list
    },
    [folderKey, folderId]
  )

  const load = useCallback(
    async (nextOffset, append) => {
      const token = ++reqRef.current
      if (!append) setLoading(true)
      setError(null)
      try {
        const list = await loadFolder(folderId, query, PAGE, nextOffset)
        if (token !== reqRef.current) return // a newer request superseded this one
        const filtered = applyInboxRule(list)
        setDone(list.length < PAGE)
        setEmails((prev) => (append ? [...prev, ...filtered] : filtered))
        setOffset(nextOffset + list.length)
      } catch (err) {
        if (token === reqRef.current) setError(String(err.message || err))
      } finally {
        if (token === reqRef.current) setLoading(false)
      }
    },
    [folderId, query, applyInboxRule]
  )

  // reload when the folder, query or refresh signal changes.
  // load(0, false) resets offset/done/emails itself.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() refetches the folder
    load(0, false)
  }, [folderId, query, refreshSignal, load])

  function removeLocally(id) {
    setEmails((list) => list.filter((m) => m.id !== id))
  }

  async function handleMove(email, targetKey) {
    const target = folderMap?.[targetKey]
    if (!target) {
      toast.show({ message: `no ${targetKey} folder`, kind: "err" })
      return
    }
    removeLocally(email.id)
    try {
      await moveEmail(email.id, target)
      toast.show({ message: `moved to ${targetKey}`, kind: "info" })
    } catch (err) {
      toast.show({ message: String(err.message || err), kind: "err" })
    }
  }

  async function handleDelete(email) {
    const originalKey = folderKey === "favorites" ? "inbox" : folderKey
    const original = folderMap?.[originalKey]
    removeLocally(email.id)
    try {
      await deleteEmail(email.id, original)
      toast.show({
        message: "moved to trash",
        kind: "info",
        actionLabel: "undo",
        onAction: async () => {
          try {
            if (original) await moveEmail(email.id, original)
            // bring it back into the current view
            setEmails((list) => [email, ...list])
          } catch (err) {
            toast.show({ message: String(err.message || err), kind: "err" })
          }
        },
      })
    } catch (err) {
      toast.show({ message: String(err.message || err), kind: "err" })
    }
  }

  async function handleFlag(email) {
    const wasFlagged = !!email.keywords?.$flagged
    // optimistic toggle
    setEmails((list) =>
      list.map((m) =>
        m.id === email.id
          ? { ...m, keywords: { ...m.keywords, $flagged: wasFlagged ? undefined : true } }
          : m
      )
    )
    try {
      await toggleFlag(email.id)
    } catch (err) {
      toast.show({ message: String(err.message || err), kind: "err" })
    }
  }

  if (loading && emails.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-pkm-500 border-t-gold" />
      </div>
    )
  }

  if (error && emails.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-danger lowercase">{error}</p>
        <button onClick={() => load(0, false)} className={`mt-3 ${ghostBtn}`}>
          retry
        </button>
      </div>
    )
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <p className="text-sm text-text-info lowercase">{query ? "no matches" : "nothing here"}</p>
      </div>
    )
  }

  // sent/drafts show the recipient line; everything else shows the sender
  const showRecipient = folderKey === "sent" || folderKey === "drafts"

  return (
    <div className="p-3 sm:p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
        {emails.map((m) => {
          const unread = !m.keywords?.$seen
          const flagged = !!m.keywords?.$flagged
          return (
            <div
              key={m.id}
              onClick={() => onOpen?.(m)}
              className={`flex cursor-pointer flex-col gap-1 rounded-lg border bg-pkm-800 px-4 py-3 transition hover:bg-pkm-700/50 hover:border-gold ${
                selectedId === m.id ? "border-gold" : "border-pkm-500"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`flex items-center gap-1.5 truncate text-sm lowercase ${unread ? "text-gold font-semibold" : "text-text-primary"}`}>
                  <span aria-hidden>📧</span>
                  <span className="truncate">{showRecipient ? toLine(m) : fromName(m)}</span>
                </p>
                <span className="shrink-0 text-xs text-text-info lowercase">{fmtDate(m.receivedAt)}</span>
              </div>
              <p className="truncate text-sm text-text-primary lowercase">{m.subject || "(no subject)"}</p>
              <p className="truncate text-xs text-text-info lowercase">{m.preview || ""}</p>

              <div className="mt-1 flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => onReply?.(m)} className={ghostBtn}>
                  reply
                </button>
                <button onClick={() => handleFlag(m)} className={ghostBtn} aria-label="toggle flag">
                  {flagged ? "★" : "☆"}
                </button>
                {folderKey !== "spam" && (
                  <button onClick={() => handleMove(m, "spam")} className={ghostBtn}>
                    spam
                  </button>
                )}
                {folderKey !== "trash" && (
                  <button onClick={() => handleMove(m, "trash")} className={ghostBtn}>
                    trash
                  </button>
                )}
                <button onClick={() => handleDelete(m)} className={dangerBtn}>
                  delete
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {!done && (
        <div className="flex justify-center p-4">
          <button onClick={() => load(offset, true)} disabled={loading} className={ghostBtn}>
            {loading ? "loading..." : "load more"}
          </button>
        </div>
      )}
    </div>
  )
}
