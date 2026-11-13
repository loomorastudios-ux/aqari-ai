// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import {
  ShieldCheck,
  Search,
  Download,
  ArrowLeft,
  AlertTriangle,
  FileText,
  X,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface AdminDashboardProps {
  currentUser: User | null;
  onRedirectHome: (reason?: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onRedirectHome,
}) => {
  const [users, setUsers] = useState<any[]>([]);
  const [failedWebhooks, setFailedWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [over3Only, setOver3Only] = useState(false);
  const [refundOnly, setRefundOnly] = useState(false);

  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [newPlan, setNewPlan] = useState<'free' | 'starter' | 'pro' | 'enterprise'>('free');
  const [planReason, setPlanReason] = useState('');
  const [refundNotes, setRefundNotes] = useState('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (res.status === 403 || res.status === 401) {
        onRedirectHome('403 Forbidden: Owner admin access only');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setFailedWebhooks(data.failedWebhooks || []);
      }
    } catch {
      onRedirectHome('Unable to verify admin authorization');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser || currentUser.email.toLowerCase() !== 'loomora.studios@gmail.com') {
      onRedirectHome('403 Forbidden: Restricted to loomora.studios@gmail.com');
      return;
    }
    loadUsers();
  }, [currentUser?.email]);

  const openUserDetail = async (email: string) => {
    try {
      const res = await fetch(`/api/admin/user/${encodeURIComponent(email)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedUser(data.user);
        setNewPlan(data.user.plan || 'free');
        setPlanReason('');
        setRefundNotes('');
      }
    } catch {}
  };

  const handleChangePlan = async () => {
    if (!selectedUser) return;
    if (!planReason.trim()) {
      setActionMsg('Reason is mandatory to change a user plan.');
      return;
    }
    try {
      const res = await fetch(`/api/admin/user/${encodeURIComponent(selectedUser.email)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'change_plan',
          newPlan,
          reason: planReason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('Plan updated & audit logged.');
        setPlanReason('');
        await openUserDetail(selectedUser.email);
        await loadUsers();
      } else {
        setActionMsg(data?.error || 'Failed to update plan');
      }
    } catch {
      setActionMsg('Network error updating plan');
    }
  };

  const handleRefundDecision = async (status: 'denied' | 'approved' | 'pending') => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`/api/admin/user/${encodeURIComponent(selectedUser.email)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'refund_decision',
          status,
          notes: refundNotes.trim() || selectedUser.refundEvaluation?.verdict || '',
        }),
      });
      if (res.ok) {
        setActionMsg(`Refund marked ${status.toUpperCase()} in timeline.`);
        setRefundNotes('');
        await openUserDetail(selectedUser.email);
        await loadUsers();
      }
    } catch {}
  };

  const filteredUsers = users.filter((u) => {
    if (search && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (planFilter !== 'all' && u.plan !== planFilter) return false;
    if (statusFilter === 'expired' && !u.isExpired) return false;
    if (statusFilter === 'active' && u.isExpired) return false;
    if (over3Only && u.analyses_used <= 3) return false;
    if (refundOnly && !u.refund_requested) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-black text-slate-100 p-4 sm:p-8 relative z-20">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37] uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>OWNER FORENSIC EVIDENCE CONSOLE • LOOMORA STUDIOS</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Admin Compliance &amp; Dispute Evidence Dashboard
            </h1>
            <p className="text-xs font-mono text-zinc-400 mt-1">
              Authenticated Owner: {currentUser?.email} • Immutable usage &amp; refund policy logs
            </p>
          </div>

          <button
            type="button"
            onClick={() => onRedirectHome()}
            className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-mono text-white flex items-center gap-2 cursor-pointer self-start"
          >
            <ArrowLeft className="w-4 h-4 text-[#D4AF37]" />
            <span>Return to App</span>
          </button>
        </div>

        {/* Search & Filters */}
        <div className="glass-panel p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user by email..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-white outline-none focus:border-[#D4AF37]"
            />
          </div>

          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-mono text-white"
          >
            <option value="all">All Plans</option>
            <option value="free">FREE</option>
            <option value="starter">STARTER</option>
            <option value="pro">PROFESSIONAL</option>
            <option value="enterprise">SOVEREIGN</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-mono text-white"
          >
            <option value="all">Active &amp; Expired</option>
            <option value="active">Active Only</option>
            <option value="expired">Expired Only</option>
          </select>

          <label className="flex items-center gap-2 text-xs font-mono text-zinc-300 cursor-pointer px-2">
            <input
              type="checkbox"
              checked={over3Only}
              onChange={(e) => setOver3Only(e.target.checked)}
              className="accent-[#D4AF37]"
            />
            <span>Analyses &gt; 3</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-mono text-zinc-300 cursor-pointer px-2">
            <input
              type="checkbox"
              checked={refundOnly}
              onChange={(e) => setRefundOnly(e.target.checked)}
              className="accent-[#D4AF37]"
            />
            <span>Refund Requested</span>
          </label>
        </div>

        {/* Failed Webhook Security Alerts */}
        {failedWebhooks.length > 0 && (
          <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-xs font-mono text-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>
                Security Log: {failedWebhooks.length} invalid/unsigned webhook attempt(s) rejected. Latest:{' '}
                {failedWebhooks[0]?.reason}
              </span>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="glass-panel overflow-hidden border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-white/[0.04] border-b border-white/10 text-zinc-400 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">License Start</th>
                  <th className="py-3 px-4">License End</th>
                  <th className="py-3 px-4">Days Left</th>
                  <th className="py-3 px-4">Analyses Used / Limit</th>
                  <th className="py-3 px-4">Analyses List</th>
                  <th className="py-3 px-4">PDF Downloads</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-4">Total Paid ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-zinc-300">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-zinc-500">
                      Loading forensic user database...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-zinc-500">
                      No matching user records found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr
                      key={u.email}
                      onClick={() => openUserDetail(u.email)}
                      className="hover:bg-[#D4AF37]/10 cursor-pointer transition"
                    >
                      <td className="py-3 px-4 font-bold text-white">{u.email}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] font-bold">
                          {u.displayPlan}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {u.license_start ? new Date(u.license_start).toISOString().slice(0, 10) : '-'}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {u.license_end ? new Date(u.license_end).toISOString().slice(0, 10) : '-'}
                      </td>
                      <td className="py-3 px-4">{u.daysLeft}d</td>
                      <td className="py-3 px-4 font-bold text-white">
                        {u.analyses_used} / {u.analysesLimit}
                      </td>
                      <td className="py-3 px-4 max-w-[180px] truncate text-zinc-400">
                        {u.analyses_log?.length
                          ? `${u.analyses_log.length} logged (${u.analyses_log[0].property})`
                          : 'None'}
                      </td>
                      <td className="py-3 px-4">
                        {u.pdf_downloads?.length || 0}{' '}
                        {u.pdf_downloads?.[0]
                          ? `(${new Date(u.pdf_downloads[0].timestamp).toISOString().slice(0, 10)})`
                          : ''}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {u.last_login_at ? new Date(u.last_login_at).toISOString().slice(0, 10) : '-'}
                      </td>
                      <td className="py-3 px-4 text-emerald-400 font-bold">
                        ${u.total_paid_usd || 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* User Detail Forensic Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-3xl glass-dropdown border border-[#D4AF37]/40 p-6 sm:p-8 space-y-6 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-wider">
                  FORENSIC ACCOUNT DOSSIER
                </div>
                <h2 className="text-xl font-bold text-white mt-0.5">{selectedUser.email}</h2>
                <div className="text-xs font-mono text-zinc-400 mt-1">
                  Plan: <strong className="text-[#D4AF37]">{selectedUser.displayPlan}</strong> • Paid: $
                  {selectedUser.total_paid_usd || 0} • Analyses Used: {selectedUser.analyses_used} • PDFs:{' '}
                  {selectedUser.pdf_downloads?.length || 0}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`/api/admin/export/${encodeURIComponent(selectedUser.email)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold text-xs font-mono flex items-center gap-2 hover:brightness-110"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Evidence PDF</span>
                </a>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {actionMsg && (
              <div className="p-3 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-xs font-mono text-[#D4AF37]">
                {actionMsg}
              </div>
            )}

            {/* Refund Eligibility Verdict */}
            <div
              className={`p-4 rounded-2xl border text-xs font-mono flex items-start gap-3 ${
                selectedUser.refundEvaluation?.eligible
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
              }`}
            >
              {selectedUser.refundEvaluation?.eligible ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div className="space-y-1 flex-1">
                <div className="font-bold">
                  Refund Policy Verdict: {selectedUser.refundEvaluation?.verdict}
                </div>
                <div className="text-[11px] opacity-80">
                  Policy: Refund ONLY within 5–7 days AND &lt;= 3 analyses AND 0 PDF downloads.
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={refundNotes}
                    onChange={(e) => setRefundNotes(e.target.value)}
                    placeholder="Optional dispute note..."
                    className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white text-xs"
                  />
                  <button
                    onClick={() => handleRefundDecision('denied')}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
                  >
                    Log Refund DENIED
                  </button>
                  <button
                    onClick={() => handleRefundDecision('approved')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer"
                  >
                    Log Refund APPROVED
                  </button>
                </div>
              </div>
            </div>

            {/* Audited Admin Plan Change (Mandatory Reason) */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
              <div className="text-xs font-mono font-bold text-white uppercase">
                Audited Plan Override (Mandatory Reason Logged)
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white"
                >
                  <option value="free">FREE</option>
                  <option value="starter">STARTER</option>
                  <option value="pro">PROFESSIONAL</option>
                  <option value="enterprise">SOVEREIGN</option>
                </select>
                <input
                  type="text"
                  value={planReason}
                  onChange={(e) => setPlanReason(e.target.value)}
                  placeholder="Mandatory audit reason (e.g., Manual Lemon order #123 reconciliation)"
                  className="flex-1 min-w-[220px] px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white"
                />
                <button
                  onClick={handleChangePlan}
                  className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold cursor-pointer"
                >
                  Apply Audited Change
                </button>
              </div>
            </div>

            {/* Full Chronological Timeline */}
            <div className="space-y-2">
              <div className="text-xs font-mono font-bold text-white uppercase flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D4AF37]" />
                <span>Immutable System Audit Timeline ({selectedUser.timeline?.length || 0})</span>
              </div>
              <div className="rounded-2xl bg-black/60 border border-white/10 p-4 max-h-64 overflow-y-auto space-y-2 text-xs font-mono">
                {(selectedUser.timeline || []).length === 0 ? (
                  <div className="text-zinc-500">No timeline events recorded yet.</div>
                ) : (
                  selectedUser.timeline.map((ev: any) => (
                    <div
                      key={ev.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1.5 border-b border-white/[0.05] last:border-0"
                    >
                      <span className="text-zinc-200">{ev.message}</span>
                      <span className="text-[10px] text-zinc-500 shrink-0">{ev.timestamp}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
