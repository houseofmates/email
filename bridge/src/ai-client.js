// ── nvidia NIM AI client with round-robin key rotation ─────────
// singleton — all AI features use this one client.
// reads every NVIDIA_API_KEY_{N} from env, cycles on each call,
// and retries on 429 by rotating to the next key.

const axios = require('axios')

const BASE_URL = 'https://integrate.api.nvidia.com/v1'
const MODEL = 'deepseek-ai/deepseek-v4-flash'
const TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS, 10) || 30000

class NvidiaNIMClient {
  constructor() {
    this.keys = []
    this.index = 0

    // collect all NVIDIA_API_KEY_{N} from env
    for (let i = 1; ; i++) {
      const key = process.env[`NVIDIA_API_KEY_${i}`]
      if (!key) break
      this.keys.push(key)
    }

    // also try bare NVIDIA_API_KEY as a fallback
    if (this.keys.length === 0 && process.env.NVIDIA_API_KEY) {
      this.keys.push(process.env.NVIDIA_API_KEY)
    }

    if (this.keys.length === 0) {
      console.warn('[ai-client] no NVIDIA_API_KEY_{N} found — ai features will return fallbacks')
    } else {
      console.log(`[ai-client] loaded ${this.keys.length} nvidia api key(s)`)
    }

    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // atomic key rotation — no lock needed, JS number ops are single-threaded
  _nextKey() {
    const idx = this.index++ % this.keys.length
    return this.keys[idx]
  }

  // attempt an LLM call, rotating keys on 429
  async _call(messages, systemPrompt = '', options = {}) {
    if (this.keys.length === 0) {
      throw Object.assign(new Error('no nvidia api keys configured'), { code: 'NO_KEYS' })
    }

    const body = {
      model: MODEL,
      messages: [],
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.3,
    }

    if (systemPrompt) {
      body.messages.push({ role: 'system', content: systemPrompt })
    }
    body.messages.push(...messages)

    // try each key at most once (full round)
    const attempts = this.keys.length

    for (let attempt = 0; attempt < attempts; attempt++) {
      const apiKey = this._nextKey()
      const keyIndex = ((this.index - 1) % this.keys.length)

      try {
        const res = await this.http.post('/chat/completions', body, {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        // mask key for logging
        const masked = apiKey.slice(0, 6) + '...' + apiKey.slice(-4)
        const usage = res.data?.usage || {}
        console.log(
          `[ai] model=${MODEL} key=${keyIndex} prompt_tokens=${usage.prompt_tokens || '?'} completion_tokens=${usage.completion_tokens || '?'} — 200`
        )

        const choice = res.data?.choices?.[0]
        if (!choice) throw new Error('empty response from nvidia')

        return {
          text: choice.message?.content || '',
          finishReason: choice.finish_reason,
          usage: res.data?.usage || null,
        }
      } catch (err) {
        const status = err.response?.status
        const masked = apiKey.slice(0, 6) + '...' + apiKey.slice(-4)
        console.log(`[ai] key=${keyIndex} ${status || 'network error'}`)

        if (status === 429) {
          // rate-limited → rotate to next key and retry
          console.log('[ai] 429 detected — rotating to next key')
          continue
        }

        // not a 429 — re-throw immediately (auth errors, model issues, etc.)
        throw err
      }
    }

    throw Object.assign(new Error('all nvidia api keys exhausted or rate-limited'), { code: 'ALL_KEYS_EXHAUSTED' })
  }

  // ── public helpers ─────────────────────────────────────────

  // simple chat completion
  async chat(prompt, system = '', opts = {}) {
    const result = await this._call(
      [{ role: 'user', content: prompt }],
      system,
      opts
    )
    return result.text
  }

  // structured JSON output — instructs the model to return parseable JSON
  async chatJSON(prompt, system = '', opts = {}) {
    const fullSystem = (system ? system + '\n\n' : '') +
      'You are a helpful assistant. Respond ONLY with valid JSON. No markdown, no code fences, no explanation.'
    const result = await this._call(
      [{ role: 'user', content: prompt }],
      fullSystem,
      { ...opts, temperature: opts.temperature ?? 0.1 }
    )
    // strip any markdown fences the model might sneak in
    let cleaned = result.text.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    }
    try {
      return JSON.parse(cleaned)
    } catch {
      return { _raw: cleaned, _parseError: 'could not parse as JSON' }
    }
  }

  // get the raw api key list count (for health checks)
  keyCount() {
    return this.keys.length
  }
}

// singleton
let instance = null
function getClient() {
  if (!instance) {
    instance = new NvidiaNIMClient()
  }
  return instance
}

module.exports = { getClient, NvidiaNIMClient }