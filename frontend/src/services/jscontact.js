// map between a flat ui contact and a jscontact (rfc 9553) ContactCard, the
// format stalwart's jmap contacts use. we support the common fields; unknown
// jscontact properties on read are ignored, and we preserve the card id.
//
// flat shape: { id, addressBookId, name, emails:[str], phones:[str], org, note }

// flat -> jscontact ContactCard (for create/update)
export function toCard(flat, { addressBookId } = {}) {
  const card = { "@type": "Card", version: "1.0", kind: "individual" }
  if (flat.name) card.name = { full: flat.name }
  const emails = (flat.emails || []).filter(Boolean)
  if (emails.length) card.emails = Object.fromEntries(emails.map((address, i) => [`e${i + 1}`, { "@type": "EmailAddress", address }]))
  const phones = (flat.phones || []).filter(Boolean)
  if (phones.length) card.phones = Object.fromEntries(phones.map((number, i) => [`p${i + 1}`, { "@type": "Phone", number }]))
  if (flat.org) card.organizations = { o1: { "@type": "Organization", name: flat.org } }
  if (flat.note) card.notes = { n1: { "@type": "Note", note: flat.note } }
  const abId = addressBookId || flat.addressBookId
  if (abId) card.addressBookIds = { [abId]: true }
  return card
}

// jscontact ContactCard -> flat (for display/editing)
export function fromCard(card) {
  if (!card) return null
  return {
    id: card.id,
    addressBookId: card.addressBookIds ? Object.keys(card.addressBookIds)[0] : null,
    name: card.name?.full
      || [card.name?.components?.find((c) => c.kind === "given")?.value, card.name?.components?.find((c) => c.kind === "surname")?.value].filter(Boolean).join(" ")
      || "",
    emails: Object.values(card.emails || {}).map((e) => e.address).filter(Boolean),
    phones: Object.values(card.phones || {}).map((p) => p.number).filter(Boolean),
    org: Object.values(card.organizations || {})[0]?.name || "",
    note: Object.values(card.notes || {})[0]?.note || "",
  }
}
