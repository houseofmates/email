// vault import/export — pure, no react, no network.
//
// normalizes external password exports into our cipher shape (type strings +
// flat fields, carrying a `folder` NAME so the caller can map it to a folder
// id), and serializes the current vault to json / csv. supports our own json,
// bitwarden json (unencrypted), and generic csv (column-name detected).

const BW_TYPE = { 1: "login", 2: "note", 3: "card", 4: "identity" }

// fields we round-trip in exports (besides type/name/notes/folder)
const EXTRA_FIELDS = {
  login: ["username", "password", "uri", "totp"],
  card: ["cardholderName", "brand", "number", "expMonth", "expYear", "code"],
  identity: ["firstName", "lastName", "username", "email", "phone", "address1", "city", "state", "postalCode", "country", "company"],
  note: [],
}

// ── csv (minimal RFC4180-ish) ────────────────────────────────────────────────
function parseCSV(text) {
  const rows = []
  let row = [], field = "", inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false }
      else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ",") { row.push(field); field = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field); field = ""
      if (row.some((x) => x !== "")) rows.push(row)
      row = []
    } else field += c
  }
  if (field !== "" || row.length) { row.push(field); if (row.some((x) => x !== "")) rows.push(row) }
  return rows
}

function csvCell(v) {
  const s = v == null ? "" : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// map common header aliases (bitwarden, 1password, lastpass, generic) -> our keys
const CSV_ALIASES = {
  name: ["name", "title", "account"],
  username: ["username", "login_username", "user", "email"],
  password: ["password", "login_password", "pass"],
  uri: ["uri", "url", "login_uri", "website"],
  notes: ["notes", "note", "extra"],
  folder: ["folder", "grouping", "group", "category"],
  type: ["type"],
}

function headerIndex(headers) {
  const lower = headers.map((h) => h.trim().toLowerCase())
  const idx = {}
  for (const [key, aliases] of Object.entries(CSV_ALIASES)) {
    const i = lower.findIndex((h) => aliases.includes(h))
    if (i !== -1) idx[key] = i
  }
  return idx
}

function importCSV(text) {
  const rows = parseCSV(text)
  if (rows.length < 2) return { items: [], folders: [] }
  const idx = headerIndex(rows[0])
  const folders = new Set()
  const items = []
  for (const r of rows.slice(1)) {
    const get = (k) => (idx[k] != null ? (r[idx[k]] || "").trim() : "")
    const folder = get("folder")
    if (folder) folders.add(folder)
    const rawType = get("type")
    const type = BW_TYPE[rawType] || (["login", "note", "card", "identity"].includes(rawType) ? rawType : "login")
    items.push({
      type,
      name: get("name") || get("uri") || get("username") || "untitled",
      username: get("username"), password: get("password"), uri: get("uri"),
      notes: get("notes"), folder,
    })
  }
  return { items, folders: [...folders].map((name) => ({ name })) }
}

// ── json ─────────────────────────────────────────────────────────────────────
function importJSON(text) {
  const data = JSON.parse(text)
  const rawItems = data.items || data.ciphers || []
  const folderById = {}
  for (const f of data.folders || []) if (f.id) folderById[f.id] = f.name
  const folderNames = new Set((data.folders || []).map((f) => f.name).filter(Boolean))

  const items = rawItems.map((it) => {
    // bitwarden uses numeric type + nested login/card/identity; ours is flat
    const isBW = typeof it.type === "number"
    const type = isBW ? BW_TYPE[it.type] || "note" : it.type || "login"
    const base = {
      type, name: it.name || "untitled", notes: it.notes || "",
      folder: it.folder || folderById[it.folderId] || "",
    }
    if (base.folder) folderNames.add(base.folder)
    if (isBW) {
      if (type === "login" && it.login) Object.assign(base, {
        username: it.login.username || "", password: it.login.password || "",
        uri: it.login.uris?.[0]?.uri || "", totp: it.login.totp || "",
      })
      else if (type === "card" && it.card) Object.assign(base, {
        cardholderName: it.card.cardholderName || "", brand: it.card.brand || "", number: it.card.number || "",
        expMonth: it.card.expMonth || "", expYear: it.card.expYear || "", code: it.card.code || "",
      })
      else if (type === "identity" && it.identity) for (const k of EXTRA_FIELDS.identity) base[k] = it.identity[k] || ""
    } else {
      for (const k of EXTRA_FIELDS[type] || []) if (it[k] != null) base[k] = it[k]
    }
    return base
  })
  return { items, folders: [...folderNames].map((name) => ({ name })) }
}

export function parseImport(text, filename = "") {
  const looksJSON = /\.json$/i.test(filename) || text.trim().startsWith("{")
  return looksJSON ? importJSON(text) : importCSV(text)
}

// ── export ───────────────────────────────────────────────────────────────────
// items: the synced ciphers; folderName: (id) => name lookup
export function toJSON(items, folderName) {
  return JSON.stringify({
    version: 1,
    exportedFields: "plaintext",
    items: items.map((i) => {
      const out = { type: i.type, name: i.name || "", notes: i.notes || "", folder: i.folderId ? folderName(i.folderId) : "" }
      for (const k of EXTRA_FIELDS[i.type] || []) if (i[k]) out[k] = i[k]
      return out
    }),
  }, null, 2)
}

export function toCSV(items, folderName) {
  const cols = ["type", "name", "username", "password", "uri", "notes", "folder"]
  const lines = [cols.join(",")]
  for (const i of items) {
    lines.push(cols.map((c) => csvCell(c === "folder" ? (i.folderId ? folderName(i.folderId) : "") : i[c])).join(","))
  }
  return lines.join("\n")
}

export const _internal = { parseCSV, headerIndex }
