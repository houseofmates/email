// parse a gmail-style search string into a jmap Email filter.
// supports: from: to: cc: subject: body: has:attachment before:<date>
// after:<date> (alias since:), and free text. quoted values are honored.

function toDate(v) {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function parseSearchQuery(input) {
  const q = (input || "").trim()
  if (!q) return null
  // split on whitespace but keep "quoted phrases" (incl. key:"a b") together
  const tokens = q.match(/(?:[^\s"]+|"[^"]*")+/g) || []
  const conditions = []
  const textParts = []

  for (const t of tokens) {
    const m = t.match(/^(\w+):(.*)$/)
    if (!m) { textParts.push(t); continue }
    const key = m[1].toLowerCase()
    const value = m[2].replace(/^"|"$/g, "")
    switch (key) {
      case "from": conditions.push({ from: value }); break
      case "to": conditions.push({ to: value }); break
      case "cc": conditions.push({ cc: value }); break
      case "subject": conditions.push({ subject: value }); break
      case "body": conditions.push({ body: value }); break
      case "has": if (value.toLowerCase() === "attachment") conditions.push({ hasAttachment: true }); break
      case "is": if (value.toLowerCase() === "unread") conditions.push({ notKeyword: "$seen" }); else if (value.toLowerCase() === "read") conditions.push({ hasKeyword: "$seen" }); break
      case "before": { const d = toDate(value); if (d) conditions.push({ before: d }); break }
      case "after": case "since": { const d = toDate(value); if (d) conditions.push({ after: d }); break }
      default: textParts.push(t)
    }
  }

  const text = textParts.join(" ").replace(/"/g, "").trim()
  if (text) conditions.push({ text })
  if (conditions.length === 0) return null
  if (conditions.length === 1) return conditions[0]
  return { operator: "AND", conditions }
}
