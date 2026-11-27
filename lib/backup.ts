// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import { isAdminUser, AuthSessionUser } from './auth';
import {
  getAllServerUsersFromDb,
  getAllPaymentsFromDb,
  getAnalyses,
  getAuditLog,
  getUserIdForEmail,
} from './serverStore';

export interface ExportedBackupPayload {
  exportedAt: string;
  exportedBy: string;
  storageProvider: 'upstash-redis';
  counts: {
    users: number;
    payments: number;
    analyses: number;
    auditLogs: number;
  };
  users: Array<Record<string, any>>;
  payments: Array<Record<string, any>>;
  analyses: Array<Record<string, any>>;
  auditLogs: Array<Record<string, any>>;
}

function scrubUserForBackup(user: Record<string, any>): Record<string, any> {
  const { api_key_token: _secretApiKey, ...safe } = user || {};
  return {
    ...safe,
    userId: safe.userId || getUserIdForEmail(safe.email || ''),
    api_key_redacted: safe.api_key_last4 ? `****${safe.api_key_last4}` : null,
  };
}

export async function exportAllData(
  adminUser?: Partial<AuthSessionUser> | null
): Promise<ExportedBackupPayload> {
  if (!isAdminUser(adminUser)) {
    throw new Error('Forbidden: Admin authentication required for backup export');
  }

  const [rawUsers, payments, auditResult] = await Promise.all([
    getAllServerUsersFromDb(),
    getAllPaymentsFromDb(),
    getAuditLog({ page: 1, limit: 100 }),
  ]);

  const analyses: Array<Record<string, any>> = [];
  for (const user of rawUsers) {
    const uid = user.userId || getUserIdForEmail(user.email);
    const storedAnalyses = await getAnalyses(uid);
    for (const item of storedAnalyses) {
      analyses.push({
        id: item.id,
        userId: item.userId,
        email: item.email,
        createdAt: item.createdAt,
        payload: item.payload,
      });
    }
    if (storedAnalyses.length === 0 && Array.isArray(user.saved_analyses)) {
      for (const saved of user.saved_analyses) {
        analyses.push({
          id: saved?.id || null,
          userId: uid,
          email: user.email,
          createdAt: saved?.createdAt || null,
          payload: saved,
        });
      }
    }
  }

  const users = rawUsers.map((u) => scrubUserForBackup(u as Record<string, any>));

  return {
    exportedAt: new Date().toISOString(),
    exportedBy: String(adminUser?.email || ''),
    storageProvider: 'upstash-redis',
    counts: {
      users: users.length,
      payments: payments.length,
      analyses: analyses.length,
      auditLogs: auditResult.logs.length,
    },
    users,
    payments: payments.map((p) => ({ ...p })),
    analyses,
    auditLogs: auditResult.logs.map((a) => ({ ...a })),
  };
}
