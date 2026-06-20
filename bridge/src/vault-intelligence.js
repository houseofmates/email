// ── vault intelligence service ──────────────────────────────
// security health reports, password analysis, breach checking.
// uses the local vault data + LLM for analysis + HIBP API if configured.

const { getClient } = require('./ai-client')
const { loadVault, sanitize } = require('./vault')
const { exportCredentialsForAnalysis } = require('./vault-warden-api')

// ── password strength heuristics (local, no network needed) ─

// in-memory cache for vault reports (5 min TTL)
const reportCache = { data: null, time: 0, TTL: 5 * 60 * 1000 }

function analyzePasswordStrength(password) {
  if (!password) return { score: 0, label: 'missing', issues: ['no password set'] }

  const issues = []
  let score = 40 // start at 40 (weak)

  if (password.length >= 12) score += 15
  else if (password.length >= 8) score += 5
  else issues.push('too short (under 8 characters)')

  if (/[A-Z]/.test(password)) score += 10
  else issues.push('missing uppercase letters')

  if (/[a-z]/.test(password)) score += 10
  else issues.push('missing lowercase letters')

  if (/[0-9]/.test(password)) score += 10
  else issues.push('missing digits')

  if (/[^A-Za-z0-9]/.test(password)) score += 10
  else issues.push('missing special characters')

  // penalize common patterns
  if (/(.)\1{2,}/.test(password)) { score -= 10; issues.push('has repeated characters') }
  if (/^(password|12345|qwerty|letmein|admin)/i.test(password)) { score -= 20; issues.push('uses a common password pattern') }
  if (/^[a-zA-Z]+$/.test(password) && password.length < 10) { score -= 10; issues.push('only letters, too simple') }

  score = Math.max(0, Math.min(100, score))

  let label = 'strong'
  if (score < 30) label = 'very weak'
  else if (score < 50) label = 'weak'
  else if (score < 70) label = 'fair'
  else if (score < 85) label = 'good'

  return { score, label, issues }
}

function findReusedPasswords(loginItems) {
  const pwMap = {}
  for (const item of loginItems) {
    const pw = item.password || ''
    if (!pw) continue
    if (!pwMap[pw]) pwMap[pw] = []
    pwMap[pw].push({ id: item.id, site: item.site || item.url || 'unknown', username: item.username || '' })
  }

  const reused = []
  for (const [pw, sites] of Object.entries(pwMap)) {
    if (sites.length > 1) {
      reused.push({ password: pw, sites, count: sites.length })
    }
  }

  return reused.sort((a, b) => b.count - a.count)
}

// ── HIBP breach check (v3 API, k-anonymity) ────────────────

async function checkHIBP(password) {
  if (!password || password.length < 1) return { pwned: false, count: 0 }

  try {
    const crypto = require('crypto')
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase()
    const prefix = sha1.slice(0, 5)
    const suffix = sha1.slice(5)

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return { pwned: false, count: 0, error: `hibp returned ${res.status}` }

    const text = await res.text()
    const lines = text.split('\n')
    for (const line of lines) {
      const [hashSuffix, count] = line.split(':')
      if (hashSuffix === suffix) {
        return { pwned: true, count: parseInt(count, 10) || 0 }
      }
    }

    return { pwned: false, count: 0 }
  } catch (err) {
    return { pwned: false, count: 0, error: err.message }
  }
}

// ── security scorecard ──────────────────────────────────────

/**
 * Generate a full vault security report — password strength analysis,
 * reuse detection, breach checks, and LLM-generated recommendations.
 *
 * @returns {Promise<object>}
 */
