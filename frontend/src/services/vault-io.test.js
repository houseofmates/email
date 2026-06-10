import { describe, it, expect } from "vitest"
import { parseImport, toJSON, toCSV } from "./vault-io"

const folderName = (id) => ({ f1: "social" }[id] || "")

describe("export", () => {
  const items = [
    { id: "1", type: "login", name: "github", username: "octocat", password: "hunter2", uri: "https://github.com", notes: "n", folderId: "f1" },
    { id: "2", type: "note", name: "wifi", notes: "the code" },
  ]

  it("toJSON emits plaintext items with folder names and round-trips through parseImport", () => {
    const json = toJSON(items, folderName)
    const { items: parsed, folders } = parseImport(json, "vault.json")
    expect(parsed).toHaveLength(2)
    const gh = parsed.find((p) => p.name === "github")
    expect(gh.username).toBe("octocat")
    expect(gh.password).toBe("hunter2")
    expect(gh.folder).toBe("social")
    expect(folders.map((f) => f.name)).toContain("social")
  })

  it("toCSV emits a header + escaped rows", () => {
    const csv = toCSV([{ type: "login", name: 'a,b "c"', username: "u", password: "p", uri: "", notes: "", folderId: "f1" }], folderName)
    const [header, row] = csv.split("\n")
    expect(header).toBe("type,name,username,password,uri,notes,folder")
    expect(row).toContain('"a,b ""c"""') // comma + quotes escaped
    expect(row).toContain("social")
  })
})

describe("import", () => {
  it("parses bitwarden json (numeric types + nested login + folders)", () => {
    const bw = JSON.stringify({
      folders: [{ id: "abc", name: "work" }],
      items: [
        { type: 1, name: "gmail", folderId: "abc", login: { username: "me", password: "pw", uris: [{ uri: "https://gmail.com" }] } },
        { type: 2, name: "secret note", notes: "hidden" },
      ],
    })
    const { items, folders } = parseImport(bw, "bitwarden_export.json")
    const gmail = items.find((i) => i.name === "gmail")
    expect(gmail.type).toBe("login")
    expect(gmail.username).toBe("me")
    expect(gmail.uri).toBe("https://gmail.com")
    expect(gmail.folder).toBe("work")
    expect(items.find((i) => i.name === "secret note").type).toBe("note")
    expect(folders.map((f) => f.name)).toContain("work")
  })

  it("parses generic csv with aliased headers", () => {
    const csv = 'name,login_username,login_password,login_uri,folder\nGitHub,octocat,hunter2,https://github.com,Dev\n'
    const { items, folders } = parseImport(csv, "lastpass.csv")
    expect(items).toHaveLength(1)
    expect(items[0].type).toBe("login")
    expect(items[0].username).toBe("octocat")
    expect(items[0].uri).toBe("https://github.com")
    expect(items[0].folder).toBe("Dev")
    expect(folders.map((f) => f.name)).toContain("Dev")
  })

  it("handles quoted csv fields containing commas and newlines", () => {
    const csv = 'name,notes\n"acme, inc","line1\nline2"\n'
    const { items } = parseImport(csv, "x.csv")
    expect(items[0].name).toBe("acme, inc")
    expect(items[0].notes).toBe("line1\nline2")
  })
})
