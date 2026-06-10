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
  const [freq, setFreq] = useState(initial?.recurrence?.freq || "none")
  const [interval, setIntervalVal] = useState(initial?.recurrence?.interval || 1)
  const [reminder, setReminder] = useState(initial?.reminderMinutes == null ? "none" : String(initial.reminderMinutes))
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
      await onSave({
        id: initial?.id, title: title.trim(), description, location, allDay, start, end, calendarId,
        recurrence: { freq, interval: Number(interval) || 1 },
        reminderMinutes: reminder === "none" ? "none" : Number(reminder),
      })
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

          {/* recurrence */}
          <div className="flex items-center gap-2">
            <label className="w-20 shrink-0 text-xs text-text-info lowercase">repeats</label>
            <select className={inputClass(false)} value={freq} onChange={(e) => setFreq(e.target.value)} aria-label="repeats">
              <option value="none">does not repeat</option>
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
            </select>
            {freq !== "none" && (
              <>
                <span className="shrink-0 text-xs text-text-info lowercase">every</span>
                <input type="number" min="1" value={interval} onChange={(e) => setIntervalVal(e.target.value)}
                  className={`${inputClass(false)} w-16`} aria-label="interval" />
              </>
            )}
          </div>

          {/* reminder */}
          <div className="flex items-center gap-2">
            <label className="w-20 shrink-0 text-xs text-text-info lowercase">remind</label>
            <select className={inputClass(false)} value={reminder} onChange={(e) => setReminder(e.target.value)} aria-label="reminder">
              <option value="none">no reminder</option>
              <option value="0">at start time</option>
              <option value="5">5 minutes before</option>
              <option value="15">15 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
              <option value="1440">1 day before</option>
            </select>
          </div>

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
