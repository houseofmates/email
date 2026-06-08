import { useState } from "react"
import { inputClass, goldBtn, ghostBtn, dangerBtn, modalBackdrop } from "./ui"

// add / edit a calendar event. matches the compose modal patterns (backdrop,
// gold primary button, ghost/danger secondaries). all touch targets >= 44px.

const pad = (n) => String(n).padStart(2, "0")

/** Date -> <input type="datetime-local"> value. */
function toInput(d) {
  if (!d) return ""
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Date -> <input type="date"> value. */
function toDateInput(d) {
  if (!d) return ""
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseLocal(value) {
  if (!value) return null
  // value is "YYYY-MM-DDTHH:MM" or "YYYY-MM-DD"
  const [date, time = "00:00"] = value.split("T")
  const [y, mo, d] = date.split("-").map(Number)
  const [h, mi] = time.split(":").map(Number)
  return new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0, 0)
}

export default function EventModal({ initial, calendars = [], onSave, onDelete, onClose }) {
  const editing = !!initial?.id
  const [title, setTitle] = useState(initial?.title || "")
  const [description, setDescription] = useState(initial?.description || "")
  const [location, setLocation] = useState(initial?.location || "")
  const [allDay, setAllDay] = useState(!!initial?.allDay)
  const [start, setStart] = useState(() => initial?.start || new Date())
  const [end, setEnd] = useState(() => initial?.end || new Date(Date.now() + 3600000))
  const [calendarId, setCalendarId] = useState(initial?.calendarId || calendars[0]?.id || "")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function save() {
    if (!title.trim()) {
      setErr("title required")
      return
    }
    if (end <= start && !allDay) {
      setErr("end must be after start")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await onSave({ id: initial?.id, title: title.trim(), description, location, allDay, start, end, calendarId })
      onClose()
    } catch (e) {
      setErr(String(e.message || e))
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await onDelete(initial.id)
      onClose()
    } catch (e) {
      setErr(String(e.message || e))
      setBusy(false)
    }
  }

  return (
    <div className={modalBackdrop} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-pkm-500 bg-pkm-800 p-5 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg text-gold lowercase">{editing ? "edit event" : "new event"}</h2>
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] text-text-info hover:text-sky lowercase" aria-label="close">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <input className={inputClass(false)} placeholder="title" value={title} autoFocus
            onChange={(e) => setTitle(e.target.value)} />

          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-xs text-text-info lowercase">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            all day
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-text-info lowercase">starts</label>
              <input
                type={allDay ? "date" : "datetime-local"}
                className={inputClass(false)}
                value={allDay ? toDateInput(start) : toInput(start)}
                onChange={(e) => {
                  const d = parseLocal(e.target.value)
                  if (d) {
                    setStart(d)
                    if (end <= d) setEnd(new Date(d.getTime() + 3600000))
                  }
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-info lowercase">ends</label>
              <input
                type={allDay ? "date" : "datetime-local"}
                className={inputClass(false)}
                value={allDay ? toDateInput(end) : toInput(end)}
                onChange={(e) => {
                  const d = parseLocal(e.target.value)
                  if (d) setEnd(d)
                }}
              />
            </div>
          </div>

          <input className={inputClass(false)} placeholder="location (optional)" value={location}
            onChange={(e) => setLocation(e.target.value)} />

          <textarea className={`${inputClass(false)} min-h-[80px] resize-y`} placeholder="notes (optional)"
            value={description} onChange={(e) => setDescription(e.target.value)} />

          {calendars.length > 1 && (
            <select className={inputClass(false)} value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}

          {err && <p className="text-xs text-danger lowercase">{err}</p>}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div>
            {editing && (
              <button onClick={remove} disabled={busy} className={`${dangerBtn} min-h-[44px] px-3`}>
                delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} disabled={busy} className={`${ghostBtn} min-h-[44px] px-3`}>cancel</button>
            <button onClick={save} disabled={busy} className={`${goldBtn} min-h-[44px] px-4`}>
              {busy ? "saving..." : "save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
