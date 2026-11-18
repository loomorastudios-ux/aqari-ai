import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { openPaddleCheckout, PADDLE_PRO_SUCCESS_MESSAGE } from '../utils/paddleClient';
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  AlertCircle,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Upload,
} from 'lucide-react';

export type PaidPlanChoice = 'starter' | 'pro' | 'enterprise';

interface BankTransferDetails {
  companyName: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string;
  configured: boolean;
}

interface BankTransferCheckoutPageProps {
  initialPlan: PaidPlanChoice;
  user: User | null;
  onRequireAuth: () => void;
  onBack: () => void;
  onGoToTerminal: () => void;
}

const PLAN_META: Record<
  PaidPlanChoice,
  { labelAr: string; labelEn: string; amountUSD: number; amountOMR: number }
> = {
  starter: {
    labelAr: 'باقة Starter',
    labelEn: 'STARTER',
    amountUSD: 79,
    amountOMR: Number((79 * 0.385).toFixed(2)),
  },
  pro: {
    labelAr: 'باقة Professional',
    labelEn: 'PROFESSIONAL',
    amountUSD: 199,
    amountOMR: Number((199 * 0.385).toFixed(2)),
  },
  enterprise: {
    labelAr: 'باقة Sovereign',
    labelEn: 'SOVEREIGN',
    amountUSD: 599,
    amountOMR: Number((599 * 0.385).toFixed(2)),
  },
};

function compressReceiptImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الإيصال.'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        try {
          const maxDim = 1280;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.78);
          resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export const BankTransferCheckoutPage: React.FC<BankTransferCheckoutPageProps> = ({
  initialPlan,
  user,
  onRequireAuth,
  onBack,
  onGoToTerminal,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<PaidPlanChoice>(initialPlan);
  const [currency, setCurrency] = useState<'OMR' | 'USD'>('OMR');
  const [orderNumber, setOrderNumber] = useState<string>('AQ-2026-001');
  const [bankDetails, setBankDetails] = useState<BankTransferDetails>({
    companyName: 'Aqari AI',
    bankName: '',
    accountName: '',
    accountNumber: '',
    iban: '',
    configured: false,
  });
  const [loadingInit, setLoadingInit] = useState<boolean>(true);
  const [copiedBank, setCopiedBank] = useState<boolean>(false);

  // Proof form state
  const [customerEmail, setCustomerEmail] = useState<string>(user?.email || '');
  const [customerName, setCustomerName] = useState<string>(user?.name || '');
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [senderAccountName, setSenderAccountName] = useState<string>('');
  const [transferDate, setTransferDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [whatsappNumber, setWhatsappNumber] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedPending, setSubmittedPending] = useState<{
    orderNumber: string;
    message: string;
    planDisplay: string;
    selectedAmount: number;
    currency: 'OMR' | 'USD';
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // International Paddle fallback state
  const [paddleLoading, setPaddleLoading] = useState<boolean>(false);
  const [paddleMsg, setPaddleMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    setSelectedPlan(initialPlan);
  }, [initialPlan]);

  useEffect(() => {
    if (user?.email) setCustomerEmail(user.email);
    if (user?.name) setCustomerName(user.name);
  }, [user?.email, user?.name]);

  useEffect(() => {
    let active = true;
    const initTransferOrder = async () => {
      setLoadingInit(true);
      try {
        const res = await fetch('/api/app?action=manual-payment-init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            plan: selectedPlan,
            currency,
            orderNumber: /^AQ-\d{4}-\d{3,}$/i.test(orderNumber) && !loadingInit ? orderNumber : undefined,
          }),
        });
        if (res.ok && active) {
          const data = await res.json();
          if (data?.orderNumber) setOrderNumber(data.orderNumber);
          if (data?.bankDetails) setBankDetails(data.bankDetails);
        }
      } catch {
        // Keep clean fallback state
      } finally {
        if (active) setLoadingInit(false);
      }
    };
    initTransferOrder();
    return () => {
      active = false;
    };
  }, [selectedPlan]);

  const planMeta = PLAN_META[selectedPlan];
  const displayAmount = currency === 'OMR' ? planMeta.amountOMR : planMeta.amountUSD;

  const whatsappHref = `https://wa.me/96878900731?text=${encodeURIComponent(
    `مرحبا، أريد الاشتراك في باقة عقاري AI. رقم طلبي هو: ${orderNumber}`
  )}`;

  const handleCopyBankDetails = async () => {
    const text = [
      `اسم الشركة: ${bankDetails.companyName || 'Aqari AI'}`,
      `اسم البنك: ${bankDetails.bankName || 'BANK_NAME'}`,
      `اسم الحساب: ${bankDetails.accountName || 'BANK_ACCOUNT_NAME'}`,
      `رقم الحساب: ${bankDetails.accountNumber || 'BANK_ACCOUNT_NUMBER'}`,
      `IBAN: ${bankDetails.iban || 'BANK_IBAN'}`,
      `الباقة: ${planMeta.labelEn}`,
      `المبلغ: ${displayAmount} ${currency} ($${planMeta.amountUSD} USD)`,
      `رقم المرجع (اكتبه في ملاحظة التحويل): ${orderNumber}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 3000);
    } catch {
      setFormError('تعذر النسخ التلقائي، يرجى نسخ رقم الحساب والمرجع يدوياً.');
    }
  };

  const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setReceiptImage('');
      setReceiptFileName('');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setFormError('يرجى رفع صورة صالحة لإيصال التحويل (PNG أو JPG).');
      return;
    }
    try {
      const compressed = await compressReceiptImage(file);
      setReceiptImage(compressed);
      setReceiptFileName(file.name);
    } catch (err: any) {
      setFormError(err?.message || 'حدث خطأ أثناء معالجة صورة الإيصال.');
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const effectiveEmail = (user?.email || customerEmail || '').trim().toLowerCase();
    if (!effectiveEmail || !effectiveEmail.includes('@')) {
      setFormError('يرجى تسجيل الدخول أو كتابة بريدك الإلكتروني لتأكيد الطلب.');
      return;
    }
    if (!receiptImage) {
      setFormError('صورة إيصال التحويل مطلوبة.');
      return;
    }
    if (!senderAccountName.trim()) {
      setFormError('اسم الحساب المُحوِّل مطلوب.');
      return;
    }
    if (!transferDate.trim()) {
      setFormError('تاريخ التحويل مطلوب.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/app?action=create-manual-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderNumber,
          plan: selectedPlan,
          currency,
          email: effectiveEmail,
          login_email: effectiveEmail,
          customerName: (user?.name || customerName || effectiveEmail.split('@')[0]).trim(),
          senderAccountName: senderAccountName.trim(),
          transferDate: transferDate.trim(),
          whatsappNumber: whatsappNumber.trim(),
          receiptImage,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setFormError(data?.error || 'تعذر إرسال طلب التحويل البنكي، يرجى المحاولة مرة أخرى.');
        return;
      }

      setSubmittedPending({
        orderNumber: data.orderNumber || orderNumber,
        message:
          data.message ||
          'تم استلام طلبك. الطلب قيد المراجعة. سيتم التفعيل خلال 12-24 ساعة عمل بعد التحقق من وصول المبلغ.',
        planDisplay: data.planDisplay || planMeta.labelEn,
        selectedAmount: data.selectedAmount ?? displayAmount,
        currency: data.currency || currency,
      });
    } catch {
      setFormError('خطأ في الاتصال بالخادم أثناء إرسال إثبات التحويل.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayWithPaddle = async () => {
    setPaddleMsg(null);
    if (!user) {
      onRequireAuth();
      return;
    }
    setPaddleLoading(true);
    try {
      await openPaddleCheckout({
        plan: selectedPlan,
        email: user.email,
        userId: user.id || user.googleId,
        refundAcceptedAt: new Date().toISOString(),
        onVerified: (verifyData) => {
          setPaddleLoading(false);
          setPaddleMsg({
            type: 'success',
            text: verifyData?.message || PADDLE_PRO_SUCCESS_MESSAGE,
          });
        },
        onError: (msg) => {
          setPaddleLoading(false);
          setPaddleMsg({ type: 'error', text: msg });
        },
        onClose: () => {
          setPaddleLoading(false);
        },
      });
    } catch (err: any) {
      setPaddleLoading(false);
      setPaddleMsg({
        type: 'error',
        text: err?.message || 'تعذر فتح نافذة الدفع عبر Paddle.',
      });
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-black text-slate-100 py-24 px-4 lg:px-8 relative z-10"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-mono text-zinc-200 cursor-pointer transition"
          >
            <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
            <span>العودة إلى الأسعار</span>
          </button>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-mono text-[#D4AF37]">
            <Building2 className="w-3.5 h-3.5" />
            <span>الدفع بالتحويل البنكي المباشر • سلطنة عُمان</span>
          </div>
        </div>

        {/* Step 1: Plan Summary & Order Number */}
        <div className="glass-panel rounded-[28px] p-6 sm:p-8 border border-[#D4AF37]/35 shadow-[0_0_50px_rgba(212,175,55,0.12)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
            <div>
              <div className="text-xs font-mono text-[#D4AF37] font-bold mb-1">
                الخطوة 1: تفاصيل الطلب والباقة المختارة
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                اشتراك {planMeta.labelAr} — Aqari AI
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                حساب بنكي شخصي مخصص للاشتراكات داخل سلطنة عُمان (تفعيل خلال 12-24 ساعة عمل).
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end gap-2">
              <div className="px-4 py-2 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-center">
                <div className="text-[10px] font-mono text-zinc-300">رقم الطلب / المرجع</div>
                <div
                  dir="ltr"
                  className="text-lg font-black font-mono text-[#D4AF37] tracking-wider"
                >
                  {loadingInit ? '...' : orderNumber}
                </div>
              </div>
            </div>
          </div>

          {/* Plan & Currency Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5">
            <div>
              <div className="text-xs font-mono text-zinc-400 mb-2">الباقة:</div>
              <div className="grid grid-cols-3 gap-2">
                {(['starter', 'pro', 'enterprise'] as PaidPlanChoice[]).map((pKey) => {
                  const m = PLAN_META[pKey];
                  const active = selectedPlan === pKey;
                  return (
                    <button
                      key={pKey}
                      type="button"
                      disabled={Boolean(submittedPending)}
                      onClick={() => setSelectedPlan(pKey)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-mono font-bold border transition cursor-pointer ${
                        active
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                          : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:border-[#D4AF37]/40'
                      }`}
                    >
                      <div>{m.labelEn}</div>
                      <div dir="ltr" className="text-[11px] opacity-90">
                        ${m.amountUSD}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs font-mono text-zinc-400 mb-2">عملة التحويل:</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={Boolean(submittedPending)}
                  onClick={() => setCurrency('OMR')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-mono font-bold border transition cursor-pointer ${
                    currency === 'OMR'
                      ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                      : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:border-[#D4AF37]/40'
                  }`}
                >
                  <div>ريال عماني (OMR)</div>
                  <div dir="ltr" className="text-[11px] opacity-90">
                    {planMeta.amountOMR} OMR
                  </div>
                </button>
                <button
                  type="button"
                  disabled={Boolean(submittedPending)}
                  onClick={() => setCurrency('USD')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-mono font-bold border transition cursor-pointer ${
                    currency === 'USD'
                      ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                      : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:border-[#D4AF37]/40'
                  }`}
                >
                  <div>دولار أمريكي (USD)</div>
                  <div dir="ltr" className="text-[11px] opacity-90">
                    ${planMeta.amountUSD} USD
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Step 4: Pending Confirmation View after submit */}
        {submittedPending ? (
          <div className="glass-panel rounded-[28px] p-8 border border-emerald-500/40 bg-emerald-950/20 text-center space-y-5 shadow-[0_0_50px_rgba(16,185,129,0.15)]">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-emerald-400" />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-xs font-mono text-amber-300 font-bold">
              <span>الحالة: قيد المراجعة (Pending)</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white leading-relaxed max-w-2xl mx-auto">
              {submittedPending.message}
            </h2>

            <div className="max-w-md mx-auto p-4 rounded-2xl bg-black/60 border border-white/10 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">رقم الطلب:</span>
                <span dir="ltr" className="text-[#D4AF37] font-bold">
                  {submittedPending.orderNumber}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">الباقة:</span>
                <span className="text-white font-bold">{submittedPending.planDisplay}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">المبلغ:</span>
                <span dir="ltr" className="text-emerald-300 font-bold">
                  {submittedPending.selectedAmount} {submittedPending.currency}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href={`https://wa.me/96878900731?text=${encodeURIComponent(
                  `مرحبا، أريد الاشتراك في باقة عقاري AI. رقم طلبي هو: ${submittedPending.orderNumber}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold transition shadow-lg"
              >
                <MessageCircle className="w-4 h-4" />
                <span>تواصل عبر واتساب</span>
              </a>

              <button
                type="button"
                onClick={user ? onGoToTerminal : onBack}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-white text-xs font-mono font-bold cursor-pointer transition"
              >
                <span>{user ? 'الانتقال إلى المنصة' : 'العودة للرئيسية'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Step 2: Bank Transfer Details */}
            <div className="glass-panel rounded-[28px] p-6 sm:p-7 border border-white/15 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-mono text-[#D4AF37] font-bold">
                    الخطوة 2: بيانات التحويل البنكي
                  </div>
                  <h2 className="text-lg font-bold text-white mt-0.5">
                    قم بالتحويل إلى الحساب التالي
                  </h2>
                </div>
                <Building2 className="w-6 h-6 text-[#D4AF37] shrink-0" />
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3">
                  <span className="text-zinc-400">اسم الشركة:</span>
                  <span className="text-white font-bold">{bankDetails.companyName || 'Aqari AI'}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3">
                  <span className="text-zinc-400">اسم البنك:</span>
                  <span className="text-white font-bold">
                    {bankDetails.bankName || 'سيظهر عند إضافة BANK_NAME في Vercel'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3">
                  <span className="text-zinc-400">اسم الحساب:</span>
                  <span className="text-white font-bold">
                    {bankDetails.accountName || 'سيظهر عند إضافة BANK_ACCOUNT_NAME في Vercel'}
                  </span>
                </div>

                {bankDetails.accountNumber && (
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3">
                    <span className="text-zinc-400">رقم الحساب:</span>
                    <span dir="ltr" className="text-white font-bold">
                      {bankDetails.accountNumber}
                    </span>
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-zinc-400 shrink-0">رقم الحساب / IBAN:</span>
                  <span dir="ltr" className="text-white font-bold break-all">
                    {bankDetails.iban ||
                      bankDetails.accountNumber ||
                      'سيظهر عند إضافة BANK_IBAN في Vercel'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3">
                  <span className="text-zinc-400">العملة:</span>
                  <span dir="ltr" className="text-white font-bold">
                    {currency} (OMR / USD)
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-between gap-3">
                  <span className="text-zinc-200 font-bold">المبلغ المطلوب:</span>
                  <span dir="ltr" className="text-base font-black text-[#D4AF37]">
                    {displayAmount} {currency} (${planMeta.amountUSD} USD)
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/35 space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-amber-200 font-bold">رقم المرجع (Order Number):</span>
                    <span dir="ltr" className="text-sm font-black text-[#D4AF37]">
                      {orderNumber}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    مهم جداً: اكتب رقم المرجع هذا في ملاحظة التحويل (Write this reference in transfer note)
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleCopyBankDetails}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E6C65A] to-[#B8860B] hover:brightness-110 text-black font-black text-xs font-mono flex items-center justify-center gap-2 cursor-pointer transition shadow-lg"
                >
                  {copiedBank ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>
                    {copiedBank ? 'تم نسخ البيانات البنكية!' : 'نسخ البيانات البنكية (Copy Bank Details)'}
                  </span>
                </button>

                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-mono flex items-center justify-center gap-2 transition shadow-lg"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>واتساب مباشر</span>
                </a>
              </div>
            </div>

            {/* Step 3: Send Transfer Proof Form */}
            <form
              onSubmit={handleSubmitProof}
              className="glass-panel rounded-[28px] p-6 sm:p-7 border border-white/15 space-y-4"
            >
              <div>
                <div className="text-xs font-mono text-[#D4AF37] font-bold">
                  الخطوة 3: إرسال إثبات التحويل
                </div>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  أرفق إيصال التحويل البنكي
                </h2>
              </div>

              {!user && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2">
                  <span>يفضل تسجيل الدخول لحسابك قبل الإرسال أو أدخل بريدك الإلكتروني أدناه.</span>
                  <button
                    type="button"
                    onClick={onRequireAuth}
                    className="px-3 py-1 rounded-lg bg-[#D4AF37] text-black font-bold text-[11px] font-mono cursor-pointer"
                  >
                    تسجيل الدخول
                  </button>
                </div>
              )}

              {!user && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-zinc-300 mb-1.5">
                      الاسم الكامل *
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="اسم العميل"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/70 border border-white/15 text-white text-xs focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-zinc-300 mb-1.5">
                      البريد الإلكتروني للتفعيل *
                    </label>
                    <input
                      type="email"
                      dir="ltr"
                      lang="en"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/70 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
              )}

              {/* Upload Receipt Image (required) */}
              <div>
                <label className="block text-xs font-mono text-zinc-300 mb-1.5">
                  صورة إيصال التحويل (Upload Receipt Image) *
                </label>
                <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-black/60 border border-dashed border-[#D4AF37]/40 hover:border-[#D4AF37] cursor-pointer transition text-center">
                  <Upload className="w-5 h-5 text-[#D4AF37]" />
                  <span className="text-xs text-zinc-300">
                    {receiptFileName ? `تم اختيار: ${receiptFileName}` : 'اضغط لرفع صورة الإيصال (PNG / JPG)'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptChange}
                    className="hidden"
                  />
                </label>
                {receiptImage && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-white/15 max-h-40 bg-black flex justify-center">
                    <img
                      src={receiptImage}
                      alt="إيصال التحويل البنكي"
                      className="max-h-40 object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Sender Account Name (required) */}
              <div>
                <label className="block text-xs font-mono text-zinc-300 mb-1.5">
                  اسم الحساب المُحوِّل (Sender Account Name) *
                </label>
                <input
                  type="text"
                  required
                  value={senderAccountName}
                  onChange={(e) => setSenderAccountName(e.target.value)}
                  placeholder="الاسم الظاهر في الحساب المحول منه"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/70 border border-white/15 text-white text-xs focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {/* Transfer Date (required) & WhatsApp Number (optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-zinc-300 mb-1.5">
                    تاريخ التحويل (Transfer Date) *
                  </label>
                  <input
                    type="date"
                    dir="ltr"
                    lang="en"
                    required
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/70 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-300 mb-1.5">
                    رقم الواتساب (اختياري)
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    lang="en"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="+968 9XXXXXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/70 border border-white/15 text-white text-xs font-mono focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E6C65A] to-[#B8860B] hover:brightness-110 disabled:opacity-60 text-black font-black text-xs font-mono flex items-center justify-center gap-2 cursor-pointer transition shadow-lg"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري إرسال إثبات التحويل...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>إرسال إثبات التحويل لتفعيل الباقة</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Second Option: Paddle Checkout for International Users */}
        <div className="glass-panel rounded-[28px] p-6 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-300 font-bold">
              <CreditCard className="w-4 h-4 text-[#D4AF37]" />
              <span>خيار الدفع الثاني (للمستخدمين الدوليين خارج عُمان)</span>
            </div>
            <p className="text-xs text-zinc-400">
              يمكنك أيضاً الدفع الفوري بالبطاقة البنكية الدولية عبر بوابة Paddle Sandbox (${planMeta.amountUSD} USD).
            </p>
            {paddleMsg && (
              <div
                className={`mt-2 text-xs font-mono font-bold flex items-center gap-1.5 ${
                  paddleMsg.type === 'success' ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {paddleMsg.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
                <span>{paddleMsg.text}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={paddleLoading}
            onClick={handlePayWithPaddle}
            className="px-5 py-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 hover:border-[#D4AF37]/50 text-white text-xs font-mono font-bold flex items-center justify-center gap-2 cursor-pointer transition shrink-0"
          >
            {paddleLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" />
                <span>جاري فتح Paddle...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 text-[#D4AF37]" />
                <span>الدفع بالبطاقة عبر Paddle (${planMeta.amountUSD})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
