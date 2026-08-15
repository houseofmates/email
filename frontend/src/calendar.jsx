import { useCallback, useEffect, useState } from "react"
import Layout from "./layout"
import CalendarMonth from "./components/CalendarMonth"
import CalendarTimeGrid from "./components/CalendarTimeGrid"
import EventModal from "./components/EventModal"
import { ToastProvider, useToast } from "./components/Toast"
import { goldBtn, ghostBtn } from "./components/ui"
import {
  setAuthHeader, getCalendars, listEvents, createEvent, updateEvent, deleteEvent, caldavUrl,
} from "./services/calendar"

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

function startOfWeek(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay())
  return x
}

function rangeFor(view, anchor) {
  if (view === "day") {
    const s = new Date(anchor); s.setHours(0, 0, 0, 0)
    const e = new Date(s); e.setDate(s.getDate() + 1)
    return { from: s, to: e, days: [new Date(s)] }
  }
  if (view === "week") {
    const s = startOfWeek(anchor)
    const e = new Date(s); e.setDate(s.getDate() + 7)
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d })
    return { from: s, to: e, days }
  }
  // month grid (6 weeks)
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const s = startOfWeek(first)
  const e = new Date(s); e.setDate(s.getDate() + 42)
  return { from: s, to: e, days: [] }
}

function CalendarInner({ authHeader, onNavigate, onLogout, userEmail }) {
  const toast = useToast()
  const [view, setView] = useState("week")
  const [anchor, setAnchor] = useState(() => new Date())
  const [events, setEvents] = useState([])
  const [calendars, setCalendars] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // {draft} or {event}
  const [showSubscribe, setShowSubscribe] = useState(false)

  useEffect(() => { setAuthHeader(authHeader) }, [authHeader])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { from, to } = rangeFor(view, anchor)
      const [cals, evs] = await Promise.all([
        calendars.length ? Promise.resolve(calendars) : getCalendars().catch(() => []),
        listEvents(from, to),
      ])
      if (!calendars.length) setCalendars(cals)
      setEvents(evs)
    } catch (e) {
      toast.show({ kind: "err", message: `calendar: ${e.message || e}` })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchor, authHeader])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  function shift(dir) {
    const d = new Date(anchor)
    if (view === "day") d.setDate(d.getDate() + dir)
    else if (view === "week") d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setAnchor(d)
  }

  async function handleSave(form) {
    if (form.id) {
      await updateEvent(form.id, form)
      toast.show({ kind: "ok", message: "event updated" })
    } else {
      await createEvent(form)
      toast.show({ kind: "ok", message: "event created" })
    }
    await load()
  }

  async function handleDelete(id) {
    await deleteEvent(id)
    toast.show({ kind: "ok", message: "event deleted" })
    await load()
  }

  // drag-to-reschedule: persist immediately, optimistic local update
  async function reschedule(ev, start, end) {
    setEvents((list) => list.map((e) => (e.id === ev.id ? { ...e, start, end } : e)))
    try {
      await updateEvent(ev.id, { start, end, allDay: ev.allDay })
    } catch (e) {
      toast.show({ kind: "err", message: `move failed: ${e.message || e}` })
      await load()
    }
  }

  async function copyCaldav() {
    const url = caldavUrl(userEmail)
    try {
      await navigator.clipboard.writeText(url)
      toast.show({ kind: "ok", message: "caldav url copied" })
    } catch {
      toast.show({ kind: "info", message: url })
    }
  }

  const { days } = rangeFor(view, anchor)
  const heading = view === "month"
    ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
    : view === "day"
      ? `${MONTHS[anchor.getMonth()]} ${anchor.getDate()}`
      : `${MONTHS[days[0].getMonth()]} ${days[0].getDate()} - ${MONTHS[days[6].getMonth()]} ${days[6].getDate()}`

  return (
    <Layout currentPage="calendar" onNavigate={onNavigate} onLogout={onLogout} userEmail={userEmail}>
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-pkm-500 px-4 py-3">
        <h1 className="text-lg text-gold lowercase tracking-wide">calendar</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className={`${ghostBtn} min-h-[44px] min-w-[44px]`} aria-label="previous">‹</button>
          <button onClick={() => setAnchor(new Date())} className={`${ghostBtn} min-h-[44px]`}>today</button>
          <button onClick={() => shift(1)} className={`${ghostBtn} min-h-[44px] min-w-[44px]`} aria-label="next">›</button>
        </div>
        <span className="text-sm text-text-primary lowercase">{heading}</span>

        <div className="ml-auto flex items-center gap-1">
          {["day", "week", "month"].map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`min-h-[44px] rounded-md px-3 text-xs lowercase transition active:scale-[0.98] ${
                view === v ? "bg-pkm-600 text-gold font-semibold" : "text-text-info hover:text-text-primary"
              }`}>{v}</button>
          ))}
          <button onClick={() => setShowSubscribe((v) => !v)} className={`${ghostBtn} min-h-[44px]`} title="subscribe / caldav">subscribe</button>
          <button onClick={() => setEditing({ draft: defaultDraft(anchor, calendars[0]?.id) })} className={`${goldBtn} min-h-[44px]`}>new</button>
        </div>
      </div>

      {/* subscribe / caldav (hidden until clicked) */}
      {showSubscribe && (
        <div className="border-b border-pkm-500 bg-pkm-800 px-4 py-3">
          <p className="mb-2 text-xs text-text-info lowercase leading-relaxed">
            subscribe from thunderbird, apple calendar, etc. using this caldav url:
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-pkm-700 px-2 py-1 text-xs text-text-primary break-all">{caldavUrl(userEmail)}</code>
            <button onClick={copyCaldav} className={`${goldBtn} min-h-[44px]`}>copy url</button>
          </div>
        </div>
      )}

      {/* view */}
      <div className="relative flex flex-1 min-h-0 flex-col">
        {loading && (
          <div className="absolute right-4 top-2 z-10">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-pkm-500 border-t-gold" />
          </div>
        )}
        {view === "month" ? (
          <CalendarMonth
            anchor={anchor}
            events={events}
            onCreate={(start) => setEditing({ draft: { ...defaultDraft(start, calendars[0]?.id), start, end: new Date(start.getTime() + 3600000) } })}
            onOpen={(e) => setEditing({ event: e })}
          />
        ) : (
          <CalendarTimeGrid
            days={days}
            events={events}
            onCreate={(start, end) => setEditing({ draft: { ...defaultDraft(start, calendars[0]?.id), start, end } })}
            onOpen={(e) => setEditing({ event: e })}
            onMove={reschedule}
            onResize={(ev, end) => reschedule(ev, ev.start, end)}
          />
        )}
      </div>

      {editing && (
        <EventModal
          initial={editing.event || editing.draft}
          calendars={calendars}
          events={events}
          userEmail={userEmail}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </Layout>
  )
}

function defaultDraft(start, calendarId) {
  const s = new Date(start)
  return { title: "", description: "", location: "", allDay: false, start: s, end: new Date(s.getTime() + 3600000), calendarId }
}

export default function Calendar(props) {
  return (
    <ToastProvider>
      <CalendarInner {...props} />
    </ToastProvider>
  )
}
