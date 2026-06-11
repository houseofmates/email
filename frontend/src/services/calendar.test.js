import { describe, it, expect } from "vitest"
import { buildRecurrence, parseRecurrence, buildAlerts, parseAlerts, buildParticipants, parseParticipants, findConflicts } from "./calendar"

describe("recurrence mapping", () => {
  it("builds a jscalendar RecurrenceRule", () => {
    expect(buildRecurrence("weekly", 2)).toEqual([{ "@type": "RecurrenceRule", frequency: "weekly", interval: 2 }])
  })
  it("returns undefined for none/invalid", () => {
    expect(buildRecurrence("none")).toBeUndefined()
    expect(buildRecurrence("")).toBeUndefined()
    expect(buildRecurrence("hourly")).toBeUndefined()
  })
  it("clamps interval to >= 1", () => {
    expect(buildRecurrence("daily", 0)[0].interval).toBe(1)
  })
  it("round-trips through parseRecurrence", () => {
    expect(parseRecurrence(buildRecurrence("monthly", 3))).toEqual({ freq: "monthly", interval: 3 })
    expect(parseRecurrence(undefined)).toEqual({ freq: "none", interval: 1 })
  })
})

describe("reminder/alert mapping", () => {
  it("builds an offset display alert (minutes before)", () => {
    const a = buildAlerts(15)
    expect(Object.values(a)[0].trigger.offset).toBe("-PT15M")
    expect(Object.values(a)[0].action).toBe("display")
  })
  it("uses PT0S for at-start", () => {
    expect(Object.values(buildAlerts(0))[0].trigger.offset).toBe("PT0S")
  })
  it("returns undefined for none/invalid", () => {
    expect(buildAlerts("none")).toBeUndefined()
    expect(buildAlerts(null)).toBeUndefined()
    expect(buildAlerts(-5)).toBeUndefined()
  })
  it("parses offsets back to minutes (m/h/d)", () => {
    expect(parseAlerts(buildAlerts(30))).toBe(30)
    expect(parseAlerts(buildAlerts(0))).toBe(0)
    expect(parseAlerts({ 1: { trigger: { offset: "-PT2H" } } })).toBe(120)
    expect(parseAlerts({ 1: { trigger: { offset: "-P1D" } } })).toBe(1440)
    expect(parseAlerts(undefined)).toBeNull()
  })
})

describe("participants / invitations", () => {
  it("builds an organizer + attendees map", () => {
    const p = buildParticipants("me@x.co", ["a@y.co", "b@z.co"])
    const vals = Object.values(p)
    expect(vals.find((v) => v.roles.owner).participationStatus).toBe("accepted")
    const attendees = vals.filter((v) => !v.roles.owner)
    expect(attendees).toHaveLength(2)
    expect(attendees[0].sendTo.imip).toMatch(/^mailto:/)
    expect(attendees[0].participationStatus).toBe("needs-action")
  })
  it("dedupes the organizer out of the attendee list", () => {
    const p = buildParticipants("me@x.co", ["me@x.co", "a@y.co"])
    expect(Object.values(p).filter((v) => !v.roles.owner)).toHaveLength(1)
  })
  it("returns undefined when there are no attendees", () => {
    expect(buildParticipants("me@x.co", [])).toBeUndefined()
  })
  it("parses participants into organizer + attendees", () => {
    const parsed = parseParticipants(buildParticipants("me@x.co", ["a@y.co"]))
    expect(parsed.organizer).toBe("me@x.co")
    expect(parsed.attendees.map((a) => a.email)).toEqual(["a@y.co"])
  })
})

describe("findConflicts (free/busy-lite)", () => {
  const ev = (id, sh, eh) => ({ id, start: new Date(2026, 0, 1, sh), end: new Date(2026, 0, 1, eh) })
  const events = [ev("a", 9, 10), ev("b", 11, 12)]
  it("flags an overlapping time", () => {
    expect(findConflicts(new Date(2026, 0, 1, 9, 30), new Date(2026, 0, 1, 10, 30), events).map((e) => e.id)).toEqual(["a"])
  })
  it("ignores adjacent (half-open) and non-overlapping times", () => {
    expect(findConflicts(new Date(2026, 0, 1, 10), new Date(2026, 0, 1, 11), events)).toHaveLength(0)
  })
  it("excludes the event being edited", () => {
    expect(findConflicts(new Date(2026, 0, 1, 9), new Date(2026, 0, 1, 10), events, "a")).toHaveLength(0)
  })
})
