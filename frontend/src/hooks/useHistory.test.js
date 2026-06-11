import { describe, it, expect } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useHistory } from "./useHistory"

const setup = () => renderHook(() => useHistory("", { debounce: 0 }))

describe("useHistory", () => {
  it("tracks the present value", () => {
    const { result } = setup()
    act(() => result.current.set("a"))
    expect(result.current.value).toBe("a")
  })

  it("undoes and redoes edits", () => {
    const { result } = setup()
    act(() => result.current.set("a"))
    act(() => result.current.set("ab"))
    act(() => result.current.set("abc"))
    act(() => result.current.undo())
    expect(result.current.value).toBe("ab")
    act(() => result.current.undo())
    expect(result.current.value).toBe("a")
    act(() => result.current.redo())
    expect(result.current.value).toBe("ab")
  })

  it("a new edit clears the redo stack", () => {
    const { result } = setup()
    act(() => result.current.set("a"))
    act(() => result.current.set("ab"))
    act(() => result.current.undo())   // -> "a"
    act(() => result.current.set("ax")) // new branch
    expect(result.current.value).toBe("ax")
    act(() => result.current.redo())   // nothing to redo
    expect(result.current.value).toBe("ax")
  })

  it("undo at the start is a no-op", () => {
    const { result } = setup()
    act(() => result.current.undo())
    expect(result.current.value).toBe("")
  })

  it("ignores no-op sets (same value)", () => {
    const { result } = setup()
    act(() => result.current.set("a"))
    act(() => result.current.set("a"))
    act(() => result.current.undo())
    expect(result.current.value).toBe("") // only one real change recorded
  })

  it("reset clears history", () => {
    const { result } = setup()
    act(() => result.current.set("a"))
    act(() => result.current.reset("z"))
    expect(result.current.value).toBe("z")
    act(() => result.current.undo())
    expect(result.current.value).toBe("z")
  })

  it("onKeyDown wires ctrl+z / ctrl+shift+z", () => {
    const { result } = setup()
    act(() => result.current.set("a"))
    act(() => result.current.set("ab"))
    const ev = (opts) => ({ ...opts, preventDefault() {} })
    act(() => result.current.onKeyDown(ev({ key: "z", ctrlKey: true })))
    expect(result.current.value).toBe("a")
    act(() => result.current.onKeyDown(ev({ key: "z", ctrlKey: true, shiftKey: true })))
    expect(result.current.value).toBe("ab")
  })
})
