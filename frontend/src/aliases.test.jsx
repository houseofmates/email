import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import Aliases from "./aliases"

const mockSL = vi.hoisted(() => ({
  list: vi.fn(), mailboxes: vi.fn(), domains: vi.fn(), options: vi.fn(),
  toggle: vi.fn(), update: vi.fn(), remove: vi.fn(),
  contacts: vi.fn(), activities: vi.fn(), addContact: vi.fn(), removeContact: vi.fn(),
  createRandom: vi.fn(), createCustom: vi.fn(),
  addMailbox: vi.fn(), updateMailbox: vi.fn(), removeMailbox: vi.fn(), updateDomain: vi.fn(),
}))
vi.mock("./services/simplelogin", () => ({ simplelogin: mockSL }))

const props = { authHeader: "Basic x", onNavigate: () => {}, onLogout: () => {}, userEmail: "me@x.co" }

function stubFetch(provider, aliasesPayload = []) {
  globalThis.fetch = vi.fn((url) => {
    if (String(url).includes("/config")) return Promise.resolve({ json: () => Promise.resolve({ provider }) })
    return Promise.resolve({ ok: true, json: () => Promise.resolve(aliasesPayload) })
  })
}

beforeEach(() => { for (const f of Object.values(mockSL)) f.mockReset() })
afterEach(() => { delete globalThis.fetch })

describe("Aliases provider detection", () => {
  it("renders basic mode when the backend is the stalwart store", async () => {
    stubFetch("stalwart", [])
    render(<Aliases {...props} />)
    expect(await screen.findByText(/basic mode/i)).toBeInTheDocument()
    // simplelogin-only sub-nav should not be present
    expect(screen.queryByText("mailboxes")).toBeNull()
  })

  it("renders the full simplelogin ui with the alias list", async () => {
    stubFetch("simplelogin")
    mockSL.list.mockResolvedValue({ aliases: [{ id: 1, email: "spam@me.co", enabled: true, nb_forward: 3, nb_block: 1, nb_reply: 0, mailbox: { id: 9, email: "real@me.co" } }] })
    mockSL.mailboxes.mockResolvedValue({ mailboxes: [{ id: 9, email: "real@me.co", default: true, verified: true }] })
    mockSL.domains.mockResolvedValue({ custom_domains: [] })

    render(<Aliases {...props} />)
    expect(await screen.findByText("spam@me.co")).toBeInTheDocument()
    // sub-nav present
    expect(screen.getByRole("button", { name: "mailboxes" })).toBeInTheDocument()
  })

  it("toggles an alias enabled state via the client", async () => {
    stubFetch("simplelogin")
    mockSL.list.mockResolvedValue({ aliases: [{ id: 7, email: "x@me.co", enabled: true, mailbox: { id: 1, email: "r@me.co" } }] })
    mockSL.mailboxes.mockResolvedValue({ mailboxes: [] })
    mockSL.domains.mockResolvedValue({ custom_domains: [] })
    mockSL.toggle.mockResolvedValue({ enabled: false })

    render(<Aliases {...props} />)
    await screen.findByText("x@me.co")
    fireEvent.click(screen.getByRole("switch", { name: "enabled" }))
    await waitFor(() => expect(mockSL.toggle).toHaveBeenCalledWith("Basic x", 7))
  })
})
