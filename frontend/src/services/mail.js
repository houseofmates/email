// mail service — thin wrapper around the stalwart jmap api, reached through the
// bridge proxy on the same origin (/jmap/session + the discovered apiUrl).
//
// all calls send the basic auth header derived from the saved login
// (localStorage "email_creds"), the same credentials the rest of the app uses.
// a caller can override the header via setAuthHeader() so a react context can
// feed it in directly.
//
// testing steps (manual):
//  - getFolders() returns inbox/sent/drafts/spam/trash ids after login.
//  - loadFolder(inboxId) only returns mail whose mailboxIds include inboxId.
//  - moveEmail / deleteEmail flip mailboxIds and the item leaves the source view.
//  - toggleFlag flips the $flagged keyword (favorites view).
//  - sendEmail creates a draft then submits it (stalwart moves it to sent).
//  - uploadBlob returns a blobId usable as an attachment / inline image.

const CORE = "urn:ietf:params:jmap:core"
const MAIL = "urn:ietf:params:jmap:mail"
const SUBMISSION = "urn:ietf:params:jmap:submission"

// standard folder roles -> the lowercase names the ui shows
export const STANDARD_FOLDERS = [
  { key: "inbox", role: "inbox", label: "inbox" },
  { key: "sent", role: "sent", label: "sent" },
  { key: "drafts", role: "drafts", label: "drafts" },
  { key: "spam", role: "junk", label: "spam" },
  { key: "trash", role: "trash", label: "trash" },
]

let _session = null
let _override = null

/** override the auth header (e.g. from a react context). */
export function setAuthHeader(header) {
  _override = header || null
}

/** build "Basic ..." from the saved creds, or use the override. */
function authHeader() {
  if (_override) return _override
  try {
    const saved = localStorage.getItem("email_creds")
    if (saved) {
      const { email, password } = JSON.parse(saved)
      return "Basic " + btoa(`${email}:${password}`)
    }
  } catch { /* ignore */ }
  return ""
}

/** clear the cached jmap session (call on logout). */
export function resetSession() {
  _session = null
}

/** fetch (and cache) the jmap session document. */
async function getSession(force = false) {
  if (_session && !force) return _session
  const res = await fetch("/jmap/session", {
    credentials: "same-origin",
    headers: { Authorization: authHeader() },
  })
  if (!res.ok) throw new Error(`session ${res.status}`)
  _session = await res.json()
  return _session
}

function accountId(session) {
  return (
    session.primaryAccounts?.[MAIL] ||
    (session.accounts && Object.keys(session.accounts)[0]) ||
    null
  )
}

/** low-level jmap request; returns the methodResponses array. */
async function call(methodCalls, using = [CORE, MAIL]) {
  const session = await getSession()
  const res = await fetch(session.apiUrl, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify({ using, methodCalls }),
  })
  if (!res.ok) throw new Error(`jmap ${res.status}`)
  const data = await res.json()
  return data.methodResponses || []
}

/**
 * list the account mailboxes.
 * @returns {Promise<Array<{id:string,name:string,role:string,totalEmails:number,unreadEmails:number}>>}
 */
export async function getFolders() {
  const session = await getSession()
  const acc = accountId(session)
  if (!acc) throw new Error("no mail account")
  const r = await call([
    [
      "Mailbox/get",
      { accountId: acc, properties: ["id", "name", "role", "totalEmails", "unreadEmails"] },
      "0",
    ],
  ])
  return r[0]?.[1]?.list || []
}

/** resolve { inbox, sent, drafts, spam, trash } -> mailbox id. */
export async function getFolderMap() {
  const folders = await getFolders()
  const map = {}
  for (const std of STANDARD_FOLDERS) {
    const hit = folders.find((f) => f.role === std.role)
    if (hit) map[std.key] = hit.id
  }
  return map
}

const LIST_PROPERTIES = [
  "id",
  "threadId",
  "mailboxIds",
  "keywords",
  "from",
  "to",
  "cc",
  "subject",
  "preview",
  "receivedAt",
  "hasAttachment",
]

