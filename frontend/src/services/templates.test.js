import { describe, it, expect, beforeEach } from "vitest"
import { getTemplates, saveTemplate, deleteTemplate } from "./templates"

beforeEach(() => localStorage.clear())

describe("templates", () => {
  it("starts empty", () => {
    expect(getTemplates()).toEqual([])
  })

  it("saves a new template with a generated id", () => {
    const list = saveTemplate({ name: "ooo", body: "away until monday" })
    expect(list).toHaveLength(1)
    expect(list[0].id).toBeTruthy()
    expect(list[0].name).toBe("ooo")
    expect(getTemplates()).toHaveLength(1)
  })

  it("updates an existing template by id", () => {
    const [t] = saveTemplate({ name: "a", body: "x" })
    const updated = saveTemplate({ id: t.id, name: "a2", body: "y" })
    expect(updated).toHaveLength(1)
    expect(updated[0].name).toBe("a2")
    expect(updated[0].body).toBe("y")
  })

  it("deletes by id", () => {
    const [t] = saveTemplate({ name: "a", body: "x" })
    saveTemplate({ name: "b", body: "z" })
    const after = deleteTemplate(t.id)
    expect(after).toHaveLength(1)
    expect(after[0].name).toBe("b")
  })
})
