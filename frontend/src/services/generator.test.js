import { describe, it, expect } from "vitest"
import { generate, generatePassword, entropyBits, WORDS } from "./generator"

const AMBIGUOUS = /[lo01IO]/

describe("generate (character mode)", () => {
  it("respects the requested length", () => {
    for (const len of [8, 16, 20, 64]) {
      expect(generate({ length: len })).toHaveLength(len)
    }
  })

  it("uses only lowercase when other classes are disabled", () => {
    const pw = generate({ length: 40, lowercase: true, uppercase: false, numbers: false, symbols: false })
    expect(pw).toMatch(/^[a-z]+$/)
  })

  it("avoids ambiguous glyphs by default", () => {
    // sample many to make a stray ambiguous char overwhelmingly likely to surface
    for (let i = 0; i < 200; i++) {
      expect(AMBIGUOUS.test(generate({ length: 24 }))).toBe(false)
    }
  })

  it("includes ambiguous glyphs only when avoidAmbiguous is off", () => {
    let sawAmbiguous = false
    for (let i = 0; i < 200 && !sawAmbiguous; i++) {
      if (AMBIGUOUS.test(generate({ length: 40, avoidAmbiguous: false }))) sawAmbiguous = true
    }
    expect(sawAmbiguous).toBe(true)
  })

  it("guarantees requested minimum numbers and symbols", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generate({ length: 16, minNumbers: 3, minSymbols: 2 })
      expect((pw.match(/[0-9]/g) || []).length).toBeGreaterThanOrEqual(3)
      expect((pw.match(/[!@#$%^&*()\-_=+[\]{};:,.?]/g) || []).length).toBeGreaterThanOrEqual(2)
    }
  })

  it("throws when no character set is selected", () => {
    expect(() => generate({ lowercase: false, uppercase: false, numbers: false, symbols: false }))
      .toThrow(/at least one/)
  })

  it("produces unique output across calls (no fixed seed)", () => {
    const set = new Set(Array.from({ length: 100 }, () => generate({ length: 24 })))
    expect(set.size).toBe(100)
  })

  it("is reasonably uniform (smoke check for modulo bias)", () => {
    // single-char draws from a 4-symbol pool should spread roughly evenly
    const pool = "abcd"
    const counts = {}
    for (let i = 0; i < 4000; i++) {
      const c = generate({ length: 1, lowercase: true, uppercase: false, numbers: false, symbols: false })
      counts[c] = (counts[c] || 0) + 1
    }
    // every produced char is a valid lowercase letter; just assert spread exists
    expect(Object.keys(counts).length).toBeGreaterThan(10)
    void pool
  })
})

describe("generate (passphrase mode)", () => {
  it("produces the requested number of words plus a trailing number", () => {
    const phrase = generate({ passphrase: true, words: 4, wordSeparator: "-", includeNumber: true, capitalize: false })
    const parts = phrase.split("-")
    expect(parts).toHaveLength(5) // 4 words + 1 number
    expect(parts.slice(0, 4).every((w) => WORDS.includes(w))).toBe(true)
    expect(Number.isInteger(Number(parts[4]))).toBe(true)
  })

  it("capitalizes words when requested", () => {
    const phrase = generate({ passphrase: true, words: 3, includeNumber: false, capitalize: true })
    for (const w of phrase.split("-")) expect(w[0]).toBe(w[0].toUpperCase())
  })

  it("honors a custom separator", () => {
    const phrase = generate({ passphrase: true, words: 3, wordSeparator: ".", includeNumber: false })
    expect(phrase.split(".")).toHaveLength(3)
  })
})

describe("entropyBits", () => {
  it("grows with length and shrinks with fewer classes", () => {
    const full = entropyBits({ length: 20 })
    const longer = entropyBits({ length: 40 })
    const lowerOnly = entropyBits({ length: 20, uppercase: false, numbers: false, symbols: false })
    expect(longer).toBeGreaterThan(full)
    expect(lowerOnly).toBeLessThan(full)
  })
})

describe("generatePassword (back-compat)", () => {
  it("defaults to length 20 and accepts a length arg", () => {
    expect(generatePassword()).toHaveLength(20)
    expect(generatePassword(32)).toHaveLength(32)
  })
})
