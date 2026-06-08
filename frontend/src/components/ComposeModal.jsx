import { useRef, useState } from "react"
import { sendEmail, uploadBlob, moveEmail, getFolderMap } from "../services/mail"
import { renderMarkdown } from "../services/markdown"
import { useToast } from "./Toast"
import { inputClass, goldBtn, ghostBtn, modalBackdrop } from "./ui"

// a deliberately small markdown editor: a textarea plus a formatting toolbar,
// wired for drag-and-drop and an "add media" picker. dropped/picked files are
// inserted as a markdown placeholder at the cursor, uploaded via uploadBlob, and
// the placeholder is then swapped for the permanent blob reference.

const TOOLBAR = [
  { label: "b", wrap: ["**", "**"], hint: "bold" },
  { label: "i", wrap: ["*", "*"], hint: "italic" },
  { label: "code", wrap: ["`", "`"], hint: "code" },
  { label: "link", wrap: ["[", "](https://)"], hint: "link" },
  { label: "quote", prefix: "> ", hint: "quote" },
  { label: "list", prefix: "- ", hint: "list item" },
]

/**
 * compose / reply / forward modal.
 * @param {object} props
 * @param {object} [props.initial] { to, cc, bcc, subject, body }
 * @param {()=>void} props.onClose
 * @param {()=>void} [props.onSent] refresh hook after a successful send
 */
export default function ComposeModal({ initial = {}, onClose, onSent }) {
  const [to, setTo] = useState(initial.to || "")
  const [cc, setCc] = useState(initial.cc || "")
  const [bcc, setBcc] = useState(initial.bcc || "")
  const [showCc, setShowCc] = useState(!!(initial.cc || initial.bcc))
  const [subject, setSubject] = useState(initial.subject || "")
  const [body, setBody] = useState(initial.body || "")
  const [attachments, setAttachments] = useState([]) // { blobId, name, type, size }
  const [preview, setPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)

  const textRef = useRef(null)
  const fileRef = useRef(null)
  const toast = useToast()

  // insert text at the current cursor position in the body textarea
  function insertAtCursor(snippet, selectInsideLen) {
    const el = textRef.current
    const start = el ? el.selectionStart : body.length
    const end = el ? el.selectionEnd : body.length
    const next = body.slice(0, start) + snippet + body.slice(end)
    setBody(next)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const pos = start + (selectInsideLen ?? snippet.length)
      el.setSelectionRange(pos, pos)
    })
  }

  function applyToolbar(t) {
    const el = textRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = body.slice(start, end)
    if (t.wrap) {
      const [a, b] = t.wrap
      const next = body.slice(0, start) + a + selected + b + body.slice(end)
      setBody(next)
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(start + a.length, start + a.length + selected.length)
      })
    } else if (t.prefix) {
      const lineStart = body.lastIndexOf("\n", start - 1) + 1
      const next = body.slice(0, lineStart) + t.prefix + body.slice(lineStart)
      setBody(next)
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(start + t.prefix.length, end + t.prefix.length)
      })
    }
  }

  // insert placeholder, upload, then replace placeholder with the real ref
  async function handleFiles(files) {
    for (const file of files) {
      const isImage = (file.type || "").startsWith("image/")
      const token = `uploading-${file.name}-${Math.round(file.size)}`
      const placeholder = isImage ? `![${token}](...)` : `[${token}](...)`
      insertAtCursor(placeholder + "\n")
      try {
        const blob = await uploadBlob(file)
        setAttachments((list) => [...list, blob])
        const ref = isImage
          ? `![${file.name}](cid:${blob.blobId})`
          : `[${file.name}](/jmap/download/${blob.blobId})`
        setBody((b) => b.replace(placeholder, ref))
      } catch (err) {
        setBody((b) => b.replace(placeholder, ""))
        toast.show({ message: `upload failed: ${err.message || err}`, kind: "err" })
      }
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer?.files || [])
    if (files.length) handleFiles(files)
  }

  async function submit() {
    if (!to.trim()) {
      setError("recipient required")
      return
    }
    setSending(true)
    setError(null)
    try {
      const html = renderMarkdown(body)
      const result = await sendEmail(to, cc, bcc, subject, body, attachments, html)
      toast.show({
        message: "message sent",
        kind: "ok",
        actionLabel: "undo",
        onAction: async () => {
          try {
            // move the sent copy back to drafts (best effort; needs drafts folder)
            const map = await getFolderMap()
            if (result.emailId && map.drafts) await moveEmail(result.emailId, map.drafts)
            toast.show({ message: "send undone — back in drafts", kind: "info" })
            onSent?.()
          } catch (err) {
            toast.show({ message: String(err.message || err), kind: "err" })
          }
        },
      })
      onSent?.()
      onClose?.()
    } catch (err) {
      setError(String(err.message || err))
      toast.show({ message: `send failed: ${err.message || err}`, kind: "err" })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={modalBackdrop} onClick={onClose}>
      <div
        className="flex w-full max-w-[640px] flex-col gap-3 rounded-xl border border-pkm-500 bg-pkm-800 p-5 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base text-gold lowercase tracking-wide">new message</h2>
          <button onClick={onClose} className={ghostBtn}>
            close
          </button>
        </div>

        <input
          type="text"
          inputMode="email"
          placeholder="to"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={inputClass(error === "recipient required")}
        />

        {!showCc ? (
          <button onClick={() => setShowCc(true)} className="self-start text-xs text-sky underline lowercase">
            add cc / bcc
          </button>
        ) : (
          <>
            <input
              type="text"
              placeholder="cc"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              className={inputClass(false)}
            />
            <input
              type="text"
              placeholder="bcc"
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              className={inputClass(false)}
            />
          </>
        )}

        <input
          type="text"
          placeholder="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={inputClass(false)}
        />

        {/* editor toolbar */}
        <div className="flex flex-wrap items-center gap-1">
          {TOOLBAR.map((t) => (
            <button key={t.label} title={t.hint} onClick={() => applyToolbar(t)} className={ghostBtn}>
              {t.label}
            </button>
          ))}
          <button onClick={() => fileRef.current?.click()} className={ghostBtn}>
            add media
          </button>
          <button onClick={() => setPreview((p) => !p)} className={ghostBtn}>
            {preview ? "edit" : "preview"}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(Array.from(e.target.files || []))
              e.target.value = ""
            }}
          />
        </div>

        {/* editor / preview area with dropzone */}
        {preview ? (
          <div
            className="min-h-[200px] space-y-2 break-words rounded-lg border border-pkm-500 bg-pkm-700 px-3 py-2 text-sm text-text-primary"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(body) || "<p class='text-text-info'>nothing to preview</p>" }}
          />
        ) : (
          <textarea
            ref={textRef}
            placeholder="write in markdown — drop files or images to attach"
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`resize-y rounded-lg border bg-pkm-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-info outline-none transition focus:border-gold ${
              dragging ? "border-gold ring-1 ring-gold" : "border-pkm-500"
            }`}
          />
        )}

        {attachments.length > 0 && (
          <p className="text-xs text-text-info lowercase">
            {attachments.length} attachment{attachments.length > 1 ? "s" : ""}: {attachments.map((a) => a.name).join(", ")}
          </p>
        )}

        {error && <p className="text-xs text-danger lowercase">{error}</p>}

        <div className="flex items-center justify-end gap-2 border-t border-pkm-500 pt-3">
          <button onClick={onClose} className={ghostBtn}>
            cancel
          </button>
          <button onClick={submit} disabled={sending} className={goldBtn}>
            {sending ? "sending..." : "send"}
          </button>
        </div>
      </div>
    </div>
  )
}
