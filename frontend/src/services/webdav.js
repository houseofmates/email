// minimal webdav client for stalwart file storage (/dav/file/<account>/).
// goes through the bridge /dav proxy. all paths are absolute dav urls.

export const fileRoot = (user) => `/dav/file/${encodeURIComponent(user || "")}/`

const PROPFIND_BODY =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<d:propfind xmlns:d="DAV:"><d:prop>' +
  "<d:displayname/><d:getcontentlength/><d:getlastmodified/><d:getcontenttype/><d:resourcetype/>" +
  "</d:prop></d:propfind>"

function dav(authHeader, path, { method = "GET", headers = {}, body } = {}) {
  return fetch(path, { method, headers: { Authorization: authHeader, ...headers }, body, credentials: "same-origin" })
}

const stripSlash = (s) => s.replace(/\/+$/, "")
const norm = (href) => stripSlash(decodeURIComponent(href)).replace(/^https?:\/\/[^/]+/, "")

// parse a PROPFIND multistatus body into entries, excluding the queried dir.
export function parsePropfind(xml, selfPath) {
  const doc = new DOMParser().parseFromString(xml, "application/xml")
  const self = norm(selfPath)
  const out = []
  for (const r of doc.getElementsByTagNameNS("DAV:", "response")) {
    const hrefEl = r.getElementsByTagNameNS("DAV:", "href")[0]
    if (!hrefEl) continue
    const href = hrefEl.textContent || ""
    if (norm(href) === self) continue // the directory itself
    const isDir = r.getElementsByTagNameNS("DAV:", "collection").length > 0
    const size = parseInt(r.getElementsByTagNameNS("DAV:", "getcontentlength")[0]?.textContent || "0", 10)
    const modified = r.getElementsByTagNameNS("DAV:", "getlastmodified")[0]?.textContent || ""
    const contentType = r.getElementsByTagNameNS("DAV:", "getcontenttype")[0]?.textContent || ""
    const name = decodeURIComponent(stripSlash(href).split("/").pop() || "")
    out.push({ href, name, isDir, size, modified, contentType })
  }
  // folders first, then alphabetical
  return out.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1))
}

export async function list(authHeader, dirPath) {
  const res = await dav(authHeader, dirPath, { method: "PROPFIND", headers: { Depth: "1", "Content-Type": "application/xml" }, body: PROPFIND_BODY })
  if (!res.ok) throw new Error(`list failed (${res.status})`)
  return parsePropfind(await res.text(), dirPath)
}

export async function mkcol(authHeader, dirPath) {
  const res = await dav(authHeader, dirPath, { method: "MKCOL" })
  if (!res.ok) throw new Error(`create folder failed (${res.status})`)
}

export async function upload(authHeader, filePath, file) {
  const res = await dav(authHeader, filePath, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file })
  if (!res.ok) throw new Error(`upload failed (${res.status})`)
}

export async function remove(authHeader, path) {
  const res = await dav(authHeader, path, { method: "DELETE" })
  if (!res.ok && res.status !== 404) throw new Error(`delete failed (${res.status})`)
}

export async function move(authHeader, fromPath, toPath) {
  const destination = new URL(toPath, window.location.origin).href
  const res = await dav(authHeader, fromPath, { method: "MOVE", headers: { Destination: destination, Overwrite: "F" } })
  if (!res.ok) throw new Error(`move failed (${res.status})`)
}

export async function download(authHeader, path) {
  const res = await dav(authHeader, path)
  if (!res.ok) throw new Error(`download failed (${res.status})`)
  return res.blob()
}
