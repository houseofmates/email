// minimal, dependency-free markdown -> safe html.
//
// the brief calls for marked + dompurify; to keep the build self-contained and
// offline (no new npm packages) this implements a small, deliberately limited
// markdown subset and an allow-list sanitiser. it covers headings, bold/italic,
// inline code, fenced code, links, images (including cid: refs for inline
// attachments), blockquotes and lists — enough for compose + reading. swap in
// marked/dompurify here later without touching callers.

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// only allow http(s), mailto and cid (inline attachment) urls
function safeUrl(url) {
  const u = String(url).trim()
  if (/^(https?:|mailto:|cid:)/i.test(u)) return u
  if (/^[^:]+$/.test(u)) return u // relative, no scheme
  return "#"
}

function inline(text) {
  let s = escapeHtml(text)
  // images: ![alt](src)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, src) => {
    return `<img src="${safeUrl(src)}" alt="${escapeHtml(alt)}" class="max-w-full rounded-lg" />`
  })
  // links: [label](href)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
    return `<a href="${safeUrl(href)}" target="_blank" rel="noopener noreferrer" class="text-sky underline">${label}</a>`
  })
  // inline code
  s = s.replace(/`([^`]+)`/g, '<code class="rounded bg-pkm-700 px-1 py-0.5 text-xs">$1</code>')
  // bold then italic
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>")
  return s
}

/** render a markdown string to a safe html string. */
export function renderMarkdown(md) {
  if (!md) return ""
  const lines = String(md).replace(/\r\n/g, "\n").split("\n")
  const out = []
  let i = 0
  let inList = false

  function closeList() {
    if (inList) {
      out.push("</ul>")
      inList = false
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    // fenced code block
    if (/^```/.test(line)) {
      closeList()
      const buf = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(escapeHtml(lines[i]))
        i++
      }
      i++ // skip closing fence
      out.push(`<pre class="overflow-x-auto rounded-lg bg-pkm-700 p-3 text-xs"><code>${buf.join("\n")}</code></pre>`)
      continue
    }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      closeList()
      const level = h[1].length
      out.push(`<h${level} class="font-semibold text-text-primary">${inline(h[2])}</h${level}>`)
      i++
      continue
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      closeList()
      const buf = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(inline(lines[i].replace(/^>\s?/, "")))
        i++
      }
      out.push(`<blockquote class="border-l-2 border-pkm-500 pl-3 text-text-info">${buf.join("<br/>")}</blockquote>`)
      continue
    }

    // unordered list
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push('<ul class="list-disc pl-5">')
        inList = true
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`)
      i++
      continue
    }

    // blank line
    if (line.trim() === "") {
      closeList()
      i++
      continue
    }

    // paragraph
    closeList()
    out.push(`<p>${inline(line)}</p>`)
    i++
  }
  closeList()
  return out.join("\n")
}

/** quote a plain-text body as markdown "> " lines (for reply). */
export function quoteAsMarkdown(text) {
  if (!text) return ""
  return String(text)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n")
}
