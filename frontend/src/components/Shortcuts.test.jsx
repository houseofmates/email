import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import Shortcuts from "./Shortcuts"

describe("Shortcuts", () => {
  it("toggles the cheat sheet with ?", () => {
    render(<Shortcuts onNavigate={() => {}} />)
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.keyDown(window, { key: "?" })
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    fireEvent.keyDown(window, { key: "?" })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("closes the cheat sheet on escape", () => {
    render(<Shortcuts onNavigate={() => {}} />)
    fireEvent.keyDown(window, { key: "?" })
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("navigates on the g-then-key sequence", () => {
    const onNavigate = vi.fn()
    render(<Shortcuts onNavigate={onNavigate} />)
    fireEvent.keyDown(window, { key: "g" })
    fireEvent.keyDown(window, { key: "p" })
    expect(onNavigate).toHaveBeenCalledWith("passwords")
  })

  it("does not navigate for a bare destination key without g", () => {
    const onNavigate = vi.fn()
    render(<Shortcuts onNavigate={onNavigate} />)
    fireEvent.keyDown(window, { key: "p" })
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it("ignores shortcuts while typing in an input", () => {
    const onNavigate = vi.fn()
    render(
      <div>
        <input data-testid="field" />
        <Shortcuts onNavigate={onNavigate} />
      </div>
    )
    const input = screen.getByTestId("field")
    // event bubbles from the input to the window listener with target=input
    fireEvent.keyDown(input, { key: "?" })
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.keyDown(input, { key: "g" })
    fireEvent.keyDown(input, { key: "p" })
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it("dispatches shortcut:refresh on u", () => {
    const handler = vi.fn()
    window.addEventListener("shortcut:refresh", handler)
    render(<Shortcuts onNavigate={() => {}} />)
    fireEvent.keyDown(window, { key: "u" })
    expect(handler).toHaveBeenCalledTimes(1)
    window.removeEventListener("shortcut:refresh", handler)
  })

  it("ignores keys combined with a modifier", () => {
    const onNavigate = vi.fn()
    render(<Shortcuts onNavigate={onNavigate} />)
    fireEvent.keyDown(window, { key: "?", metaKey: true })
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
