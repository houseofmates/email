import { describe, it, expect } from "vitest"
import { buildRule, buildVacation, buildScript } from "./sieve"

describe("buildRule", () => {
  it("emits a single header test for one condition", () => {
    const out = buildRule({ name: "news", match: "all", conditions: [{ field: "from", op: "contains", value: "newsletter@" }], actions: [{ type: "fileinto", value: "INBOX/news" }] })
    expect(out).toContain('if header :contains "From" "newsletter@"')
    expect(out).toContain('fileinto "INBOX/news";')
  })

  it("wraps multiple conditions with allof/anyof", () => {
    const all = buildRule({ match: "all", conditions: [{ field: "to", op: "is", value: "a@b.co" }, { field: "subject", op: "contains", value: "hi" }], actions: [{ type: "keep" }] })
    expect(all).toContain("allof (")
    const any = buildRule({ match: "any", conditions: [{ field: "to", op: "is", value: "a@b.co" }, { field: "subject", op: "contains", value: "hi" }], actions: [{ type: "keep" }] })
    expect(any).toContain("anyof (")
  })

  it("escapes quotes in values", () => {
    const out = buildRule({ conditions: [{ field: "subject", op: "contains", value: 'say "hi"' }], actions: [{ type: "keep" }] })
    expect(out).toContain('"say \\"hi\\""')
  })

  it("negates not_contains and supports body/size/attachment", () => {
    expect(buildRule({ conditions: [{ field: "body", op: "not_contains", value: "invoice" }], actions: [{ type: "discard" }] })).toContain("not body :text :contains")
    expect(buildRule({ conditions: [{ field: "size", value: "5M" }], actions: [{ type: "discard" }] })).toContain("size :over 5M")
    expect(buildRule({ conditions: [{ field: "attachment" }], actions: [{ type: "discard" }] })).toContain('"Content-Disposition" "attachment"')
  })

  it("renders each action type and a trailing stop", () => {
    const out = buildRule({ conditions: [{ field: "from", op: "is", value: "x@y.z" }], actions: [{ type: "fileinto", value: "F" }, { type: "flag", value: "\\Seen" }, { type: "forward", value: "me@z.co" }, { type: "reject", value: "no" }], stop: true })
    expect(out).toContain('fileinto "F";')
    expect(out).toContain('addflag "\\\\Seen";')
    expect(out).toContain('redirect :copy "me@z.co";')
    expect(out).toContain('reject "no";')
    expect(out.trimEnd().endsWith("stop;\n}") || out.includes("  stop;")).toBe(true)
  })

  it("returns empty when there are no conditions or no actions", () => {
    expect(buildRule({ conditions: [], actions: [{ type: "keep" }] })).toBe("")
    expect(buildRule({ conditions: [{ field: "from", op: "is", value: "x" }], actions: [] })).toBe("")
  })
})

describe("buildVacation", () => {
  it("is empty when disabled", () => {
    expect(buildVacation({ enabled: false })).toBe("")
  })
  it("includes days, subject, addresses and message", () => {
    const out = buildVacation({ enabled: true, days: 3, subject: "away", addresses: ["me@x.co"], message: "back soon" })
    expect(out).toContain("vacation :days 3")
    expect(out).toContain(':subject "away"')
    expect(out).toContain(':addresses ["me@x.co"]')
    expect(out).toContain('"back soon"')
  })
})

describe("buildScript", () => {
  it("derives the require line from used features", () => {
    const script = buildScript(
      [{ match: "any", conditions: [{ field: "body", op: "contains", value: "x" }], actions: [{ type: "fileinto", value: "F" }, { type: "flag", value: "\\Seen" }] }],
      { enabled: true, message: "away", days: 1 }
    )
    expect(script).toMatch(/^require \[/)
    for (const ext of ["fileinto", "imap4flags", "body", "vacation"]) expect(script).toContain(`"${ext}"`)
  })

  it("omits the require line when nothing needs it", () => {
    const script = buildScript([{ conditions: [{ field: "from", op: "is", value: "x" }], actions: [{ type: "keep" }] }], null)
    expect(script.startsWith("require")).toBe(false)
    expect(script).toContain("keep;")
  })
})
