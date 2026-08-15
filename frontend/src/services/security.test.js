import { describe, it, expect } from "vitest"
import { estimateEntropy, auditVault, checkBreaches } from "./security"

describe("estimateEntropy", () => {
  it("grows with length and character variety", () => {
    expect(estimateEntropy("")).toBe(0)
    expect(estimateEntropy("aaaa")).toBeLessThan(estimateEntropy("aaaaaaaaaaaa"))
    expect(estimateEntropy("abcd")).toBeLessThan(estimateEntropy("aB3$xyzQ"))
  })
})

describe("auditVault", () => {
  const items = [
    { id: "1", type: "login", name: "a", password: "12345" },          // weak + reused
    { id: "2", type: "login", name: "b", password: "12345" },          // weak + reused
    { id: "3", type: "login", name: "c", password: "Tr0ub4dor&3xK9!zQp" }, // strong, unique
    { id: "4", type: "note", name: "n", notes: "no password here" },    // ignored
  ]
  const audit = auditVault(items)

  it("counts only ciphers with a password", () => {
    expect(audit.counts.total).toBe(3)
  })
  it("flags weak passwords", () => {
    const names = audit.weak.map((w) => w.item.name)
    expect(names).toContain("a")
    expect(names).toContain("b")
    expect(names).not.toContain("c")
  })
  it("groups reused passwords", () => {
    expect(audit.reused).toHaveLength(1)
    expect(audit.reused[0]).toHaveLength(2)
    expect(audit.counts.reused).toBe(2)
  })
})

describe("checkBreaches", () => {
  it("matches a password's sha-1 suffix against the range response", async () => {
    const items = [{ id: "1", type: "login", name: "x", password: "password" }]
    // sha1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    // prefix = 5BAA6, suffix = 1E4C9B93F3F0682250B6CF8331B7EE68FD8
    const fakeRange = () => Promise.resolve("1E4C9B93F3F0682250B6CF8331B7EE68FD8:12345\r\nFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:1")
    const result = await checkBreaches(items, fakeRange)
    expect(result.get("password")).toBe(12345)
  })

  it("reports 0 when the suffix is absent", async () => {
    const items = [{ id: "1", type: "login", name: "x", password: "password" }]
    const result = await checkBreaches(items, () => Promise.resolve("0000000000000000000000000000000000000:9"))
    expect(result.get("password")).toBe(0)
  })
})