/**
 * load emails for a folder. the virtual "favorites" folder returns every
 * message carrying the \Flagged ($flagged) keyword regardless of mailbox.
 * @param {string} folderId mailbox id, or "favorites"
 * @param {string} [query] free-text search
 * @param {number} [limit]
 * @param {number} [offset]
 * @returns {Promise<Array<object>>}
 */
export async function loadFolder(folderId, query = "", limit = 40, offset = 0) {
  const session = await getSession()
  const acc = accountId(session)
  if (!acc) throw new Error("no mail account")

  const conditions = []
  if (folderId === "favorites") conditions.push({ hasKeyword: "$flagged" })
  else if (folderId) conditions.push({ inMailbox: folderId })
  const trimmed = query.trim()
  if (trimmed) conditions.push({ text: trimmed })

  let filter
  if (conditions.length === 0) filter = undefined
  else if (conditions.length === 1) filter = conditions[0]
  else filter = { operator: "AND", conditions }

  const responses = await call([
    [
      "Email/query",
      {
        accountId: acc,
        filter,
        sort: [{ property: "receivedAt", isAscending: false }],
        position: offset,
        limit,
      },
      "0",
    ],
    [
      "Email/get",
      {
        accountId: acc,
        "#ids": { resultOf: "0", name: "Email/query", path: "/ids" },
        properties: LIST_PROPERTIES,
      },
      "1",
    ],
  ])
  return responses.find((r) => r[0] === "Email/get")?.[1]?.list || []
}

/**
 * fetch one email with full body + attachment metadata.
 * @param {string} emailId
 */
export async function getEmail(emailId) {
  const session = await getSession()
  const acc = accountId(session)
  const responses = await call([
    [
      "Email/get",
      {
        accountId: acc,
        ids: [emailId],
        properties: [
          "id",
          "threadId",
          "mailboxIds",
          "keywords",
          "from",
          "to",
          "cc",
          "bcc",
          "replyTo",
          "subject",
          "receivedAt",
          "preview",
          "textBody",
          "htmlBody",
          "bodyValues",
          "attachments",
        ],
        fetchTextBodyValues: true,
        fetchHTMLBodyValues: true,
      },
      "0",
    ],
  ])
  return responses[0]?.[1]?.list?.[0] || null
}

/** best-effort plain-text body extraction. */
export function emailText(email) {
  if (!email) return ""
  const parts = email.textBody?.length ? email.textBody : email.htmlBody || []
  return parts.map((p) => email.bodyValues?.[p.partId]?.value || "").join("\n")
}

/** the html body string, if any (already-stored html part). */
export function emailHtml(email) {
  if (!email) return ""
  const parts = email.htmlBody || []
  return parts.map((p) => email.bodyValues?.[p.partId]?.value || "").join("\n")
}

/**
 * move an email into a single target mailbox (replaces existing mailboxIds).
 * @param {string} emailId
 * @param {string} targetFolderId
 */
export async function moveEmail(emailId, targetFolderId) {
  const session = await getSession()
  const acc = accountId(session)
  const r = await call([
    [
      "Email/set",
      { accountId: acc, update: { [emailId]: { mailboxIds: { [targetFolderId]: true } } } },
      "0",
    ],
  ])
  const set = r[0]?.[1]
  if (set?.notUpdated?.[emailId]) {
    throw new Error(set.notUpdated[emailId].description || "move failed")
  }
  return true
}

/**
 * toggle the \Flagged keyword (favorites). returns the new flagged state.
 * @param {string} emailId
 */
export async function toggleFlag(emailId) {
  const current = await getEmail(emailId)
  const flagged = !!current?.keywords?.$flagged
  const session = await getSession()
  const acc = accountId(session)
  await call([
    [
      "Email/set",
      { accountId: acc, update: { [emailId]: { "keywords/$flagged": flagged ? null : true } } },
      "0",
    ],
  ])
  return !flagged
}

