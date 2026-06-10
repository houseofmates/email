// vault security analysis — pure functions over the decrypted ciphers, plus a
// breach check that uses haveibeenpwned's k-anonymity range api (only a 5-char
// sha-1 prefix ever leaves the browser, and even that goes through the bridge).

// rough shannon entropy of an arbitrary password string, from the character
// classes it actually uses. good enough to flag weak entries.
export function estimateEntropy(pw) {
  if (!pw) return 0
  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/[0-9]/.test(pw)) pool += 10
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 32
  return pool ? Math.round(pw.length * Math.log2(pool)) : 0
}

const WEAK_BITS = 50

// classify the vault. returns weak + reused lists (each entry references the
// cipher) and summary counts. only ciphers with a password participate.
export function auditVault(items) {
  const withPw = (items || []).filter((i) => i && i.password)

  const weak = withPw
    .map((i) => ({ item: i, bits: estimateEntropy(i.password) }))
    .filter((w) => w.bits < WEAK_BITS)
    .sort((a, b) => a.bits - b.bits)

  const byPassword = new Map()
  for (const i of withPw) {
    if (!byPassword.has(i.password)) byPassword.set(i.password, [])
    byPassword.get(i.password).push(i)
  }
  const reused = [...byPassword.values()]
    .filter((group) => group.length > 1)
    .sort((a, b) => b.length - a.length)

  return {
    weak,
    reused,
    counts: {
      total: withPw.length,
      weak: weak.length,
      reused: reused.reduce((n, g) => n + g.length, 0),
    },
  }
}

// sha-1 hex of a string, via web crypto (uppercase to match the hibp api).
export async function sha1Hex(text) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()
}

// check each unique password against hibp. rangeFetcher(prefix) -> the raw
// range response text ("SUFFIX:COUNT\r\n..."). returns a map password -> count
// (0 = not found). the bridge performs the upstream fetch (see vault.hibpRange).
export async function checkBreaches(items, rangeFetcher) {
  const passwords = [...new Set((items || []).filter((i) => i && i.password).map((i) => i.password))]
  const result = new Map()
  // cache range responses by prefix to avoid duplicate requests
  const rangeCache = new Map()
  for (const pw of passwords) {
    const hash = await sha1Hex(pw)
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)
    if (!rangeCache.has(prefix)) rangeCache.set(prefix, await rangeFetcher(prefix))
    const text = rangeCache.get(prefix) || ""
    let count = 0
    for (const line of text.split("\n")) {
      const [suf, c] = line.trim().split(":")
      if (suf === suffix) { count = parseInt(c, 10) || 0; break }
    }
    result.set(pw, count)
  }
  return result
}
