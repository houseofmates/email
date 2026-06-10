import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import Onboarding from "./Onboarding"

describe("Onboarding", () => {
  it("advances through steps with next", () => {
    render(<Onboarding onDone={() => {}} onNavigate={() => {}} />)
    expect(screen.getByRole("heading", { name: "welcome" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "next" }))
    expect(screen.getByRole("heading", { name: "your vault" })).toBeInTheDocument()
  })

  it("can go back", () => {
    render(<Onboarding onDone={() => {}} onNavigate={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "next" }))
    fireEvent.click(screen.getByRole("button", { name: "back" }))
    expect(screen.getByRole("heading", { name: "welcome" })).toBeInTheDocument()
  })

  it("skip completes immediately", () => {
    const onDone = vi.fn()
    render(<Onboarding onDone={onDone} onNavigate={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "skip" }))
    expect(onDone).toHaveBeenCalled()
  })

  it("an action button navigates and completes", () => {
    const onDone = vi.fn(), onNavigate = vi.fn()
    render(<Onboarding onDone={onDone} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole("button", { name: "next" })) // -> your vault (has action)
    fireEvent.click(screen.getByRole("button", { name: /open passwords/ }))
    expect(onNavigate).toHaveBeenCalledWith("passwords")
    expect(onDone).toHaveBeenCalled()
  })

  it("finishes on the last step", () => {
    const onDone = vi.fn()
    render(<Onboarding onDone={onDone} onNavigate={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "next" }))
    fireEvent.click(screen.getByRole("button", { name: "next" }))
    fireEvent.click(screen.getByRole("button", { name: "next" }))
    fireEvent.click(screen.getByRole("button", { name: "get started" }))
    expect(onDone).toHaveBeenCalled()
  })
})
