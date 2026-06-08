import { useRef, useState } from "react"

// day / week timeline with drag interactions:
//  - desktop: drag on empty space to create a time range; drag an event to move
//    it; drag the bottom handle to resize; right-click a slot to add.
//  - mobile: long-press an empty slot to add; tap an event to edit.
// snapping is 15 minutes. onCreate opens the editor pre-filled; onMove/onResize
// persist immediately (drag-to-reschedule).

const HOUR_PX = 48
const SNAP = 15
const DAY_MIN = 24 * 60
const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const minutesOf = (d) => d.getHours() * 60 + d.getMinutes()

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function fmt(mins) {
  const h = Math.floor(mins / 60), m = mins % 60
  return `${h}:${String(m).padStart(2, "0")}`
}

export default function CalendarTimeGrid({ days, events, onCreate, onOpen, onMove, onResize }) {
  const colsRef = useRef(null)
  const drag = useRef(null)
  const longPress = useRef(null)
  const [draft, setDraft] = useState(null)
  const today = new Date()

  function locate(e) {
    const rect = colsRef.current.getBoundingClientRect()
    const colW = rect.width / days.length
    const dayIndex = clamp(Math.floor((e.clientX - rect.left) / colW), 0, days.length - 1)
    const raw = (e.clientY - rect.top) / HOUR_PX * 60
    const mins = clamp(Math.round(raw / SNAP) * SNAP, 0, DAY_MIN)
    return { dayIndex, mins }
  }

  function minToDate(dayIndex, mins) {
    const d = new Date(days[dayIndex])
    d.setHours(0, 0, 0, 0)
    d.setMinutes(mins)
    return d
  }

  function clearLongPress() {
    if (longPress.current) { clearTimeout(longPress.current); longPress.current = null }
  }

  // ── empty-slot interactions ──
  function slotDown(e) {
    if (e.button === 2) return
    const loc = locate(e)
    if (e.pointerType === "mouse") {
      drag.current = { mode: "create", dayIndex: loc.dayIndex, startMin: loc.mins, anchor: loc.mins, moved: false }
      setDraft({ dayIndex: loc.dayIndex, startMin: loc.mins, endMin: loc.mins + SNAP })
      colsRef.current.setPointerCapture(e.pointerId)
    } else {
      // touch: long-press to create, let normal scrolling happen otherwise
      const startY = e.clientY, startX = e.clientX
      drag.current = { mode: "pending", startX, startY, loc }
      longPress.current = setTimeout(() => {
        longPress.current = null
        drag.current = null
        onCreate(minToDate(loc.dayIndex, loc.mins), minToDate(loc.dayIndex, loc.mins + 60))
      }, 450)
    }
  }

  function onMovePointer(e) {
    const d = drag.current
    if (!d) return
    if (d.mode === "pending") {
      if (Math.abs(e.clientY - d.startY) > 8 || Math.abs(e.clientX - d.startX) > 8) {
        clearLongPress(); drag.current = null // it's a scroll, bail out
      }
      return
    }
    const { dayIndex, mins } = locate(e)
    if (d.mode === "create") {
      const s = Math.min(d.anchor, mins), en = Math.max(d.anchor + SNAP, mins)
      d.startMin = s; d.endMin = en; d.moved = en - s > SNAP
      setDraft({ dayIndex: d.dayIndex, startMin: s, endMin: en })
    } else if (d.mode === "move") {
      const ns = clamp(mins - d.grab, 0, DAY_MIN - d.dur)
      d.target = { dayIndex, startMin: ns }; d.moved = true
      setDraft({ dayIndex, startMin: ns, endMin: ns + d.dur, id: d.event.id })
    } else if (d.mode === "resize") {
      const en = clamp(Math.max(d.startMin + SNAP, mins), 0, DAY_MIN)
      d.target = { endMin: en }; d.moved = true
      setDraft({ dayIndex: d.dayIndex, startMin: d.startMin, endMin: en, id: d.event.id })
    }
  }

  function onUpPointer() {
    clearLongPress()
    const d = drag.current
    drag.current = null
    setDraft(null)
    if (!d || d.mode === "pending") return
    if (d.mode === "create") {
      const en = d.moved ? d.endMin : d.startMin + 60
      onCreate(minToDate(d.dayIndex, d.startMin), minToDate(d.dayIndex, en))
    } else if (d.mode === "move" && d.moved && d.target) {
      const ns = minToDate(d.target.dayIndex, d.target.startMin)
      onMove(d.event, ns, new Date(ns.getTime() + d.dur * 60000))
    } else if (d.mode === "move" && !d.moved) {
      onOpen(d.event)
    } else if (d.mode === "resize" && d.moved && d.target) {
      onResize(d.event, minToDate(d.dayIndex, d.target.endMin))
    }
  }

  function slotContext(e) {
    e.preventDefault()
    const { dayIndex, mins } = locate(e)
    onCreate(minToDate(dayIndex, mins), minToDate(dayIndex, mins + 60))
  }

  // ── event interactions (mouse drag move/resize) ──
  function eventDown(e, ev, dayIndex, mode) {
    if (e.pointerType !== "mouse") return // touch uses onClick to open
    e.stopPropagation()
    if (e.button === 2) return
    const { mins } = locate(e)
    const sMin = minutesOf(ev.start)
    const dur = Math.max(SNAP, Math.round((ev.end - ev.start) / 60000))
    drag.current = mode === "resize"
      ? { mode: "resize", event: ev, dayIndex, startMin: sMin, moved: false }
      : { mode: "move", event: ev, dayIndex, grab: mins - sMin, dur, moved: false }
    colsRef.current.setPointerCapture(e.pointerId)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* day headers */}
      <div className="flex border-b border-pkm-500 pl-12">
        {days.map((d, i) => {
          const isToday = sameDay(d, today)
          return (
            <div key={i} className="flex-1 px-1 py-2 text-center">
              <div className="text-[11px] text-text-info lowercase">{DOW[d.getDay()]}</div>
              <div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                isToday ? "bg-gold font-semibold text-pkm-900" : "text-text-primary"
              }`}>{d.getDate()}</div>
            </div>
          )
        })}
      </div>

      {/* scrolling timeline */}
      <div className="relative flex-1 overflow-y-auto">
        <div className="flex" style={{ height: HOUR_PX * 24 }}>
          {/* hour gutter */}
          <div className="w-12 shrink-0">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="relative" style={{ height: HOUR_PX }}>
                <span className="absolute -top-2 right-1 text-[10px] text-text-info lowercase">{h}:00</span>
              </div>
            ))}
          </div>

          {/* day columns (single shared interaction surface) */}
          <div
            ref={colsRef}
            className="relative flex flex-1 touch-pan-y select-none"
            onPointerDown={slotDown}
            onPointerMove={onMovePointer}
            onPointerUp={onUpPointer}
            onPointerCancel={onUpPointer}
            onContextMenu={slotContext}
          >
            {days.map((day, di) => {
              const dayEvents = events.filter((e) => !e.allDay && e.start && sameDay(e.start, day))
              return (
                <div key={di} className="relative flex-1 border-l border-pkm-500">
                  {/* hour lines */}
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="border-b border-pkm-600" style={{ height: HOUR_PX }} />
                  ))}

                  {/* events */}
                  {dayEvents.map((ev) => {
                    const s = minutesOf(ev.start)
                    const e2 = sameDay(ev.end, day) ? minutesOf(ev.end) : DAY_MIN
                    const top = s / 60 * HOUR_PX
                    const height = Math.max(18, (e2 - s) / 60 * HOUR_PX)
                    const hidden = draft?.id === ev.id
                    return (
                      <div
                        key={ev.id}
                        onPointerDown={(e) => eventDown(e, ev, di, "move")}
                        className={`absolute left-0.5 right-0.5 overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] text-pkm-900 shadow-sm lowercase ${
                          hidden ? "opacity-0" : "cursor-grab active:cursor-grabbing"
                        }`}
                        style={{ top, height, background: ev.color || "#f6b012" }}
                        title={ev.title}
                      >
                        <div className="font-semibold leading-tight">{ev.title}</div>
                        <div className="opacity-80">{fmt(s)}</div>
                        {/* resize handle */}
                        <div
                          onPointerDown={(e) => eventDown(e, ev, di, "resize")}
                          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                        />
                      </div>
                    )
                  })}

                  {/* drag preview */}
                  {draft && draft.dayIndex === di && (
                    <div
                      className="pointer-events-none absolute left-0.5 right-0.5 rounded-md border border-gold bg-gold-dim px-1.5 py-0.5 text-[11px] text-gold lowercase"
                      style={{ top: draft.startMin / 60 * HOUR_PX, height: Math.max(18, (draft.endMin - draft.startMin) / 60 * HOUR_PX) }}
                    >
                      {fmt(draft.startMin)}–{fmt(draft.endMin)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
