import { describe, it, expect } from "vitest"
import { toCard, fromCard } from "./jscontact"

describe("jscontact mapping", () => {
  it("maps a flat contact to a jscontact card", () => {
    const card = toCard({ name: "ada lovelace", emails: ["ada@x.co", "a@y.co"], phones: ["123"], org: "analytical", note: "hi" }, { addressBookId: "ab1" })
    expect(card["@type"]).toBe("Card")
    expect(card.kind).toBe("individual")
    expect(card.name.full).toBe("ada lovelace")
    expect(Object.values(card.emails).map((e) => e.address)).toEqual(["ada@x.co", "a@y.co"])
    expect(Object.values(card.phones)[0].number).toBe("123")
    expect(Object.values(card.organizations)[0].name).toBe("analytical")
    expect(Object.values(card.notes)[0].note).toBe("hi")
    expect(card.addressBookIds).toEqual({ ab1: true })
  })

  it("omits empty collections", () => {
    const card = toCard({ name: "x", emails: ["", null], phones: [] })
    expect(card.emails).toBeUndefined()
    expect(card.phones).toBeUndefined()
    expect(card.organizations).toBeUndefined()
  })

  it("reads a jscontact card back to flat", () => {
    const flat = fromCard({
      id: "c1", name: { full: "grace hopper" },
      emails: { e1: { address: "grace@navy.mil" } },
      phones: { p1: { number: "555" } },
      organizations: { o1: { name: "navy" } },
      notes: { n1: { note: "cobol" } },
      addressBookIds: { ab2: true },
    })
    expect(flat).toEqual({ id: "c1", addressBookId: "ab2", name: "grace hopper", emails: ["grace@navy.mil"], phones: ["555"], org: "navy", note: "cobol" })
  })

  it("falls back to name components when full is absent", () => {
    const flat = fromCard({ id: "c2", name: { components: [{ kind: "given", value: "alan" }, { kind: "surname", value: "turing" }] } })
    expect(flat.name).toBe("alan turing")
  })

  it("round-trips", () => {
    const original = { name: "linus", emails: ["l@kernel.org"], phones: ["1"], org: "linux", note: "git" }
    const back = fromCard({ id: "x", ...toCard(original, { addressBookId: "ab" }) })
    expect(back.name).toBe("linus")
    expect(back.emails).toEqual(["l@kernel.org"])
    expect(back.org).toBe("linux")
  })
})
