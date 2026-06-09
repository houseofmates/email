// password + passphrase generator — pure, no react, no network.
//
// single source of truth for credential generation across the app (passwords
// view, vault, compose-time alias passwords). uses crypto.getRandomValues with
// rejection sampling so there is NO modulo bias, and guarantees requested
// minimums (e.g. "at least 1 number") by placement + crypto shuffle.

// character pools. ambiguous-looking glyphs are split out so avoidAmbiguous
// can drop them per class (l/o, I/O, 0/1).
const POOLS = {
  lower:      "abcdefghijkmnpqrstuvwxyz", // no l, o
  lowerAmbig: "lo",
  upper:      "ABCDEFGHJKLMNPQRSTUVWXYZ", // no I, O
  upperAmbig: "IO",
  number:     "23456789",                 // no 0, 1
  numberAmbig:"01",
  symbol:     "!@#$%^&*()-_=+[]{};:,.?",
}

export const defaultOptions = {
  length: 20,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  avoidAmbiguous: true,
  minNumbers: 1,
  minSymbols: 1,
  // passphrase mode
  passphrase: false,
  words: 5,
  wordSeparator: "-",
  capitalize: true,
  includeNumber: true,
}

// unbiased random integer in [0, max) via rejection sampling
function randInt(max) {
  if (max <= 0) return 0
  const limit = Math.floor(0x100000000 / max) * max
  const buf = new Uint32Array(1)
  let x
  do { crypto.getRandomValues(buf); x = buf[0] } while (x >= limit)
  return x % max
}

function pick(str) { return str[randInt(str.length)] }

// fisher-yates shuffle of an array using crypto randomness
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── character-based password ─────────────────────────────────────────────────
function generateChars(o) {
  const lower = POOLS.lower + (o.avoidAmbiguous ? "" : POOLS.lowerAmbig)
  const upper = POOLS.upper + (o.avoidAmbiguous ? "" : POOLS.upperAmbig)
  const number = POOLS.number + (o.avoidAmbiguous ? "" : POOLS.numberAmbig)
  const symbol = POOLS.symbol

  const classes = []
  if (o.lowercase) classes.push(lower)
  if (o.uppercase) classes.push(upper)
  if (o.numbers) classes.push(number)
  if (o.symbols) classes.push(symbol)
  if (!classes.length) throw new Error("select at least one character set")

  const length = Math.max(o.length || 0, classes.length)
  const required = []
  // guarantee minimums (clamped so they never exceed the total length)
  if (o.numbers) for (let i = 0; i < Math.min(o.minNumbers || 0, length); i++) required.push(pick(number))
  if (o.symbols) for (let i = 0; i < Math.min(o.minSymbols || 0, length - required.length); i++) required.push(pick(symbol))
  // ensure every enabled class appears at least once
  for (const c of classes) if (required.length < length) required.push(pick(c))

  const all = classes.join("")
  const out = [...required]
  while (out.length < length) out.push(pick(all))
  return shuffle(out).join("")
}

// ── passphrase ─────────────────────────────────────────────────────────────
// default wordlist is a compact, unambiguous starter set; swap WORDS for the
// full eff long list (7776 words) for ~12.9 bits/word without touching logic.
// the ui reads WORDS.length to display honest entropy.
export const WORDS = [
  "apple","amber","anchor","arrow","atlas","autumn","badge","bamboo","banjo","beacon",
  "berry","birch","bison","blossom","bottle","branch","breeze","bridge","bronze","brook",
  "candle","canyon","carbon","cedar","cherry","cinder","cliff","clover","cobalt","comet",
  "copper","coral","cosmic","cotton","cricket","crystal","dawn","delta","desert","diamond",
  "dolphin","dragon","dune","eagle","ember","emerald","evergreen","falcon","fern","flame",
  "forest","fox","galaxy","garden","ginger","glacier","granite","harbor","hazel","hollow",
  "honey","ivory","jade","jasmine","juniper","kettle","lagoon","lantern","leaf","lemon",
  "lily","linen","lotus","lunar","maple","marble","meadow","mellow","mint","misty",
  "mountain","nectar","nimbus","oasis","ocean","olive","onyx","opal","orchid","otter",
  "pebble","pepper","pine","planet","plum","pollen","poppy","prairie","quartz","quill",
  "rabbit","radiant","raven","reef","river","robin","ruby","saffron","sage","sapphire",
  "shadow","silver","slate","spruce","starling","storm","summit","sunset","tango","thistle",
  "thunder","timber","topaz","tulip","tundra","valley","velvet","violet","walnut","willow",
  "winter","wisp","wolf","wren","zephyr","zinc",
]

function generatePassphrase(o) {
  const n = Math.max(o.words || 1, 1)
  const parts = []
  for (let i = 0; i < n; i++) {
    let w = WORDS[randInt(WORDS.length)]
    if (o.capitalize) w = w[0].toUpperCase() + w.slice(1)
    parts.push(w)
  }
  let s = parts.join(o.wordSeparator ?? "-")
  if (o.includeNumber) s += (o.wordSeparator ?? "-") + randInt(10000)
  return s
}

// ── public api ───────────────────────────────────────────────────────────────
export function generate(options = {}) {
  const o = { ...defaultOptions, ...options }
  return o.passphrase ? generatePassphrase(o) : generateChars(o)
}

// approximate shannon entropy in bits, for the strength meter
export function entropyBits(options = {}) {
  const o = { ...defaultOptions, ...options }
  if (o.passphrase) {
    let bits = (o.words || 0) * Math.log2(WORDS.length)
    if (o.includeNumber) bits += Math.log2(10000)
    return Math.round(bits)
  }
  let pool = 0
  if (o.lowercase) pool += POOLS.lower.length + (o.avoidAmbiguous ? 0 : POOLS.lowerAmbig.length)
  if (o.uppercase) pool += POOLS.upper.length + (o.avoidAmbiguous ? 0 : POOLS.upperAmbig.length)
  if (o.numbers) pool += POOLS.number.length + (o.avoidAmbiguous ? 0 : POOLS.numberAmbig.length)
  if (o.symbols) pool += POOLS.symbol.length
  return pool > 1 ? Math.round((o.length || 0) * Math.log2(pool)) : 0
}

// backward-compatible helper (old call sites passed a length)
export function generatePassword(len = 20) {
  return generate({ length: len })
}

export default generate
