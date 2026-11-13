// © 2026 Loomora Studios - AQARI TERMINAL - All rights reserved. Unauthorized copying prohibited.
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { PricingPublicPayload, PlanKey, findPlanPricing } from '../../lib/plans';
import {
  ShieldCheck,
  Search,
  Download,
  ArrowLeft,
  AlertTriangle,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  Flame,
  Save,
  Users,
} from 'lucide-react';

interface AdminDashboardProps {
  currentUser: User | null;
  onRedirectHome: (reason?: string) => void;
  onPricingUpdated?: (pricing: PricingPublicPayload) => void;
}

interface EditablePlanDraft {
  originalPrice: string;
  launchPrice: string;
  analysesLimit: string;
  featuresText: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onRedirectHome,
  onPricingUpdated,
}) => {
  const [adminTab, setAdminTab] = useState<'users' | 'pricing'>('users');
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

  // Dynamic Pricing Control state
  const [pricingState, setPricingState] = useState<PricingPublicPayload | null>(null);
  const [pricingLogs, setPricingLogs] = useState<any[]>([]);
  const [launchBadgeInput, setLaunchBadgeInput] = useState('LAUNCH -40% - First 30 users only');
  const [countdownDaysInput, setCountdownDaysInput] = useState('7');
  const [planDrafts, setPlanDrafts] = useState<Record<PlanKey, EditablePlanDraft>>({
    free: { originalPrice: '0', launchPrice: '0', analysesLimit: '3', featuresText: '' },
    starter: { originalPrice: '129', launchPrice: '79', analysesLimit: '30', featuresText: '' },
    pro: { originalPrice: '349', launchPrice: '199', analysesLimit: '150', featuresText: '' },
    enterprise: { originalPrice: '999', launchPrice: '599', analysesLimit: '400', featuresText: '' },
  });
  const [pricingMsg, setPricingMsg] = useState<string | null>(null);
  const [savingPricingKey, setSavingPricingKey] = useState<string | null>(null);

  const hydratePricingDrafts = (p: PricingPublicPayload) => {
    setPricingState(p);
    setLaunchBadgeInput(p.launchBadgeText);
    setCountdownDaysInput(String(p.daysRemaining));
    const freeP = findPlanPricing(p, 'free');
    const starterP = findPlanPricing(p, 'starter');
    const proP = findPlanPricing(p, 'pro');
    const enterpriseP = findPlanPricing(p, 'enterprise');
    setPlanDrafts({
      free: {
        originalPrice: String(freeP?.originalPrice ?? 0),
        launchPrice: String(freeP?.launchPrice ?? 0),
        analysesLimit: String(freeP?.analysesLimit ?? 3),
        featuresText: (freeP?.features || []).join('\n'),
      },
      starter: {
        originalPrice: String(starterP?.originalPrice ?? 129),
        launchPrice: String(starterP?.launchPrice ?? 79),
        analysesLimit: String(starterP?.analysesLimit ?? 30),
        featuresText: (starterP?.features || []).join('\n'),
      },
      pro: {
        originalPrice: String(proP?.originalPrice ?? 349),
        launchPrice: String(proP?.launchPrice ?? 199),
        analysesLimit: String(proP?.analysesLimit ?? 150),
        featuresText: (proP?.features || []).join('\n'),
      },
      enterprise: {
        originalPrice: String(enterpriseP?.originalPrice ?? 999),
        launchPrice: String(enterpriseP?.launchPrice ?? 599),
        analysesLimit: String(enterpriseP?.analysesLimit ?? 400),
        featuresText: (enterpriseP?.features || []).join('\n'),
      },
    });
  };

  const loadPricingControl = async () => {
    try {
      const res = await fetch('/api/admin/pricing', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data?.pricing) hydratePricingDrafts(data.pricing);
        if (Array.isArray(data?.logs)) setPricingLogs(data.logs);
      }
    } catch {}
  };

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
    const em = (currentUser?.email || '').toLowerCase();
    if (!em || (em !== 'loomora.studios@gmail.com' && em !== 'loomorastudios@gmail.com')) {
      onRedirectHome('403 Forbidden: Restricted to loomora.studios@gmail.com');
      return;
    }
    loadUsers();
    loadPricingControl();
  }, [currentUser?.email]);

  const handleToggleLaunchDiscount = async (nextActive: boolean) => {
    setSavingPricingKey('global');
    setPricingMsg(null);
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'toggle_launch_discount',
          launchDiscountActive: nextActive,
          launchBadgeText: launchBadgeInput,
          countdownDays: Number(countdownDaysInput || 7),
        }),
      });
      const data = await res.json();
      if (res.ok && data?.pricing) {
        hydratePricingDrafts(data.pricing);
        if (Array.isArray(data?.logs)) setPricingLogs(data.logs);
        onPricingUpdated?.(data.pricing);
        window.dispatchEvent(new Event('aqari:pricing-updated'));
        setPricingMsg(data.log?.message || 'Launch discount settings saved & live.');
      } else {
        setPricingMsg(data?.error || 'Failed to update launch discount');
      }
    } catch {
      setPricingMsg('Network error updating launch discount');
    } finally {
      setSavingPricingKey(null);
    }
  };

  const handleSavePlanPricing = async (planKey: PlanKey) => {
    const draft = planDrafts[planKey];
    setSavingPricingKey(planKey);
    setPricingMsg(null);
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update_plan',
          planKey,
          originalPrice: Number(draft.originalPrice),
          launchPrice: Number(draft.launchPrice),
          analysesLimit: Number(draft.analysesLimit),
          features: draft.featuresText
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (res.ok && data?.pricing) {
        hydratePricingDrafts(data.pricing);
        if (Array.isArray(data?.logs)) setPricingLogs(data.logs);
        onPricingUpdated?.(data.pricing);
        window.dispatchEvent(new Event('aqari:pricing-updated'));
        setPricingMsg(data.log?.message || 'Plan pricing updated & live.');
      } else {
        setPricingMsg(data?.error || 'Failed to save plan pricing');
      }
    } catch {
      setPricingMsg('Network error saving plan pricing');
    } finally {
      setSavingPricingKey(null);
    }
  };

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

          <div className="flex flex-wrap items-center gap-2 self-start">
            <button
              type="button"
              onClick={() => setAdminTab('users')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 cursor-pointer border transition ${
                adminTab === 'users'
                  ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                  : 'bg-white/[0.05] text-zinc-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Users &amp; Evidence ({users.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('pricing')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 cursor-pointer border transition ${
                adminTab === 'pricing'
                  ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                  : 'bg-white/[0.05] text-zinc-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Pricing Control</span>
            </button>
            <button
              type="button"
              onClick={() => onRedirectHome()}
              className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-mono text-white flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#D4AF37]" />
              <span>Return to App</span>
            </button>
          </div>
        </div>

        {/* PRICING CONTROL TAB */}
        {adminTab === 'pricing' && (
          <div className="space-y-6">
            {pricingMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-xs font-mono text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{pricingMsg}</span>
              </div>
            )}

            {/* Global Launch Discount Control */}
            <div className="glass-panel p-5 border border-[#D4AF37]/30 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37] font-bold uppercase">
                    <Flame className="w-4 h-4" />
                    <span>Launch Discount Control (Live Checkout &amp; Pricing Page)</span>
                  </div>
                  <p className="text-xs font-mono text-zinc-400 mt-1">
                    When ON, checkout uses launchPrice. Toggle OFF to switch checkout and pricing page to originalPrice immediately without redeploy.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={savingPricingKey === 'global'}
                  onClick={() => handleToggleLaunchDiscount(!(pricingState?.launchDiscountActive ?? true))}
                  className={`px-4 py-2.5 rounded-xl text-xs font-mono font-black uppercase tracking-wider cursor-pointer transition shrink-0 ${
                    pricingState?.launchDiscountActive ?? true
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-500/50'
                      : 'bg-rose-950/60 text-rose-300 border border-rose-500/50 hover:bg-emerald-500/20 hover:text-emerald-300'
                  }`}
                >
                  {pricingState?.launchDiscountActive ?? true
                    ? 'Launch Discount ON (Click to Turn OFF)'
                    : 'Launch Discount OFF (Click to Turn ON)'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] text-zinc-400 uppercase mb-1">
                    Launch Badge Text
                  </label>
                  <input
                    type="text"
                    value={launchBadgeInput}
                    onChange={(e) => setLaunchBadgeInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase mb-1">
                    Countdown Days Remaining
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      value={countdownDaysInput}
                      onChange={(e) => setCountdownDaysInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white"
                    />
                    <button
                      type="button"
                      disabled={savingPricingKey === 'global'}
                      onClick={() => handleToggleLaunchDiscount(pricingState?.launchDiscountActive ?? true)}
                      className="px-3 py-2 rounded-xl bg-[#D4AF37] text-black font-bold cursor-pointer shrink-0"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Per-Plan Editors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {(['starter', 'pro', 'enterprise'] as const).map((planKey) => {
                const draft = planDrafts[planKey];
                const title =
                  planKey === 'starter'
                    ? 'STARTER'
                    : planKey === 'pro'
                    ? 'PROFESSIONAL'
                    : 'SOVEREIGN';
                return (
                  <div
                    key={planKey}
                    className="glass-panel p-5 border border-white/10 space-y-3.5 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                      <span className="text-sm font-bold text-[#D4AF37]">{title}</span>
                      <span className="text-[10px] text-zinc-400">
                        Active: $
                        {(pricingState?.launchDiscountActive ?? true)
                          ? draft.launchPrice
                          : draft.originalPrice}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] text-zinc-400 uppercase mb-1">
                          Original Price ($)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={draft.originalPrice}
                          onChange={(e) =>
                            setPlanDrafts((prev) => ({
                              ...prev,
                              [planKey]: { ...prev[planKey], originalPrice: e.target.value },
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 uppercase mb-1">
                          Launch Price ($)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={draft.launchPrice}
                          onChange={(e) =>
                            setPlanDrafts((prev) => ({
                              ...prev,
                              [planKey]: { ...prev[planKey], launchPrice: e.target.value },
                            }))
                          }
                          className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#D4AF37]/40 text-[#D4AF37] font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-400 uppercase mb-1">
                        Analyses Limit (30 Days)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={draft.analysesLimit}
                        onChange={(e) =>
                          setPlanDrafts((prev) => ({
                            ...prev,
                            [planKey]: { ...prev[planKey], analysesLimit: e.target.value },
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-zinc-400 uppercase mb-1">
                        Features List (one per line)
                      </label>
                      <textarea
                        rows={5}
                        value={draft.featuresText}
                        onChange={(e) =>
                          setPlanDrafts((prev) => ({
                            ...prev,
                            [planKey]: { ...prev[planKey], featuresText: e.target.value },
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-zinc-200 text-[11px] leading-relaxed"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={savingPricingKey === planKey}
                      onClick={() => handleSavePlanPricing(planKey)}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#D4AF37] hover:brightness-110 text-black font-bold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>
                        {savingPricingKey === planKey ? 'Saving...' : `Save ${title} Pricing`}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Pricing Change Audit Log */}
            <div className="glass-panel p-5 border border-white/10 space-y-3">
              <div className="text-xs font-mono font-bold text-white uppercase flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D4AF37]" />
                <span>Pricing Change Audit Log ({pricingLogs.length})</span>
              </div>
              <div className="rounded-2xl bg-black/60 border border-white/10 p-4 max-h-60 overflow-y-auto space-y-2 text-xs font-mono">
                {pricingLogs.length === 0 ? (
                  <div className="text-zinc-500">No pricing changes recorded yet.</div>
                ) : (
                  pricingLogs.map((log: any) => (
                    <div
                      key={log.id}
                      className="py-1.5 border-b border-white/[0.05] last:border-0 text-zinc-200"
                    >
                      {log.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {adminTab === 'users' && (
          <>
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
          </>
        )}
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
