import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import Passwords from "./passwords"

// mock the vaultwarden transport so the flow is exercised without a live bridge.
// vi.hoisted runs before the hoisted vi.mock factory, so mockVault is defined.
const mockVault = vi.hoisted(() => ({
  status: vi.fn(),
  sync: vi.fn(),
  unlock: vi.fn(),
  create: vi.fn(),
  lock: vi.fn(),
  changePassword: vi.fn(),
  saveCipher: vi.fn(),
  deleteCipher: vi.fn(),
  createFolder: vi.fn(),
  renameFolder: vi.fn(),
  deleteFolder: vi.fn(),
}))
vi.mock("./services/vault", () => ({
  vault: mockVault,
  VaultLockedError: class VaultLockedError extends Error {},
}))

const props = { authHeader: "Basic x", onNavigate: () => {}, onLogout: () => {}, userEmail: "me@example.com" }

beforeEach(() => {
  for (const fn of Object.values(mockVault)) fn.mockReset()
})

describe("Passwords (option-b flow)", () => {
  it("shows the unlock screen when an initialized vault is locked", async () => {
    mockVault.status.mockResolvedValue({ initialized: true, unlocked: false })
    render(<Passwords {...props} />)
    expect(await screen.findByText("unlock vault")).toBeInTheDocument()
    expect(screen.getByText("master password")).toBeInTheDocument()
  })

  it("shows the create screen on first run (no vault yet)", async () => {
    mockVault.status.mockResolvedValue({ initialized: false, unlocked: false })
    render(<Passwords {...props} />)
    // create mode asks for confirmation (unique label)
    expect(await screen.findByText("confirm password")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "create vault" })).toBeInTheDocument()
  })

  it("unlocks and then syncs the vault", async () => {
    mockVault.status.mockResolvedValue({ initialized: true, unlocked: false })
    mockVault.unlock.mockResolvedValue({ token: "t" })
    mockVault.sync.mockResolvedValue({
      ciphers: [{ id: "1", type: "login", name: "github", username: "octocat", password: "hunter2" }],
      folders: [],
      lastSync: "2026-01-01T00:00:00Z",
    })
    render(<Passwords {...props} />)
    await screen.findByText("unlock vault")

    const pw = document.querySelector('input[type="password"]')
    fireEvent.change(pw, { target: { value: "master" } })
    fireEvent.click(screen.getByRole("button", { name: "unlock" }))

    await waitFor(() => expect(mockVault.unlock).toHaveBeenCalledWith("Basic x", "me@example.com", "master"))
    // the synced item renders
    expect(await screen.findByText("github")).toBeInTheDocument()
  })

  it("renders items directly when the vault is already unlocked", async () => {
    mockVault.status.mockResolvedValue({ initialized: true, unlocked: true, email: "me@example.com" })
    mockVault.sync.mockResolvedValue({
      ciphers: [{ id: "2", type: "card", name: "visa", number: "4111111111111111" }],
      folders: [],
      lastSync: null,
    })
    render(<Passwords {...props} />)
    expect(await screen.findByText("visa")).toBeInTheDocument()
    // card subtitle masks all but the last 4
    expect(screen.getByText("•••• 1111")).toBeInTheDocument()
    // no unlock screen
    expect(screen.queryByText("unlock vault")).toBeNull()
  })
})
