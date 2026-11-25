# AQARI GLOBAL TERMINAL — Phase 1 Protection, Backup & Rollback Plan

> **CRITICAL RULE:** Do NOT test unverified changes directly on Production (`https://aqari-ai-rho.vercel.app`). Always verify on a branch + Vercel Preview URL first.

---

## 1. How to Create a Full Backup Before Any Change

### A. Local & Remote Git Backup
Run these commands in order before starting Phase 2+ work:

```bash
# 1. Check working tree status
git status

# 2. Create a dated backup branch from current clean state
git branch backup/phase1-2026-11-25

# 3. Stage and commit any Phase 1 protection files (if not yet committed)
git add BACKUP_PLAN.md .env.example .gitignore
git commit -m "chore(phase1): add backup plan, env template, and gitignore protection"

# 4. Push both backup branch and current branch to origin
git push origin backup/phase1-2026-11-25
git push origin HEAD
```

### B. Vercel Production Snapshot Record
Before pushing any Phase 2+ commits:
1. Open **Vercel Dashboard → Project (`aqari-ai`) → Deployments**.
2. Filter to **Production** and locate the current **Ready** deployment serving `https://aqari-ai-rho.vercel.app`.
3. Record its exact **Deployment ID / Name** (e.g., `aqari-ai-<hash>.vercel.app`), **Commit SHA**, and **Timestamp** in your release log before deploying anything new.

---

## 2. How to Create and Use a Test (Preview) Environment

1. Open **Vercel Dashboard → Project → Settings → Git → Preview Deployments**.
2. Ensure **Preview Deployments** are enabled for all non-production branches (or pull requests).
3. Create a feature/staging branch instead of pushing to `main`:
   ```bash
   git checkout -b feat/phase2-staging
   git push -u origin feat/phase2-staging
   ```
4. Configure **Preview** environment variables in **Vercel Dashboard → Project → Settings → Environment Variables** (selecting the **Preview** scope only, using test/sandbox keys rather than mutating Production secrets).
5. Open the auto-generated **Preview URL** (`https://aqari-ai-git-<branch>-<team>.vercel.app`) for all QA and testing.
6. **NEVER test experimental changes on Production (`https://aqari-ai-rho.vercel.app`).**
   - *Note:* `index.html` currently redirects non-production `*.vercel.app` hostnames to `https://aqari-ai-rho.vercel.app`; keep that check in mind during future staging phases so Preview URLs remain testable when needed.

---

## 3. How to Rollback If Anything Breaks

### A. Instant Vercel Production Rollback (No Code Rebuild Required)
1. Open **Vercel Dashboard → Project (`aqari-ai`) → Deployments**.
2. Find the last verified **Ready** Production deployment recorded in Step 1B.
3. Click the **`...`** menu on that deployment → **Promote to Production**.
4. Confirm promotion and verify `https://aqari-ai-rho.vercel.app` recovers immediately.

### B. Git History Rollback
To revert a bad commit on the active branch safely without rewriting shared history:

```bash
# Revert the latest commit (creates a clean inverse commit)
git revert HEAD --no-edit
git push origin HEAD

# Or revert a specific commit SHA
git revert <BAD_COMMIT_SHA> --no-edit
git push origin HEAD

# Or restore entire working tree to the Phase 1 backup branch
git checkout backup/phase1-2026-11-25
```

---

## 4. Mandatory Pre-Phase 2+ Checklist

Verify **all** items below before making any feature, API, auth, Paddle, pricing, or UI change:

- [ ] `git status` inspected and Phase 1 backup branch `backup/phase1-2026-11-25` created and pushed.
- [ ] Last known-good Vercel Production **Ready** deployment ID/name recorded.
- [ ] `.env.example` contains variable names only (zero secret values).
- [ ] `.gitignore` ignores `.env`, `.env.local`, `.env*`, `node_modules`, `dist`, and `.vercel`.
- [ ] Vercel Preview Deployment URL verified working for isolated testing.
- [ ] Production (`https://aqari-ai-rho.vercel.app`) verified completely untouched.
