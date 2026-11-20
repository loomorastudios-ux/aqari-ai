import React, { useState, useRef } from 'react';
import {
  FileCheck2,
  Upload,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Lock,
} from 'lucide-react';
import type { DocumentDueDiligenceResult } from '../../types';

interface UploadedDocEntry {
  id: string;
  docType: 'Lease' | 'Title Deed' | 'Valuation' | 'Service Fees' | 'Legal';
  fileName: string;
  mimeType: string;
  base64Data: string;
  textExtract: string;
}

interface DocumentDueDiligencePanelProps {
  userEmail: string;
  canDueDiligence: boolean;
  isAccountLocked: boolean;
  financialModel: {
    city: string;
    priceUSD: number;
    monthlyRentUSD: number;
    hoaUSD: number;
    ownershipType: string;
  };
  persistedDocResult: DocumentDueDiligenceResult | null;
  onResultCreated: (result: DocumentDueDiligenceResult, billingPatch?: { analysesLeft?: number; analysesUsed?: number }) => void;
  onOpenRenewal: () => void;
}

export const DocumentDueDiligencePanel: React.FC<DocumentDueDiligencePanelProps> = ({
  userEmail,
  canDueDiligence,
  isAccountLocked,
  financialModel,
  persistedDocResult,
  onResultCreated,
  onOpenRenewal,
}) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pendingDocType, setPendingDocType] = useState<
    'Lease' | 'Title Deed' | 'Valuation' | 'Service Fees' | 'Legal'
  >('Lease');
  const [docs, setDocs] = useState<UploadedDocEntry[]>([]);
  const [manualClauseText, setManualClauseText] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > 3 * 1024 * 1024) {
      setError('Document file must be under 3 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      setDocs((prev) => [
        ...prev.slice(0, 4),
        {
          id: `doc_${Date.now()}`,
          docType: pendingDocType,
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          base64Data: res,
          textExtract: '',
        },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const handleAddTextDoc = () => {
    if (!manualClauseText.trim()) return;
    setDocs((prev) => [
      ...prev.slice(0, 4),
      {
        id: `doc_${Date.now()}`,
        docType: pendingDocType,
        fileName: `${pendingDocType}-Extract.txt`,
        mimeType: 'text/plain',
        base64Data: '',
        textExtract: manualClauseText.trim(),
      },
    ]);
    setManualClauseText('');
  };

  const handleRunDocAudit = async () => {
    if (!canDueDiligence || isAccountLocked) {
      onOpenRenewal();
      return;
    }
    if (docs.length === 0) {
      setError('Upload or paste at least 1 document (Lease, Title Deed, Valuation, Service Fees, or Legal).');
      return;
    }
    setIsScanning(true);
    setError(null);
    try {
      const res = await fetch('/api/app?action=due-diligence-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: userEmail,
          login_email: userEmail,
          documents: docs,
          financialModel,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.result) {
        setError(data.error || 'Document Due Diligence scan failed.');
        return;
      }
      onResultCreated(data.result, {
        analysesLeft: data.analyses_left,
        analysesUsed: data.analyses_used,
      });
    } catch (err: any) {
      setError(err?.message || 'Network error running document audit.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="glass-panel p-6 space-y-5 border border-[#D4AF37]/30">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[11px] font-mono text-[#D4AF37] mb-1.5">
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>AI DOCUMENT DUE DILIGENCE • LEASE / TITLE / VALUATION / FEES</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white">
            Document Contradiction &amp; Missing-Clause Audit
          </h3>
          <p className="text-xs font-mono text-zinc-400 mt-0.5">
            Upload Lease, Title Deed, Valuation, Service Fees, or Legal docs to compare against your underwriting model (${financialModel.priceUSD.toLocaleString('en-US')} / ${financialModel.monthlyRentUSD.toLocaleString('en-US')} mo / {financialModel.ownershipType}).
          </p>
        </div>
      </div>

      {/* Document Upload Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 font-mono">
        <div className="space-y-3 p-4 rounded-xl bg-black/40 border border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pendingDocType}
              onChange={(e) => setPendingDocType(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-black/70 border border-white/15 text-white text-xs"
            >
              <option value="Lease">Lease Agreement</option>
              <option value="Title Deed">Title Deed / Mulkiya</option>
              <option value="Valuation">Valuation Report</option>
              <option value="Service Fees">Service Fees / HOA Schedule</option>
              <option value="Legal">Legal / SPV Contract</option>
            </select>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={!canDueDiligence}
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-xs text-white cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Attach PDF / Image</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <textarea
              rows={3}
              value={manualClauseText}
              onChange={(e) => setManualClauseText(e.target.value)}
              placeholder="Or paste clauses/numbers from Lease, Title Deed, or HOA Invoice..."
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-xs"
            />
            <button
              type="button"
              onClick={handleAddTextDoc}
              className="px-3 py-1.5 rounded-lg bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 border border-[#D4AF37]/40 text-[#D4AF37] text-xs cursor-pointer"
            >
              + Add Text Extract as {pendingDocType}
            </button>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-2">
          <div className="text-xs font-bold text-zinc-300">
            Queued Documents ({docs.length}/5)
          </div>
          {docs.length === 0 ? (
            <div className="text-xs text-zinc-500 py-6 text-center">
              No documents attached yet. Add Lease, Title Deed, Valuation, or Service Fee sheets.
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <div
                  key={d.id}
                  className="p-2.5 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] font-bold mr-2">
                      {d.docType}
                    </span>
                    <span className="text-white">{d.fileName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDocs((prev) => prev.filter((x) => x.id !== d.id))}
                    className="text-rose-400 hover:text-rose-200 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs font-mono text-rose-200">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={!canDueDiligence || isScanning || isAccountLocked}
        onClick={handleRunDocAudit}
        className="px-6 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#F3E5AB] text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-50"
      >
        {!canDueDiligence || isAccountLocked ? (
          <Lock className="w-4 h-4" />
        ) : isScanning ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileCheck2 className="w-4 h-4" />
        )}
        <span>
          {isScanning ? 'Extracting & Cross-Checking Documents...' : 'Scan Documents vs Financial Model (-1 CREDIT)'}
        </span>
      </button>

      {/* Persisted Document Due Diligence Result */}
      {persistedDocResult && (
        <div className="space-y-4 pt-4 border-t border-white/[0.08]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-mono text-emerald-400">
                Audited {persistedDocResult.documentsScanned.length} doc(s) •{' '}
                {new Date(persistedDocResult.generatedAt).toLocaleString('en-US')}
              </div>
              <div className="text-base font-bold text-white">{persistedDocResult.verdict}</div>
            </div>
            <div className="flex flex-wrap gap-2 font-mono text-xs">
              <span className="px-3 py-1 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] font-bold">
                Score: {persistedDocResult.overallComplianceScore}/100
              </span>
              <span className="px-3 py-1 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 font-bold">
                Contradictions: {persistedDocResult.contradictionsCount}
              </span>
              <span className="px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold">
                Missing: {persistedDocResult.missingCount}
              </span>
            </div>
          </div>

          {persistedDocResult.missingDocumentsOrClauses.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-200 space-y-1">
              <div className="font-bold">Missing Supporting Docs / Clauses Flagged:</div>
              {persistedDocResult.missingDocumentsOrClauses.map((m, idx) => (
                <div key={idx}>• {m}</div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-white/[0.03] border-b border-white/[0.08] text-zinc-400 uppercase">
                <tr>
                  <th className="py-2.5 px-3">Field / Clause</th>
                  <th className="py-2.5 px-3">Extracted Value</th>
                  <th className="py-2.5 px-3">Model Value</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Source Citation</th>
                  <th className="py-2.5 px-3">Audit Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {persistedDocResult.items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-3 font-bold text-white">{it.field}</td>
                    <td className="py-2.5 px-3 text-zinc-200">{it.extractedValue}</td>
                    <td className="py-2.5 px-3 text-zinc-400">{it.modelValue}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[10px] ${
                          it.status === 'Match' || it.status === 'Verified'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : it.status === 'Contradiction'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {it.status === 'Match' || it.status === 'Verified' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : it.status === 'Contradiction' ? (
                          <XCircle className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        {it.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#D4AF37]">[{it.sourceCitation}]</td>
                    <td className="py-2.5 px-3 text-zinc-300">{it.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[11px] font-mono text-zinc-400">{persistedDocResult.disclaimer}</div>
        </div>
      )}
    </div>
  );
};
