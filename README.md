<h1 align="center">email</h1>

<p align="center">
  personal email suite forked from stalwart — secure, scalable mail & collaboration server with alias management<br>
  (imap, jmap, smtp, caldav, carddav, webdav)
</p>

<br>

<hr>

<h2 align="center" id="fork-notice">fork notice</h2>

<p align="center">this is a personal fork of <a href="https://github.com/stalwartlabs/stalwart">stalwartlabs/stalwart</a> modified to create a personal email suite with integrated alias management, inspired by proton pass. the core mail server functionality remains, with additions for alias workflows and a personal frontend.</p>

<hr>

<h2 align="center" id="features">features</h2>

<p align="center"><strong>email</strong> is a personal email server forked from stalwart with added alias management capabilities. it is written in rust and designed to be secure, fast, robust and scalable.</p>

<p align="center">key features:</p>

- **email server** with complete protocol support:
  - jmap:
    * [jmap for mail](https://datatracker.ietf.org/doc/html/rfc8621) server.
    * [jmap for sieve scripts](https://www.ietf.org/archive/id/draft-ietf-jmap-sieve-22.html).
    * [websocket](https://datatracker.ietf.org/doc/html/rfc8887), [blob management](https://www.rfc-editor.org/rfc/rfc9404.html) and [quotas](https://www.rfc-editor.org/rfc/rfc9425.html) extensions.
  - imap:
    * [imap4rev2](https://datatracker.ietf.org/doc/html/rfc9051) and [imap4rev1](https://datatracker.ietf.org/doc/html/rfc3501) server.
    * [managesieve](https://datatracker.ietf.org/doc/html/rfc5804) server.
    * numerous [extensions](https://stalw.art/docs/development/rfcs#imap4-and-extensions) supported.
  - pop3:
    * [pop3](https://datatracker.ietf.org/doc/html/rfc1939) server.
    * [stls](https://datatracker.ietf.org/doc/html/rfc2595) and [sasl](https://datatracker.ietf.org/doc/html/rfc5034) support as well as other [extensions](https://datatracker.ietf.org/doc/html/rfc2449).
  - smtp:
    * smtp server with built-in [dmarc](https://datatracker.ietf.org/doc/html/rfc7489), [dkim](https://datatracker.ietf.org/doc/html/rfc6376), [spf](https://datatracker.ietf.org/doc/html/rfc7208) and [arc](https://datatracker.ietf.org/doc/html/rfc8617) support for message authentication.
    * strong transport security through [dane](https://datatracker.ietf.org/doc/html/rfc6698), [mta-sts](https://datatracker.ietf.org/doc/html/rfc8461) and [smtp tls](https://datatracker.ietf.org/doc/html/rfc8460) reporting.
    * automated dkim key rotation and management.
    * inbound throttling and filtering with granular configuration rules, sieve scripting, mta hooks and milter integration.
    * distributed virtual queues with delayed delivery, priority delivery, quotas, routing rules and throttling support.
    * envelope rewriting and message modification.
- **collaboration server**:
  - calendaring and scheduling:
    * [caldav](https://datatracker.ietf.org/doc/html/rfc4791) and [caldav scheduling](https://datatracker.ietf.org/doc/html/rfc6638) support.
    * [jmap for calendars](https://datatracker.ietf.org/doc/html/draft-ietf-jmap-calendars-24) support.
  - contact management:
    * [carddav](https://datatracker.ietf.org/doc/html/rfc6352) support.
    * [jmap for contacts](https://datatracker.ietf.org/doc/html/rfc9610) support.
  - file storage:
    * [webdav](https://datatracker.ietf.org/doc/html/rfc4918) support.
    * [jmap for file storage](https://datatracker.ietf.org/doc/html/draft-ietf-jmap-filenode-03) support.
  - sharing with fine-grained access controls:
    * [webdav acl](https://datatracker.ietf.org/doc/html/rfc3744) support.
    * [jmap sharing](https://datatracker.ietf.org/doc/html/rfc9670) support.
- **spam and phishing built-in filter**:
  - comprehensive set of filtering **rules** on par with popular solutions.
  - llm-driven spam filtering and message analysis.
  - statistical **spam classifier** with collaborative filtering, automatic training capabilities and address book integration.
  - dns blocklists (**dnsbls**) checking of ip addresses, domains, and hashes.
  - collaborative digest-based spam filtering with **pyzor**.
  - **phishing** protection against homographic url attacks, sender spoofing and other techniques.
  - trusted **reply** tracking to recognize and prioritize genuine e-mail replies.
  - sender **reputation** monitoring by ip address, asn, domain and email address.
  - **greylisting** to temporarily defer unknown senders.
  - **spam traps** to set up decoy email addresses that catch and analyze spam.
- **flexible**:
  - pluggable storage backends with **rocksdb**, **foundationdb**, **postgresql**, **mysql**, **sqlite**, **s3-compatible**, **azure** and **redis** support.
  - full-text search available in 17 languages using the built-in search engine or via **meilisearch**, **elasticsearch**, **opensearch**, **postgresql** or **mysql** backends.
  - sieve scripting language with support for all [registered extensions](https://www.iana.org/assignments/sieve-extensions/sieve-extensions.xhtml).
  - email aliases, mailing lists, subaddressing and catch-all addresses support.
  - automated dns management.
  - automatic account configuration and discovery with [autoconfig](https://www.ietf.org/id/draft-bucksch-autoconfig-02.html) and [autodiscover](https://learn.microsoft.com/en-us/exchange/architecture/client-access/autodiscover?view=exchserver-2019).
  - multi-tenancy support with domain and tenant isolation.
  - disk quotas per user and tenant.
- **secure and robust**:
  - encryption at rest with **s/mime** or **openpgp**.
  - automatic tls certificate provisioning with [acme](https://datatracker.ietf.org/doc/html/rfc8555) using `tls-alpn-01`, `dns-01`, `dns-persist-01` or `http-01` challenges.
  - automated blocking of ip addresses that attack, abuse or scan the server for exploits.
  - rate limiting.
  - security audited (read the [report](https://stalw.art/blog/security-audit)).
  - memory safe (thanks to rust).
- **scalable and fault-tolerant**:
  - designed to handle growth seamlessly, from small setups to large-scale deployments of thousands of nodes.
  - built with **fault tolerance** and **high availability** in mind, recovers from hardware or software failures with minimal operational impact.
  - peer-to-peer cluster coordination or with **kafka**, **redpanda**, **nats** or **redis**.
  - **kubernetes**, **apache mesos** and **docker swarm** support for automated scaling and container orchestration.
  - read replicas, sharded blob storage and in-memory data stores for high performance and low latency.
- **authentication and authorization**:
  - **openid connect** authentication.
  - oauth 2.0 authorization with [authorization code](https://www.rfc-editor.org/rfc/rfc8628) and [device authorization](https://www.rfc-editor.org/rfc/rfc8628) flows.
  - **ldap**, **oidc**, **sql** or built-in authentication backend support.
  - two-factor authentication with time-based one-time passwords (`2fa-totp`)
  - application passwords (app passwords).
  - roles and permissions.
  - access control lists (acls).
- **observability**:
  - logging and tracing with **opentelemetry**, journald, log files and console support.
  - metrics with **opentelemetry** and **prometheus** integration.
  - webhooks for event-driven automation.
  - alerts with email and webhook notifications.
  - live tracing and metrics.
- **web-based administration**:
  - dashboard with real-time statistics and monitoring.
  - account, domain, group and mailing list management.
  - smtp queue management for messages and outbound dmarc and tls reports.
  - report visualization interface for received dmarc, tls-rpt and failure (arf) reports.
  - configuration of every aspect of the mail server.
  - log viewer with search and filtering capabilities.
  - self-service portal for password reset and encryption-at-rest key management.

<p align="center">all documentation for the original stalwart code is available at <a href="[https://stalw.art/docs/install/](https://stalw.art/docs/install/)">https://stalw.art/docs/install/</a>.</p>

<hr>

<h2 align="center" id="license">license</h2>

<p align="center">the original code of the stalwart project is licensed under the <strong>gnu affero general public license v3.0</strong> (<a href="./LICENSE">agpl-3.0</a>). HOWEVER, all added code, including additions to the email suite, were made under the mates license, explicitly prohibiting use of the code under said license from being used to gain financial profit in any way, shape or form. the mates license also highly recommends for users to HIGHLY MODIFY and fork their own version of the software instead of using it as-is (because it was made for the house of mates system's mind, not for general use). for more details see the <a href="./LICENSE">license file</a>.</p>

<hr>

<h2 align="center" id="copyright">copyright</h2>

<p align="center">copyright (c) 2026 stalwart labs llc<br>
copyright (c) 2026 house of mates</p>
