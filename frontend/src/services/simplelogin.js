// simplelogin client — full alias api surface
//
// transport only. every method takes the app auth header as its first arg.
// the bridge proxies /api/aliases/* to simplelogin (sending the configured
// `Authentication` api key), or to stalwart's generic alias store as a
// fallback. the paths below mirror simplelogin's real rest api so that, once
// SIMPLELOGIN_URL is configured, the bridge can forward them 1:1.
//
// ── bridge routing note (wired in the aliases vertical) ──────────────────────
// simplelogin's create endpoints are versioned (/api/v3/alias/custom/new,
// /api/v2/aliases). the bridge currently proxies /api/aliases -> SL with no
// path rewrite, which only suits the stalwart fallback. when SL is enabled the
// bridge should rewrite the friendly paths below to SL's versioned routes:
//
//   GET    /api/aliases                  -> GET  /api/v2/aliases?page_id=N
//   POST   /api/aliases/random           -> POST /api/alias/random/new
//   POST   /api/aliases/custom           -> POST /api/v3/alias/custom/new
//   GET    /api/aliases/options          -> GET  /api/v5/alias/options
//   PUT    /api/aliases/:id              -> PATCH /api/aliases/:id     (note/name/mailbox)
//   POST   /api/aliases/:id/toggle       -> POST /api/aliases/:id/toggle
//   DELETE /api/aliases/:id              -> DELETE /api/aliases/:id
//   GET    /api/aliases/:id/contacts     -> GET  /api/aliases/:id/contacts
//   POST   /api/aliases/:id/contacts     -> POST /api/aliases/:id/contacts
//   GET    /api/aliases/:id/activities   -> GET  /api/aliases/:id/activities
//   GET    /api/aliases/mailboxes        -> GET  /api/v2/mailboxes
//   POST   /api/aliases/mailboxes        -> POST /api/mailboxes
//   PUT    /api/aliases/mailboxes/:id    -> PUT  /api/mailboxes/:id
//   DELETE /api/aliases/mailboxes/:id    -> DELETE /api/mailboxes/:id
//   GET    /api/aliases/domains          -> GET  /api/custom_domains
//   PATCH  /api/aliases/domains/:id      -> PATCH /api/custom_domains/:id  (catch-all/random prefix)
//   GET    /api/aliases/domains/:id/trash-> GET  /api/custom_domains/:id/trash

async function request(authHeader, path, { method = "GET", body } = {}) {
  const headers = { authorization: authHeader }
  if (body != null) headers["content-type"] = "application/json"
  const res = await fetch(`/api/aliases${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  })
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}))
    throw new Error(msg.error || msg.message || `request failed (${res.status})`)
  }
  if (res.status === 204) return { ok: true }
  return res.json().catch(() => ({}))
}

export const simplelogin = {
  // ── aliases ────────────────────────────────────────────────────────────────
  list: (a, page = 0) => request(a, `?page_id=${page}`),
  options: (a) => request(a, "/options"), // suffixes + can-create flags for the create form
  createRandom: (a, { note, mode = "uuid" } = {}) =>
    request(a, "/random", { method: "POST", body: { note, mode } }),
  createCustom: (a, { prefix, signedSuffix, mailboxIds, note, name } = {}) =>
    request(a, "/custom", { method: "POST", body: { alias_prefix: prefix, signed_suffix: signedSuffix, mailbox_ids: mailboxIds, note, name } }),
  // update note / display name / mailbox assignment / pinned
  update: (a, id, patch) => request(a, `/${id}`, { method: "PUT", body: patch }),
  toggle: (a, id) => request(a, `/${id}/toggle`, { method: "POST" }),
  remove: (a, id) => request(a, `/${id}`, { method: "DELETE" }),

  // ── activity log (forward / reply / block per alias) ─────────────────────
  activities: (a, id, page = 0) => request(a, `/${id}/activities?page_id=${page}`),

  // ── contacts (who may send to / reply from this alias) ───────────────────
  contacts: (a, id, page = 0) => request(a, `/${id}/contacts?page_id=${page}`),
  addContact: (a, id, email) => request(a, `/${id}/contacts`, { method: "POST", body: { contact: email } }),
  removeContact: (a, contactId) => request(a, `/contacts/${contactId}`, { method: "DELETE" }),

  // ── mailboxes (real receiving addresses) ─────────────────────────────────
  mailboxes: (a) => request(a, "/mailboxes"),
  addMailbox: (a, email) => request(a, "/mailboxes", { method: "POST", body: { email } }),
  updateMailbox: (a, id, patch) => request(a, `/mailboxes/${id}`, { method: "PUT", body: patch }), // default / verify / cancel-email
  removeMailbox: (a, id, transferAliasTo) =>
    request(a, `/mailboxes/${id}`, { method: "DELETE", body: transferAliasTo ? { transfer_aliases_to: transferAliasTo } : undefined }),

  // ── custom domains (catch-all, random prefix, directory) ─────────────────
  domains: (a) => request(a, "/domains"),
  updateDomain: (a, id, patch) => request(a, `/domains/${id}`, { method: "PATCH", body: patch }), // { catch_all, random_prefix_generation, mailbox_ids }
  domainTrash: (a, id) => request(a, `/domains/${id}/trash`),
}

export default simplelogin
