#!/bin/bash
set -e

# Wait for the SQLite database to be ready
sleep 2

# Skip if already initialized
if pdnsutil list-zone email.test >/dev/null 2>&1; then
    echo "Zone email.test already exists; skipping init."
    exit 0
fi

# Create the zone with default SOA + NS
pdnsutil create-zone email.test ns1.email.test
pdnsutil set-kind email.test native

# Replace the default SOA with our own
pdnsutil replace-rrset email.test '' SOA 'ns1.email.test. admin.email.test. 2024010101 3600 900 604800 86400'

# Add basic records
pdnsutil add-record email.test 'ns1' A '127.0.0.1'
pdnsutil add-record email.test '' A '127.0.0.1'
pdnsutil add-record email.test '' MX '10 mail.email.test.'
pdnsutil add-record email.test 'mail' A '127.0.0.1'

# Add a sample TLSA record
# Usage=3 (DANE-EE), Selector=1 (SubjectPublicKeyInfo), Matching=1 (SHA-256)
pdnsutil add-record email.test '_25._tcp.mail' TLSA '3 1 1 0000000000000000000000000000000000000000000000000000000000000000'

# Import static TSIG key for RFC2136 dynamic updates
# Key: email-update-key / HMAC-SHA256
# Base64 secret: c3RhbHdhcnQtdGVzdC10c2lnLXNlY3JldC1rZXkxMjM0NTY3ODkw
pdnsutil import-tsig-key email-update-key hmac-sha256 'c3RhbHdhcnQtdGVzdC10c2lnLXNlY3JldC1rZXkxMjM0NTY3ODkw'
pdnsutil activate-tsig-key email.test email-update-key primary
pdnsutil set-meta email.test TSIG-ALLOW-DNSUPDATE email-update-key
pdnsutil set-meta email.test ALLOW-DNSUPDATE-FROM '0.0.0.0/0'


echo "PowerDNS zone setup complete."
echo "TSIG key name:      email-update-key"
echo "TSIG algorithm:     hmac-sha256"
echo "TSIG secret (b64):  c3RhbHdhcnQtdGVzdC10c2lnLXNlY3JldC1rZXkxMjM0NTY3ODkw"
