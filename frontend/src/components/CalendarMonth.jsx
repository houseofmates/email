// month grid view. tap a day to add an event, tap an event to edit.
// fully responsive: cells shrink and scroll on small screens.

const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfGrid(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const d = new Date(first)
  d.setDate(1 - first.getDay()) // back up to sunday
  return d
}

export default function CalendarMonth({ anchor, events, onCreate, onOpen }) {
  const gridStart = startOfGrid(anchor)
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })
  const today = new Date()

  function eventsOn(day) {
    return events
      .filter((e) => e.start && sameDay(e.start, day))
      .sort((a, b) => a.start - b.start)
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="grid grid-cols-7 border-b border-pkm-500">
        {DOW.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs text-text-info lowercase">{d}</div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {days.map((day, i) => {
          const inMonth = day.getMonth() === anchor.getMonth()
          const isToday = sameDay(day, today)
          const dayEvents = eventsOn(day)
          return (
            <div
              key={i}
              onClick={() => {
                const start = new Date(day)
                start.setHours(9, 0, 0, 0)
                onCreate(start)
              }}
              className={`min-h-[72px] cursor-pointer border-b border-r border-pkm-500 p-1 transition hover:bg-pkm-700/40 ${
                inMonth ? "" : "opacity-40"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday ? "bg-gold font-semibold text-pkm-900" : "text-text-primary"
                }`}>
                  {day.getDate()}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    onClick={(ev) => { ev.stopPropagation(); onOpen(e) }}
                    className="block w-full truncate rounded px-1 py-0.5 text-left text-[11px] text-pkm-900 lowercase"
                    style={{ background: e.color || "#f6b012" }}
                    title={e.title}
                  >
                    {!e.allDay && (
                      <span className="opacity-80">{e.start.getHours()}:{String(e.start.getMinutes()).padStart(2, "0")} </span>
                    )}
                    {e.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <span className="block px-1 text-[10px] text-text-info lowercase">+{dayEvents.length - 3} more</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
