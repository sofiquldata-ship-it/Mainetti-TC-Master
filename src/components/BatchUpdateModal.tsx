import React, { useState } from 'react';
import { PIData, PaymentStatus, DeliveryStatus } from '../types/tc';
import {
  Layers,
  X,
  CheckCircle2,
  Calendar,
  Receipt,
  FileCheck2,
  AlertCircle,
  Hash,
  ShieldAlert,
  Trash2,
} from 'lucide-react';

interface BatchUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPIs: PIData[];
  onApplyBatchUpdate: (ids: string[], updates: Partial<PIData>) => void;
}

export const BatchUpdateModal: React.FC<BatchUpdateModalProps> = ({
  isOpen,
  onClose,
  selectedPIs,
  onApplyBatchUpdate,
}) => {
  if (!isOpen || selectedPIs.length === 0) return null;

  // Local state for batch update fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [tcRequestDate, setTcRequestDate] = useState('');
  const [receivedCommercialDocDate, setReceivedCommercialDocDate] = useState('');
  const [draftTcDate, setDraftTcDate] = useState('');
  const [draftConfirmationDate, setDraftConfirmationDate] = useState('');
  const [revisionQty, setRevisionQty] = useState('');
  const [finalTcApplyDate, setFinalTcApplyDate] = useState('');
  const [finalTcReceivedDate, setFinalTcReceivedDate] = useState('');
  const [tcNumber, setTcNumber] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<string>('');
  const [deliveryStatus, setDeliveryStatus] = useState<string>('');

  // Checkbox toggles for active fields to apply
  const [applyInvoice, setApplyInvoice] = useState(true);
  const [applyInvoiceDate, setApplyInvoiceDate] = useState(false);
  const [applyCommDoc, setApplyCommDoc] = useState(false);
  const [applyTcReqDate, setApplyTcReqDate] = useState(false);
  const [applyDraftTcDate, setApplyDraftTcDate] = useState(false);
  const [applyDraftConfirm, setApplyDraftConfirm] = useState(false);
  const [applyRevQty, setApplyRevQty] = useState(false);
  const [applyFinalApply, setApplyFinalApply] = useState(false);
  const [applyFinalRec, setApplyFinalRec] = useState(false);
  const [applyTcNum, setApplyTcNum] = useState(false);
  const [applyPaymentStatus, setApplyPaymentStatus] = useState(false);
  const [applyDeliveryStatus, setApplyDeliveryStatus] = useState(false);

  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updates: Partial<PIData> = {};

    if (applyInvoice) updates.invoiceNumber = invoiceNumber.trim() || undefined;
    if (applyInvoiceDate) updates.invoiceDate = invoiceDate || undefined;
    if (applyTcReqDate) updates.tcRequestDate = tcRequestDate || undefined;
    if (applyCommDoc) updates.receivedCommercialDocDate = receivedCommercialDocDate || undefined;
    if (applyDraftTcDate) updates.draftTcDate = draftTcDate || undefined;
    if (applyDraftConfirm) updates.draftConfirmationDate = draftConfirmationDate || undefined;
    if (applyRevQty) updates.revisionQty = revisionQty ? Number(revisionQty) : 0;
    if (applyFinalApply) updates.finalTcApplyDate = finalTcApplyDate || undefined;
    if (applyFinalRec) updates.finalTcReceivedDate = finalTcReceivedDate || undefined;
    if (applyTcNum) updates.tcNumber = tcNumber.trim() || undefined;
    if (applyPaymentStatus && paymentStatus) updates.paymentStatus = paymentStatus as PaymentStatus;
    if (applyDeliveryStatus && deliveryStatus) updates.deliveryStatus = deliveryStatus as DeliveryStatus;

    const ids = selectedPIs.map((p) => p.id);
    onApplyBatchUpdate(ids, updates);

    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1200);
  };

  const piNumbersList = selectedPIs.map((p) => p.piNumber).join(', ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-sm shadow-2xl w-full max-w-2xl my-auto overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#0b1b3d] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xs bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide uppercase flex items-center gap-2">
                <span>Batch / Bulk Update ({selectedPIs.length} PIs)</span>
              </h2>
              <p className="text-[11px] text-blue-200/80 font-mono">
                Apply same Invoice Number, Dates & Status across selected PIs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-xs hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected PIs Banner */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 text-xs text-slate-700 font-mono shrink-0 flex items-start gap-2">
          <span className="font-bold text-[#0b1b3d] shrink-0 font-sans">
            Selected PIs ({selectedPIs.length}):
          </span>
          <span className="truncate text-slate-600 font-semibold" title={piNumbersList}>
            {piNumbersList}
          </span>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {isSuccess ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-300 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Batch Update Successfully Applied!
              </h3>
              <p className="text-xs text-slate-500">
                Updated {selectedPIs.length} PIs with new Invoice / TC Dates.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-blue-50/60 border border-blue-200 rounded-xs p-3 text-xs text-blue-900 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed text-[11.5px]">
                  <strong>দিকনির্দেশনা:</strong> যে যে ফিল্ড পরিবর্তন করতে চান, পাশের চেকইন বক্সে টিক (✓) দিয়ে সঠিক ডাটা লিখুন। যেসব বক্সে টিক দেওয়া থাকবে না, সেগুলো আগের মতোই অপরিবর্তিত থাকবে।
                </p>
              </div>

              {/* SECTION 1: Commercial Invoice Details (Number & Date) */}
              <div className="border border-slate-200 rounded-xs p-3.5 bg-white space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Invoice Number */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs text-[#0b1b3d]">
                        <input
                          type="checkbox"
                          checked={applyInvoice}
                          onChange={(e) => setApplyInvoice(e.target.checked)}
                          className="w-3.5 h-3.5 accent-[#0b1b3d] rounded-xs cursor-pointer"
                        />
                        <Receipt className="w-3.5 h-3.5 text-blue-600" />
                        <span>Invoice Number</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. INV-2026-90412"
                      value={invoiceNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInvoiceNumber(val);
                        setApplyInvoice(val.trim().length > 0);
                      }}
                      className={`w-full py-1.5 px-2.5 border rounded-xs text-xs font-mono font-bold focus:outline-none transition-colors ${
                        applyInvoice
                          ? 'bg-blue-50/50 border-blue-400 text-slate-900'
                          : 'bg-slate-50 border-slate-300 text-slate-500'
                      }`}
                    />
                  </div>

                  {/* Invoice Date */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-xs text-[#0b1b3d]">
                        <input
                          type="checkbox"
                          checked={applyInvoiceDate}
                          onChange={(e) => setApplyInvoiceDate(e.target.checked)}
                          className="w-3.5 h-3.5 accent-[#0b1b3d] rounded-xs cursor-pointer"
                        />
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span>Invoice Date</span>
                      </label>
                    </div>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInvoiceDate(val);
                        setApplyInvoiceDate(val !== '');
                      }}
                      className={`w-full py-1.5 px-2.5 border rounded-xs text-xs font-mono font-bold focus:outline-none transition-colors ${
                        applyInvoiceDate
                          ? 'bg-blue-50/50 border-blue-400 text-slate-900'
                          : 'bg-slate-50 border-slate-300 text-slate-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: TC Workflow Dates */}
              <div className="border border-slate-200 rounded-xs p-3.5 bg-white space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-xs text-[#0b1b3d] flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>TC Workflow Dates</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Updates Stage Chronology</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* TC Request Date */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={applyTcReqDate}
                        onChange={(e) => setApplyTcReqDate(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#0b1b3d] rounded-xs cursor-pointer"
                      />
                      <span>TC Request Date</span>
                    </label>
                    <input
                      type="date"
                      value={tcRequestDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTcRequestDate(val);
                        setApplyTcReqDate(val !== '');
                      }}
                      className={`w-full py-1 px-2.5 border rounded-xs font-mono text-xs focus:outline-none transition-colors ${
                        applyTcReqDate
                          ? 'bg-blue-50/50 border-blue-400 text-slate-900 font-bold'
                          : 'bg-slate-50 border-slate-300 text-slate-500'
                      }`}
                    />
                  </div>

                  {/* Commercial Doc Received Date */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={applyCommDoc}
                        onChange={(e) => setApplyCommDoc(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#0b1b3d] rounded-xs cursor-pointer"
                      />
                      <span>Received Comm Doc Date</span>
                    </label>
                    <input
                      type="date"
                      value={receivedCommercialDocDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setReceivedCommercialDocDate(val);
                        setApplyCommDoc(val !== '');
                      }}
                      className={`w-full py-1 px-2.5 border rounded-xs font-mono text-xs focus:outline-none transition-colors ${
                        applyCommDoc
                          ? 'bg-blue-50/50 border-blue-400 text-slate-900 font-bold'
                          : 'bg-slate-50 border-slate-300 text-slate-500'
                      }`}
                    />
                  </div>

                  {/* Draft TC Date */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={applyDraftTcDate}
                        onChange={(e) => setApplyDraftTcDate(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#0b1b3d] rounded-xs cursor-pointer"
                      />
                      <span>Draft TC Received Date</span>
                    </label>
                    <input
                      type="date"
                      value={draftTcDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftTcDate(val);
                        setApplyDraftTcDate(val !== '');
                      }}
                      className={`w-full py-1 px-2.5 border rounded-xs font-mono text-xs focus:outline-none transition-colors ${
                        applyDraftTcDate
                          ? 'bg-blue-50/50 border-blue-400 text-slate-900 font-bold'
                          : 'bg-slate-50 border-slate-300 text-slate-500'
                      }`}
                    />
                  </div>

                  {/* Draft Confirmation Date */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={applyDraftConfirm}
                        onChange={(e) => setApplyDraftConfirm(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#0b1b3d] rounded-xs cursor-pointer"
                      />
                      <span>Draft Confirmation Date</span>
                    </label>
                    <input
                      type="date"
                      value={draftConfirmationDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftConfirmationDate(val);
                        setApplyDraftConfirm(val !== '');
                      }}
                      className={`w-full py-1 px-2.5 border rounded-xs font-mono text-xs focus:outline-none transition-colors ${
                        applyDraftConfirm
                          ? 'bg-blue-50/50 border-blue-400 text-slate-900 font-bold'
                          : 'bg-slate-50 border-slate-300 text-slate-500'
                      }`}
                    />
                  </div>

                  {/* Final Apply Date */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={applyFinalApply}
                        onChange={(e) => setApplyFinalApply(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#0b1b3d] rounded-xs cursor-pointer"
                      />
                      <span>Final TC Apply Date</span>
                    </label>
                    <input
                      type="date"
                      value={finalTcApplyDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFinalTcApplyDate(val);
                        setApplyFinalApply(val !== '');
                      }}
                      className={`w-full py-1 px-2.5 border rounded-xs font-mono text-xs focus:outline-none transition-colors ${
                        applyFinalApply
                          ? 'bg-blue-50/50 border-blue-400 text-slate-900 font-bold'
                          : 'bg-slate-50 border-slate-300 text-slate-500'
                      }`}
                    />
                  </div>

                  {/* Final TC Received Date */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={applyFinalRec}
                        onChange={(e) => setApplyFinalRec(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#0b1b3d] rounded-xs cursor-pointer"
                      />
                      <span>Final TC Received Date</span>
                    </label>
                    <input
                      type="date"
                      value={finalTcReceivedDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFinalTcReceivedDate(val);
                        setApplyFinalRec(val !== '');
                      }}
                      className={`w-full py-1 px-2.5 border rounded-xs font-mono text-xs focus:outline-none transition-colors ${
                        applyFinalRec
                          ? 'bg-blue-50/50 border-blue-400 text-slate-900 font-bold'
                          : 'bg-slate-50 border-slate-300 text-slate-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: Additional Metadata (TC Number, Revision Qty, Statuses) */}
              <div className="border border-slate-200 rounded-xs p-3.5 bg-white space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-xs text-[#0b1b3d] flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-blue-600" />
                    <span>TC Certificate & Order Logistics</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* TC Number */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={applyTcNum}
                        onChange={(e) => setApplyTcNum(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#0b1b3d] rounded-xs cursor-pointer"
                      />
                      <span>TC Number</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. TC-2026-88091"
                      value={tcNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTcNumber(val);
                        setApplyTcNum(val.trim().length > 0);
                      }}
                      className={`w-full py-1 px-2.5 border rounded-xs font-mono text-xs focus:outline-none transition-colors ${
                        applyTcNum
                          ? 'bg-blue-50/50 border-blue-400 text-slate-900 font-bold'
                          : 'bg-slate-50 border-slate-300 text-slate-500'
                      }`}
                    />
                  </div>

                  {/* Revision Count */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={applyRevQty}
                        onChange={(e) => setApplyRevQty(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#0b1b3d] rounded-xs cursor-pointer"
                      />
                      <span>Revision Count (e.g. 1, 2)</span>
                    </label>
                    {applyRevQty && (
                      <input
                        type="number"
                        min="0"
                        max="10"
                        placeholder="e.g. 1"
                        value={revisionQty}
                        onChange={(e) => setRevisionQty(e.target.value)}
                        className="w-full py-1 px-2.5 bg-slate-50 border border-slate-300 rounded-xs font-mono text-xs focus:border-blue-600 focus:outline-none"
                      />
                    )}
                  </div>

                  {/* Payment Status */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={applyPaymentStatus}
                        onChange={(e) => setApplyPaymentStatus(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#0b1b3d] rounded-xs cursor-pointer"
                      />
                      <span>Payment Status</span>
                    </label>
                    {applyPaymentStatus && (
                      <select
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value)}
                        className="w-full py-1 px-2.5 bg-slate-50 border border-slate-300 rounded-xs text-xs focus:border-blue-600 focus:outline-none"
                      >
                        <option value="">-- Select Status --</option>
                        <option value="Paid">Paid</option>
                        <option value="Pending">Pending</option>
                        <option value="Overdue">Overdue</option>
                        <option value="Waived">Waived</option>
                      </select>
                    )}
                  </div>

                  {/* Delivery Status */}
                  <div className="space-y-1">
                    <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={applyDeliveryStatus}
                        onChange={(e) => setApplyDeliveryStatus(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#0b1b3d] rounded-xs cursor-pointer"
                      />
                      <span>Delivery Status</span>
                    </label>
                    {applyDeliveryStatus && (
                      <select
                        value={deliveryStatus}
                        onChange={(e) => setDeliveryStatus(e.target.value)}
                        className="w-full py-1 px-2.5 bg-slate-50 border border-slate-300 rounded-xs text-xs focus:border-blue-600 focus:outline-none"
                      >
                        <option value="">-- Select Status --</option>
                        <option value="Production Complete">Production Complete</option>
                        <option value="Delivered">Delivered</option>
                        <option value="In Transit">In Transit</option>
                        <option value="Port Clearance">Port Clearance</option>
                        <option value="Dispatched">Dispatched</option>
                        <option value="Pending Dispatch">Pending Dispatch</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Footer Buttons */}
          {!isSuccess && (
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onApplyBatchUpdate(
                    selectedPIs.map((p) => p.id),
                    {
                      invoiceNumber: '',
                      tcRequestDate: '',
                      receivedCommercialDocDate: '',
                      draftTcDate: '',
                      draftConfirmationDate: '',
                      revisionQty: 0,
                      finalTcApplyDate: '',
                      finalTcReceivedDate: '',
                      tcNumber: '',
                      tcStatus: 'Not Requested',
                    }
                  );
                  setIsSuccess(true);
                  setTimeout(() => {
                    setIsSuccess(false);
                    onClose();
                  }, 1200);
                }}
                className="px-3 py-2 border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold uppercase rounded-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                title="Wipe out all workflow dates & invoice numbers from selected PIs"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Clear Cells ({selectedPIs.length} PIs)</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold uppercase rounded-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0b1b3d] hover:bg-[#152e5f] text-white text-xs font-bold uppercase tracking-wider rounded-xs transition-colors cursor-pointer shadow-xs inline-flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Apply Batch Update ({selectedPIs.length} PIs)</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
