// calendar service — wraps the stalwart jmap calendars api (jscalendar / rfc 8984)
// reached through the bridge proxy on the same origin (/jmap/session + apiUrl).
//
// it mirrors services/mail.js: a cached session, an auth-header override that a
// react context can feed in, and a small set of high level helpers the ui uses.
//
// jmap calendars overview (see frontend/CALENDAR_JMAP.md for the long version):
//  - Calendar/get          -> the user's calendars (id, name, color)
//  - CalendarEvent/query    -> event ids overlapping a {after, before} window
//  - CalendarEvent/get      -> the jscalendar objects for those ids
//  - CalendarEvent/set      -> create / update / destroy events
//
// jscalendar stores a wall-clock `start` ("2026-06-08T09:00:00"), a `timeZone`,
// and an iso-8601 `duration` ("PT1H"). we treat the browser's local zone as the
// event zone, which is the right behaviour for a self-hosted single-user setup.

const CORE = "urn:ietf:params:jmap:core"
const CALENDARS = "urn:ietf:params:jmap:calendars"

let _session = null
let _override = null

/** override the auth header (e.g. from a react context). */
export function setAuthHeader(header) {
  _override = header || null
}

/** clear the cached jmap session (call on logout). */
export function resetSession() {
  _session = null
}

function authHeader() {
  if (_override) return _override
  try {
    const saved = localStorage.getItem("email_creds")
    if (saved) {
      const { email, password } = JSON.parse(saved)
      return "Basic " + btoa(`${email}:${password}`)
    }
  } catch { /* ignore */ }
  return ""
}

async function getSession(force = false) {
  if (_session && !force) return _session
  const res = await fetch("/jmap/session", {
    credentials: "same-origin",
    headers: { Authorization: authHeader() },
  })
  if (!res.ok) throw new Error(`session ${res.status}`)
  _session = await res.json()
  return _session
}

/** does this stalwart advertise the jmap calendars capability? */
export async function calendarsSupported() {
  try {
    const session = await getSession()
    return !!session.capabilities?.[CALENDARS] || !!accountId(session)
  } catch {
    return false
  }
}

function accountId(session) {
  return (
    session.primaryAccounts?.[CALENDARS] ||
    session.primaryAccounts?.["urn:ietf:params:jmap:mail"] ||
    (session.accounts && Object.keys(session.accounts)[0]) ||
    null
  )
}

async function call(methodCalls) {
  const session = await getSession()
  const res = await fetch(session.apiUrl, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({ using: [CORE, CALENDARS], methodCalls }),
  })
  if (!res.ok) throw new Error(`jmap ${res.status}`)
  const data = await res.json()
  const err = (data.methodResponses || []).find((r) => r[0] === "error")
  if (err) throw new Error(err[1]?.description || err[1]?.type || "jmap error")
  return data.methodResponses || []
}

// ── date <-> jscalendar helpers ───────────────────────────

const pad = (n) => String(n).padStart(2, "0")

/** Date -> utc rfc3339 without fractional seconds ("2026-06-08T00:00:00Z"). */
function rfc3339(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z")
}

/** local Date -> jscalendar wall-clock "YYYY-MM-DDTHH:MM:SS". */
export function toLocalDateTime(d) {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

/** local Date -> jscalendar all-day "YYYY-MM-DD". */
export function toLocalDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** jscalendar wall-clock string -> local Date (zone is treated as local). */
function fromLocalDateTime(s) {
  if (!s) return null
  const [date, time = "00:00:00"] = s.split("T")
  const [y, mo, d] = date.split("-").map(Number)
  const [h, mi, se] = time.split(":").map(Number)
  return new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0, se || 0)
}

/** seconds between two Dates -> iso-8601 duration ("PT1H30M" / "P1D"). */
export function toDuration(start, end) {
  let secs = Math.max(0, Math.round((end - start) / 1000))
  const days = Math.floor(secs / 86400)
  secs -= days * 86400
  const h = Math.floor(secs / 3600)
  secs -= h * 3600
  const m = Math.floor(secs / 60)
  const s = secs - m * 60
  let out = "P"
  if (days) out += `${days}D`
  if (h || m || s || out === "P") {
    out += "T"
    if (h) out += `${h}H`
    if (m) out += `${m}M`
    if (s || (!h && !m)) out += `${s}S`
  }
  return out
}

/** iso-8601 duration -> seconds. */
export function durationToSeconds(dur) {
  if (!dur) return 3600
  const m = /P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/.exec(dur)
  if (!m) return 3600
  const [, d, h, mi, s] = m.map((x) => Number(x) || 0)
  return d * 86400 + h * 3600 + mi * 60 + s
}

// ── public api ────────────────────────────────────────────

