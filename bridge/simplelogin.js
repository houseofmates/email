// simplelogin translator — maps our friendly /api/aliases/* routes onto
// simplelogin's versioned rest api (and translates methods, e.g. our PUT ->
// simplelogin's PATCH) which a plain reverse proxy can't do. mounted only when
// SIMPLELOGIN_URL + SIMPLELOGIN_API_KEY are configured; otherwise server.js
// falls back to the stalwart alias store.
//
// auth: simplelogin expects the api key in the `Authentication` header.
//
// NOTE: built to the documented simplelogin api. the bridge can't reach a live
// simplelogin from the build sandbox, so response shapes should be validated
// against your instance; routes are 1:1 with the documented endpoints.

const express = require("express")

function createRouter(slUrl, apiKey) {
  const router = express.Router()
  router.use(express.json({ limit: "256kb" })) // all routes are local fetch (no proxy fall-through)

  const base = slUrl.replace(/\/$/, "")

  // call simplelogin and mirror its status + json back to the caller
  async function sl(res, method, path, body) {
    try {
      const r = await fetch(`${base}${path}`, {
        method,
        headers: {
          Authentication: apiKey,
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      const text = await r.text()
      const data = text ? JSON.parse(text) : {}
      res.status(r.status).json(data)
    } catch (err) {
      res.status(502).json({ error: String(err.message || err) })
    }
  }

  const page = (req) => `page_id=${parseInt(req.query.page_id, 10) || 0}`

  // ── literal routes first (so they aren't shadowed by /:id) ────────────────
  router.get("/options", (req, res) => sl(res, "GET", "/api/v5/alias/options"))
  router.post("/random", (req, res) => sl(res, "POST", `/api/alias/random/new${req.query.mode ? `?mode=${encodeURIComponent(req.query.mode)}` : ""}`, req.body))
  router.post("/custom", (req, res) => sl(res, "POST", "/api/v3/alias/custom/new", req.body))

  // mailboxes
  router.get("/mailboxes", (req, res) => sl(res, "GET", "/api/v2/mailboxes"))
  router.post("/mailboxes", (req, res) => sl(res, "POST", "/api/mailboxes", req.body))
  router.put("/mailboxes/:id", (req, res) => sl(res, "PUT", `/api/mailboxes/${req.params.id}`, req.body))
  router.delete("/mailboxes/:id", (req, res) => sl(res, "DELETE", `/api/mailboxes/${req.params.id}`, req.body || {}))

  // custom domains
  router.get("/domains", (req, res) => sl(res, "GET", "/api/custom_domains"))
  router.patch("/domains/:id", (req, res) => sl(res, "PATCH", `/api/custom_domains/${req.params.id}`, req.body))
  router.get("/domains/:id/trash", (req, res) => sl(res, "GET", `/api/custom_domains/${req.params.id}/trash`))

  // contacts (delete is by contact id, not alias id)
  router.delete("/contacts/:cid", (req, res) => sl(res, "DELETE", `/api/contacts/${req.params.cid}`))

  // ── alias list + per-alias routes ─────────────────────────────────────────
  router.get("/", (req, res) => sl(res, "GET", `/api/v2/aliases?${page(req)}`))
  router.get("/:id/activities", (req, res) => sl(res, "GET", `/api/aliases/${req.params.id}/activities?${page(req)}`))
  router.get("/:id/contacts", (req, res) => sl(res, "GET", `/api/aliases/${req.params.id}/contacts?${page(req)}`))
  router.post("/:id/contacts", (req, res) => sl(res, "POST", `/api/aliases/${req.params.id}/contacts`, req.body))
  router.post("/:id/toggle", (req, res) => sl(res, "POST", `/api/aliases/${req.params.id}/toggle`))
  router.put("/:id", (req, res) => sl(res, "PATCH", `/api/aliases/${req.params.id}`, req.body)) // our PUT -> SL PATCH
  router.delete("/:id", (req, res) => sl(res, "DELETE", `/api/aliases/${req.params.id}`))

  return router
}

module.exports = { createRouter }
