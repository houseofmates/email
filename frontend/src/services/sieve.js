// sieve script generator — pure, no network.
//
// turns the visual rule-builder model into an rfc 5228 sieve script that
// stalwart runs. kept side-effect free so it can be unit tested and previewed
// live in the ui before being saved via managesieve.
//
// rule model:
//   { name, match: "all" | "any", conditions: [ condition ], actions: [ action ], stop }
//   condition: { field: "from"|"to"|"cc"|"subject"|"body"|"attachment"|"size",
//                op: "contains"|"is"|"matches"|"not_contains", value }
//   action:    { type: "fileinto"|"flag"|"forward"|"discard"|"reject"|"keep"|"stop", value }
//
// vacation model:
//   { enabled, subject, message, days, addresses: [] }

// quote + escape a string for a sieve quoted-string literal
function q(s) {
  return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'
}

const HEADER_FIELDS = { from: "From", to: "To", cc: "Cc", subject: "Subject" }

// a single condition -> a sieve test expression
function buildTest(c) {
  const value = c.value ?? ""
  if (c.field === "size") {
    // value like "5M" / "200K" / "1000"
    return `size :over ${String(value).trim()}`
  }
  if (c.field === "attachment") {
    // requires the "body" extension; true when a content-type header marks an attachment
    return `header :contains "Content-Disposition" "attachment"`
  }
  if (c.field === "body") {
    const test = `body :text :contains ${q(value)}`
    return c.op === "not_contains" ? `not ${test}` : test
  }
  const header = HEADER_FIELDS[c.field]
  if (!header) return null
  const matchType = c.op === "is" ? ":is" : c.op === "matches" ? ":matches" : ":contains"
  const test = `header ${matchType} ${q(header)} ${q(value)}`
  return c.op === "not_contains" ? `not ${test}` : test
}

// a single action -> one or more sieve command lines (indented)
function buildAction(a) {
  switch (a.type) {
    case "fileinto": return [`  fileinto ${q(a.value)};`]
    case "flag":     return [`  addflag ${q(a.value || "\\\\Seen")};`]
    case "forward":  return [`  redirect :copy ${q(a.value)};`]
    case "discard":  return [`  discard;`]
    case "reject":   return [`  reject ${q(a.value || "message rejected")};`]
    case "keep":     return [`  keep;`]
    case "stop":     return [`  stop;`]
    default:         return []
  }
}

// which sieve extensions a set of actions/conditions needs (the require line)
function collectRequires(rules, vacation) {
  const req = new Set()
  for (const r of rules || []) {
    for (const c of r.conditions || []) {
      if (c.field === "body" || c.field === "attachment") req.add("body")
    }
    for (const a of r.actions || []) {
      if (a.type === "fileinto") req.add("fileinto")
      if (a.type === "flag") req.add("imap4flags")
      if (a.type === "reject") req.add("reject")
    }
    if (r.stop) { /* stop is core */ }
  }
  if (vacation?.enabled) req.add("vacation")
  return [...req]
}

// build one `if`/`elsif`-free block per rule (each rule is independent)
export function buildRule(rule) {
  const conds = (rule.conditions || []).map(buildTest).filter(Boolean)
  const actions = (rule.actions || []).flatMap(buildAction)
  if (rule.stop) actions.push("  stop;")
  if (!conds.length || !actions.length) return ""

  const join = rule.match === "any" ? "anyof" : "allof"
  const test = conds.length === 1 ? conds[0] : `${join} (${conds.join(", ")})`
  const header = rule.name ? `# ${String(rule.name).toLowerCase()}\n` : ""
  return `${header}if ${test} {\n${actions.join("\n")}\n}`
}

// vacation / auto-responder block
export function buildVacation(v) {
  if (!v?.enabled) return ""
  const parts = ["vacation"]
  if (v.days) parts.push(`:days ${parseInt(v.days, 10) || 7}`)
  if (v.subject) parts.push(`:subject ${q(v.subject)}`)
  if (Array.isArray(v.addresses) && v.addresses.length) {
    parts.push(`:addresses [${v.addresses.map(q).join(", ")}]`)
  }
  parts.push(q(v.message || "i am currently away."))
  return `# auto-responder\n${parts.join(" ")};`
}

// assemble a full, runnable script from all rules + optional vacation
export function buildScript(rules = [], vacation = null) {
  const requires = collectRequires(rules, vacation)
  const head = requires.length ? `require [${requires.map(q).join(", ")}];\n\n` : ""
  const body = rules.map(buildRule).filter(Boolean).join("\n\n")
  const vac = buildVacation(vacation)
  return [head + body, vac].filter(Boolean).join("\n\n").trim() + "\n"
}

export default { buildRule, buildVacation, buildScript }