/**
 * move an email to trash. returns the original folder id so the caller can
 * offer an undo.
 * @param {string} emailId
 * @param {string} originalFolderId
 */
export async function deleteEmail(emailId, originalFolderId) {
  const map = await getFolderMap()
  if (!map.trash) throw new Error("no trash folder")
  await moveEmail(emailId, map.trash)
  return originalFolderId
}

function parseRecipients(value) {
  if (!value) return []
  return String(value)
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((email) => ({ email }))
}

/**
 * upload a file as a blob; returns { blobId, type, size, name }.
 * @param {File} file
 */
export async function uploadBlob(file) {
  const session = await getSession()
  const acc = accountId(session)
  const url = (session.uploadUrl || "/jmap/upload/{accountId}/")
    .replace("{accountId}", acc)
    .replace("{type}", encodeURIComponent(file.type || "application/octet-stream"))
  const res = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Authorization: authHeader(),
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  })
  if (!res.ok) throw new Error(`upload ${res.status}`)
  const data = await res.json()
  return { blobId: data.blobId, type: data.type || file.type, size: data.size, name: file.name }
}

/**
 * compose + send a message. creates a draft in drafts then submits it; on
 * success stalwart moves it to sent and delivers via smtp.
 * @param {string} to comma/semicolon separated recipients
 * @param {string} cc
 * @param {string} bcc
 * @param {string} subject
 * @param {string} markdownBody markdown source; sent as a text part, with an
 *   html part rendered from it
 * @param {Array<{blobId:string,type:string,name:string,size:number}>} [attachments]
 * @param {string} [htmlBody] pre-rendered html (otherwise the caller's markdown
 *   is used verbatim as the text part only)
 * @returns {Promise<{emailId:string, sentFolderId:string|null}>}
 */
export async function sendEmail(to, cc, bcc, subject, markdownBody, attachments = [], htmlBody = "") {
  const session = await getSession()
  const acc = accountId(session)

  const pre = await call([["Identity/get", { accountId: acc, ids: null }, "0"]], [CORE, MAIL, SUBMISSION])
  const identities = pre[0]?.[1]?.list || []
  const identity = identities[0]
  if (!identity) throw new Error("no sending identity configured")

  const map = await getFolderMap()
  const draftsId = map.drafts
  const sentId = map.sent

  const draft = {
    mailboxIds: draftsId ? { [draftsId]: true } : {},
    keywords: { $draft: true },
    from: [{ email: identity.email, name: identity.name || undefined }],
    to: parseRecipients(to),
    cc: parseRecipients(cc),
    bcc: parseRecipients(bcc),
    subject: subject || "",
    bodyValues: {
      text: { value: markdownBody || "", charset: "utf-8" },
      ...(htmlBody ? { html: { value: htmlBody, charset: "utf-8" } } : {}),
    },
    textBody: [{ partId: "text", type: "text/plain" }],
    ...(htmlBody ? { htmlBody: [{ partId: "html", type: "text/html" }] } : {}),
    ...(attachments.length
      ? {
          attachments: attachments.map((a) => ({
            blobId: a.blobId,
            type: a.type || "application/octet-stream",
            name: a.name,
            size: a.size,
          })),
        }
      : {}),
  }

  const onSuccessUpdateEmail = sentId
    ? {
        "#send": {
          ...(draftsId ? { [`mailboxIds/${draftsId}`]: null } : {}),
          [`mailboxIds/${sentId}`]: true,
          "keywords/$draft": null,
          "keywords/$seen": true,
        },
      }
    : undefined

  const responses = await call(
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

  const created = responses.find((r) => r[0] === "Email/set")?.[1]?.created?.draft
  const sub = responses.find((r) => r[0] === "EmailSubmission/set")?.[1]
  if (!sub?.created?.send) {
    const err =
      sub?.notCreated?.send?.description || sub?.notCreated?.send?.type || "send failed"
    throw new Error(err)
  }
  return { emailId: created?.id || null, sentFolderId: sentId || null }
}
