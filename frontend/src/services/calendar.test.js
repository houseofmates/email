import { describe, it, expect } from "vitest"
import { buildRecurrence, parseRecurrence, buildAlerts, parseAlerts } from "./calendar"

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
