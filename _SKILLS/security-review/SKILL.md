---
name: security-review
description: Security-oriented code review and risk assessment with actionable recommendations for any codebase (frontend, backend, data, or infrastructure). Use for security analysis, security audit, API security, encrypted storage, authentication/authorization, secrets handling, or confidentiality/integrity/access control reviews.
---

# Security Review

## Overview

Provide a focused security review of the requested code scope and deliver prioritized findings with concrete recommendations. Keep analysis evidence-based and tied to specific files and lines.

## Workflow

1. Confirm scope and context
- Identify target paths/modules and whether the surface is frontend, backend, data, or infrastructure.
- Clarify environment assumptions (production vs dev), threat model, data classification, and storage/identity requirements.
- Ask for exact paths or components when scope is ambiguous.

2. Collect relevant files
- Use `rg --files` and targeted `rg` searches to find entry points, data flows, storage, crypto, auth, config/env, network calls, and logging.
- Include persistence layers, API handlers, and any security-sensitive utilities.

3. Analyze key risk areas
- Review data handling (PII, secrets, encrypted storage at rest and in transit).
- Review authN/authZ and access control boundaries.
- Review input validation and injection risks (SQL/NoSQL, path traversal, SSRF, deserialization).
- Review crypto and key management (derivation, IV/nonce, rotation, storage).
- Review API security (rate limits, CORS, request validation, error exposure).
- Review logging and telemetry for sensitive data leakage.
- Review dependencies and supply chain risks.
- Review secure defaults and configuration hardening.

4. Produce the report
- Order findings by severity (Critical/High/Medium/Low/Info).
- Include for each finding: severity, short title, risk/impact, evidence with file path and line, and a recommendation.
- State explicitly when no findings are detected, and list residual risks or testing gaps.
- Add open questions or assumptions at the end.

## Output format

- Start with findings, then open questions/assumptions, then a brief change summary if needed.
- Use file paths with line numbers for evidence.
- Avoid code changes unless explicitly requested.

## Stack checklists (optional)

Use only the sections relevant to the code under review.

### Svelte 5 frontend

- Avoid exposing secrets in the client bundle (no private keys or client secrets).
- Treat any `{@html}` usage as XSS risk; require sanitization and trusted sources.
- Validate and sanitize external data before rendering or storage.
- Minimize token/PII persistence; prefer memory or session storage.
- Enforce HTTPS and avoid logging sensitive data in the browser.

### FastAPI backend

- Validate inputs with Pydantic for bodies, queries, and headers.
- Enforce authN/authZ at the endpoint level, not only in clients.
- Restrict CORS to known origins, methods, and headers.
- Rate limit auth and sensitive endpoints; add brute-force protections.
- Avoid leaking stack traces or secrets in error responses and logs.

### Encrypted storage and crypto

- Use authenticated encryption (AES-GCM or ChaCha20-Poly1305).
- Ensure a unique random IV/nonce per encryption; store IV with ciphertext.
- Use a proper KDF (PBKDF2/Argon2) with salt for password-derived keys.
- Keep keys in secure storage; rotate keys and invalidate old material.
- Fail closed on decryption errors and clear corrupted data.

### Database

- Use parameterized queries; avoid string concatenation for SQL.
- Apply least-privilege roles and segregate read/write access.
- Encrypt sensitive columns and ensure backups are encrypted.
- Enforce tenant scoping in queries and indexes for multi-tenant data.
- Redact PII in logs and error messages.

### Infrastructure

- Store secrets in a secret manager; never in build artifacts or logs.
- Enforce TLS everywhere; enable HSTS on public endpoints.
- Restrict network ingress/egress; apply least-privilege IAM policies.
- Monitor auth/admin actions with audit logs and alerting.
- Scan dependencies and images; pin base images and versions.
- Verify backups and restoration procedures regularly.

## Operating constraints

- Follow repository-specific AI instructions when present (for example, AGENTS.md or AI_INSTRUCTIONS.md).
- Keep responses concise and focused on security-relevant risks.
