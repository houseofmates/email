import { describe, it, expect } from "vitest"
import { parseSearchQuery } from "./search"

describe("parseSearchQuery", () => {
  it("returns null for empty input", () => {
    expect(parseSearchQuery("")).toBeNull()
    expect(parseSearchQuery("   ")).toBeNull()
  })

  it("treats bare words as a full-text condition", () => {
    expect(parseSearchQuery("invoice")).toEqual({ text: "invoice" })
    expect(parseSearchQuery("quarterly invoice")).toEqual({ text: "quarterly invoice" })
  })

  it("maps a single operator to a single condition", () => {
    expect(parseSearchQuery("from:boss@co")).toEqual({ from: "boss@co" })
    expect(parseSearchQuery("subject:hello")).toEqual({ subject: "hello" })
  })

  it("handles has:attachment and is:unread", () => {
    expect(parseSearchQuery("has:attachment")).toEqual({ hasAttachment: true })
    expect(parseSearchQuery("is:unread")).toEqual({ notKeyword: "$seen" })
  })

  it("parses before/after into iso dates", () => {
    const r = parseSearchQuery("after:2024-01-01")
    expect(r.after).toMatch(/^2024-01-01T/)
  })

  it("honors quoted phrase values", () => {
    expect(parseSearchQuery('subject:"year end"')).toEqual({ subject: "year end" })
  })

  it("combines multiple conditions with AND and trailing free text", () => {
    const r = parseSearchQuery("from:a@b has:attachment before:2025-01-01 report")
    expect(r.operator).toBe("AND")
    expect(r.conditions).toEqual(expect.arrayContaining([
      { from: "a@b" },
      { hasAttachment: true },
      expect.objectContaining({ before: expect.stringMatching(/^2025-01-01T/) }),
      { text: "report" },
    ]))
  })

  it("ignores unknown operators (kept as text)", () => {
    expect(parseSearchQuery("wat:foo")).toEqual({ text: "wat:foo" })
  })
})
