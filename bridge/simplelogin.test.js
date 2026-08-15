// translation tests for the simplelogin router. stubs the upstream fetch and
// asserts each friendly /api/aliases/* route maps to the documented simplelogin
// method + path (incl. our PUT -> SL PATCH). the test client uses node:http so
// only the router's *upstream* call goes through the stubbed fetch.

const { test, before, after, beforeEach } = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const express = require("express")
const { createRouter } = require("./simplelogin")

const BASE = "http://sl.test"
const KEY = "test-key"
let server, port
const calls = []
let realFetch

before(async () => {
  realFetch = global.fetch
  global.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method || "GET", auth: opts.headers?.Authentication, body: opts.body })
    return new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } })
  }
  const app = express()
  app.use("/api/aliases", createRouter(BASE, KEY))
  await new Promise((resolve) => { server = app.listen(0, () => { port = server.address().port; resolve() }) })
})

after(async () => {
  global.fetch = realFetch
  await new Promise((resolve) => server.close(resolve))
})

beforeEach(() => { calls.length = 0 })

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const r = http.request({ port, method, path, headers: body ? { "content-type": "application/json" } : {} },
      (res) => { let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve({ status: res.statusCode, body: d })) })
    r.on("error", reject)
    if (body) r.write(JSON.stringify(body))
    r.end()
  })
}

test("GET / -> SL GET /api/v2/aliases with pagination", async () => {
  await req("GET", "/api/aliases?page_id=2")
  assert.equal(calls[0].method, "GET")
  assert.equal(calls[0].url, `${BASE}/api/v2/aliases?page_id=2`)
  assert.equal(calls[0].auth, KEY)
})

test("POST /custom -> SL POST /api/v3/alias/custom/new", async () => {
  await req("POST", "/api/aliases/custom", { alias_prefix: "hi" })
  assert.equal(calls[0].method, "POST")
  assert.equal(calls[0].url, `${BASE}/api/v3/alias/custom/new`)
})

test("POST /random honours the mode query", async () => {
  await req("POST", "/api/aliases/random?mode=word", { note: "n" })
  assert.equal(calls[0].url, `${BASE}/api/alias/random/new?mode=word`)
})

test("PUT /:id translates to SL PATCH", async () => {
  await req("PUT", "/api/aliases/42", { note: "x" })
  assert.equal(calls[0].method, "PATCH")
  assert.equal(calls[0].url, `${BASE}/api/aliases/42`)
})

test("POST /:id/toggle maps through", async () => {
  await req("POST", "/api/aliases/42/toggle")
  assert.equal(calls[0].method, "POST")
  assert.equal(calls[0].url, `${BASE}/api/aliases/42/toggle`)
})

test("literal /mailboxes is not shadowed by /:id", async () => {
  await req("GET", "/api/aliases/mailboxes")
  assert.equal(calls[0].url, `${BASE}/api/v2/mailboxes`)
})

test("GET /domains -> /api/custom_domains", async () => {
  await req("GET", "/api/aliases/domains")
  assert.equal(calls[0].url, `${BASE}/api/custom_domains`)
})

test("DELETE /contacts/:cid -> /api/contacts/:cid", async () => {
  await req("DELETE", "/api/aliases/contacts/9")
  assert.equal(calls[0].method, "DELETE")
  assert.equal(calls[0].url, `${BASE}/api/contacts/9`)
})

test("GET /:id/activities maps with pagination", async () => {
  await req("GET", "/api/aliases/7/activities")
  assert.equal(calls[0].url, `${BASE}/api/aliases/7/activities?page_id=0`)
})
