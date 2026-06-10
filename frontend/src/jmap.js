// minimal jmap client for the web ui.
// talks to the stalwart jmap endpoint discovered via /jmap/session.

const MAIL = "urn:ietf:params:jmap:mail"
const SUBMISSION = "urn:ietf:params:jmap:submission"
const CORE = "urn:ietf:params:jmap:core"
const SIEVE = "urn:ietf:params:jmap:sieve"

let _session = null

export async function getSession(authHeader, force = false) {
  if (_session && !force) return _session
  const res = await fetch("/jmap/session", {
    headers: { Authorization: authHeader },
  })
  if (!res.ok) throw new Error(`session ${res.status}`)
  _session = await res.json()
  return _session
}

export function resetSession() {
  _session = null
}

function accountId(session) {
  return (
    session.primaryAccounts?.[MAIL] ||
    (session.accounts && Object.keys(session.accounts)[0]) ||
    null
  )
}

async function call(authHeader, session, methodCalls, using = [CORE, MAIL]) {
  const res = await fetch(session.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ using, methodCalls }),
  })
  if (!res.ok) throw new Error(`jmap ${res.status}`)
  const data = await res.json()
  return data.methodResponses || []
}

// find a mailbox id by role (inbox/drafts/sent/...)
async function mailboxByRole(authHeader, session, acc, role) {
  const r = await call(authHeader, session, [
    ["Mailbox/query", { accountId: acc, filter: { role } }, "0"],
  ])
  const ids = r[0]?.[1]?.ids || []
  return ids[0] || null
}

export async function listInbox(authHeader, limit = 50) {
  const session = await getSession(authHeader)
  const acc = accountId(session)
  if (!acc) throw new Error("no mail account")

  const inboxId = await mailboxByRole(authHeader, session, acc, "inbox")
  if (!inboxId) return []

  const responses = await call(authHeader, session, [
    [
      "Email/query",
      {
        accountId: acc,
        filter: { inMailbox: inboxId },
        sort: [{ property: "receivedAt", isAscending: false }],
        limit,
      },
      "0",
    ],
    [
      "Email/get",
      {
        accountId: acc,
        "#ids": { resultOf: "0", name: "Email/query", path: "/ids" },
        properties: [
          "id",
          "threadId",
          "from",
          "subject",
          "preview",
          "receivedAt",
          "keywords",
        ],
      },
      "1",
    ],
  ])
  const list = responses.find((r) => r[0] === "Email/get")?.[1]?.list || []
  return list
}

export async function getEmail(authHeader, id) {
  const session = await getSession(authHeader)
  const acc = accountId(session)
  const responses = await call(authHeader, session, [
    [
      "Email/get",
      {
        accountId: acc,
        ids: [id],
        properties: [
          "id",
          "subject",
          "from",
          "to",
          "receivedAt",
          "preview",
          "textBody",
          "htmlBody",
          "bodyValues",
        ],
        fetchTextBodyValues: true,
        fetchHTMLBodyValues: true,
      },
      "0",
    ],
  ])
  return responses[0]?.[1]?.list?.[0] || null
}

// best-effort plain-text body extraction
export function emailText(email) {
  if (!email) return ""
  const parts = email.textBody?.length ? email.textBody : email.htmlBody || []
  const out = parts
    .map((p) => email.bodyValues?.[p.partId]?.value || "")
    .join("\n")
  return out
}

// mark/unmark a keyword (e.g. $seen)
export async function setKeyword(authHeader, id, keyword, value) {
  const session = await getSession(authHeader)
  const acc = accountId(session)
  await call(authHeader, session, [
    [
      "Email/set",
      {
        accountId: acc,
        update: { [id]: { [`keywords/${keyword}`]: value ? true : null } },
      },
      "0",
    ],
  ])
}

