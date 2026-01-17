# Auth Security Review Conclusions

Findings
- Medium: Refresh tokens can be persisted in local storage by default, and token encryption can fall back to plaintext if the key is missing or invalid.
- Medium: Token selection allows partial audience/scope matching and can fall back to a default token, which risks returning a token for the wrong audience.
- Low: Token fragments are logged in debug paths even when audit logging is disabled.
- Medium: Google direct flow can embed a client secret in frontend builds when explicitly allowed.
- Low: Azure user identity is derived from ID token claims without explicit signature/issuer/audience/nonce validation.

Recommendations
- Default to session or memory for refresh tokens; fail closed when encryption is not available or invalid.
- Require exact audience/scope match for access tokens; make any fallback explicit and opt-in.
- Remove token material from logs or gate all token logging behind a strict audit flag.
- Enforce backend exchange for Google in production; disallow client secrets in frontend builds.
- Validate ID tokens before using claims or prefer fetching verified profile data from provider APIs.
