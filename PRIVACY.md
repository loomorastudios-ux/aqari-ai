# AQARI GLOBAL TERMINAL — Privacy, Data Retention & Deletion Policy

Effective Date: 2026-11-26  
Controller: Loomora Studios (`loomorastudios@gmail.com`)

---

## 1. Customer Data Isolation & Access Controls
- All user data APIs (`/api/app`) resolve identity exclusively from the server-verified `HttpOnly` session cookie (`aqari_session`, issued only after cryptographic Google token verification).
- Client-supplied `email`, `login_email`, or `userId` parameters in request bodies or query strings are ignored for customer authorization and data lookup.
- Saved analyses, portfolio items, workspaces, and generated PDF/memorandum reports enforce `ownerId` and `ownerEmail` ownership checks on every read, export, and delete request.
- Cross-tenant lookup attempts for unknown or third-party record IDs return `404` (`not found`) without confirming record existence.
- Generated reports are stored privately behind authenticated ownership-checked access (`GET /api/app?action=getReportFile&id=...`) with zero public directory exposure.

## 2. Data Retention Schedule
- **Underwriting Analyses, Saved Properties, Workspaces & Reports:** Retained in active storage until deleted by the user (`action=delete-saved` or `action=deleteMyAccount`).
- **Session Tokens:** Retained up to 7 days (`Max-Age=604800`) and immediately purged on sign-out (`DELETE /api/app?action=session`) or account deletion.
- **Security & Financial Audit Logs:** Append-only admin, billing, refund, and account deletion audit logs (`auditLog`) are retained for **12 months** for fraud prevention, chargeback resolution, and regulatory compliance.

## 3. Permanent Account Deletion (`action=deleteMyAccount`)
Authenticated users can permanently delete their account at any time by calling:

```http
POST /api/app?action=deleteMyAccount
```

Upon verification of the active session:
1. All user profile records, saved analyses, underwriting history, portfolio items, generated reports/files metadata, custom branding, API keys, analyst threads, and workspace memberships are permanently deleted from both disk and Redis/KV persistence.
2. All active session records and cookies (`aqari_session`, `aqari_entitlement`) are invalidated and purged so any subsequent authenticated request (`/api/app?action=me`) returns `401 Unauthorized`.
3. A non-PII deletion audit record (`deleted_<userId>@deleted.local`) is appended to the 12-month security audit log.
4. **Deleted customer data is permanent and not recoverable after deletion.**

## 4. Production Error Sanitization & Logging
- In production (`VERCEL_ENV=production` or `NODE_ENV=production`), API responses return generic client-safe messages only and never expose stack traces, internal `/tmp` file paths, environment variable names, or other users' emails.
- Diagnostic errors are logged exclusively server-side (`console.error`) without secrets.