// compose + send a plain-text message
export async function sendEmail(authHeader, { from, to, subject, text }) {
  const session = await getSession(authHeader)
  const acc = accountId(session)

  // identity + drafts/sent mailboxes
  const pre = await call(
    authHeader,
    session,
    [["Identity/get", { accountId: acc, ids: null }, "0"]],
    [CORE, MAIL, SUBMISSION]
  )
  const identities = pre[0]?.[1]?.list || []
  const identity =
    identities.find((i) => i.email?.toLowerCase() === from?.toLowerCase()) ||
    identities[0]
  if (!identity) throw new Error("no sending identity configured")

  const draftsId = await mailboxByRole(authHeader, session, acc, "drafts")
  const sentId = await mailboxByRole(authHeader, session, acc, "sent")

  const recipients = to
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((email) => ({ email }))

  const draft = {
    mailboxIds: draftsId ? { [draftsId]: true } : {},
    keywords: { $draft: true },
    from: [{ email: identity.email, name: identity.name || undefined }],
    to: recipients,
    subject,
    bodyValues: { body: { value: text, charset: "utf-8" } },
    textBody: [{ partId: "body", type: "text/plain" }],
  }

  const onSuccessUpdateEmail = sentId
    ? {
        "#send": {
          [`mailboxIds/${draftsId}`]: null,
          [`mailboxIds/${sentId}`]: true,
          "keywords/$draft": null,
          "keywords/$seen": true,
        },
      }
    : undefined

  const responses = await call(
    authHeader,
    session,
    [
      ["Email/set", { accountId: acc, create: { draft } }, "0"],
      [
        "EmailSubmission/set",
        {
          accountId: acc,
          create: { send: { emailId: "#draft", identityId: identity.id } },
          onSuccessUpdateEmail,
        },
        "1",
      ],
    ],
    [CORE, MAIL, SUBMISSION]
  )

  const sub = responses.find((r) => r[0] === "EmailSubmission/set")?.[1]
  if (sub?.created?.send) return true
  const err =
    sub?.notCreated?.send?.description ||
    sub?.notCreated?.send?.type ||
    "send failed"
  throw new Error(err)
}

// list sending identities (the "from" addresses available to compose)
export async function listIdentities(authHeader) {
  const session = await getSession(authHeader)
  const acc = accountId(session)
  const responses = await call(authHeader, session,
    [["Identity/get", { accountId: acc, ids: null }, "0"]], [CORE, MAIL, SUBMISSION])
  return responses[0]?.[1]?.list || []
}

// ── advanced / full-text search ──────────────────────────────────────────────
// `filter` is a jmap Email FilterCondition/FilterOperator (e.g.
// { operator:"AND", conditions:[{ from:"x" },{ hasAttachment:true }] }).
// returns matching emails (envelope props), newest first.
export async function searchEmails(authHeader, filter, limit = 50) {
  const session = await getSession(authHeader)
  const acc = accountId(session)
  if (!acc) throw new Error("no mail account")
  const responses = await call(authHeader, session, [
    ["Email/query", { accountId: acc, filter, sort: [{ property: "receivedAt", isAscending: false }], limit }, "0"],
    ["Email/get", {
      accountId: acc,
      "#ids": { resultOf: "0", name: "Email/query", path: "/ids" },
      properties: ["id", "threadId", "from", "subject", "preview", "receivedAt", "keywords", "hasAttachment"],
    }, "1"],
  ])
  return responses.find((r) => r[0] === "Email/get")?.[1]?.list || []
}

// ── sieve scripts (filters + vacation) ───────────────────────────────────────
function uploadUrl(session, acc) {
  return (session.uploadUrl || "/jmap/upload/{accountId}/").replace("{accountId}", encodeURIComponent(acc))
}

export async function listSieveScripts(authHeader) {
  const session = await getSession(authHeader)
  const acc = accountId(session)
  const responses = await call(authHeader, session, [
    ["SieveScript/query", { accountId: acc }, "0"],
    ["SieveScript/get", {
      accountId: acc,
      "#ids": { resultOf: "0", name: "SieveScript/query", path: "/ids" },
      properties: ["id", "name", "isActive"],
    }, "1"],
  ], [CORE, SIEVE])
  return responses.find((r) => r[0] === "SieveScript/get")?.[1]?.list || []
}

// upload the script text as a blob, then create-or-update the named script and
// activate it. returns the SieveScript/set response.
export async function saveSieveScript(authHeader, { name = "filters", content, scriptId }) {
  const session = await getSession(authHeader)
  const acc = accountId(session)
  const up = await fetch(uploadUrl(session, acc), {
    method: "POST",
    headers: { "Content-Type": "application/sieve", Authorization: authHeader },
    body: content,
  })
  if (!up.ok) throw new Error(`sieve upload ${up.status}`)
  const { blobId } = await up.json()
  const op = scriptId
    ? { update: { [scriptId]: { blobId } }, onSuccessActivateScript: scriptId }
    : { create: { s: { name, blobId } }, onSuccessActivateScript: "#s" }
  const responses = await call(authHeader, session, [["SieveScript/set", { accountId: acc, ...op }, "0"]], [CORE, SIEVE])
  const r = responses.find((x) => x[0] === "SieveScript/set")?.[1]
  const failed = r?.notCreated?.s || (scriptId && r?.notUpdated?.[scriptId])
  if (failed) throw new Error(failed.description || failed.type || "sieve save failed")
  return r
}
