# AQARI Global Terminal — Database Backup & Restore Guide

## 1. Persistent Storage Architecture
- **Primary Database**: Upstash Redis (via `@upstash/redis` REST API).
- **Environment Variables** (configured in Vercel Project Settings, never committed):
  - `UPSTASH_REDIS_REST_URL` (or `KV_REST_API_URL`)
  - `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_TOKEN`)
  - `KV_URL`
- **Redis Key Schema**:
  - `user:{email}` — User account profile, active plan, expiry, and forensic timeline
  - `user:byId:{userId}` — Deterministic user ID index
  - `credits:{userId}` — Atomic integer credit counter (`DECRBY` / `INCRBY` via Lua)
  - `session:{sessionId}` — Authenticated HTTP-only session record with TTL
  - `analysis:{userId}:{analysisId}` & `analyses:index:{userId}` — Persisted underwriting analyses
  - `payment:{orderId}` & `payments:index` — Idempotent payment ledger (`SET NX`)
  - `audit:{timestamp}:{id}` & `aqari:audit_logs:v1` — Append-only admin audit log
  - `aqari:rl:{key}` — Sliding-window rate limit counters
- Legacy read-through keys (`aqari:user:{email}`, `aqari:session:{sessionId}`, `aqari:used_order:{orderId}`) remain readable without destructive migration or data deletion.

---

## 2. Daily Backup Procedure (Upstash Console + Admin Export)

### A. Upstash Console Snapshot / Data Browser Export (Recommended Daily)
1. Sign in to the **Upstash Console** (`console.upstash.com`) and select the production Redis database backing AQARI Terminal.
2. Open **Data Browser** (or **Backups** tab if Upstash Daily Backups are enabled on your plan).
3. Click **Export Data** (JSON / RDB snapshot) and store the encrypted archive in your secure owner vault (e.g., encrypted cloud bucket or offline drive — never commit exports to Git).
4. Verify key counts for `user:*`, `payment:*`, `credits:*`, `analysis:*`, and `audit:*` match expectations.

### B. Programmatic Admin JSON Export (`lib/backup.ts`)
- Authorized owner admins (`ADMIN_EMAIL` with verified Google session) can call `exportAllData(adminUser)` in `lib/backup.ts` (never exposed unauthenticated; strips `api_key_token` and session tokens).
- Store exported JSON files with timestamped filenames such as `aqari-backup-YYYY-MM-DD.json` in encrypted off-site storage.

---

## 3. Restore Procedure
1. **Do NOT run `FLUSHALL` or `FLUSHDB`** on a live database containing active user or payment records.
2. To restore into a clean or staging Upstash Redis instance:
   - Provision or select the target Upstash Redis database in the Upstash Console.
   - Use **Upstash Console -> Data Browser -> Import** (or Upstash Restore from Backup Snapshot) to load the snapshot keys (`user:*`, `credits:*`, `payment:*`, `analysis:*`, `audit:*`).
3. Verify critical indexes exist after import:
   - `users:index` contains active emails
   - `payments:index` contains processed order IDs (prevents duplicate webhook replay)
   - `credits:{userId}` integers match active plan/extra credit balances
4. Update `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (and `KV_REST_API_URL` / `KV_REST_API_TOKEN`) in Vercel if pointing to a restored database, then redeploy.
5. Verify health check endpoint returns HTTP `200 { ok: true }` before announcing maintenance completion.

---

## 4. RPO / RTO Targets
- **RPO (Recovery Point Objective)**: <= 24 hours with daily Upstash backup / export (or real-time replication on Upstash Multi-Region / Global database plans).
- **RTO (Recovery Time Objective)**: ~15–30 minutes via Upstash snapshot restore or env var switch in Vercel + redeploy.
