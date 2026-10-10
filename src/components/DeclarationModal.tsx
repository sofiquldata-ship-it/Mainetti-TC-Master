import React, { useState, useMemo } from 'react';
import { PIData, computeAutomatedTcStatus } from '../types/tc';
import {
  X,
  Clock,
  AlertTriangle,
  Search,
  Download,
  Copy,
  Check,
  CheckCircle2,
  Package,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';

interface DeclarationModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PIData[];
  onSelectPI?: (pi: PIData) => void;
}

export const DeclarationModal: React.FC<DeclarationModalProps> = ({
  isOpen,
  onClose,
  data,
  onSelectPI,
}) => {
  const [activeTab, setActiveTab] = useState<'90' | '180'>('90');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedPIS, setCopiedPIS] = useState<boolean>(false);

  // Helper to calculate days from date to today
  const getDaysFromDate = (dateStr?: string): number => {
    if (!dateStr) return 0;
    try {
      const targetTime = new Date(dateStr).getTime();
      if (isNaN(targetTime)) return 0;
      const today = new Date().getTime();
      const diffMs = today - targetTime;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    } catch {
      return 0;
    }
  };

  // Base calculation with STRICT rule:
  // ONLY Invoice Date is considered. Final TC Received / Issued orders are excluded.
  const categorizedData = useMemo(() => {
    const list90to179: (PIData & { daysOver: number; effectiveStatus: string })[] = [];
    const list180plus: (PIData & { daysOver: number; effectiveStatus: string })[] = [];

    data.forEach((item) => {
      const autoStatus = computeAutomatedTcStatus(item);
      const effectiveStatus = autoStatus !== 'Not Requested' ? autoStatus : (item.tcStatus || 'Not Requested');
      const isFinalIssued =
        effectiveStatus === 'Final TC Received' ||
        effectiveStatus === 'Issued' ||
        Boolean(item.finalTcReceivedDate);

      if (isFinalIssued) return;

      const invoiceDate = item.invoiceDate ? String(item.invoiceDate).trim() : '';
      if (!invoiceDate) return;

      const daysOver = getDaysFromDate(invoiceDate);

      // STRICT USER RULE:
      // Orders that cross 180 days are ONLY in 180 days declaration, NOT in 90 days declaration!
      if (daysOver > 180) {
        list180plus.push({
          ...item,
          daysOver,
          effectiveStatus,
        });
      } else if (daysOver > 90) {
        list90to179.push({
          ...item,
          daysOver,
          effectiveStatus,
        });
      }
    });

    list90to179.sort((a, b) => b.daysOver - a.daysOver);
    list180plus.sort((a, b) => b.daysOver - a.daysOver);

    return {
      list90to179,
      list180plus,
    };
  }, [data]);

  const activeList = useMemo(() => {
    const source = activeTab === '180' ? categorizedData.list180plus : categorizedData.list90to179;
    if (!searchQuery.trim()) return source;
    const q = searchQuery.toLowerCase().trim();
    return source.filter((item) => {
      const model = item.model || (item.productItems && item.productItems[0]?.modelProduct) || item.productDescription || '';
      return (
        item.piNumber.toLowerCase().includes(q) ||
        (item.invoiceNumber && item.invoiceNumber.toLowerCase().includes(q)) ||
        (item.lastChallanNumber && item.lastChallanNumber.toLowerCase().includes(q)) ||
        model.toLowerCase().includes(q) ||
        item.buyer.toLowerCase().includes(q) ||
        item.customer.toLowerCase().includes(q)
      );
    });
  }, [activeTab, categorizedData, searchQuery]);

  // Aggregate totals for the active list
  const totals = useMemo(() => {
    return activeList.reduce(
      (acc, item) => {
        const orderQ = item.orderQuantity ?? item.quantityPcs ?? 0;
        const delivQ = item.deliveryQuantity ?? 0;
        acc.totalOrder += orderQ > 1 ? orderQ : 0;
        acc.totalDeliv += delivQ > 1 ? delivQ : 0;
        acc.totalCost += item.tcCost || 0;
        return acc;
      },
      { totalOrder: 0, totalDeliv: 0, totalCost: 0 }
    );
  }, [activeList]);

  // Export current list to CSV
  const handleExportCSV = () => {
    if (activeList.length === 0) return;
    const headers = [
      'PI Number',
      'Model',
      'Invoice Number',
      'Invoice Date',
      'Delivery Challan No',
      'Buyer',
      'Customer',
      'Order Qty',
      'Delivery Qty',
      'Days Over',
      'TC Status',
    ];

    const rows = activeList.map((item) => {
      const model = item.model || (item.productItems && item.productItems[0]?.modelProduct) || (item.productDescription !== 'TRANSACTION CERTIFICATE COST' ? item.productDescription : 'POLYBAGS');
      return [
        `"${item.piNumber}"`,
        `"${model}"`,
        `"${item.invoiceNumber || ''}"`,
        `"${item.invoiceDate || ''}"`,
        `"${item.lastChallanNumber || ''}"`,
        `"${item.buyer}"`,
        `"${item.customer}"`,
        item.orderQuantity ?? item.quantityPcs ?? 0,
        item.deliveryQuantity ?? 0,
        item.daysOver,
        `"${item.effectiveStatus}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Declaration_${activeTab}_Days_Over_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyPiNumbers = () => {
    if (activeList.length === 0) return;
    const text = activeList.map((p) => p.piNumber).join(', ');
    navigator.clipboard.writeText(text);
    setCopiedPIS(true);
    setTimeout(() => setCopiedPIS(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5">
      <div className="bg-white rounded-md shadow-2xl border border-slate-300 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#0b1b3d] text-white px-5 py-3.5 flex items-center justify-between border-b border-[#162d59]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-500/20 rounded-xs border border-blue-400/30">
              <Layers className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold tracking-wide flex items-center gap-2">
                <span>Declaration Orders Analysis Modal</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-900/80 text-blue-200 border border-blue-700/50">
                  90 Days & 180 Days Over
                </span>
              </h2>
              <p className="text-[11px] text-slate-300">
                Rule: Orders over 180 days are isolated to the 180 Days view only (not in 90 Days).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-sm hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher & Summary Bar */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-2 bg-slate-200/80 p-1 rounded-sm">
            <button
              type="button"
              onClick={() => setActiveTab('90')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === '90'
                  ? 'bg-[#0b1b3d] text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
              }`}
            >
              <Clock className={`w-3.5 h-3.5 ${activeTab === '90' ? 'text-amber-300' : 'text-amber-600'}`} />
              <span>90 Days Over (90-179D)</span>
              <span className={`px-1.5 py-0.2 text-[10px] font-mono rounded-xs font-bold ${
                activeTab === '90' ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 text-amber-900'
              }`}>
                {categorizedData.list90to179.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('180')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === '180'
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${activeTab === '180' ? 'text-white' : 'text-red-600'}`} />
              <span>180 Days Over (180D+ Critical)</span>
              <span className={`px-1.5 py-0.2 text-[10px] font-mono rounded-xs font-bold ${
                activeTab === '180' ? 'bg-white text-red-900' : 'bg-red-100 text-red-900'
              }`}>
                {categorizedData.list180plus.length}
              </span>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1 text-slate-600">
              <span className="text-[11px] text-slate-400 uppercase">Qualifying:</span>
              <strong className="text-slate-900 font-bold">{activeList.length} PIs</strong>
            </div>
            <div className="flex items-center gap-1 text-slate-600">
              <span className="text-[11px] text-slate-400 uppercase">Total Order:</span>
              <strong className="text-slate-900 font-bold">{totals.totalOrder.toLocaleString()} PCS</strong>
            </div>
            <div className="flex items-center gap-1 text-slate-600">
              <span className="text-[11px] text-slate-400 uppercase">Delivered:</span>
              <strong className="text-emerald-700 font-bold">{totals.totalDeliv.toLocaleString()} PCS</strong>
            </div>
          </div>
        </div>

        {/* Action Controls & Search Strip */}
        <div className="px-5 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search PI No, Model, Inv#, Challan, Buyer..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xs focus:bg-white focus:outline-none focus:border-blue-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyPiNumbers}
              className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xs border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Copy all PI numbers to clipboard"
            >
              {copiedPIS ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy PIs</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-2.5 py-1 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Export this modal table to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Modal Table Content */}
        <div className="flex-1 overflow-auto max-h-[58vh]">
          {activeList.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-70" />
              <p className="font-semibold text-slate-700 text-sm">
                No orders matching {activeTab === '180' ? '180+ Days Critical' : '90-179 Days Over'}
              </p>
              <p className="text-xs text-slate-400">
                All relevant orders are either resolved or within the acceptable delivery and TC window.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#0b1b3d] text-white text-[10px] font-bold uppercase tracking-wider sticky top-0 z-20">
                <tr>
                  <th className="py-2 px-2.5 border-r border-[#1a386b] text-center w-10">#</th>
                  <th className="py-2 px-2.5 border-r border-[#1a386b] whitespace-nowrap">PI Number</th>
                  <th className="py-2 px-2.5 border-r border-[#1a386b] whitespace-nowrap">Model</th>
                  <th className="py-2 px-2.5 border-r border-[#1a386b] whitespace-nowrap">Invoice No</th>
                  <th className="py-2 px-2.5 border-r border-[#1a386b] whitespace-nowrap">Invoice Date</th>
                  <th className="py-2 px-2.5 border-r border-[#1a386b] whitespace-nowrap">Challan No</th>
                  <th className="py-2 px-2.5 border-r border-[#1a386b] whitespace-nowrap">Buyer</th>
                  <th className="py-2 px-2.5 border-r border-[#1a386b] whitespace-nowrap">Customer</th>
                  <th className="py-2 px-2.5 border-r border-[#1a386b] whitespace-nowrap text-right">Order Qty</th>
                  <th className="py-2 px-2.5 border-r border-[#1a386b] whitespace-nowrap text-right">Delivery Qty</th>
                  <th className="py-2 px-2.5 border-r border-[#1a386b] whitespace-nowrap text-center">Days Over</th>
                  <th className="py-2 px-2.5 whitespace-nowrap text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {activeList.map((pi, idx) => {
                  const model =
                    pi.model ||
                    (pi.productItems && pi.productItems[0]?.modelProduct) ||
                    (pi.productDescription !== 'TRANSACTION CERTIFICATE COST'
                      ? pi.productDescription
                      : 'POLYBAGS');

                  const is180Plus = pi.daysOver > 180;

                  return (
                    <tr
                      key={pi.id}
                      onClick={() => onSelectPI && onSelectPI(pi)}
                      className={`hover:bg-blue-50/60 transition-colors cursor-pointer ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      <td className="py-2 px-2.5 border-r border-slate-100 text-center font-mono text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-100 font-mono font-bold text-[#0b1b3d]">
                        {pi.piNumber}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-100 font-mono text-slate-700 max-w-[150px] truncate" title={model}>
                        <span className="font-semibold text-slate-800">{model}</span>
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-100 font-mono text-slate-800">
                        {pi.invoiceNumber || '-'}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                        {pi.invoiceDate || '-'}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-100 font-mono">
                        {pi.lastChallanNumber ? (
                          <span className="font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded-xs border border-blue-200">
                            {pi.lastChallanNumber}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-100 font-semibold text-slate-900 whitespace-nowrap">
                        {pi.buyer}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-100 text-slate-700 max-w-[140px] truncate" title={pi.customer}>
                        {pi.customer}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-100 text-right font-mono font-semibold text-slate-900">
                        {(pi.orderQuantity ?? pi.quantityPcs ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-100 text-right font-mono font-semibold text-emerald-700">
                        {(pi.deliveryQuantity ?? 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-2.5 border-r border-slate-100 text-center whitespace-nowrap">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded-xs text-[10px] ${
                            is180Plus
                              ? 'bg-red-100 text-red-900 border border-red-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {pi.daysOver} Days Over
                        </span>
                      </td>
                      <td className="py-2 px-2.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectPI) onSelectPI(pi);
                          }}
                          className="px-2 py-0.5 text-[10px] font-bold text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded-xs transition-colors cursor-pointer"
                        >
                          Details →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Showing {activeList.length} orders in{' '}
              <strong className="text-slate-800">
                {activeTab === '180' ? '180+ Days Critical' : '90-179 Days Over'}
              </strong>{' '}
              category
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider bg-[#0b1b3d] hover:bg-[#162d59] text-white rounded-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
