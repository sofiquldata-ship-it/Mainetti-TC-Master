import React, { useState, useEffect } from 'react';
import {
  PIData,
  TCStatus,
  computeAutomatedTcStatus,
  computeActionableWaitingStatus,
  getDraftToConfirmDays,
} from '../types/tc';
import {
  X,
  Building2,
  Calendar,
  DollarSign,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileCheck,
  Package,
  ArrowRight,
  Send,
  ExternalLink,
  Copy,
  Check,
  CalendarDays,
  FileText,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

interface PiDetailDrawerProps {
  pi: PIData | null;
  onClose: () => void;
  onUpdateStatus?: (piId: string, newStatus: TCStatus) => void;
  onUpdatePI?: (updatedPI: PIData) => void;
}

export const PiDetailDrawer: React.FC<PiDetailDrawerProps> = ({
  pi,
  onClose,
  onUpdateStatus,
  onUpdatePI,
}) => {
  const [copied, setCopied] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Workflow Form State
  const [tcReqDate, setTcReqDate] = useState<string>('');
  const [recCommDocDate, setRecCommDocDate] = useState<string>('');
  const [draftTcDate, setDraftTcDate] = useState<string>('');
  const [draftConfDate, setDraftConfDate] = useState<string>('');
  const [revQty, setRevQty] = useState<string>('');
  const [finalApplyDate, setFinalApplyDate] = useState<string>('');
  const [finalRecDate, setFinalRecDate] = useState<string>('');
  const [tcNum, setTcNum] = useState<string>('');
  const [invoiceNo, setInvoiceNo] = useState<string>('');
  const [invoiceDt, setInvoiceDt] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (pi) {
      setTcReqDate(pi.tcRequestDate || '');
      setRecCommDocDate(pi.receivedCommercialDocDate || '');
      setDraftTcDate(pi.draftTcDate || '');
      setDraftConfDate(pi.draftConfirmationDate || '');
      const cleanRev =
        pi.revisionQty !== undefined && pi.revisionQty > 0 && pi.revisionQty <= 20
          ? String(pi.revisionQty)
          : '';
      setRevQty(cleanRev);
      setFinalApplyDate(pi.finalTcApplyDate || '');
      setFinalRecDate(pi.finalTcReceivedDate || '');
      setTcNum(pi.tcNumber || '');
      setInvoiceNo(pi.invoiceNumber || '');
      setInvoiceDt(pi.invoiceDate || '');
      setNotes(pi.notes || '');
    }
  }, [pi?.id]);

  if (!pi) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(pi.piNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to get today's date formatted as YYYY-MM-DD
  const getTodayStr = () => new Date().toISOString().slice(0, 10);

  // Apply changes to parent state and auto-sync
  const applyWorkflowUpdate = (overrides: Partial<PIData>) => {
    const updatedDraft: PIData = {
      ...pi,
      tcRequestDate: overrides.tcRequestDate !== undefined ? overrides.tcRequestDate : (tcReqDate || undefined),
      receivedCommercialDocDate: overrides.receivedCommercialDocDate !== undefined ? overrides.receivedCommercialDocDate : (recCommDocDate || undefined),
      draftTcDate: overrides.draftTcDate !== undefined ? overrides.draftTcDate : (draftTcDate || undefined),
      draftConfirmationDate: overrides.draftConfirmationDate !== undefined ? overrides.draftConfirmationDate : (draftConfDate || undefined),
      revisionQty: overrides.revisionQty !== undefined ? overrides.revisionQty : (revQty ? Number(revQty) : undefined),
      finalTcApplyDate: overrides.finalTcApplyDate !== undefined ? overrides.finalTcApplyDate : (finalApplyDate || undefined),
      finalTcReceivedDate: overrides.finalTcReceivedDate !== undefined ? overrides.finalTcReceivedDate : (finalRecDate || undefined),
      tcNumber: overrides.tcNumber !== undefined ? overrides.tcNumber : (tcNum || undefined),
      invoiceNumber: overrides.invoiceNumber !== undefined ? overrides.invoiceNumber : (invoiceNo || undefined),
      invoiceDate: overrides.invoiceDate !== undefined ? overrides.invoiceDate : (invoiceDt || undefined),
      notes: overrides.notes !== undefined ? overrides.notes : notes,
    };

    // Auto calculate status based on current fields
    const autoStatus = computeAutomatedTcStatus(updatedDraft);
    updatedDraft.tcStatus = autoStatus;

    if (onUpdatePI) {
      onUpdatePI(updatedDraft);
    } else if (onUpdateStatus) {
      onUpdateStatus(updatedDraft.id, autoStatus);
    }

    setActionSuccess(`Status automatically updated to "${autoStatus}" & synced!`);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  // Current computed status
  const currentAutoStatus = computeAutomatedTcStatus({
    tcRequestDate: tcReqDate || undefined,
    receivedCommercialDocDate: recCommDocDate || undefined,
    draftTcDate: draftTcDate || undefined,
    draftConfirmationDate: draftConfDate || undefined,
    revisionQty: revQty ? Number(revQty) : undefined,
    finalTcApplyDate: finalApplyDate || undefined,
    finalTcReceivedDate: finalRecDate || undefined,
    tcNumber: tcNum || undefined,
  });

  const activeStatus = currentAutoStatus !== 'Not Requested' ? currentAutoStatus : (pi.tcStatus || 'Not Requested');

  const stages: { label: TCStatus; short: string }[] = [
    { label: 'Not Requested', short: '1. Not Req' },
    { label: 'TC Requested', short: '2. Req' },
    { label: 'Commercial Doc Received', short: '3. Doc Rec' },
    { label: 'Draft TC Received', short: '4. Draft' },
    { label: 'Draft Confirmed', short: '5. Confirmed' },
    { label: 'Revision', short: '6. Rev' },
    { label: 'Final TC Applied', short: '7. Applied' },
    { label: 'Final TC Received', short: '8. Final TC' },
  ];

  const currentStageIndex = stages.findIndex((s) => s.label === activeStatus);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-300 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-5 py-4 bg-[#0b1b3d] text-white flex items-center justify-between border-b border-[#183466]">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#1e3a8a] p-1.5 rounded-sm border border-blue-400/20">
              <FileCheck className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-mono text-white tracking-tight">
                  {pi.piNumber}
                </h2>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Copy PI Number"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <span className="text-xs text-blue-200">
                {pi.buyer} · PO: {pi.poReference} · {pi.customer}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-sm hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Action Success Alert */}
          {actionSuccess && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-medium rounded-sm flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Current Automated Status Bar with Actionable Waiting Step */}
          {(() => {
            const actionable = computeActionableWaitingStatus({
              ...pi,
              tcRequestDate: tcReqDate || undefined,
              receivedCommercialDocDate: recCommDocDate || undefined,
              draftTcDate: draftTcDate || undefined,
              draftConfirmationDate: draftConfDate || undefined,
              revisionQty: revQty ? Number(revQty) : undefined,
              finalTcApplyDate: finalApplyDate || undefined,
              finalTcReceivedDate: finalRecDate || undefined,
              tcNumber: tcNum || undefined,
            });
            return (
              <div className="p-3 bg-[#0b1b3d] text-white rounded-sm shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-[#1a386b]">
                <div>
                  <span className="text-[10px] text-blue-200 font-bold uppercase tracking-wider block font-mono">
                    Current Process Status (Waiting For):
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${actionable.dotColor} ${actionable.isCompleted ? '' : 'animate-pulse'}`} />
                    <span className="text-sm font-bold font-mono text-white tracking-tight">
                      {actionable.statusLabel}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-sans text-blue-100 bg-white/10 px-2 py-1 rounded-xs border border-white/20 inline-block">
                    {actionable.actionText}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Stepper Progression Visualizer */}
          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-sm">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              TC Status Workflow Progression
            </span>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 text-center font-mono text-[9px]">
              {stages.map((st, i) => {
                const isCurrent = st.label === activeStatus;
                const isPassed = currentStageIndex >= 0 && i < currentStageIndex;
                return (
                  <div
                    key={st.label}
                    className={`p-1.5 rounded-xs border transition-colors ${
                      isCurrent
                        ? 'bg-[#0b1b3d] text-white border-[#0b1b3d] font-bold shadow-xs'
                        : isPassed
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-medium'
                        : 'bg-white text-slate-400 border-slate-200'
                    }`}
                    title={st.label}
                  >
                    <span className="block truncate">{st.short}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Commercial Invoice Details (Number & Date) */}
          <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-sm space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#0b1b3d] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                <span>Commercial Invoice Details</span>
              </label>
              <span className="text-[10px] text-blue-700 font-mono font-medium">
                (Manual Input / From Document)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Invoice Number */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Invoice Number
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-90412 / MSF-8812"
                    value={invoiceNo}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInvoiceNo(val);
                      applyWorkflowUpdate({ invoiceNumber: val || undefined });
                    }}
                    className="flex-1 py-1.5 px-2.5 bg-white border border-blue-300 rounded-xs text-xs font-mono font-bold text-[#0b1b3d] focus:border-blue-700 focus:ring-1 focus:ring-blue-700 focus:outline-none placeholder:font-normal placeholder:text-slate-400"
                  />
                  {invoiceNo && (
                    <button
                      type="button"
                      onClick={() => {
                        setInvoiceNo('');
                        applyWorkflowUpdate({ invoiceNumber: undefined });
                      }}
                      className="px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-red-700 bg-white border border-slate-300 rounded-xs hover:bg-red-50 transition-colors cursor-pointer"
                      title="Clear Invoice Number"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Invoice Date */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Invoice Date
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="date"
                    value={invoiceDt}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInvoiceDt(val);
                      applyWorkflowUpdate({ invoiceDate: val || undefined });
                    }}
                    className="flex-1 py-1.5 px-2.5 bg-white border border-blue-300 rounded-xs text-xs font-mono font-bold text-[#0b1b3d] focus:border-blue-700 focus:ring-1 focus:ring-blue-700 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const today = getTodayStr();
                      setInvoiceDt(today);
                      applyWorkflowUpdate({ invoiceDate: today });
                    }}
                    className="px-2 py-1 bg-white hover:bg-blue-100 text-blue-900 text-[10px] font-bold rounded-xs border border-blue-300 cursor-pointer transition-colors shadow-2xs"
                  >
                    Today
                  </button>
                  {invoiceDt && (
                    <button
                      type="button"
                      onClick={() => {
                        setInvoiceDt('');
                        applyWorkflowUpdate({ invoiceDate: undefined });
                      }}
                      className="px-1.5 py-1 text-[11px] font-medium text-slate-500 hover:text-red-700 bg-white border border-slate-300 rounded-xs hover:bg-red-50 transition-colors cursor-pointer"
                      title="Clear Invoice Date"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 8 TC Workflow Dates & Fields Input Form */}
          <div className="border border-slate-200 rounded-sm p-3.5 bg-white space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
              {/* 1. TC Request Date */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  1. TC Request Date
                </label>
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={tcReqDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTcReqDate(val);
                      applyWorkflowUpdate({ tcRequestDate: val || undefined });
                    }}
                    className="flex-1 py-1 px-2 border border-slate-300 rounded-xs text-xs font-mono focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const today = getTodayStr();
                      setTcReqDate(today);
                      applyWorkflowUpdate({ tcRequestDate: today });
                    }}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold rounded-xs border border-slate-300 cursor-pointer"
                  >
                    Today
                  </button>
                </div>
              </div>

              {/* 2. Received Commercial Doc Date */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  2. Received Commercial Doc Date
                </label>
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={recCommDocDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRecCommDocDate(val);
                      applyWorkflowUpdate({ receivedCommercialDocDate: val || undefined });
                    }}
                    className="flex-1 py-1 px-2 border border-slate-300 rounded-xs text-xs font-mono focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const today = getTodayStr();
                      setRecCommDocDate(today);
                      applyWorkflowUpdate({ receivedCommercialDocDate: today });
                    }}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold rounded-xs border border-slate-300 cursor-pointer"
                  >
                    Today
                  </button>
                </div>
              </div>

              {/* 3. Draft TC Date */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  3. Draft TC Date
                </label>
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={draftTcDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraftTcDate(val);
                      applyWorkflowUpdate({ draftTcDate: val || undefined });
                    }}
                    className="flex-1 py-1 px-2 border border-slate-300 rounded-xs text-xs font-mono focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const today = getTodayStr();
                      setDraftTcDate(today);
                      applyWorkflowUpdate({ draftTcDate: today });
                    }}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold rounded-xs border border-slate-300 cursor-pointer"
                  >
                    Today
                  </button>
                </div>
              </div>

              {/* 4. Draft Confirmation Date */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  4. Draft Confirmation Date
                </label>
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={draftConfDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraftConfDate(val);
                      applyWorkflowUpdate({ draftConfirmationDate: val || undefined });
                    }}
                    className="flex-1 py-1 px-2 border border-slate-300 rounded-xs text-xs font-mono focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const today = getTodayStr();
                      setDraftConfDate(today);
                      applyWorkflowUpdate({ draftConfirmationDate: today });
                    }}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold rounded-xs border border-slate-300 cursor-pointer"
                  >
                    Today
                  </button>
                </div>
              </div>

              {/* 5. Draft TC to Confirmation Days (Auto Calculated) */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  5. Draft to Confirm Days (Auto)
                </label>
                {(() => {
                  const confirmInfo = getDraftToConfirmDays({
                    draftTcDate: draftTcDate || undefined,
                    draftConfirmationDate: draftConfDate || undefined,
                  });
                  if (confirmInfo.days === null) {
                    return (
                      <div className="w-full py-1.5 px-2.5 border border-dashed border-slate-300 bg-slate-50 rounded-xs text-xs font-mono text-slate-400">
                        Set Draft TC Date to calculate days
                      </div>
                    );
                  }
                  if (confirmInfo.isConfirmed) {
                    return (
                      <div className="w-full py-1.5 px-2.5 border border-emerald-300 bg-emerald-50 rounded-xs text-xs font-mono font-bold text-emerald-900 flex items-center justify-between">
                        <span>{confirmInfo.label}</span>
                        <span className="text-[10px] font-sans font-semibold bg-emerald-200/70 text-emerald-900 px-1.5 py-0.2 rounded-xs">
                          Confirmed
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div className="w-full py-1.5 px-2.5 border border-purple-300 bg-purple-50 rounded-xs text-xs font-mono font-bold text-purple-900 flex items-center justify-between">
                      <span>{confirmInfo.label}</span>
                      <span className="text-[10px] font-sans font-semibold bg-purple-200/70 text-purple-900 px-1.5 py-0.2 rounded-xs">
                        Waiting Confirm
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* 6. Final TC Apply Date */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  6. Final TC Apply Date
                </label>
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={finalApplyDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFinalApplyDate(val);
                      applyWorkflowUpdate({ finalTcApplyDate: val || undefined });
                    }}
                    className="flex-1 py-1 px-2 border border-slate-300 rounded-xs text-xs font-mono focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const today = getTodayStr();
                      setFinalApplyDate(today);
                      applyWorkflowUpdate({ finalTcApplyDate: today });
                    }}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold rounded-xs border border-slate-300 cursor-pointer"
                  >
                    Today
                  </button>
                </div>
              </div>

              {/* 7. Final TC Received Date */}
              <div>
                <label className="text-[11px] font-semibold text-emerald-800 block mb-1">
                  7. Final TC Received Date
                </label>
                <div className="flex gap-1">
                  <input
                    type="date"
                    value={finalRecDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFinalRecDate(val);
                      applyWorkflowUpdate({ finalTcReceivedDate: val || undefined });
                    }}
                    className="flex-1 py-1 px-2 border border-emerald-400 bg-emerald-50/40 rounded-xs text-xs font-mono focus:border-emerald-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const today = getTodayStr();
                      setFinalRecDate(today);
                      applyWorkflowUpdate({ finalTcReceivedDate: today });
                    }}
                    className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[10px] font-bold rounded-xs border border-emerald-400 cursor-pointer"
                  >
                    Today
                  </button>
                </div>
              </div>

              {/* 8. TC Number */}
              <div>
                <label className="text-[11px] font-semibold text-emerald-800 block mb-1">
                  8. TC Number (Certificate #)
                </label>
                <input
                  type="text"
                  placeholder="e.g. TC-GRS-2026-98124"
                  value={tcNum}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTcNum(val);
                    applyWorkflowUpdate({ tcNumber: val || undefined });
                  }}
                  className="w-full py-1 px-2 border border-emerald-400 bg-emerald-50/40 rounded-xs text-xs font-mono font-bold focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* PI Product & Delivery Summary */}
          <div className="border border-slate-200 rounded-sm p-3 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0b1b3d] uppercase tracking-wide block">
                PI Quantities & Commercial Logistics
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono font-bold text-slate-800 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-xs">
                  Model: {pi.model || (pi.productItems && pi.productItems[0]?.modelProduct) || (pi.productDescription !== 'TRANSACTION CERTIFICATE COST' ? pi.productDescription : 'POLYBAGS')}
                </span>
                {pi.lastChallanNumber && (
                  <span className="text-[11px] font-mono font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-xs">
                    Challan: {pi.lastChallanNumber}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xs border border-slate-200 font-mono text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] font-sans">Order Qty</span>
                <strong className="text-slate-900 font-bold">
                  {(pi.orderQuantity !== undefined && pi.orderQuantity > 1 ? pi.orderQuantity : 0).toLocaleString()} PCS
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] font-sans">Delivery Qty</span>
                <strong className="text-emerald-800 font-bold">
                  {(pi.deliveryQuantity !== undefined && pi.deliveryQuantity > 1 ? pi.deliveryQuantity : 0).toLocaleString()} PCS
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] font-sans">Balance Qty</span>
                <strong className="text-amber-800 font-bold">
                  {Math.max(
                    0,
                    (pi.orderQuantity !== undefined && pi.orderQuantity > 1 ? pi.orderQuantity : 0) -
                      (pi.deliveryQuantity !== undefined && pi.deliveryQuantity > 1 ? pi.deliveryQuantity : 0)
                  ).toLocaleString()} PCS
                </strong>
              </div>
            </div>

            {/* Delivery Challan Tracking Breakdown if present */}
            {pi.lastChallanNumber && (
              <div className="bg-indigo-50/50 border border-indigo-100 p-2.5 rounded-xs text-[11px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-indigo-950">Latest Delivery Challan:</span>
                  <span className="font-mono font-bold text-indigo-900">{pi.lastChallanNumber}</span>
                </div>
                {pi.lastDeliveryDate && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Last Delivery Date:</span>
                    <span className="font-mono">{pi.lastDeliveryDate}</span>
                  </div>
                )}
                {pi.allChallanNumbers && pi.allChallanNumbers.length > 1 && (
                  <div className="pt-1 border-t border-indigo-100 flex flex-wrap items-center gap-1">
                    <span className="text-slate-500 text-[10px]">All Challans ({pi.allChallanNumbers.length}):</span>
                    {pi.allChallanNumbers.map((ch, idx) => (
                      <span key={idx} className="font-mono font-bold bg-white text-indigo-900 px-1.5 py-0.2 rounded-xs border border-indigo-200 text-[10px]">
                        {ch}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-sm hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Close Dossier
          </button>

          <button
            type="button"
            onClick={() => {
              applyWorkflowUpdate({
                invoiceNumber: invoiceNo || undefined,
                tcRequestDate: tcReqDate || undefined,
                receivedCommercialDocDate: recCommDocDate || undefined,
                draftTcDate: draftTcDate || undefined,
                draftConfirmationDate: draftConfDate || undefined,
                revisionQty: revQty ? Number(revQty) : undefined,
                finalTcApplyDate: finalApplyDate || undefined,
                finalTcReceivedDate: finalRecDate || undefined,
                tcNumber: tcNum || undefined,
                notes: notes || undefined,
              });
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-sm shadow-xs transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4 text-emerald-200" />
            <span>Save & Close</span>
          </button>
        </div>
      </div>
    </div>
  );
};