/** list the user's calendars. */
export async function getCalendars() {
  const session = await getSession()
  const acc = accountId(session)
  if (!acc) throw new Error("no calendar account")
  const r = await call([
    ["Calendar/get", { accountId: acc, properties: ["id", "name", "color", "isSubscribed", "myRights"] }, "0"],
  ])
  const list = r[0]?.[1]?.list || []
  return list.map((c) => ({ id: c.id, name: c.name || "calendar", color: c.color || "#f6b012" }))
}

const EVENT_PROPS = [
  "id", "uid", "calendarIds", "title", "description", "start",
  "duration", "timeZone", "showWithoutTime", "location", "status", "color",
  "recurrenceRules", "alerts", "participants", "replyTo",
]

// ── recurrence + reminders (jscalendar) — pure, exported for tests ───────────
const FREQS = ["daily", "weekly", "monthly", "yearly"]

export function buildRecurrence(freq, interval = 1) {
  if (!freq || freq === "none" || !FREQS.includes(freq)) return undefined
  return [{ "@type": "RecurrenceRule", frequency: freq, interval: Math.max(1, Number(interval) || 1) }]
}

export function parseRecurrence(rules) {
  const r = Array.isArray(rules) ? rules[0] : null
  return r?.frequency ? { freq: r.frequency, interval: r.interval || 1 } : { freq: "none", interval: 1 }
}

// minutes-before -> a single display Alert (offset trigger). 0 = at start time.
export function buildAlerts(minutes) {
  if (minutes == null || minutes === "" || minutes === "none") return undefined
  const m = Number(minutes)
  if (Number.isNaN(m) || m < 0) return undefined
  const offset = m === 0 ? "PT0S" : `-PT${m}M`
  return { "1": { "@type": "Alert", trigger: { "@type": "OffsetTrigger", offset }, action: "display" } }
}

export function parseAlerts(alerts) {
  const a = alerts && Object.values(alerts)[0]
  const off = a?.trigger?.offset
  if (!off) return null
  if (/PT0S/.test(off)) return 0
  let m
  if ((m = /PT(\d+)M/.exec(off))) return +m[1]
  if ((m = /PT(\d+)H/.exec(off))) return +m[1] * 60
  if ((m = /P(\d+)D/.exec(off))) return +m[1] * 1440
  return null
}

// ── participants / invitations (jscalendar) ──────────────────────────────────
const pkey = (email) => "p_" + String(email).toLowerCase().replace(/[^a-z0-9]/g, "")

// build a participants map: the organizer (owner, accepted) + attendees
// (needs-action, expecting a reply). stalwart sends the imip invitations.
export function buildParticipants(organizerEmail, attendees) {
  const emails = (attendees || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean)
  if (!emails.length) return undefined
  const parts = {}
  if (organizerEmail) {
    parts[pkey(organizerEmail)] = { "@type": "Participant", name: organizerEmail, sendTo: { imip: `mailto:${organizerEmail}` }, roles: { owner: true, attendee: true }, participationStatus: "accepted" }
  }
  for (const e of emails) {
    if (organizerEmail && e === organizerEmail.toLowerCase()) continue
    parts[pkey(e)] = { "@type": "Participant", sendTo: { imip: `mailto:${e}` }, roles: { attendee: true }, participationStatus: "needs-action", expectReply: true }
  }
  return parts
}

export function parseParticipants(participants) {
  const list = Object.entries(participants || {}).map(([id, p]) => ({
    id,
    email: (p.sendTo?.imip || "").replace(/^mailto:/i, "") || p.email || "",
    name: p.name || "",
    status: p.participationStatus || "needs-action",
    owner: !!p.roles?.owner,
  }))
  return { participants: list, organizer: list.find((p) => p.owner)?.email || null, attendees: list.filter((p) => !p.owner) }
}

// ── free/busy-lite: conflict detection against the user's own events ──────────
// (true attendee availability needs server scheduling; this flags self-overlap.)
export function findConflicts(start, end, events, excludeId) {
  const s = start?.getTime?.() ?? start
  const e = end?.getTime?.() ?? end
  if (s == null || e == null) return []
  return (events || []).filter((ev) => {
    if (!ev || ev.id === excludeId || ev.allDay) return false
    const es = ev.start?.getTime?.() ?? 0
    const ee = ev.end?.getTime?.() ?? es
    return s < ee && es < e // half-open overlap
  })
}

/** normalize a jscalendar event into the shape the ui uses. */
function normalize(ev) {
  const allDay = !!ev.showWithoutTime
  const start = fromLocalDateTime(ev.start)
  const end = new Date((start?.getTime() || 0) + durationToSeconds(ev.duration) * 1000)
  return {
    id: ev.id,
    uid: ev.uid,
    title: ev.title || "(untitled)",
    description: ev.description || "",
    location: ev.location || "",
    start,
    end,
    allDay,
    color: ev.color || null,
    calendarId: ev.calendarIds ? Object.keys(ev.calendarIds)[0] : null,
    recurrence: parseRecurrence(ev.recurrenceRules),
    reminderMinutes: parseAlerts(ev.alerts),
    ...parseParticipants(ev.participants),
  }
}

