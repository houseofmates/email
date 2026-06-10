import { describe, it, expect } from "vitest"
import { parsePropfind, fileRoot } from "./webdav"

const SELF = "/dav/file/me@x.co/"
const XML = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/dav/file/me@x.co/</d:href>
    <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/file/me@x.co/photos/</d:href>
    <d:propstat><d:prop><d:displayname>photos</d:displayname><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/file/me@x.co/notes.txt</d:href>
    <d:propstat><d:prop><d:displayname>notes.txt</d:displayname><d:getcontentlength>1234</d:getcontentlength><d:getcontenttype>text/plain</d:getcontenttype><d:resourcetype/></d:prop></d:propstat>
  </d:response>
</d:multistatus>`

describe("webdav", () => {
  it("builds the per-user file root", () => {
    expect(fileRoot("me@x.co")).toBe("/dav/file/me%40x.co/")
  })

  it("parses a propfind multistatus, excluding the queried dir", () => {
    const items = parsePropfind(XML, SELF)
    expect(items).toHaveLength(2) // self entry dropped
  })

  it("orders folders before files and reads metadata", () => {
    const [dir, file] = parsePropfind(XML, SELF)
    expect(dir.isDir).toBe(true)
    expect(dir.name).toBe("photos")
    expect(file.isDir).toBe(false)
    expect(file.name).toBe("notes.txt")
    expect(file.size).toBe(1234)
    expect(file.contentType).toBe("text/plain")
  })

  it("matches self even with an absolute href host", () => {
    const xml = XML.replace("/dav/file/me@x.co/<", "https://mail.example.com/dav/file/me@x.co/<")
    // the self response now has an absolute href; it should still be excluded
    const items = parsePropfind(xml.replace("<d:href>/dav/file/me@x.co/</d:href>", "<d:href>https://mail.example.com/dav/file/me@x.co/</d:href>"), SELF)
    expect(items.every((i) => i.name !== "")).toBe(true)
    expect(items).toHaveLength(2)
  })
})
