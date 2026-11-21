import React, { useState, useEffect, useMemo } from 'react';
import { User, AnalystThread, WhiteGloveRequest } from '../types';
import { PricingPublicPayload, PlanKey, findPlanPricing } from '../../lib/plans';
import { CITIES, findCityEntry, searchCities, CityEntry } from '../../data/cities';
import { downloadWhiteGlovePdf } from '../utils/pdfExport';
import { parseEnglishNumber, sanitizeEnglishDecimal } from '../utils/formatters';
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
  MessageSquare,
  FileText,
  Mail,
  Send,
  Plus,
  Trash2,
  RefreshCw,
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

interface ComplexPropertyDraft {
  id: string;
  title: string;
  cityInput: string;
  currency: string;
  valuation: string;
  monthlyRent: string;
  equityPct: string;
  ratePct: string;
  opexPct: string;
  spvNote: string;
}

function resolveAdminCity(rawInput: string): CityEntry | null {
  const cleaned = String(rawInput || '').trim();
  if (!cleaned) return null;
  const direct = findCityEntry(cleaned);
  if (direct) return direct;
  const strippedParen = cleaned.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return findCityEntry(strippedParen) || findCityEntry(cleaned.split(',')[0].trim());
}

const EN_ADMIN_INPUT_STYLE: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  unicodeBidi: 'embed',
  direction: 'ltr',
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onRedirectHome,
  onPricingUpdated,
}) => {
  const [adminTab, setAdminTab] = useState<'users' | 'pricing' | 'analyst' | 'whiteglove' | 'issues' | 'logs'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [failedWebhooks, setFailedWebhooks] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [issuesList, setIssuesList] = useState<any[]>([]);
  const [cancellationsList, setCancellationsList] = useState<any[]>([]);
  const [resolvingIssueEmail, setResolvingIssueEmail] = useState<string | null>(null);
  const [issuesMsg, setIssuesMsg] = useState<string | null>(null);
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

  // Analyst Desk Inbox state
  const [analystThreads, setAnalystThreads] = useState<AnalystThread[]>([]);
  const [selectedThreadEmail, setSelectedThreadEmail] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<AnalystThread | null>(null);
  const [activeClientSaved, setActiveClientSaved] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');
  const [replyAttachedIdx, setReplyAttachedIdx] = useState('');
  const [replyPdfNote, setReplyPdfNote] = useState('');
  const [analystAdminMsg, setAnalystAdminMsg] = useState<string | null>(null);
  const [sendingReply, setSendingReply] = useState(false);

  // White-Glove Requests & Complex Analysis Workspace state
  const [wgRequests, setWgRequests] = useState<WhiteGloveRequest[]>([]);
  const [selectedWgId, setSelectedWgId] = useState<string | null>(null);
  const [wgDraftTitle, setWgDraftTitle] = useState('');
  const [wgDraftProps, setWgDraftProps] = useState<ComplexPropertyDraft[]>([]);
  const [wgOpenCityRowId, setWgOpenCityRowId] = useState<string | null>(null);
  const [wgSpvStructureNote, setWgSpvStructureNote] = useState('');
  const [wgRiskNote, setWgRiskNote] = useState('');
  const [wgRecommendation, setWgRecommendation] = useState('');
  const [wgAdminMsg, setWgAdminMsg] = useState<string | null>(null);
  const [deliveringWg, setDeliveringWg] = useState(false);

  // Dynamic Pricing Control state
  const [pricingState, setPricingState] = useState<PricingPublicPayload | null>(null);
  const [pricingLogs, setPricingLogs] = useState<any[]>([]);
  const [launchBadgeInput, setLaunchBadgeInput] = useState('LAUNCH -40% - First 30 users only');
  const [countdownDaysInput, setCountdownDaysInput] = useState('7');
  const [planDrafts, setPlanDrafts] = useState<Record<PlanKey, EditablePlanDraft>>({
    free: { originalPrice: '0', launchPrice: '0', analysesLimit: '3', featuresText: '' },
    starter: { originalPrice: '129', launchPrice: '75', analysesLimit: '30', featuresText: '' },
    pro: { originalPrice: '349', launchPrice: '199', analysesLimit: '150', featuresText: '' },
    enterprise: { originalPrice: '999', launchPrice: '599', analysesLimit: '500', featuresText: '' },
    institutional: { originalPrice: '2499', launchPrice: '1499', analysesLimit: '1000', featuresText: '' },
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
    const institutionalP = findPlanPricing(p, 'institutional');
    setPlanDrafts({
      free: {
        originalPrice: String(freeP?.originalPrice ?? 0),
        launchPrice: String(freeP?.launchPrice ?? 0),
        analysesLimit: String(freeP?.analysesLimit ?? 3),
        featuresText: (freeP?.features || []).join('\n'),
      },
      starter: {
        originalPrice: String(starterP?.originalPrice ?? 129),
        launchPrice: String(starterP?.launchPrice ?? 75),
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
        analysesLimit: String(enterpriseP?.analysesLimit ?? 500),
        featuresText: (enterpriseP?.features || []).join('\n'),
      },
      institutional: {
        originalPrice: String(institutionalP?.originalPrice ?? 2499),
        launchPrice: String(institutionalP?.launchPrice ?? 1499),
        analysesLimit: String(institutionalP?.analysesLimit ?? 1000),
        featuresText: (institutionalP?.features || []).join('\n'),
      },
    });
  };

  const loadPricingControl = async () => {
    try {
      const res = await fetch('/api/admin?action=pricing', { credentials: 'include' });
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
      const res = await fetch('/api/admin?action=users', { credentials: 'include' });
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

  const loadAnalystInbox = async () => {
    try {
      const res = await fetch('/api/admin?action=analyst-inbox', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAnalystThreads(Array.isArray(data?.threads) ? data.threads : []);
      }
    } catch {}
  };

  const openAnalystThread = async (email: string) => {
    setSelectedThreadEmail(email);
    setAnalystAdminMsg(null);
    try {
      const res = await fetch(`/api/admin?action=analyst-thread&email=${encodeURIComponent(email)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.thread) setActiveThread(data.thread);
        setActiveClientSaved(Array.isArray(data?.savedAnalyses) ? data.savedAnalyses : []);
        loadAnalystInbox();
      }
    } catch {}
  };

  const handleSendAnalystReply = async () => {
    if (!selectedThreadEmail || !replyText.trim()) {
      setAnalystAdminMsg('Select a thread and type a reply message.');
      return;
    }
    setSendingReply(true);
    setAnalystAdminMsg(null);
    try {
      const idxNum = replyAttachedIdx === '' ? -1 : Number(replyAttachedIdx);
      const attached = idxNum >= 0 ? activeClientSaved[idxNum] : null;
      const res = await fetch('/api/admin?action=analyst-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: selectedThreadEmail,
          message: replyText.trim(),
          attachedAnalysisTitle: attached ? `${attached.property} (${attached.city})` : undefined,
          attachedAnalysisSummary: attached
            ? `Price: $${Number(attached.price || 0).toLocaleString('en-US')} | Cap: ${attached.capRate}% | IRR: ${attached.irr}%`
            : undefined,
          attachmentPdfNote: replyPdfNote.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setActiveThread(data.thread);
        setReplyText('');
        setReplyAttachedIdx('');
        setReplyPdfNote('');
        setAnalystAdminMsg('Reply sent to client & email notification logged.');
        loadAnalystInbox();
        loadAdminLogs();
      } else {
        setAnalystAdminMsg(data?.error || 'Failed to send reply.');
      }
    } catch {
      setAnalystAdminMsg('Network error sending reply.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleCloseThread = async () => {
    if (!selectedThreadEmail) return;
    try {
      const res = await fetch('/api/admin?action=analyst-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: selectedThreadEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.thread) {
        setActiveThread(data.thread);
        setAnalystAdminMsg('Thread marked Closed.');
        loadAnalystInbox();
      }
    } catch {}
  };

  const loadWhiteGloveRequests = async () => {
    try {
      const res = await fetch('/api/admin?action=whiteglove-requests', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setWgRequests(Array.isArray(data?.requests) ? data.requests : []);
      }
    } catch {}
  };

  const selectWhiteGloveRequest = (reqItem: WhiteGloveRequest) => {
    setSelectedWgId(reqItem.id);
    setWgAdminMsg(null);
    const deliv = reqItem.deliverable;
    if (deliv) {
      setWgDraftTitle(deliv.title || `White-Glove Complex Dossier: ${reqItem.propertyTitle || reqItem.id}`);
      setWgSpvStructureNote(deliv.spvStructureNote || deliv.spvNote || '');
      setWgRiskNote(deliv.riskNote || '');
      setWgRecommendation(deliv.summaryRecommendation || '');
      setWgDraftProps(
        (deliv.properties || []).map((p: any, idx: number) => ({
          id: p.id || `prop_${idx + 1}`,
          title: p.title || `Asset #${idx + 1}`,
          cityInput: p.city || 'Muscat',
          currency: 'USD',
          valuation: String(p.valuation ?? p.priceUSD ?? 650000),
          monthlyRent: String(p.monthlyRent ?? p.rentUSD ?? 4500),
          equityPct: String(p.equityPct ?? p.downPaymentPct ?? 30),
          ratePct: String(p.ratePct ?? p.interestRatePct ?? 5.5),
          opexPct: String(p.opexPct ?? p.operatingExpensePct ?? 15),
          spvNote: p.spvNote || '',
        }))
      );
    } else {
      const cEntry = resolveAdminCity(reqItem.targetCity || 'Muscat');
      setWgDraftTitle(`White-Glove Underwriting: ${reqItem.propertyTitle || reqItem.id}`);
      setWgSpvStructureNote('');
      setWgRiskNote('');
      setWgRecommendation('');
      setWgDraftProps([
        {
          id: `prop_${Date.now()}`,
          title: reqItem.propertyTitle || 'Primary Subject Property',
          cityInput: cEntry ? `${cEntry.city} (${cEntry.country} ${cEntry.countryCode})` : (reqItem.targetCity || 'Muscat'),
          currency: 'USD',
          valuation: String(reqItem.valuation || 650000),
          monthlyRent: String(reqItem.expectedMonthlyRent || 4500),
          equityPct: '30',
          ratePct: '5.5',
          opexPct: '15',
          spvNote: reqItem.goalNotes || '',
        },
      ]);
    }
  };

  const wgLiveCombined = useMemo(() => {
    let totalValuation = 0;
    let totalMonthlyRent = 0;
    let totalAnnualNOI = 0;
    let totalAnnualDebt = 0;
    let totalEquity = 0;
    for (const p of wgDraftProps) {
      const val = Math.max(0, Number(p.valuation) || 0);
      const rent = Math.max(0, Number(p.monthlyRent) || 0);
      const eqPct = Math.min(100, Math.max(1, Number(p.equityPct) || 30));
      const ratePct = Math.max(0.1, Number(p.ratePct) || 5.5);
      const opexPct = Math.min(95, Math.max(0, Number(p.opexPct) || 15));
      const down = val * (eqPct / 100);
      const loan = Math.max(0, val - down);
      const r = ratePct / 100 / 12;
      const n = 25 * 12;
      const monthlyDebt = loan > 0 && r > 0 ? (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : 0;
      const annGross = rent * 12;
      const annNoi = annGross * (1 - opexPct / 100);
      totalValuation += val;
      totalMonthlyRent += rent;
      totalAnnualNOI += annNoi;
      totalAnnualDebt += monthlyDebt * 12;
      totalEquity += down;
    }
    const weightedCapRate = totalValuation > 0 ? Number(((totalAnnualNOI / totalValuation) * 100).toFixed(2)) : 0;
    const annualCf = totalAnnualNOI - totalAnnualDebt;
    const blendedCoC = totalEquity > 0 ? Number(((annualCf / totalEquity) * 100).toFixed(2)) : 0;
    const dscr = totalAnnualDebt > 0 ? Number((totalAnnualNOI / totalAnnualDebt).toFixed(2)) : 4.0;
    const irr5Yr = annualCf <= 0 ? null : Number((blendedCoC + 3.0).toFixed(1));
    return {
      totalValuation: Math.round(totalValuation),
      totalMonthlyRent: Math.round(totalMonthlyRent),
      totalMonthlyCashflow: Math.round(annualCf / 12),
      weightedCapRate,
      blendedCoC,
      dscr,
      irr5Yr,
    };
  }, [wgDraftProps]);

  const handleDeliverWhiteGlove = async () => {
    if (!selectedWgId || wgDraftProps.length === 0) return;
    setDeliveringWg(true);
    setWgAdminMsg(null);
    try {
      const payloadProps = wgDraftProps.map((p) => {
        const entry = resolveAdminCity(p.cityInput);
        return {
          id: p.id,
          title: p.title.trim() || 'Subject Property',
          city: entry ? entry.city : p.cityInput.trim() || 'Muscat',
          currency: 'USD',
          valuation: Math.max(1, parseEnglishNumber(p.valuation, 1)),
          monthlyRent: Math.max(0, parseEnglishNumber(p.monthlyRent, 0)),
          equityPct: Math.min(100, Math.max(1, parseEnglishNumber(p.equityPct, 30))),
          ratePct: Math.max(0.1, parseEnglishNumber(p.ratePct, 5.5)),
          opexPct: Math.min(95, Math.max(0, parseEnglishNumber(p.opexPct, 15))),
          spvNote: p.spvNote.trim(),
        };
      });
      const res = await fetch('/api/admin?action=whiteglove-deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          requestId: selectedWgId,
          title: wgDraftTitle.trim() || 'White-Glove Portfolio Dossier',
          currency: 'USD',
          properties: payloadProps,
          spvStructureNote: wgSpvStructureNote.trim(),
          riskNote: wgRiskNote.trim(),
          summaryRecommendation: wgRecommendation.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setWgAdminMsg('Sent — Client notified & deliverable ready for PDF download.');
        await loadWhiteGloveRequests();
        await loadAdminLogs();
      } else {
        setWgAdminMsg(data?.error || 'Failed to deliver White-Glove analysis.');
      }
    } catch {
      setWgAdminMsg('Network error delivering White-Glove analysis.');
    } finally {
      setDeliveringWg(false);
    }
  };

  const loadIssuesAndCancellations = async () => {
    try {
      const res = await fetch('/api/admin?action=issues', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setIssuesList(Array.isArray(data?.issues) ? data.issues : []);
        setCancellationsList(Array.isArray(data?.cancellations) ? data.cancellations : []);
      }
    } catch {}
  };

  const handleResolveIssue = async (email: string) => {
    setResolvingIssueEmail(email);
    setIssuesMsg(null);
    try {
      const res = await fetch('/api/admin?action=resolve-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setIssuesMsg(`Marked issue resolved for ${email}. User notified & Rule E clock updated.`);
        await loadIssuesAndCancellations();
        await loadUsers();
        await loadAdminLogs();
      } else {
        setIssuesMsg(data?.error || 'Failed to mark issue resolved.');
      }
    } catch {
      setIssuesMsg('Network error resolving issue.');
    } finally {
      setResolvingIssueEmail(null);
    }
  };

  const loadAdminLogs = async () => {
    try {
      const res = await fetch('/api/admin?action=email-logs', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setEmailLogs(Array.isArray(data?.emailLogs) ? data.emailLogs : []);
        setWebhookLogs(Array.isArray(data?.webhookLogs) ? data.webhookLogs : []);
        if (Array.isArray(data?.failedWebhooks)) setFailedWebhooks(data.failedWebhooks);
      }
    } catch {}
  };

  useEffect(() => {
    const em = (currentUser?.email || '').toLowerCase();
    if (!em || em !== 'azzamalshmale@gmail.com') {
      onRedirectHome('403 Forbidden: Restricted to azzamalshmale@gmail.com');
      return;
    }
    loadUsers();
    loadPricingControl();
    loadAnalystInbox();
    loadWhiteGloveRequests();
    loadIssuesAndCancellations();
    loadAdminLogs();
  }, [currentUser?.email]);

  const handleToggleLaunchDiscount = async (nextActive: boolean) => {
    setSavingPricingKey('global');
    setPricingMsg(null);
    try {
      const res = await fetch('/api/admin?action=toggle-discount', {
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
      const res = await fetch('/api/admin?action=pricing-update', {
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
      const res = await fetch(`/api/admin?action=user&email=${encodeURIComponent(email)}`, {
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
      const res = await fetch('/api/admin?action=change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: selectedUser.email,
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
      const res = await fetch('/api/admin?action=refund-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: selectedUser.email,
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
              Authenticated Owner: {currentUser?.email} • Support Contact:{' '}
              <a href="mailto:azzamalshmale@gmail.com" className="text-[#D4AF37] underline">
                azzamalshmale@gmail.com
              </a>{' '}
              • Immutable usage &amp; refund policy logs
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start">
            <button
              type="button"
              onClick={() => setAdminTab('users')}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 cursor-pointer border transition ${
                adminTab === 'users'
                  ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                  : 'bg-white/[0.05] text-zinc-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Users ({users.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAdminTab('analyst');
                loadAnalystInbox();
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 cursor-pointer border transition ${
                adminTab === 'analyst'
                  ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                  : 'bg-white/[0.05] text-zinc-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>
                ANALYST INBOX ({analystThreads.filter((t) => (t.unreadForAdmin || 0) > 0 || t.status === 'Open').length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAdminTab('whiteglove');
                loadWhiteGloveRequests();
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 cursor-pointer border transition ${
                adminTab === 'whiteglove'
                  ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                  : 'bg-white/[0.05] text-zinc-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>
                WHITE-GLOVE REQUESTS ({wgRequests.filter((r) => r.status !== 'Done').length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('pricing')}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 cursor-pointer border transition ${
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
              onClick={() => {
                setAdminTab('issues');
                loadIssuesAndCancellations();
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 cursor-pointer border transition ${
                adminTab === 'issues'
                  ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                  : 'bg-white/[0.05] text-zinc-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>
                ISSUES ({issuesList.filter((i) => i.issue_status === 'reported').length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAdminTab('logs');
                loadAdminLogs();
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 cursor-pointer border transition ${
                adminTab === 'logs'
                  ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                  : 'bg-white/[0.05] text-zinc-300 border-white/10 hover:bg-white/10'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>ADMIN BACKUP &amp; EMAIL ALERTS ({emailLogs.length})</span>
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
                      type="text"
                      data-numeric="true"
                      lang="en"
                      dir="ltr"
                      inputMode="decimal"
                      autoComplete="off"
                      style={EN_ADMIN_INPUT_STYLE}
                      value={countdownDaysInput}
                      onChange={(e) => setCountdownDaysInput(sanitizeEnglishDecimal(e.target.value, false))}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {(['starter', 'pro', 'enterprise', 'institutional'] as const).map((planKey) => {
                const draft = planDrafts[planKey];
                const title =
                  planKey === 'starter'
                    ? 'STARTER'
                    : planKey === 'pro'
                    ? 'PROFESSIONAL'
                    : planKey === 'enterprise'
                    ? 'SOVEREIGN'
                    : 'ENTERPRISE';
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
                          type="text"
                          data-numeric="true"
                          lang="en"
                          dir="ltr"
                          inputMode="decimal"
                          autoComplete="off"
                          style={EN_ADMIN_INPUT_STYLE}
                          value={draft.originalPrice}
                          onChange={(e) =>
                            setPlanDrafts((prev) => ({
                              ...prev,
                              [planKey]: {
                                ...prev[planKey],
                                originalPrice: sanitizeEnglishDecimal(e.target.value, true),
                              },
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
                          type="text"
                          data-numeric="true"
                          lang="en"
                          dir="ltr"
                          inputMode="decimal"
                          autoComplete="off"
                          style={EN_ADMIN_INPUT_STYLE}
                          value={draft.launchPrice}
                          onChange={(e) =>
                            setPlanDrafts((prev) => ({
                              ...prev,
                              [planKey]: {
                                ...prev[planKey],
                                launchPrice: sanitizeEnglishDecimal(e.target.value, true),
                              },
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
                        type="text"
                        data-numeric="true"
                        lang="en"
                        dir="ltr"
                        inputMode="decimal"
                        autoComplete="off"
                        style={EN_ADMIN_INPUT_STYLE}
                        value={draft.analysesLimit}
                        onChange={(e) =>
                          setPlanDrafts((prev) => ({
                            ...prev,
                            [planKey]: {
                              ...prev[planKey],
                              analysesLimit: sanitizeEnglishDecimal(e.target.value, false),
                            },
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

        {/* ANALYST INBOX TAB */}
        {adminTab === 'analyst' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Client Threads List */}
            <div className="lg:col-span-4 glass-panel p-4 border border-white/10 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <span className="text-xs font-mono font-bold uppercase text-[#D4AF37]">
                  Sovereign Client Threads ({analystThreads.length})
                </span>
                <button
                  type="button"
                  onClick={loadAnalystInbox}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              {analystThreads.length === 0 ? (
                <div className="text-xs font-mono text-zinc-500 py-8 text-center">
                  No analyst desk messages yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-[540px] overflow-y-auto">
                  {analystThreads.map((t) => (
                    <button
                      key={t.email}
                      type="button"
                      onClick={() => openAnalystThread(t.email)}
                      className={`w-full text-left p-3 rounded-xl border transition cursor-pointer font-mono text-xs space-y-1 ${
                        selectedThreadEmail === t.email
                          ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white'
                          : 'bg-black/40 border-white/10 text-zinc-300 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold truncate">{t.email}</span>
                        {(t.unreadForAdmin || 0) > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
                            {t.unreadForAdmin}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-400">
                        <span className="text-[#D4AF37] font-bold">{t.status}</span>
                        <span>{t.updatedAt ? new Date(t.updatedAt).toLocaleString('en-US') : '-'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Conversation & Reply Workspace */}
            <div className="lg:col-span-8 glass-panel p-5 border border-white/10 space-y-4">
              {!activeThread ? (
                <div className="text-xs font-mono text-zinc-500 py-16 text-center">
                  Select a Sovereign client conversation to read questions and send replies.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div>
                      <div className="text-sm font-bold text-white font-mono">{activeThread.email}</div>
                      <div className="text-[11px] font-mono text-zinc-400">
                        Status: <strong className="text-[#D4AF37]">{activeThread.status}</strong> • Client Saved Analyses:{' '}
                        {activeClientSaved.length}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseThread}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono text-white cursor-pointer"
                    >
                      Mark Closed
                    </button>
                  </div>

                  {analystAdminMsg && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs font-mono text-emerald-200">
                      {analystAdminMsg}
                    </div>
                  )}

                  <div className="max-h-72 overflow-y-auto space-y-2.5 p-3 rounded-xl bg-black/50 border border-white/10">
                    {(activeThread.messages || []).map((m) => (
                      <div
                        key={m.id}
                        className={`flex flex-col ${m.sender === 'admin' ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-xl px-3 py-2 text-xs font-mono space-y-1 ${
                            m.sender === 'admin'
                              ? 'bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-white'
                              : 'bg-zinc-900 border border-white/15 text-zinc-200'
                          }`}
                        >
                          <div className="text-[10px] text-zinc-400 font-bold">
                            {m.sender === 'admin' ? 'Analyst (You)' : activeThread.email} •{' '}
                            {new Date(m.timestamp).toLocaleString('en-US')}
                          </div>
                          {m.attachedAnalysisTitle && (
                            <div className="text-[10px] text-[#D4AF37]">
                              Attached: {m.attachedAnalysisTitle} {m.attachedAnalysisSummary ? `(${m.attachedAnalysisSummary})` : ''}
                            </div>
                          )}
                          {m.replyByDate && <div className="text-[10px] text-amber-300">Requested reply by: {m.replyByDate}</div>}
                          {m.attachmentPdfNote && <div className="text-[10px] text-emerald-300">PDF/Memo Ref: {m.attachmentPdfNote}</div>}
                          <div className="whitespace-pre-wrap">{m.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2.5 text-xs font-mono">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <select
                        value={replyAttachedIdx}
                        onChange={(e) => setReplyAttachedIdx(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white outline-none"
                      >
                        <option value="">Attach client saved analysis (optional)</option>
                        {activeClientSaved.map((s, idx) => (
                          <option key={s.id || idx} value={String(idx)}>
                            {s.property} ({s.city}) - {s.capRate}% Cap
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={replyPdfNote}
                        onChange={(e) => setReplyPdfNote(e.target.value)}
                        placeholder="Optional PDF / Memo reference note..."
                        className="px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white outline-none"
                      />
                    </div>
                    <textarea
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write your institutional analyst response..."
                      className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white outline-none focus:border-[#D4AF37]"
                    />
                    <button
                      type="button"
                      disabled={sendingReply}
                      onClick={handleSendAnalystReply}
                      className="px-4 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold flex items-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingReply ? 'Sending Reply...' : 'Send Reply'}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* WHITE-GLOVE REQUESTS & COMPLEX MULTI-PROPERTY WORKSPACE TAB */}
        {adminTab === 'whiteglove' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Requests Queue */}
            <div className="lg:col-span-4 glass-panel p-4 border border-white/10 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <span className="text-xs font-mono font-bold uppercase text-emerald-400">
                  White-Glove Queue ({wgRequests.length})
                </span>
                <button
                  type="button"
                  onClick={loadWhiteGloveRequests}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              {wgRequests.length === 0 ? (
                <div className="text-xs font-mono text-zinc-500 py-8 text-center">
                  No White-Glove underwriting briefs submitted yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {wgRequests.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => selectWhiteGloveRequest(r)}
                      className={`w-full text-left p-3 rounded-xl border transition cursor-pointer font-mono text-xs space-y-1 ${
                        selectedWgId === r.id
                          ? 'bg-emerald-950/40 border-emerald-400 text-white'
                          : 'bg-black/40 border-white/10 text-zinc-300 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold truncate">{r.propertyTitle || r.id}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.status === 'Done'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {r.email} • {r.targetCity || '-'} • {r.currency || 'USD'}{' '}
                        {Number(r.valuation || 0).toLocaleString('en-US')}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Complex Analysis Builder */}
            <div className="lg:col-span-8 glass-panel p-5 border border-white/10 space-y-4 text-xs font-mono">
              {!selectedWgId ? (
                <div className="text-zinc-500 py-16 text-center">
                  Select a White-Glove request from the queue to open Complex Multi-Property Underwriting Workspace.
                </div>
              ) : (
                (() => {
                  const activeReq = wgRequests.find((x) => x.id === selectedWgId);
                  return (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                        <div>
                          <div className="text-sm font-bold text-white">{activeReq?.propertyTitle || selectedWgId}</div>
                          <div className="text-[11px] text-zinc-400">
                            Client: {activeReq?.email} • City: {activeReq?.targetCity} • Notes:{' '}
                            {activeReq?.goalNotes || activeReq?.brief || 'None'}
                          </div>
                        </div>
                        {activeReq?.deliverable && (
                          <button
                            type="button"
                            onClick={() =>
                              downloadWhiteGlovePdf({
                                deliverable: activeReq.deliverable!,
                                userEmail: activeReq.email,
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-[#D4AF37] text-black font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Preview PDF</span>
                          </button>
                        )}
                      </div>

                      {wgAdminMsg && (
                        <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200">
                          {wgAdminMsg}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        <input
                          type="text"
                          value={wgDraftTitle}
                          onChange={(e) => setWgDraftTitle(e.target.value)}
                          placeholder="Deliverable Report Title"
                          className="sm:col-span-3 px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white outline-none"
                        />
                        <div className="px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-[#D4AF37] font-bold flex items-center justify-center">
                          USD ($)
                        </div>
                      </div>

                      {/* Multi-Property Lines */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold uppercase text-zinc-300">
                            Modeled Properties ({wgDraftProps.length})
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setWgDraftProps((prev) => [
                                ...prev,
                                {
                                  id: `prop_${Date.now()}_${prev.length + 1}`,
                                  title: `Property #${prev.length + 1}`,
                                  cityInput: 'Muscat (Oman OM)',
                                  currency: 'USD',
                                  valuation: '650000',
                                  monthlyRent: '4500',
                                  equityPct: '30',
                                  ratePct: '5.5',
                                  opexPct: '15',
                                  spvNote: '',
                                },
                              ])
                            }
                            className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ Add Property</span>
                          </button>
                        </div>

                        {wgDraftProps.map((prop, pIdx) => {
                          const cOptions =
                            prop.cityInput.trim().length >= 2
                              ? searchCities(prop.cityInput.replace(/\s*\([^)]*\)\s*$/, ''), 15)
                              : ['Muscat', 'Dubai', 'Riyadh', 'London', 'New York']
                                  .map((n) => findCityEntry(n))
                                  .filter((c): c is CityEntry => Boolean(c));
                          return (
                            <div
                              key={prop.id}
                              className="p-3.5 rounded-xl bg-black/50 border border-white/10 space-y-2.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[#D4AF37]">Asset #{pIdx + 1}</span>
                                {wgDraftProps.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setWgDraftProps((prev) => prev.filter((item) => item.id !== prop.id))
                                    }
                                    className="text-rose-400 hover:text-rose-300 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input
                                  type="text"
                                  value={prop.title}
                                  onChange={(e) =>
                                    setWgDraftProps((prev) =>
                                      prev.map((x) => (x.id === prop.id ? { ...x, title: e.target.value } : x))
                                    )
                                  }
                                  placeholder="Property Name"
                                  className="px-2.5 py-2 rounded-lg bg-black/60 border border-white/10 text-white"
                                />
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={prop.cityInput}
                                    onFocus={() => setWgOpenCityRowId(prop.id)}
                                    onBlur={() => setTimeout(() => setWgOpenCityRowId(null), 180)}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setWgOpenCityRowId(prop.id);
                                      setWgDraftProps((prev) =>
                                        prev.map((x) => (x.id === prop.id ? { ...x, cityInput: val } : x))
                                      );
                                    }}
                                    placeholder="City (type 2+ chars)"
                                    className="w-full px-2.5 py-2 rounded-lg bg-black/60 border border-white/10 text-white"
                                  />
                                  {wgOpenCityRowId === prop.id && cOptions.length > 0 && (
                                    <div className="absolute z-40 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg bg-zinc-950 border border-[#D4AF37]/40 divide-y divide-white/[0.06]">
                                      {cOptions.map((c) => (
                                        <button
                                          key={`${prop.id}-${c.city}-${c.countryCode}`}
                                          type="button"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            setWgOpenCityRowId(null);
                                            setWgDraftProps((prev) =>
                                              prev.map((x) =>
                                                x.id === prop.id
                                                  ? { ...x, cityInput: `${c.city} (${c.country} ${c.countryCode})` }
                                                  : x
                                              )
                                            );
                                          }}
                                          className="w-full text-left px-2.5 py-1.5 text-[11px] text-zinc-200 hover:bg-[#D4AF37]/20 cursor-pointer"
                                        >
                                          {c.city} ({c.country} {c.countryCode})
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="px-2.5 py-2 rounded-lg bg-zinc-900 border border-white/10 text-[#D4AF37] font-bold flex items-center justify-center">
                                  USD ($)
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                <input
                                  type="text"
                                  data-numeric="true"
                                  lang="en"
                                  dir="ltr"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  style={EN_ADMIN_INPUT_STYLE}
                                  value={prop.valuation}
                                  onChange={(e) =>
                                    setWgDraftProps((prev) =>
                                      prev.map((x) =>
                                        x.id === prop.id
                                          ? { ...x, valuation: sanitizeEnglishDecimal(e.target.value, true) }
                                          : x
                                      )
                                    )
                                  }
                                  placeholder="Valuation (USD)"
                                  className="px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white"
                                />
                                <input
                                  type="text"
                                  data-numeric="true"
                                  lang="en"
                                  dir="ltr"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  style={EN_ADMIN_INPUT_STYLE}
                                  value={prop.monthlyRent}
                                  onChange={(e) =>
                                    setWgDraftProps((prev) =>
                                      prev.map((x) =>
                                        x.id === prop.id
                                          ? { ...x, monthlyRent: sanitizeEnglishDecimal(e.target.value, true) }
                                          : x
                                      )
                                    )
                                  }
                                  placeholder="Rent/mo (USD)"
                                  className="px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white"
                                />
                                <input
                                  type="text"
                                  data-numeric="true"
                                  lang="en"
                                  dir="ltr"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  style={EN_ADMIN_INPUT_STYLE}
                                  value={prop.equityPct}
                                  onChange={(e) =>
                                    setWgDraftProps((prev) =>
                                      prev.map((x) =>
                                        x.id === prop.id
                                          ? { ...x, equityPct: sanitizeEnglishDecimal(e.target.value, true) }
                                          : x
                                      )
                                    )
                                  }
                                  placeholder="Equity %"
                                  className="px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white"
                                />
                                <input
                                  type="text"
                                  data-numeric="true"
                                  lang="en"
                                  dir="ltr"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  style={EN_ADMIN_INPUT_STYLE}
                                  value={prop.ratePct}
                                  onChange={(e) =>
                                    setWgDraftProps((prev) =>
                                      prev.map((x) =>
                                        x.id === prop.id
                                          ? { ...x, ratePct: sanitizeEnglishDecimal(e.target.value, true) }
                                          : x
                                      )
                                    )
                                  }
                                  placeholder="Rate %"
                                  className="px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white"
                                />
                                <input
                                  type="text"
                                  data-numeric="true"
                                  lang="en"
                                  dir="ltr"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  style={EN_ADMIN_INPUT_STYLE}
                                  value={prop.opexPct}
                                  onChange={(e) =>
                                    setWgDraftProps((prev) =>
                                      prev.map((x) =>
                                        x.id === prop.id
                                          ? { ...x, opexPct: sanitizeEnglishDecimal(e.target.value, true) }
                                          : x
                                      )
                                    )
                                  }
                                  placeholder="OPEX %"
                                  className="px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white"
                                />
                              </div>

                              <input
                                type="text"
                                value={prop.spvNote}
                                onChange={(e) =>
                                  setWgDraftProps((prev) =>
                                    prev.map((x) => (x.id === prop.id ? { ...x, spvNote: e.target.value } : x))
                                  )
                                }
                                placeholder="Per-asset SPV / jurisdiction note..."
                                className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white"
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Combined Results Live Preview */}
                      <div className="p-4 rounded-xl bg-emerald-950/25 border border-emerald-500/30 space-y-2">
                        <div className="font-bold uppercase text-emerald-300">Combined Portfolio Results (Live)</div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div>
                            <div className="text-[10px] text-zinc-400">Total Valuation</div>
                            <div className="font-bold text-white">
                              USD ${wgLiveCombined.totalValuation.toLocaleString('en-US')}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-400">Weighted Cap Rate</div>
                            <div className="font-bold text-[#D4AF37]">{wgLiveCombined.weightedCapRate}%</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-400">Blended CoC / IRR</div>
                            <div className="font-bold text-emerald-300">
                              {wgLiveCombined.blendedCoC}% / {wgLiveCombined.irr5Yr}%
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-400">Net Cashflow/mo</div>
                            <div className="font-bold text-white">
                              USD ${wgLiveCombined.totalMonthlyCashflow.toLocaleString('en-US')}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <textarea
                          rows={2}
                          value={wgSpvStructureNote}
                          onChange={(e) => setWgSpvStructureNote(e.target.value)}
                          placeholder="SPV Structure & Tax Note..."
                          className="p-2.5 rounded-xl bg-black/60 border border-white/10 text-white"
                        />
                        <textarea
                          rows={2}
                          value={wgRiskNote}
                          onChange={(e) => setWgRiskNote(e.target.value)}
                          placeholder="Macro / Interest Rate Risk Note..."
                          className="p-2.5 rounded-xl bg-black/60 border border-white/10 text-white"
                        />
                        <textarea
                          rows={2}
                          value={wgRecommendation}
                          onChange={(e) => setWgRecommendation(e.target.value)}
                          placeholder="Executive Recommendation..."
                          className="p-2.5 rounded-xl bg-black/60 border border-white/10 text-white"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={deliveringWg}
                        onClick={handleDeliverWhiteGlove}
                        className="w-full py-3 rounded-xl bg-[#D4AF37] text-black font-black uppercase tracking-wider cursor-pointer disabled:opacity-60"
                      >
                        {deliveringWg ? 'Delivering to Client...' : 'Send to Client (Mark Done + Email Alert)'}
                      </button>
                    </>
                  );
                })()
              )}
            </div>
          </div>
        )}

        {/* ISSUES & CANCELLATIONS TAB */}
        {adminTab === 'issues' && (
          <div className="space-y-6 text-xs font-mono">
            {issuesMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{issuesMsg}</span>
              </div>
            )}

            {/* Reported Tool Issues Table */}
            <div className="glass-panel p-5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase text-[#D4AF37]">
                  Reported Tool Issues ({issuesList.length})
                </span>
                <button
                  type="button"
                  onClick={loadIssuesAndCancellations}
                  className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>
              {issuesList.length === 0 ? (
                <div className="text-zinc-500 py-6 text-center">No tool issues reported yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-zinc-500 border-b border-white/10 uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 pr-3">Email</th>
                        <th className="py-2.5 pr-3">Plan</th>
                        <th className="py-2.5 pr-3">Issue Description</th>
                        <th className="py-2.5 pr-3">Reported At</th>
                        <th className="py-2.5 pr-3">Successful Runs</th>
                        <th className="py-2.5 pr-3">Status</th>
                        <th className="py-2.5">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-zinc-200">
                      {issuesList.map((iss) => (
                        <tr key={iss.email}>
                          <td className="py-2.5 pr-3 font-bold text-white">{iss.email}</td>
                          <td className="py-2.5 pr-3 uppercase text-[#D4AF37] font-bold">{iss.plan}</td>
                          <td className="py-2.5 pr-3 max-w-[300px] whitespace-pre-wrap text-zinc-300">
                            {iss.issue_description || '-'}
                          </td>
                          <td className="py-2.5 pr-3 text-zinc-400">
                            {iss.issue_reported_at
                              ? new Date(iss.issue_reported_at).toLocaleString('en-US')
                              : '-'}
                          </td>
                          <td className="py-2.5 pr-3 font-bold">
                            {iss.successful_analyses ?? 0}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                iss.issue_status === 'resolved'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {iss.issue_status === 'resolved' ? 'Resolved' : 'Reported Issue'}
                            </span>
                          </td>
                          <td className="py-2.5">
                            {iss.issue_status === 'resolved' ? (
                              <span className="text-[11px] text-emerald-400">
                                {iss.issue_resolved_at
                                  ? new Date(iss.issue_resolved_at).toLocaleDateString('en-US')
                                  : 'Done'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={resolvingIssueEmail === iss.email}
                                onClick={() => handleResolveIssue(iss.email)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[11px] cursor-pointer disabled:opacity-60"
                              >
                                {resolvingIssueEmail === iss.email ? 'Resolving...' : 'Mark Resolved'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Cancellations & Paddle Refunds Log */}
            <div className="glass-panel p-5 border border-white/10 space-y-3">
              <div className="font-bold uppercase text-rose-300">
                Cancellations &amp; Paddle Refunds ({cancellationsList.length})
              </div>
              {cancellationsList.length === 0 ? (
                <div className="text-zinc-500 py-6 text-center">No cancellations processed yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-zinc-500 border-b border-white/10 uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 pr-3">Email</th>
                        <th className="py-2.5 pr-3">Previous Plan</th>
                        <th className="py-2.5 pr-3">Order ID</th>
                        <th className="py-2.5 pr-3">Refunded (USD)</th>
                        <th className="py-2.5 pr-3">Rule</th>
                        <th className="py-2.5">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-zinc-200">
                      {cancellationsList.map((c: any) => (
                        <tr key={c.id || `${c.email}-${c.timestamp}`}>
                          <td className="py-2.5 pr-3 font-bold text-white">{c.email}</td>
                          <td className="py-2.5 pr-3 uppercase text-[#D4AF37] font-bold">
                            {c.previous_plan || '-'}
                          </td>
                          <td className="py-2.5 pr-3">{c.order_id || '-'}</td>
                          <td className="py-2.5 pr-3 text-emerald-400 font-bold">
                            ${c.refunded_amount_usd ?? 0}
                          </td>
                          <td className="py-2.5 pr-3 uppercase text-amber-300 font-bold">
                            Rule {c.rule || '-'}
                          </td>
                          <td className="py-2.5 text-zinc-400">
                            {c.timestamp ? new Date(c.timestamp).toLocaleString('en-US') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ADMIN BACKUP & EMAIL ALERTS TAB */}
        {adminTab === 'logs' && (
          <div className="space-y-6 text-xs font-mono">
            <div className="glass-panel p-5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase text-[#D4AF37]">
                  Admin Email Alerts &amp; Client Notification Logs ({emailLogs.length})
                </span>
                <button
                  type="button"
                  onClick={loadAdminLogs}
                  className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>
              {emailLogs.length === 0 ? (
                <div className="text-zinc-500 py-4">No email alerts logged yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-zinc-500 border-b border-white/10 uppercase text-[10px]">
                      <tr>
                        <th className="py-2 pr-3">Event</th>
                        <th className="py-2 pr-3">To</th>
                        <th className="py-2 pr-3">Subject</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-zinc-300">
                      {emailLogs.map((em) => (
                        <tr key={em.id}>
                          <td className="py-2 pr-3 text-[#D4AF37] font-bold">{em.event_type}</td>
                          <td className="py-2 pr-3">{em.to}</td>
                          <td className="py-2 pr-3">{em.subject}</td>
                          <td className="py-2 pr-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                em.status === 'sent'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : em.status === 'simulated'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {em.status}
                            </span>
                          </td>
                          <td className="py-2 text-zinc-400">
                            {em.timestamp ? new Date(em.timestamp).toLocaleString('en-US') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="glass-panel p-5 border border-white/10 space-y-3">
              <div className="font-bold uppercase text-white">
                Payment Webhook Audit Logs ({webhookLogs.length})
              </div>
              {webhookLogs.length === 0 ? (
                <div className="text-zinc-500 py-4">No payment webhooks logged yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-zinc-500 border-b border-white/10 uppercase text-[10px]">
                      <tr>
                        <th className="py-2 pr-3">Event</th>
                        <th className="py-2 pr-3">Order ID</th>
                        <th className="py-2 pr-3">Plan</th>
                        <th className="py-2 pr-3">Email</th>
                        <th className="py-2 pr-3">Amount</th>
                        <th className="py-2">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-zinc-300">
                      {webhookLogs.map((w) => (
                        <tr key={w.id}>
                          <td className="py-2 pr-3">{w.event || w.event_name || 'order_created'}</td>
                          <td className="py-2 pr-3">{w.order_id}</td>
                          <td className="py-2 pr-3 uppercase text-[#D4AF37] font-bold">{w.plan}</td>
                          <td className="py-2 pr-3">{w.payment_email || w.email}</td>
                          <td className="py-2 pr-3">${w.amount}</td>
                          <td className="py-2 text-zinc-400">
                            {w.timestamp ? new Date(w.timestamp).toLocaleString('en-US') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
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
                  href={`/api/admin?action=export&email=${encodeURIComponent(selectedUser.email)}`}
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
                  Policy (Rules A–E): Refund allowed ONLY if 0 successful analyses AND (within 7 days OR unresolved tool issue for 7+ days).
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
                  placeholder="Mandatory audit reason (e.g., Manual Paddle order txn_123 reconciliation)"
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
