# Required Environment Variables

Based on the scan of the email project, here are the placeholder variables that should be defined in your `.env` file:

## Core Service Variables
- `{{alias_domain}}` - Default alias domain for auto-generated aliases (replaced `yourdomain.com`)
- `{{stalwart_contact_email}}` - Contact email for Stalwart Labs (replaced `hello@stalw.art`)
- `{{mobile_email_package}}` - Package name for mobile email app (replaced `space.houseofmates.email`)
- `{{mobile_passwords_package}}` - Package name for mobile passwords app (replaced `space.houseofmates.passwords`)
- `{{example_user_jane}}` - Example user email for documentation (replaced `jane@example.com`)

## Existing .env Template Variables (keep these as-is)
- `VAULTWARDEN_URL` - Vaultwarden service URL
- `VAULTWARDEN_API_URL` - Vaultwarden API URL
- `STALWART_URL` - Stalwart email server URL
- `STALWART_API_URL` - Stalwart API URL
- `STALWART_JMAP_URL` - Stalwart JMAP URL
- `SIMPLELOGIN_URL` - SimpleLogin service URL (optional)
- `SIMPLELOGIN_API_KEY` - SimpleLogin API key
- `ALIAS_DOMAIN` - Default alias domain (already in template)
- `BRIDGE_PORT` - Port for the bridge server
- `FRONTEND_PORT` - Frontend dev server port
- `CONFIG_ROOT` - Docker config root path
- `DOCKER_STACK` - Docker stack path
- `VAULTWARDEN_ADMIN_TOKEN` - Vaultwarden admin token (if enabled)
- `PROTON_EMAIL` - Proton account used for inbound mail forwarding (optional)
- `PROTON_PASSWORD` - Proton password / app-specific password (optional)
- `PROTON_FORWARDING` - Set to `1` to enable proton forwarding on boot (optional)
- `PROTON_BRIDGE_URL` - URL of the proton-bridge sidecar that performs the pull (optional)

## Notes
1. The `.env.example` file should be copied to `.env` and filled with actual values
2. The placeholder variables above represent hardcoded strings that were replaced for security/portability
3. Actual values should be placed in `.env`, not in the source code
4. Never commit `.env` to version control - it's already in `.gitignore`