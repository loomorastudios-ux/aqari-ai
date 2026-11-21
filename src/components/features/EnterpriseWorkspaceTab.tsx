import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  MessageSquare,
  History,
  Plus,
  Share2,
  Trash2,
  Loader2,
  Building,
  CheckCircle2,
} from 'lucide-react';
import type {
  CurrencyCode,
  EnterpriseOrganization,
  SavedAnalysis,
  WorkspaceRole,
} from '../../types';
import { formatPrice } from '../../utils/formatters';

interface EnterpriseWorkspaceTabProps {
  userEmail: string;
  currentCurrency: CurrencyCode;
  savedAnalyses: SavedAnalysis[];
  teamUsersLimit?: number;
  isInstitutional?: boolean;
}

export const EnterpriseWorkspaceTab: React.FC<EnterpriseWorkspaceTabProps> = ({
  userEmail,
  currentCurrency,
  savedAnalyses,
  teamUsersLimit = 1,
  isInstitutional = false,
}) => {
  const [orgs, setOrgs] = useState<EnterpriseOrganization[]>([]);
  const [activeOrg, setActiveOrg] = useState<EnterpriseOrganization | null>(null);
  const [myRole, setMyRole] = useState<WorkspaceRole>('Admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Create org / Invite member / Comment / Share deal
  const [newOrgName, setNewOrgName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('Analyst');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [selectedSavedToShare, setSelectedSavedToShare] = useState<string>('');

  const loadWorkspace = async (orgId?: string) => {
    if (!userEmail) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        action: 'workspace',
        email: userEmail,
        ...(orgId ? { orgId } : {}),
      });
      const res = await fetch(`/api/app?${qs.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Could not load enterprise workspace.');
        return;
      }
      setOrgs(data.orgs || []);
      setActiveOrg(data.activeOrg || null);
      setMyRole(data.myRole || 'Analyst');
      if (data.activeOrg?.sharedDeals?.[0]?.id && !selectedDealId) {
        setSelectedDealId(data.activeOrg.sharedDeals[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Network error loading workspace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, [userEmail]);

  const postWorkspace = async (payload: Record<string, any>, successLabel?: string) => {
    setLoading(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/app?action=workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: userEmail,
          orgId: activeOrg?.id,
          ...payload,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Workspace action denied or failed.');
        return;
      }
      if (data.activeOrg) {
        setActiveOrg(data.activeOrg);
        setOrgs((prev) => {
          const exists = prev.some((o) => o.id === data.activeOrg.id);
          return exists
            ? prev.map((o) => (o.id === data.activeOrg.id ? data.activeOrg : o))
            : [data.activeOrg, ...prev];
        });
      }
      if (data.myRole) setMyRole(data.myRole);
      if (successLabel) setStatusMsg(successLabel);
    } catch (err: any) {
      setError(err?.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  const handleShareSaved = async () => {
    const target =
      savedAnalyses.find((s) => s.id === selectedSavedToShare) || savedAnalyses[0];
    if (!target) {
      await postWorkspace(
        {
          subAction: 'share-deal',
          deal: {
            title: 'Muscat Al Mouj Institutional Deal',
            city: 'Muscat',
            priceUSD: 680000,
            rentUSD: 4650,
            capRate: 6.95,
            irr5Yr: 12.8,
            dscr: '1.48',
          },
        },
        'Shared deal to workspace pipeline.'
      );
      return;
    }
    await postWorkspace(
      {
        subAction: 'share-deal',
        deal: {
          title: target.property,
          city: target.city,
          priceUSD: target.price,
          rentUSD: target.rent,
          capRate: target.capRate,
          irr5Yr: target.irr,
          dscr: target.dscr,
          notes: target.notes,
        },
      },
      `Shared "${target.property}" to workspace.`
    );
  };

  const activeDeal =
    activeOrg?.sharedDeals?.find((d) => d.id === selectedDealId) ||
    activeOrg?.sharedDeals?.[0] ||
    null;
  const dealComments = (activeOrg?.comments || []).filter(
    (c) => !activeDeal || c.dealId === activeDeal.id
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-xs font-mono text-[#D4AF37] mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>ENTERPRISE WORKSPACE • SERVER-ENFORCED RBAC</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {activeOrg?.name || 'Private Institutional Workspace'}
          </h2>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Private org isolation, Analyst/Manager/Admin roles enforced server-side, shared IC deal pipeline, comments &amp; immutable audit trail.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-zinc-300">
            Team Seats: <strong className="text-white">{activeOrg?.members?.length ?? 1} / {teamUsersLimit}</strong>
          </span>
          {isInstitutional && (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold">
              CONTRACT GOVERNANCE &amp; AUDIT TRAIL
            </span>
          )}
          <span className="px-3 py-1.5 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] font-bold flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>Your Role: {myRole}</span>
          </span>
          {orgs.length > 1 && (
            <select
              value={activeOrg?.id || ''}
              onChange={(e) => loadWorkspace(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-black/70 border border-white/15 text-white"
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs font-mono text-rose-200">
          {error}
        </div>
      )}
      {statusMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs font-mono text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Org Switcher & Create Private Org */}
      <div className="glass-panel p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono text-xs">
        <div className="flex items-center gap-2 text-zinc-300">
          <Building className="w-4 h-4 text-[#D4AF37]" />
          <span>Private Org ID: <strong className="text-white">{activeOrg?.id || '...'}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder="New Org Name (e.g. Oman Sovereign Fund)"
            className="px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white w-56"
          />
          <button
            type="button"
            disabled={loading || !newOrgName.trim()}
            onClick={async () => {
              await postWorkspace({ subAction: 'create-org', name: newOrgName.trim() }, 'Created new private organization.');
              setNewOrgName('');
            }}
            className="px-3.5 py-2 rounded-xl bg-[#D4AF37] text-black font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Org</span>
          </button>
        </div>
      </div>

      {/* Team Members + Server RBAC */}
      <div className="glass-panel p-5 space-y-4 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs font-bold text-[#D4AF37] uppercase">
            Team Members &amp; Role Access Control (Analyst / Manager / Admin)
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="px-3 py-1.5 rounded-xl bg-black/50 border border-white/15 text-white"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
              className="px-2.5 py-1.5 rounded-xl bg-black/70 border border-white/15 text-white"
            >
              <option value="Analyst">Analyst</option>
              <option value="Manager">Manager</option>
              <option value="Admin">Admin</option>
            </select>
            <button
              type="button"
              disabled={loading || !inviteEmail.trim()}
              onClick={async () => {
                await postWorkspace(
                  { subAction: 'invite-member', memberEmail: inviteEmail.trim(), role: inviteRole },
                  `Added ${inviteEmail.trim()} as ${inviteRole}.`
                );
                setInviteEmail('');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 hover:text-black border border-emerald-500/40 text-emerald-300 font-bold cursor-pointer disabled:opacity-50"
            >
              Invite Member
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] border-b border-white/[0.08] text-zinc-400">
              <tr>
                <th className="py-2.5 px-3">Member Email</th>
                <th className="py-2.5 px-3">Role (Server Enforced)</th>
                <th className="py-2.5 px-3">Added By</th>
                <th className="py-2.5 px-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {(activeOrg?.members || []).map((m) => (
                <tr key={m.email}>
                  <td className="py-2.5 px-3 text-white font-bold">{m.email}</td>
                  <td className="py-2.5 px-3">
                    <select
                      value={m.role}
                      disabled={myRole !== 'Admin' || loading}
                      onChange={(e) =>
                        postWorkspace(
                          { subAction: 'update-role', memberEmail: m.email, role: e.target.value },
                          `Updated ${m.email} role to ${e.target.value}.`
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-black/70 border border-white/15 text-[#D4AF37] font-bold disabled:opacity-60"
                    >
                      <option value="Analyst">Analyst</option>
                      <option value="Manager">Manager</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </td>
                  <td className="py-2.5 px-3 text-zinc-400">{m.addedBy}</td>
                  <td className="py-2.5 px-3">
                    {m.email !== activeOrg?.ownerEmail && (
                      <button
                        type="button"
                        disabled={myRole !== 'Admin' || loading}
                        onClick={() =>
                          postWorkspace(
                            { subAction: 'remove-member', memberEmail: m.email },
                            `Removed ${m.email}.`
                          )
                        }
                        className="text-rose-400 hover:text-rose-200 disabled:opacity-40 cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shared Analyses + Comments Per Deal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 font-mono">
        <div className="glass-panel p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold text-[#D4AF37] uppercase flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5" />
              <span>Shared Analyses ({activeOrg?.sharedDeals?.length || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              {savedAnalyses.length > 0 && (
                <select
                  value={selectedSavedToShare || savedAnalyses[0]?.id || ''}
                  onChange={(e) => setSelectedSavedToShare(e.target.value)}
                  className="px-2 py-1 rounded-lg bg-black/70 border border-white/15 text-[11px] text-white max-w-[160px]"
                >
                  {savedAnalyses.map((a) => (
                    <option key={a.id} value={a.id}>{a.property}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                disabled={loading}
                onClick={handleShareSaved}
                className="px-3 py-1.5 rounded-lg bg-[#D4AF37] text-black font-bold text-[11px] cursor-pointer"
              >
                + Share Deal
              </button>
            </div>
          </div>

          {!activeOrg?.sharedDeals?.length ? (
            <div className="text-xs text-zinc-500 py-8 text-center">
              No analyses shared yet. Click &ldquo;+ Share Deal&rdquo; to push an investment memo into team review.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {activeOrg.sharedDeals.map((d) => (
                <div
                  key={d.id}
                  onClick={() => setSelectedDealId(d.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition space-y-2 ${
                    activeDeal?.id === d.id
                      ? 'bg-[#D4AF37]/10 border-[#D4AF37]'
                      : 'bg-white/[0.02] border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-white">{d.title}</div>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={d.status}
                        disabled={myRole === 'Analyst' || loading}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          postWorkspace(
                            { subAction: 'update-deal-status', dealId: d.id, status: e.target.value },
                            `Updated status to ${e.target.value}.`
                          )
                        }
                        className="px-2 py-0.5 rounded bg-black/70 border border-white/15 text-[10px] text-emerald-300"
                      >
                        <option value="Under Review">Under Review</option>
                        <option value="IC Approved">IC Approved</option>
                        <option value="On Hold">On Hold</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                      {myRole === 'Admin' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            postWorkspace({ subAction: 'delete-deal', dealId: d.id }, 'Deleted deal.');
                          }}
                          className="text-rose-400 hover:text-rose-200 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {d.city} • {formatPrice(d.priceUSD, currentCurrency)} • {d.capRate}% Cap • Shared by {d.sharedBy}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comments Per Deal */}
        <div className="glass-panel p-5 space-y-4">
          <div className="text-xs font-bold text-[#D4AF37] uppercase flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>
              IC Comments {activeDeal ? `• ${activeDeal.title}` : ''}
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              disabled={!activeDeal}
              placeholder={activeDeal ? 'Add investment committee note...' : 'Share or select a deal first'}
              className="flex-1 px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-xs"
            />
            <button
              type="button"
              disabled={!activeDeal || !commentText.trim() || loading}
              onClick={async () => {
                if (!activeDeal) return;
                await postWorkspace(
                  { subAction: 'add-comment', dealId: activeDeal.id, text: commentText.trim() },
                  'Posted comment.'
                );
                setCommentText('');
              }}
              className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold text-xs cursor-pointer disabled:opacity-50"
            >
              Post
            </button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {dealComments.length === 0 ? (
              <div className="text-xs text-zinc-500 py-6 text-center">No comments on this deal yet.</div>
            ) : (
              dealComments.map((c) => (
                <div key={c.id} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400">
                    <span>
                      <strong className="text-white">{c.authorEmail}</strong> ({c.authorRole})
                    </span>
                    <span>{new Date(c.createdAt).toLocaleString('en-US')}</span>
                  </div>
                  <div className="text-zinc-200">{c.text}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Immutable Audit Trail */}
      <div className="glass-panel p-5 space-y-3 font-mono">
        <div className="text-xs font-bold text-[#D4AF37] uppercase flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" />
          <span>Immutable Audit Trail (Who Edited What &amp; When)</span>
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin ml-2" />}
        </div>

        <div className="max-h-56 overflow-y-auto divide-y divide-white/[0.05] text-xs">
          {(activeOrg?.auditTrail || []).map((a) => (
            <div key={a.id} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <span className="px-1.5 py-0.5 rounded bg-white/[0.07] text-[#D4AF37] font-bold text-[10px] mr-2">
                  {a.action}
                </span>
                <span className="text-white font-semibold">{a.actorEmail}</span>{' '}
                <span className="text-zinc-400">[{a.actorRole}]</span> →{' '}
                <span className="text-zinc-200">{a.detail}</span>
              </div>
              <span className="text-[10px] text-zinc-500 shrink-0">
                {new Date(a.timestamp).toLocaleString('en-US')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
