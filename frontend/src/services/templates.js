// email templates — saved snippets kept in localStorage (no server needed).

const KEY = "mail_templates"

export function getTemplates() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}

function write(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* storage full/blocked */ }
  return list
}

export function saveTemplate({ id, name, body }) {
  const list = getTemplates()
  const item = { id: id || crypto.randomUUID(), name: name || "untitled", body: body || "" }
  return write(id ? list.map((t) => (t.id === id ? item : t)) : [...list, item])
}

export function deleteTemplate(id) {
  return write(getTemplates().filter((t) => t.id !== id))
}
