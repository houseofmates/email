// unit tests for the self-contained encrypted vault. run with: npm test
// uses a throwaway vault file under the os temp dir (set before require).

const os = require("node:os")
const path = require("node:path")
const fs = require("node:fs")
const crypto = require("node:crypto")
const { test, before, after } = require("node:test")
const assert = require("node:assert/strict")

const VAULT_FILE = path.join(os.tmpdir(), `vault-test-${crypto.randomUUID()}.enc`)
process.env.VAULT_FILE = VAULT_FILE

const { _internal } = require("./credential-store")
const { gcmEncrypt, gcmDecrypt, deriveKEK, createVault, unlockVault, persist, changePassword, verifyPassword } = _internal

function rm() { try { fs.unlinkSync(VAULT_FILE) } catch { /* ignore */ } }
before(rm)
after(rm)

test("gcm encrypt/decrypt round-trips", () => {
  const key = crypto.randomBytes(32)
  const blob = gcmEncrypt(key, Buffer.from("hello vault"))
  assert.equal(gcmDecrypt(key, blob).toString("utf8"), "hello vault")
})

test("gcm decrypt rejects a tampered ciphertext (auth tag)", () => {
  const key = crypto.randomBytes(32)
  const blob = gcmEncrypt(key, Buffer.from("secret"))
  const ct = Buffer.from(blob.ct, "base64"); ct[0] ^= 0xff
  assert.throws(() => gcmDecrypt(key, { ...blob, ct: ct.toString("base64") }))
})

test("gcm decrypt rejects the wrong key", () => {
  const blob = gcmEncrypt(crypto.randomBytes(32), Buffer.from("secret"))
  assert.throws(() => gcmDecrypt(crypto.randomBytes(32), blob))
})

test("argon2id KEK is deterministic for the same salt + params", async () => {
  const salt = crypto.randomBytes(16)
  const params = { memory: 8192, iterations: 2, parallelism: 1 }
  const a = await deriveKEK("pw", salt, params)
  const b = await deriveKEK("pw", salt, params)
  assert.equal(a.toString("hex"), b.toString("hex"))
  assert.equal(a.length, 32)
  const c = await deriveKEK("other", salt, params)
  assert.notEqual(c.toString("hex"), a.toString("hex"))
})

test("create -> unlock -> persist -> change-password lifecycle", async () => {
  rm()
  // create a fresh vault
  const created = await createVault("correct horse battery")
  assert.deepEqual(created.data, { version: 1, ciphers: [], folders: [] })
  assert.ok(fs.existsSync(VAULT_FILE))

  // creating again refuses
  await assert.rejects(() => createVault("x"), /already exists/)

  // unlock with the right password yields the same (empty) vault
  const opened = await unlockVault("correct horse battery")
  assert.deepEqual(opened.data.ciphers, [])

  // wrong password fails authentication
  await assert.rejects(() => unlockVault("wrong password"), /invalid master password/)

  // mutate + persist, then a fresh unlock sees the change
  opened.data.ciphers.push({ id: "1", type: "login", name: "github", password: "hunter2" })
  await persist(opened)
  const reopened = await unlockVault("correct horse battery")
  assert.equal(reopened.data.ciphers.length, 1)
  assert.equal(reopened.data.ciphers[0].name, "github")

  // change the master password — old fails, new works, data intact
  await changePassword(reopened, "new master phrase")
  await assert.rejects(() => unlockVault("correct horse battery"), /invalid master password/)
  const afterChange = await unlockVault("new master phrase")
  assert.equal(afterChange.data.ciphers[0].password, "hunter2")
})

test("verifyPassword accepts the right password and rejects others", async () => {
  rm()
  const session = await createVault("the right one")
  assert.equal(await verifyPassword(session, "the right one"), true)
  assert.equal(await verifyPassword(session, "the wrong one"), false)
})
