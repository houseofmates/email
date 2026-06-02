# deployment guide — self-hosted email suite

end-to-end setup for running this suite on a home server (e.g. a minisforum
mini-pc) behind a cloudflare tunnel, with your own domain.

> this fork is stalwart mail server + a custom web ui, alias/identity/password
> apis, and a browser extension. the mail/calendar/contacts/drive protocols are
> all stalwart; most configuration happens in stalwart's built-in admin ui after
> first boot.

---

## 0. prerequisites

- a domain you control (dns managed at cloudflare in this guide).
- the mini-pc reachable on your lan, with a static lan ip (e.g. `192.168.1.50`).
- ports you can either forward from your router **or** expose via tunnel
  (see §4 — smtp/imap can't go over a plain cloudflare http tunnel).
- a brevo account (free tier) if you want a reliable outbound relay (§5).

throughout, replace `{{alias_domain}}` with your domain and `mail.{{alias_domain}}` with
the hostname you'll run the server on.

---

## 1. build

```bash
# rust toolchain required (rustup.rs)
cargo build --release \
  --features "sqlite postgres mysql rocks s3 redis azure nats enterprise"
# binary -> target/release/email
```

for a home server, the storage backend is usually **rocksdb** (single-node, no
external db). you can trim features to `--features "rocks"` if you don't need
the others — it builds faster.

> running `cargo build` is also how you confirm the recent backend changes
> compile. if it errors, fix those first.

## 2. install (linux / systemd)

```bash
sudo ./install.sh           # installs to /usr/local/bin/email, creates 'email' user
```

`install.sh` lays down the fhs paths:

| path | purpose |
|---|---|
| `/usr/local/bin/email` | the binary |
| `/etc/email/config.toml` | bootstrap config (created on first run) |
| `/etc/email/email.env` | environment overrides |
| `/var/lib/email/` | data (rocksdb, blobs) |
| `/var/log/email/` | logs |

### first boot → grab the admin password

```bash
sudo systemctl enable --now email
# the bootstrap admin password is printed once to the log:
sudo journalctl -u email -n 200 | grep -A8 -i 'bootstrap'
```

### set your public url + hostname

```bash
sudo nano /etc/email/email.env
```

```ini
STALWART_HOSTNAME=mail.{{alias_domain}}
STALWART_PUBLIC_URL=https://mail.{{alias_domain}}
```

```bash
sudo systemctl restart email
```

everything else (domains, dkim, users, relays, encryption) is done from the
**admin ui** at `https://mail.{{alias_domain}}` (or `https://192.168.1.50:443` over
lan), signing in with `admin` + the bootstrap password.

---

## 3. dns records (cloudflare dashboard → dns)

create the domain in the admin ui first (**directory → domains → add**). the ui
generates your **dkim** record for you — copy it from
**directory → domains → {{alias_domain}} → dns records**. then add these at
cloudflare:

| type | name | value | proxy |
|---|---|---|---|
| `A` | `mail` | your public ip (or tunnel, see §4) | dns only (grey cloud) |
| `MX` | `@` | `10 mail.{{alias_domain}}` | n/a |
| `TXT` | `@` (spf) | `v=spf1 mx ~all` | n/a |
| `TXT` | `<selector>._domainkey` | *(copy dkim value from admin ui)* | n/a |
| `TXT` | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:postmaster@{{alias_domain}}` | n/a |

notes:
- **mail records must be "dns only" (grey cloud)** — cloudflare's orange-cloud
  proxy only handles http(s), not smtp/imap.
- if you relay outbound through brevo (§5), also add brevo's spf include:
  `v=spf1 include:spf.brevo.com mx ~all`, and add the dkim record brevo gives
  you in their dashboard.

verify after propagation:
```bash
dig +short MX {{alias_domain}}
dig +short TXT {{alias_domain}}
dig +short TXT <selector>._domainkey.{{alias_domain}}
```

---

## 4. cloudflare tunnel (and the smtp/imap caveat)

a cloudflare **tunnel** cleanly exposes the **web ui + jmap + caldav/carddav/
webdav** (all https) without opening router ports:

```bash
cloudflared tunnel login
cloudflared tunnel create email
# ~/.cloudflared/config.yml:
```
```yaml
tunnel: email
credentials-file: /root/.cloudflared/<id>.json
ingress:
  - hostname: mail.{{alias_domain}}
    service: https://localhost:443
    originRequest:
      noTLSVerify: true        # stalwart serves its own cert on 443
  - service: http_status:404
```
```bash
cloudflared tunnel route dns email mail.{{alias_domain}}
sudo cloudflared service install
```

**the catch:** smtp (25/465/587) and imap (143/993) are **not http**, so they
**cannot** ride the standard cloudflare tunnel. for those you have three options:

1. **router port-forward** (simplest): forward `25, 465, 587, 993, 995` from
   your router to the mini-pc, and point the `A`/`MX` records at your public ip.
   inbound mail then arrives directly. many residential isps block inbound :25 —
   if so, use option 2.
2. **relay inbound + outbound through brevo** (no inbound :25 needed) — see §5.
   you receive via brevo's inbound parse → webhook/forward, and the tunnel only
   carries https.
3. **`cloudflared` arbitrary-tcp** (advanced): run `cloudflared access tcp` on
   each client — fine for your own imap clients, not for public smtp delivery.

for a home connection with blocked :25, **option 2 (brevo) is the realistic
path** to reliable inbound + outbound.

---

## 5. brevo as the smtp relay (outbound, and optional inbound)

### outbound (smart host)

residential ips are widely blocklisted, so send through brevo:

admin ui → **smtp → routing / relay host** (a.k.a. "next-hop relay"):

| field | value |
|---|---|
| host | `smtp-relay.brevo.com` |
| port | `587` |
| tls | starttls (require) |
| username | *(your brevo smtp login)* |
| password | *(your brevo smtp key)* |

now all outbound mail leaves via brevo's reputable ips. keep `mx`/dkim/spf as in
§3 (add brevo's spf include + their dkim).

### inbound (if you can't open :25)

use brevo **inbound parsing**: point your `MX` at brevo, configure an inbound
route in brevo to forward/deliver to your server. simplest reliable variant:
have brevo forward to an address your server pulls or receives over https.

> there is **no native "pull from a remote pop3/imap account"** in stalwart
> (it's a pop3/imap *server*, not a *client*). if you want to suck mail out of an
> existing gmail/outlook/old-host account into this server, run a small puller
> alongside it:
> ```bash
> sudo apt install getmail6      # or fetchmail
> # getmail config: retrieve via pop3/imap from the old account,
> # deliver via smtp to localhost:587 (your stalwart submission port).
> ```
> schedule it with a systemd timer / cron. this is the "+ pop3" inbound path.

---

## 5b. infinite aliases (how aliases actually receive mail)

important distinction: the **passwords/aliases list in the web ui + extension is
a tracker** — creating an alias there stores a durable record (so you remember
which alias you used where), but it does **not** by itself make stalwart accept
mail at that address. there are two ways to make aliases actually deliver:

### option a — catch-all (recommended, truly "infinite")

enable a catch-all so **every** address at your domain lands in your mailbox,
then invent aliases freely (and track them in the ui/extension):

admin ui → **directory → your account → email addresses** → add
`@{{alias_domain}}` (a bare `@domain` entry) as a catch-all alias of your account.

now `anything@{{alias_domain}}` is delivered to you with zero per-alias setup — this
is the simplest path to unlimited aliases, and the alias tracker stays useful
for knowing who you handed each one to.

### option b — explicit per-alias registration

if you prefer each alias to be an explicit account address (so unknown
addresses bounce), add them individually in **directory → account → email
addresses**, or wire the `/api/aliases` create handler to register the address
on the account's principal. the api path for that (for a future code change) is:

```text
access_token.account_id()                       // current account (u32)
registry().object::<Account>(account_id)         // load the principal
  .into_user() → push to email_aliases
server.synchronize_account(account)               // persists + invalidates caches
```
this only works when the directory backend is the **internal** store (writable);
external ldap/sql directories are read-only and would overwrite the change on
next sync. it was intentionally left out of the current build because it must be
compile-verified against the directory crate first.

## 6. zero-access / at-rest encryption

this is **not** proton-style end-to-end zero-access encryption (see the status
report), but stalwart can encrypt stored mail at rest with your own pgp/s-mime
public key, so a disk-image theft doesn't expose mail:

admin ui → **account → encryption at rest** → upload your openpgp (or s/mime)
public key. incoming mail is then encrypted to that key before being written.
transport is always tls (§3–§5). combine with full-disk encryption (luks) on the
mini-pc for defense in depth.

---

## 7. clients

once dns + the server are up:

- **mail:** imap `mail.{{alias_domain}}:993` (ssl), smtp submission `:587` (starttls),
  or jmap at `https://mail.{{alias_domain}}/jmap/session`. the built-in web ui also
  lives at `https://mail.{{alias_domain}}`.
- **calendar (caldav):** `https://mail.{{alias_domain}}/dav/cal/<you@{{alias_domain}}>/`
- **contacts (carddav):** `https://mail.{{alias_domain}}/dav/card/<you@{{alias_domain}}>/`
- **files (webdav):** `https://mail.{{alias_domain}}/dav/file/<you@{{alias_domain}}>/`
- **passwords:** web ui → passwords, or the browser extension (point its options
  page `api base` at `https://mail.{{alias_domain}}/api` and set your alias domain).

ios/macos accept the caldav/carddav urls directly in account settings; thunderbird
and davx5 (android) work with the same urls + your account password.

---

## 8. health check & ops

```bash
curl -k https://mail.{{alias_domain}}/healthz/live      # liveness
sudo journalctl -u email -f                        # logs
sudo systemctl restart email                        # restart
```

backups: snapshot `/var/lib/email/` (and `/etc/email/`) regularly — that's all
your mail, calendars, contacts, files, aliases, and saved passwords.