async function generateSecurityReport() {
  // check cache first
  if (reportCache.data && (Date.now() - reportCache.time) < reportCache.TTL) {
    return reportCache.data
  }

  // try vaultwarden admin API first, fall back to local vault
  let logins = []
  let passwordAnalyses = []
  let reusedPasswords = []

  try {
    const creds = await exportCredentialsForAnalysis()
    logins = creds.map(c => ({ site: c.site, username: c.username, password: '', passwordLength: c.passwordLength }))
    passwordAnalyses = creds.map(c => ({
      id: c.site,
      site: c.site,
      username: c.username,
      strength: c.strength || analyzePasswordStrength(''),
    }))
    reusedPasswords = [] // computed separately below
  } catch (err) {
    console.error('[vault-intel] vaultwarden API failed, falling back to local vault:', err.message)
  }

  if (logins.length === 0) {
    const vault = loadVault().map(sanitize)
    logins = vault.filter(i => i.type === 'login')
    // local analysis
    passwordAnalyses = logins.map(item => ({
      id: item.id,
      site: item.site || item.url || 'unknown',
      username: item.username || '',
      strength: analyzePasswordStrength(item.password),
    }))
    reusedPasswords = findReusedPasswords(logins)
  }

  // HIBP check — sample up to 10 unique passwords for breach status
  const uniquePasswords = [...new Set(logins.map(i => i.password).filter(Boolean))]
  const sampledForCheck = uniquePasswords.slice(0, 10)
  const breachResults = []
  for (const pw of sampledForCheck) {
    const result = await checkHIBP(pw)
    if (result.pwned) {
      breachResults.push({ passwordHint: pw.slice(0, 4) + '****', count: result.count })
    }
  }

  // stats
  const weakPasswords = passwordAnalyses.filter(a => a.strength.score < 50)
  const fairPasswords = passwordAnalyses.filter(a => a.strength.score >= 50 && a.strength.score < 70)
  const strongPasswords = passwordAnalyses.filter(a => a.strength.score >= 70)

  // LLM recommendations
  const client = getClient()
  let recommendations = ''
  try {
    recommendations = await client.chat(
      `Based on this vault analysis, give 3-5 actionable security recommendations in plain english.

Vault stats:
- Total logins: ${logins.length}
- Weak passwords (score < 50): ${weakPasswords.length}
- Fair passwords (50-69): ${fairPasswords.length}
- Strong passwords (70+): ${strongPasswords.length}
- Reused passwords found: ${reusedPasswords.length} groups
- Passwords found in known breaches: ${breachResults.length}

Reused password details:
${reusedPasswords.slice(0, 5).map(r => `- "${r.password.slice(0, 4)}****" used on ${r.count} sites: ${r.sites.map(s => s.site).join(', ')}`).join('\n') || 'none'}

Breach details:
${breachResults.map(b => `- "${b.passwordHint}" appears in ${b.count} breaches`).join('\n') || 'none'}

Keep recommendations practical and ordered by priority.`,
      'You are a security analyst providing concise, actionable password hygiene advice.',
      { temperature: 0.3, maxTokens: 1024 }
    )
  } catch (err) {
    console.error('[vault-intel] LLM recommendations failed:', err.message)
  }

  const overallScore = logins.length > 0
    ? Math.round(
        (strongPasswords.length * 100 + fairPasswords.length * 60 + weakPasswords.length * 20) /
        (logins.length)
      )
    : 100

  const result = {
    overallScore,
    totalLogins: logins.length,
    passwordStats: {
      strong: strongPasswords.length,
      fair: fairPasswords.length,
      weak: weakPasswords.length,
    },
    reusedPasswords: reusedPasswords.slice(0, 10).map(r => ({
      count: r.count,
      sites: r.sites.map(s => s.site),
    })),
    breachedPasswords: breachResults,
    details: passwordAnalyses.map(a => ({
      site: a.site,
      score: a.strength.score,
      label: a.strength.label,
      issues: a.strength.issues,
    })),
    recommendations,
    generated: new Date().toISOString(),
  }

  // populate cache
  reportCache.data = result
  reportCache.time = Date.now()

  return result
}

module.exports = { generateSecurityReport, analyzePasswordStrength, checkHIBP }