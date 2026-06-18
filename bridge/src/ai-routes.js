// ── AI suite routes ─────────────────────────────────────────
// all endpoints return graceful fallbacks if LLM is unavailable.

const express = require('express')
const router = express.Router()
const jsonParser = express.json()

const aiClient = require('./ai-client')
const emailIntel = require('./email-intelligence')
const vaultIntel = require('./vault-intelligence')
const unified = require('./unified-assistant')

// helper — fetch unread emails via JMAP through the stalwart proxy
async function fetchUnreadEmails(authHeader, limit = 20) {
  const res = await fetch('http://localhost:8080/jmap/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({
      using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
      methodCalls: [
        ['Mailbox/get', { accountId: 'primary', properties: ['id', 'role', 'name'] }, '0'],
      ],
    }),
  })
  if (!res.ok) return []

  const data = await res.json()
  const mailboxes = data.methodResponses?.[0]?.[1]?.list || []
  const inbox = mailboxes.find(m => m.role === 'inbox')
  if (!inbox) return []

  const qRes = await fetch('http://localhost:8080/jmap/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({
      using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
      methodCalls: [
        [
          'Email/query',
          {
            accountId: inbox.id,
            filter: { operator: 'AND', conditions: [{ inMailbox: inbox.id }, { not: { hasKeyword: '$seen' } }] },
            sort: [{ property: 'receivedAt', isAscending: false }],
            limit,
          },
          '0',
        ],
        [
          'Email/get',
          {
            accountId: inbox.id,
            '#ids': { resultOf: '0', name: 'Email/query', path: '/ids' },
            properties: ['id', 'threadId', 'mailboxIds', 'keywords', 'from', 'to', 'subject', 'preview', 'receivedAt'],
          },
          '1',
        ],
      ],
    }),
  })
  const qData = await qRes.json()
  return qData.methodResponses?.find(r => r[0] === 'Email/get')?.[1]?.list || []
}

// helper — search emails via JMAP
async function searchEmails(authHeader, filter, textQuery, limit = 20) {
  // first resolve the account id
  const sessionRes = await fetch('http://localhost:8080/jmap/session', {
    headers: { Authorization: authHeader },
  })
  if (!sessionRes.ok) return []
  const session = await sessionRes.json()
  const accounts = Object.keys(session.accounts || {})
  const accountId = accounts[0]
  if (!accountId) return []

  const conditions = []
  if (filter) conditions.push(filter)
  if (textQuery) conditions.push({ text: textQuery })

  let queryFilter
  if (conditions.length === 0) queryFilter = undefined
  else if (conditions.length === 1) queryFilter = conditions[0]
  else queryFilter = { operator: 'AND', conditions }

  const res = await fetch('http://localhost:8080/jmap/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({
      using: ['urn:ietf:params:jmap:core', 'urn:ietf:params:jmap:mail'],
      methodCalls: [
        [
          'Email/query',
          { accountId, filter: queryFilter, sort: [{ property: 'receivedAt', isAscending: false }], limit },
          '0',
        ],
        [
          'Email/get',
          {
            accountId,
            '#ids': { resultOf: '0', name: 'Email/query', path: '/ids' },
            properties: ['id', 'threadId', 'mailboxIds', 'keywords', 'from', 'to', 'subject', 'preview', 'receivedAt'],
          },
          '1',
        ],
      ],
    }),
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.methodResponses?.find(r => r[0] === 'Email/get')?.[1]?.list || []
}

// ── health / status ────────────────────────────────────────

router.get('/ai/status', (req, res) => {
  const client = aiClient.getClient()
  res.json({
    available: client.keyCount() > 0,
    keyCount: client.keyCount(),
    model: 'deepseek-ai/deepseek-v4-flash',
  })
})

// ── inbox summary ──────────────────────────────────────────

router.post('/ai/summary', jsonParser, async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'authorization required' })

  try {
    const emails = await fetchUnreadEmails(authHeader, 20)
    if (emails.length === 0) {
      return res.json({ summary: 'no unread emails to summarize', priority: [], actionItems: [] })
    }
    const result = await emailIntel.summarizeInbox(emails)
    res.json(result)
  } catch (err) {
    console.error('[ai-routes] /ai/summary error:', err.message)
    const message = err.code === 'NO_KEYS'
      ? 'AI assistant not configured — add NVIDIA_API_KEY_1 to your .env'
      : err.code === 'ALL_KEYS_EXHAUSTED'
        ? 'AI assistant temporarily unavailable (all API keys rate-limited)'
        : 'AI assistant temporarily unavailable'
    res.status(503).json({ error: message })
  }
})

// ── natural language search ────────────────────────────────

router.post('/ai/search', jsonParser, async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'authorization required' })

  const { query } = req.body || {}
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'search query required' })
  }

  try {
    const result = await emailIntel.naturalLanguageSearch(
      query,
      (filter, textQuery) => searchEmails(authHeader, filter, textQuery),
      {}
    )
    res.json(result)
  } catch (err) {
    console.error('[ai-routes] /ai/search error:', err.message)
    res.status(503).json({ error: 'AI search temporarily unavailable', fallback: true })
  }
})

// ── smart draft ────────────────────────────────────────────

router.post('/ai/draft', jsonParser, async (req, res) => {
  const { threadContext, tone, instructions } = req.body || {}
  if (!threadContext || !threadContext.trim()) {
    return res.status(400).json({ error: 'threadContext required' })
  }

  try {
    const result = await emailIntel.generateDraft(threadContext, tone || 'professional', instructions || '')
    res.json(result)
  } catch (err) {
    console.error('[ai-routes] /ai/draft error:', err.message)
    res.status(503).json({ error: 'AI drafting temporarily unavailable' })
  }
})

// ── vault security report ──────────────────────────────────

router.get('/ai/vault-report', async (req, res) => {
  try {
    const report = await vaultIntel.generateSecurityReport()
    res.json(report)
  } catch (err) {
    console.error('[ai-routes] /ai/vault-report error:', err.message)
    res.status(503).json({ error: 'security report temporarily unavailable' })
  }
})

// ── unified query ──────────────────────────────────────────

router.post('/ai/unified', jsonParser, async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'authorization required' })

  const { query } = req.body || {}
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'query required' })
  }

  try {
    const result = await unified.unifiedQuery(query, {
      unreadEmails: () => fetchUnreadEmails(authHeader, 15),
    })
    res.json(result)
  } catch (err) {
    console.error('[ai-routes] /ai/unified error:', err.message)
    res.status(503).json({ error: 'unified assistant temporarily unavailable' })
  }
})

module.exports = router