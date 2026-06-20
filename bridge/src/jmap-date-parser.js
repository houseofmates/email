// ── natural-language date → JMAP filter parser ────────────────
// converts expressions like "last tuesday", "2 weeks ago",
// "inbox: budget from: sarah" into JMAP after/before filters.

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const MS_DAY = 86400000

function dayIndex(name) {
  return DAY_NAMES.indexOf(name.toLowerCase())
}

function startOfDay(date) {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function toISO(d) {
  return d.toISOString()
}

/**
 * Parse a natural-language query into a JMAP-compatible filter.
 *
 * @param {string} naturalQuery - e.g. "last tuesday", "2 weeks ago", "inbox: budget from: sarah"
 * @param {Object} [folderMap={}] - maps folder names to JMAP mailbox IDs
 * @returns {{ filter: { after: string|null, before: string|null, inMailbox: string|null, from: string|null }, text: string }}
 */
function parseDateQuery(naturalQuery, folderMap = {}) {
  let text = naturalQuery.trim()

  // ── 1. extract structured prefixes ────────────────────────
  let inMailbox = null
  let from = null

  const inboxRe = /\binbox:\s*(\S+)/i
  const inboxMatch = text.match(inboxRe)
  if (inboxMatch) {
    const key = inboxMatch[1]
    inMailbox = (folderMap[key] !== undefined) ? folderMap[key] : key
    text = text.replace(inboxMatch[0], '').trim()
  }

  const fromRe = /\bfrom:\s*(\S+)/i
  const fromMatch = text.match(fromRe)
  if (fromMatch) {
    from = fromMatch[1]
    text = text.replace(fromMatch[0], '').trim()
  }

  // ── 2. parse date expression ──────────────────────────────
  let after = null
  let before = null
  const lower = text.toLowerCase().trim()
  const now = new Date()

  // "today" → start of today … now
  if (/^today$/.test(lower)) {
    after = startOfDay(now)
    before = now
    text = ''

  // "yesterday" → start of yesterday … start of today
  } else if (/^yesterday$/.test(lower)) {
    const todayStart = startOfDay(now)
    after = new Date(todayStart.getTime() - MS_DAY)
    before = todayStart
    text = ''

  // "this month" → 1st of this month … now
  } else if (/^this month$/.test(lower)) {
    after = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    before = now
    text = ''

  // "this week" → start of current week (Sunday) … now
  } else if (/^this week$/.test(lower)) {
    const dow = now.getUTCDay()
    after = startOfDay(new Date(now.getTime() - dow * MS_DAY))
    before = now
    text = ''

  // "this year" → 1st of this year … now
  } else if (/^this year$/.test(lower)) {
    after = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
    before = now
    text = ''

  // "last <day>" → most recent occurrence before today
  } else {
    const lastDayRe = /^last\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/
    const lastDayMatch = lower.match(lastDayRe)
    if (lastDayMatch) {
      const target = dayIndex(lastDayMatch[1])
      const currentDow = now.getUTCDay()
      let diff = currentDow - target
      if (diff <= 0) diff += 7
      after = startOfDay(new Date(now.getTime() - diff * MS_DAY))
      before = new Date(after.getTime() + MS_DAY)
      text = ''

    // "N days/weeks/months/years ago" (or "a <unit> ago")
    } else {
      const agoRe = /^(?:a\s+|an\s+|(\d+)\s+)(day|days|week|weeks|month|months|year|years)\s+ago$/
      const agoMatch = lower.match(agoRe)
      if (agoMatch) {
        const num = agoMatch[1] ? parseInt(agoMatch[1], 10) : 1
        const unit = agoMatch[2]
        let mul
        switch (unit) {
          case 'day': case 'days':   mul = 1;          break
          case 'week': case 'weeks': mul = 7;          break
          case 'month': case 'months': mul = 30;       break
          case 'year': case 'years':  mul = 365;       break
          default: mul = 1
        }
        after = startOfDay(new Date(now.getTime() - num * mul * MS_DAY))
        before = new Date(after.getTime() + MS_DAY)
        text = ''

      // bare day name → most recent occurrence (including today)
      } else {
        const bareRe = /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/
        const bareMatch = lower.match(bareRe)
        if (bareMatch) {
          const target = dayIndex(bareMatch[1])
          const currentDow = now.getUTCDay()
          let diff = currentDow - target
          if (diff < 0) diff += 7
          after = startOfDay(new Date(now.getTime() - diff * MS_DAY))
          before = new Date(after.getTime() + MS_DAY)
          text = ''
        }
      }
    }
  }

  const filter = {
    after: after ? toISO(after) : null,
    before: before ? toISO(before) : null,
    inMailbox,
    from,
  }

  return { filter, text }
}

module.exports = { parseDateQuery }
