# how the calendar uses jmap

the calendar view talks to **stalwart** over **jmap for calendars**
(jscalendar / rfc 8984), proxied on the same origin by the bridge
(`/jmap/session` + the `apiUrl` advertised in the session document). there is
**no external caldav proxy** for the web ui — caldav is only exposed for
*external* clients (thunderbird, apple calendar) at `/dav/calendars/<user>/`.

all of this lives in [`src/services/calendar.js`](src/services/calendar.js); the
views (`components/CalendarTimeGrid.jsx`, `components/CalendarMonth.jsx`,
`components/EventModal.jsx`) only deal with normalised event objects.

## request flow

1. `GET /jmap/session` → cached session document. the account id is taken from
   `primaryAccounts["urn:ietf:params:jmap:calendars"]` (falling back to the mail
   account / first account).
2. every api call is a single `POST` to `session.apiUrl` with
   `using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:calendars"]`.

## methods used

| ui action            | jmap method(s)                                   |
| -------------------- | ------------------------------------------------ |
| list calendars       | `Calendar/get`                                   |
| load a date window   | `CalendarEvent/query` (filter `{after, before}`) then `CalendarEvent/get` by `#ids` |
| create event         | `CalendarEvent/set` `create`                     |
| move / resize / edit | `CalendarEvent/set` `update`                     |
| delete event         | `CalendarEvent/set` `destroy`                    |

the query/get pair is chained in one request using a jmap back-reference
(`"#ids": { resultOf, name, path: "/ids" }`) so a date range is one round-trip.

## jscalendar shape

events are stored as jscalendar objects. the fields we read/write:

```jsonc
{
  "@type": "Event",
  "uid": "…",
  "calendarIds": { "<calendarId>": true },
  "title": "standup",
  "description": "",
  "location": "",
  "start": "2026-06-08T09:00:00",   // wall-clock, no offset
  "timeZone": "America/Los_Angeles", // omitted for all-day
  "duration": "PT30M",               // iso-8601 duration
  "showWithoutTime": false           // true => all-day
}
```

- `start` is a **floating wall-clock** string. the ui treats it in the browser's
  local zone, which is correct for a self-hosted single-user setup. helpers
  `toLocalDateTime` / `fromLocalDateTime` convert to/from a JS `Date`.
- duration is stored as iso-8601 (`PT1H30M`, `P1D`). `toDuration` /
  `durationToSeconds` convert to/from milliseconds so the views can position and
  resize blocks. `end` is always derived as `start + duration`.
- all-day events set `showWithoutTime: true` and use a midnight `start`.

## drag & drop → jmap

the timeline (`CalendarTimeGrid.jsx`) snaps to 15 minutes and, on drop, calls
back into the page which persists immediately:

- **move**  → `update` with new `start` + recomputed `duration`
- **resize** → `update` with same `start`, new `duration`
- **create-by-drag** / **right-click** / **long-press** → opens `EventModal`,
  then `create`

moves are applied optimistically in local state and reverted (via a reload) if
the `CalendarEvent/set` call reports the event in `notUpdated`.

## debugging tips

- a `502` on `POST /jmap/` is almost always the **bridge** dropping the request
  body — see the note in `bridge/server.js`; do not re-add a global
  `express.json()` before the proxies.
- if `getCalendars()` returns `[]`, confirm the account has calendars enabled in
  stalwart and that the session advertises
  `urn:ietf:params:jmap:calendars` under `capabilities`.
- inspect the raw exchange: `POST {apiUrl}` with the `using` + `methodCalls`
  body shown above; stalwart echoes a `methodResponses` array.
