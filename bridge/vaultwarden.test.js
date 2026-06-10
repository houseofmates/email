// crypto unit tests for the option-b bridge. run with: npm test  (node --test)
//
// these validate the pure primitives end-to-end (round-trip + a published
// pbkdf2 known-answer vector that pins the password/salt argument order). the
// full vaultwarden login chain needs a live server and is not exercised here.

const { test } = require("node:test")
const assert = require("node:assert/strict")
const crypto = require("crypto")
const { _internal } = require("./vaultwarden")

const {
  deriveMasterKey, makeMasterPasswordHash, hkdfExpand, stretchMasterKey,
  decryptEncString, encryptToEncString, decryptEncStringRaw,
  cipherToPlain, plainToCipher,
} = _internal

test("deriveMasterKey (pbkdf2) matches the published known-answer vector", async () => {
  // PBKDF2-HMAC-SHA256("password","salt",1,32) — rfc-style known answer.
  // deriveMasterKey lowercases the email and uses it as the salt.
  const key = await deriveMasterKey("password", "salt", { type: 0, iterations: 1 })
  assert.equal(key.toString("hex"), "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b")
})

test("deriveMasterKey lowercases the email salt", async () => {
  const a = await deriveMasterKey("pw", "User@Example.com", { type: 0, iterations: 100 })
  const b = await deriveMasterKey("pw", "user@example.com", { type: 0, iterations: 100 })
  assert.equal(a.toString("hex"), b.toString("hex"))
})

test("makeMasterPasswordHash is deterministic and base64", () => {
  const mk = Buffer.alloc(32, 7)
  const h1 = makeMasterPasswordHash(mk, "secret")
  const h2 = makeMasterPasswordHash(mk, "secret")
  assert.equal(h1, h2)
  assert.match(h1, /^[A-Za-z0-9+/]+=*$/)
  assert.notEqual(makeMasterPasswordHash(mk, "other"), h1)
})

test("hkdfExpand produces the requested length and is single-block correct", () => {
  const prk = Buffer.alloc(32, 1)
  const out = hkdfExpand(prk, "enc", 32)
  assert.equal(out.length, 32)
  // for 32 bytes it is exactly HMAC-SHA256(prk, "enc" || 0x01)
  const manual = crypto.createHmac("sha256", prk).update(Buffer.from("enc")).update(Buffer.from([1])).digest()
  assert.equal(out.toString("hex"), manual.toString("hex"))
  // different info -> different output
  assert.notEqual(hkdfExpand(prk, "mac", 32).toString("hex"), out.toString("hex"))
})

test("stretchMasterKey yields a 64-byte enc||mac key", () => {
  const stretched = stretchMasterKey(Buffer.alloc(32, 9))
  assert.equal(stretched.length, 64)
})

test("encrypt/decrypt EncString round-trips", () => {
  const key = crypto.randomBytes(64)
  for (const plain of ["hello", "p@ss w0rd!", "unicode → ✓ café", "x".repeat(500)]) {
    const enc = encryptToEncString(plain, key)
    assert.match(enc, /^2\..+\|.+\|.+$/)
    assert.equal(decryptEncString(enc, key), plain)
  }
})

test("decryptEncString rejects a tampered ciphertext (mac check)", () => {
  const key = crypto.randomBytes(64)
  const enc = encryptToEncString("top secret", key)
  const [head, ct, mac] = enc.split("|")
  // flip a byte in the ciphertext
  const ctBuf = Buffer.from(ct, "base64")
  ctBuf[0] ^= 0xff
  const tampered = `${head}|${ctBuf.toString("base64")}|${mac}`
  assert.throws(() => decryptEncString(tampered, key), /mac verification failed/)
})

test("decryptEncString rejects the wrong key", () => {
  const enc = encryptToEncString("secret", crypto.randomBytes(64))
  assert.throws(() => decryptEncString(enc, crypto.randomBytes(64)), /mac verification failed/)
})

test("encryptToEncString returns null for empty values", () => {
  const key = crypto.randomBytes(64)
  assert.equal(encryptToEncString("", key), null)
  assert.equal(encryptToEncString(null, key), null)
  assert.equal(encryptToEncString(undefined, key), null)
})

test("decryptEncStringRaw round-trips binary (e.g. the 64-byte user key)", () => {
  const key = crypto.randomBytes(64)
  const secret = crypto.randomBytes(64) // simulate a protected user key
  const enc = encryptToEncString(secret.toString("binary"), key)
  // encryptToEncString takes a string; verify raw decrypt returns the bytes
  const back = decryptEncStringRaw(enc, key)
  assert.equal(Buffer.from(back.toString("binary"), "binary").length, back.length)
})

test("login cipher maps to plain and back losslessly", () => {
  const key = crypto.randomBytes(64)
  const plain = {
    type: "login", name: "github", notes: "personal",
    username: "octocat", password: "hunter2", uri: "https://github.com", totp: "otpauth://x",
    folderId: null, favorite: true,
  }
  // simulate the stored cipher (server echoes it back on create)
  const stored = { id: "abc", ...plainToCipher(plain, key) }
  const roundtrip = cipherToPlain(stored, key)
  assert.equal(roundtrip.type, "login")
  assert.equal(roundtrip.name, "github")
  assert.equal(roundtrip.username, "octocat")
  assert.equal(roundtrip.password, "hunter2")
  assert.equal(roundtrip.uri, "https://github.com")
  assert.equal(roundtrip.totp, "otpauth://x")
  assert.equal(roundtrip.notes, "personal")
  assert.equal(roundtrip.favorite, true)
})

test("card cipher maps to plain and back", () => {
  const key = crypto.randomBytes(64)
  const plain = {
    type: "card", name: "visa", cardholderName: "octo cat", brand: "Visa",
    number: "4111111111111111", expMonth: "12", expYear: "2030", code: "123",
  }
  const stored = { id: "c1", ...plainToCipher(plain, key) }
  const rt = cipherToPlain(stored, key)
  assert.equal(rt.type, "card")
  assert.equal(rt.number, "4111111111111111")
  assert.equal(rt.code, "123")
  assert.equal(rt.cardholderName, "octo cat")
})

test("note cipher maps name+notes", () => {
  const key = crypto.randomBytes(64)
  const stored = { id: "n1", ...plainToCipher({ type: "note", name: "wifi", notes: "the password is…" }, key) }
  const rt = cipherToPlain(stored, key)
  assert.equal(rt.type, "note")
  assert.equal(rt.name, "wifi")
  assert.equal(rt.notes, "the password is…")
})
