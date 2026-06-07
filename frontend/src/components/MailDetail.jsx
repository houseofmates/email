import { useEffect, useState } from "react"
import { getEmail, emailText, emailHtml, moveEmail, toggleFlag, deleteEmail } from "../services/mail"
import { renderMarkdown } from "../services/markdown"
import { useToast } from "./Toast"
import { ghostBtn, dangerBtn } from "./ui"

function addr(list) {
  if (!list?.length) return ""
  return list.map((a) => a.name || a.email).join(", ")
}

function fmtDate(iso) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// looks-like-markdown heuristic for bodies that arrived as plain text
function looksLikeMarkdown(text) {
  return /(^|\n)\s*(#{1,6}\s|[-*]\s|>\s)|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|```/.test(text || "")
}

/**
 * reading pane for a single email.
 * @param {object} props
 * @param {string} props.emailId
 * @param {string} props.folderKey current folder key (original folder for undo)
 * @param {object} props.folderMap resolved { inbox, sent, drafts, spam, trash }
 * @param {(email:object)=>void} props.onReply
 * @param {(email:object)=>void} props.onForward
 * @param {()=>void} props.onChange called after a move/delete so the list refreshes
 * @param {()=>void} props.onClose
 */
export default function MailDetail({ emailId, folderKey, folderMap, onReply, onForward, onChange, onClose }) {
  const [email, setEmail] = useState(null)
  const [error, setError] = useState(null)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    function load() {
      setEmail(null)
      setError(null)
      getEmail(emailId)
        .then((e) => !cancelled && setEmail(e))
        .catch((err) => !cancelled && setError(String(err.message || err)))
    }
    load()
    return () => {
      cancelled = true
    }
  }, [emailId])

  async function move(targetKey) {
    const target = folderMap?.[targetKey]
    if (!target) return toast.show({ message: `no ${targetKey} folder`, kind: "err" })
    try {
      await moveEmail(emailId, target)
      toast.show({ message: `moved to ${targetKey}`, kind: "info" })
      onChange?.()
      onClose?.()
    } catch (err) {
      toast.show({ message: String(err.message || err), kind: "err" })
    }
  }

  async function remove() {
    const originalKey = folderKey === "favorites" ? "inbox" : folderKey
    const original = folderMap?.[originalKey]
    try {
      await deleteEmail(emailId, original)
      onChange?.()
      onClose?.()
      toast.show({
        message: "moved to trash",
        kind: "info",
        actionLabel: "undo",
        onAction: async () => {
          if (original) await moveEmail(emailId, original)
          onChange?.()
        },
      })
    } catch (err) {
      toast.show({ message: String(err.message || err), kind: "err" })
    }
  }

  async function flag() {
    try {
      const now = await toggleFlag(emailId)
      setEmail((e) => (e ? { ...e, keywords: { ...e.keywords, $flagged: now ? true : undefined } } : e))
    } catch (err) {
      toast.show({ message: String(err.message || err), kind: "err" })
    }
  }

  if (error) return <p className="p-4 text-sm text-danger lowercase">{error}</p>
  if (!email) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-pkm-500 border-t-gold" />
      </div>
    )
  }

  const flagged = !!email.keywords?.$flagged
  const html = emailHtml(email)
  const text = emailText(email)
  let bodyHtml = ""
  if (html) bodyHtml = html
  else if (looksLikeMarkdown(text)) bodyHtml = renderMarkdown(text)

  return (
    <div className="animate-fade-in p-4 sm:p-6">
      {onClose && (
        <button onClick={onClose} className={`mb-4 ${ghostBtn} md:hidden`}>
          back
        </button>
      )}

      <h2 className="text-lg text-text-primary lowercase">{email.subject || "(no subject)"}</h2>
      <div className="mt-2 space-y-0.5 text-xs text-text-info lowercase">
        <p>from: {addr(email.from)}</p>
        <p>to: {addr(email.to)}</p>
        {email.cc?.length > 0 && <p>cc: {addr(email.cc)}</p>}
        <p>date: {fmtDate(email.receivedAt)}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1">
        <button onClick={() => onReply?.(email)} className={ghostBtn}>
          reply
        </button>
        <button onClick={() => onForward?.(email)} className={ghostBtn}>
          forward
        </button>
        <button onClick={flag} className={ghostBtn}>
          {flagged ? "★ unflag" : "☆ flag"}
        </button>
        {folderKey !== "spam" && (
          <button onClick={() => move("spam")} className={ghostBtn}>
            spam
          </button>
        )}
        {folderKey !== "trash" && (
          <button onClick={() => move("trash")} className={ghostBtn}>
            trash
          </button>
        )}
        <button onClick={remove} className={dangerBtn}>
          delete
        </button>
      </div>

      <div className="mt-4 border-t border-pkm-500 pt-4">
        {bodyHtml ? (
          <div
            className="space-y-2 break-words text-sm text-text-primary leading-relaxed"
            // body is rendered html: our own markdown output, or the stored html
            // part. note: stored html is not re-sanitised here — see markdown.js.
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : (
          <pre className="whitespace-pre-wrap break-words font-sans text-sm text-text-primary leading-relaxed">
            {text || email.preview || ""}
          </pre>
        )}
      </div>

      {email.attachments?.length > 0 && (
        <div className="mt-5 border-t border-pkm-500 pt-4">
          <p className="mb-2 text-xs text-text-info lowercase">attachments</p>
          <div className="flex flex-col gap-2">
            {email.attachments.map((a) => {
              const isImage = (a.type || "").startsWith("image/")
              const href = `/jmap/download/${a.blobId}`
              return isImage ? (
                <img
                  key={a.blobId}
                  src={`cid:${a.blobId}`}
                  alt={a.name || "image"}
                  className="max-w-full rounded-lg border border-pkm-500"
                />
              ) : (
                <a
                  key={a.blobId}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sky underline lowercase"
                >
                  {a.name || a.blobId} {a.size ? `(${Math.round(a.size / 1024)} kb)` : ""}
                </a>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