/** events overlapping [from, to). dates are local Date objects. */
export async function listEvents(from, to) {
  const session = await getSession()
  const acc = accountId(session)
  if (!acc) throw new Error("no calendar account")
  const r = await call([
    [
      "CalendarEvent/query",
      {
        accountId: acc,
        // stalwart parses these with a strict rfc3339 reader that rejects the
        // ".000" fractional seconds toISOString() emits — drop them.
        filter: { after: rfc3339(from), before: rfc3339(to) },
      },
      "0",
    ],
    [
      "CalendarEvent/get",
      {
        accountId: acc,
        "#ids": { resultOf: "0", name: "CalendarEvent/query", path: "/ids" },
        properties: EVENT_PROPS,
      },
      "1",
    ],
  ])
  const list = r.find((x) => x[0] === "CalendarEvent/get")?.[1]?.list || []
  return list.map(normalize).filter((e) => e.start)
}

/** create an event. {title, description, location, start:Date, end:Date, allDay, calendarId} */
export async function createEvent(ev) {
  const session = await getSession()
  const acc = accountId(session)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Etc/UTC"
  const obj = {
    "@type": "Event",
    calendarIds: ev.calendarId ? { [ev.calendarId]: true } : {},
    title: ev.title || "(untitled)",
    description: ev.description || undefined,
    location: ev.location || undefined,
  }
  if (ev.allDay) {
    obj.showWithoutTime = true
    obj.start = toLocalDate(ev.start) + "T00:00:00"
    obj.duration = toDuration(ev.start, ev.end || new Date(ev.start.getTime() + 86400000))
  } else {
    obj.start = toLocalDateTime(ev.start)
    obj.timeZone = tz
    obj.duration = toDuration(ev.start, ev.end || new Date(ev.start.getTime() + 3600000))
  }
  obj.recurrenceRules = buildRecurrence(ev.recurrence?.freq, ev.recurrence?.interval)
  obj.alerts = buildAlerts(ev.reminderMinutes)
  const participants = buildParticipants(ev.organizer, ev.attendees)
  if (participants) {
    obj.participants = participants
    if (ev.organizer) obj.replyTo = { imip: `mailto:${ev.organizer}` }
  }
  const r = await call([["CalendarEvent/set", { accountId: acc, create: { new: obj } }, "0"]])
  const set = r[0]?.[1]
  if (set?.created?.new) return set.created.new.id || true
  throw new Error(set?.notCreated?.new?.description || "create failed")
}

/** patch an event. fields: {title, description, location, start, end, allDay}. */
export async function updateEvent(id, fields) {
  const session = await getSession()
  const acc = accountId(session)
  const patch = {}
  if (fields.title !== undefined) patch.title = fields.title
  if (fields.description !== undefined) patch.description = fields.description
  if (fields.location !== undefined) patch.location = fields.location
  if (fields.start) {
    if (fields.allDay) {
      patch.showWithoutTime = true
      patch.start = toLocalDate(fields.start) + "T00:00:00"
    } else {
      patch.showWithoutTime = false
      patch.start = toLocalDateTime(fields.start)
      patch.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Etc/UTC"
    }
    if (fields.end) patch.duration = toDuration(fields.start, fields.end)
  }
  if (fields.recurrence !== undefined) patch.recurrenceRules = buildRecurrence(fields.recurrence?.freq, fields.recurrence?.interval) || null
  if (fields.reminderMinutes !== undefined) patch.alerts = buildAlerts(fields.reminderMinutes) || null
  if (fields.attendees !== undefined) {
    const parts = buildParticipants(fields.organizer, fields.attendees)
    patch.participants = parts || null
    patch.replyTo = parts && fields.organizer ? { imip: `mailto:${fields.organizer}` } : null
  }
  // rsvp: update only the user's participation status (accept/tentative/decline)
  if (fields.myParticipantId && fields.myStatus) {
    patch[`participants/${fields.myParticipantId}/participationStatus`] = fields.myStatus
  }
  const r = await call([["CalendarEvent/set", { accountId: acc, update: { [id]: patch } }, "0"]])
  const set = r[0]?.[1]
  if (set?.updated && id in set.updated) return true
  throw new Error(set?.notUpdated?.[id]?.description || "update failed")
}

/** delete an event. */
export async function deleteEvent(id) {
  const session = await getSession()
  const acc = accountId(session)
  const r = await call([["CalendarEvent/set", { accountId: acc, destroy: [id] }, "0"]])
  const set = r[0]?.[1]
  if (set?.destroyed?.includes(id)) return true
  throw new Error(set?.notDestroyed?.[id]?.description || "delete failed")
}

/** the user's caldav collection url for external clients (thunderbird, etc.). */
export function caldavUrl(userEmail) {
  const user = (userEmail || "").trim()
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  return `${origin}/dav/calendars/${encodeURIComponent(user)}/`
}
