import React, { useState, useMemo, useRef } from 'react';
import { PIData, TCStatus, computeAutomatedTcStatus } from '../types/tc';
import { BatchUpdateModal } from './BatchUpdateModal';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Pin,
  Zap,
} from 'lucide-react';

interface PendingAttentionTableProps {
  data: PIData[];
  onSelectPI: (pi: PIData) => void;
  selectedPiId?: string;
  onExport?: () => void;
  onSaveToGoogleSheets?: () => void;
  onBatchUpdatePIs?: (ids: string[], updates: Partial<PIData>) => void;
  isFullPage?: boolean;
}

type SortField =
  | 'orderDate'
  | 'piAgeDays'
  | 'piNumber'
  | 'buyer'
  | 'customer'
  | 'contactPerson'
  | 'orderQuantity'
  | 'deliveryQuantity'
  | 'balanceQuantity'
  | 'deliveryStatus'
  | 'tcRequestDate'
  | 'receivedCommercialDocDate'
  | 'draftTcDate'
  | 'draftConfirmationDate'
  | 'revisionQty'
  | 'finalTcApplyDate'
  | 'finalTcReceivedDate'
  | 'tcNumber'
  | 'tcStatus';

// Helper function to calculate exact Age in Days from Order Date to Today
export const calculatePiAgeDays = (orderDateStr: string, fallbackAge?: number): number => {
  if (!orderDateStr || orderDateStr === '-' || orderDateStr.trim() === '') {
    return fallbackAge || 0;
  }
  const orderDate = new Date(orderDateStr);
  if (isNaN(orderDate.getTime())) {
    return fallbackAge || 0;
  }
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const orderUtc = Date.UTC(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
  const diffDays = Math.floor((todayUtc - orderUtc) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : 0;
};

export const PendingAttentionTable: React.FC<PendingAttentionTableProps> = ({
  data,
  onSelectPI,
  selectedPiId,
  onExport,
  onSaveToGoogleSheets,
  onBatchUpdatePIs,
  isFullPage = false,
}) => {
  const [viewMode, setViewMode] = useState<'all' | 'not_requested' | 'attention' | 'completed'>('all');
  const [sortField, setSortField] = useState<SortField>('orderDate');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [tableSearch, setTableSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: 'left' | 'right' | 'start' | 'end') => {
    if (tableContainerRef.current) {
      if (direction === 'start') {
        tableContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      } else if (direction === 'end') {
        tableContainerRef.current.scrollTo({
          left: tableContainerRef.current.scrollWidth,
          behavior: 'smooth',
        });
      } else {
        const offset = direction === 'left' ? -380 : 380;
        tableContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
      }
    }
  };

  // Status Badge Renderer strictly based on automated status:
  // Not Requested → TC Requested → Commercial Doc Received → Draft TC Received → Draft Confirmed → Revision → Final TC Applied → Final TC Received
  const renderStatusBadge = (status: TCStatus) => {
    switch (status) {
      case 'Final TC Received':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
            <span>Final TC Received</span>
          </span>
        );
      case 'Final TC Applied':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-300">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" />
            <span>Final TC Applied</span>
          </span>
        );
      case 'Revision':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-400 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
            <span>Revision</span>
          </span>
        );
      case 'Draft Confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-300">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" />
            <span>Draft Confirmed</span>
          </span>
        );
      case 'Draft TC Received':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
            <span>Draft TC Received</span>
          </span>
        );
      case 'Commercial Doc Received':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[11px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 shrink-0" />
            <span>Commercial Doc Received</span>
          </span>
        );
      case 'TC Requested':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-300">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
            <span>TC Requested</span>
          </span>
        );
      case 'Overdue':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[11px] font-bold bg-red-50 text-red-700 border border-red-300 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
            <span>Overdue</span>
          </span>
        );
      case 'Not Requested':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
            <span>Not Requested</span>
          </span>
        );
    }
  };

  // Filter based on sub-tab
  const filteredData = useMemo(() => {
    let list = [...data];

    if (viewMode === 'not_requested') {
      list = list.filter((item) => computeAutomatedTcStatus(item) === 'Not Requested');
    } else if (viewMode === 'attention') {
      list = list.filter((item) => {
        const auto = computeAutomatedTcStatus(item);
        return auto !== 'Not Requested' && auto !== 'Final TC Received';
      });
    } else if (viewMode === 'completed') {
      list = list.filter((item) => computeAutomatedTcStatus(item) === 'Final TC Received');
    }

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter(
        (i) =>
          (i.piNumber && i.piNumber.toLowerCase().includes(q)) ||
          (i.invoiceNumber && i.invoiceNumber.toLowerCase().includes(q)) ||
          (i.tcNumber && i.tcNumber.toLowerCase().includes(q)) ||
          (i.buyer && i.buyer.toLowerCase().includes(q)) ||
          (i.customer && i.customer.toLowerCase().includes(q)) ||
          (i.contactPerson && i.contactPerson.toLowerCase().includes(q)) ||
          (i.standard && i.standard.toLowerCase().includes(q)) ||
          (i.deliveryStatus && i.deliveryStatus.toLowerCase().includes(q)) ||
          (i.orderDate && i.orderDate.toLowerCase().includes(q)) ||
          (i.tcRequestDate && i.tcRequestDate.toLowerCase().includes(q)) ||
          (i.receivedCommercialDocDate && i.receivedCommercialDocDate.toLowerCase().includes(q)) ||
          (i.draftTcDate && i.draftTcDate.toLowerCase().includes(q)) ||
          (i.draftConfirmationDate && i.draftConfirmationDate.toLowerCase().includes(q)) ||
          (i.finalTcApplyDate && i.finalTcApplyDate.toLowerCase().includes(q)) ||
          (i.finalTcReceivedDate && i.finalTcReceivedDate.toLowerCase().includes(q)) ||
          computeAutomatedTcStatus(i).toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      const getQty = (item: PIData, type: 'order' | 'deliv' | 'bal') => {
        const rawO = item.orderQuantity ?? item.quantityPcs ?? 0;
        let orderQ = rawO <= 1 ? 0 : rawO;
        const delivQ =
          orderQ === 0
            ? 0
            : item.deliveryQuantity !== undefined && item.deliveryQuantity > 1
            ? item.deliveryQuantity
            : item.deliveryStatus === 'Delivered'
            ? orderQ
            : item.deliveryStatus === 'In Transit'
            ? Math.floor(orderQ * 0.8)
            : 0;
        if (orderQ > 0 && orderQ - delivQ === 1) {
          orderQ = orderQ - 1;
        }
        const balQ = Math.max(0, orderQ - delivQ);
        if (type === 'order') return orderQ;
        if (type === 'deliv') return delivQ;
        return balQ;
      };

      let valA: any = a[sortField as keyof PIData] ?? '';
      let valB: any = b[sortField as keyof PIData] ?? '';

      if (sortField === 'piAgeDays') {
        valA = calculatePiAgeDays(a.orderDate, a.piAgeDays);
        valB = calculatePiAgeDays(b.orderDate, b.piAgeDays);
      } else if (sortField === 'orderQuantity') {
        valA = getQty(a, 'order');
        valB = getQty(b, 'order');
      } else if (sortField === 'deliveryQuantity') {
        valA = getQty(a, 'deliv');
        valB = getQty(b, 'deliv');
      } else if (sortField === 'balanceQuantity') {
        valA = getQty(a, 'bal');
        valB = getQty(b, 'bal');
      } else if (sortField === 'tcStatus') {
        valA = computeAutomatedTcStatus(a);
        valB = computeAutomatedTcStatus(b);
      }

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [data, viewMode, tableSearch, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const completedCount = data.filter((d) => {
    const auto = computeAutomatedTcStatus(d);
    const st = auto !== 'Not Requested' ? auto : d.tcStatus;
    return st === 'Final TC Received' || st === 'Issued';
  }).length;

  const inProgressCount = data.length - completedCount;

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />;
    }
    return sortAsc ? (
      <ArrowUp className="w-3 h-3 text-[#1e3a8a] font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#1e3a8a] font-bold" />
    );
  };

  const allFilteredIds = useMemo(() => filteredData.map((p) => p.id), [filteredData]);
  const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allFilteredIds);
    }
  };

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-sm shadow-xs overflow-hidden">
      {/* Batch Action Floating Header when rows selected */}
      {selectedIds.length > 0 && (
        <div className="bg-[#0b1b3d] text-white px-4 py-2 border-b border-blue-400/30 flex items-center justify-between gap-3 text-xs font-mono animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-blue-100 text-xs">
              ⚡ {selectedIds.length} PIs Selected
            </span>
            <span className="text-slate-400 text-[11px] hidden sm:inline">
              (Apply same Invoice Number or TC Dates at once)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBatchModalOpen(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-[11px] uppercase tracking-wider rounded-xs transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Batch Update ({selectedIds.length} PIs)</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-slate-300 hover:text-white px-2 py-1 text-xs font-sans hover:bg-white/10 rounded-xs transition-colors cursor-pointer"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Table Sub-Header Controls */}
      <div className="px-2 py-1 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-1.5 overflow-x-auto scrollbar-none">
        {/* Left: View Tabs */}
        <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-sm shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`px-2 py-0.5 text-xs font-semibold rounded-xs transition-colors cursor-pointer flex items-center gap-1 ${
              viewMode === 'all'
                ? 'bg-white text-[#0b1b3d] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>All PIs</span>
            <span className="font-mono text-[10px] bg-slate-100 text-slate-800 px-1 rounded-xs">
              {data.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('attention')}
            className={`px-2 py-0.5 text-xs font-semibold rounded-xs transition-colors cursor-pointer flex items-center gap-1 ${
              viewMode === 'attention'
                ? 'bg-white text-[#0b1b3d] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3 h-3 text-amber-600" />
            <span>TC In Progress</span>
            <span className="font-mono text-[10px] bg-amber-100 text-amber-900 px-1 rounded-xs">
              {inProgressCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('completed')}
            className={`px-2 py-0.5 text-xs font-semibold rounded-xs transition-colors cursor-pointer flex items-center gap-1 ${
              viewMode === 'completed'
                ? 'bg-white text-[#0b1b3d] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Final TC Received</span>
            <span className="font-mono text-[10px] bg-emerald-100 text-emerald-900 px-1 rounded-xs">
              {completedCount}
            </span>
          </button>
        </div>

        {/* Right Controls: Scroll Bar Helpers + Search + Export */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Scroll Navigation Toolbar */}
          <div className="flex items-center gap-0.5 bg-white border border-slate-300 rounded-sm p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => handleScroll('start')}
              className="p-0.5 text-slate-600 hover:text-[#0b1b3d] hover:bg-slate-100 rounded-xs transition-colors cursor-pointer"
              title="Scroll to Start (Left)"
            >
              <ChevronsLeft className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll('left')}
              className="p-0.5 text-slate-600 hover:text-[#0b1b3d] hover:bg-slate-100 rounded-xs transition-colors cursor-pointer flex items-center gap-0.5 text-[10px] font-semibold px-1"
              title="Scroll Left"
            >
              <ChevronLeft className="w-3 h-3" />
              <span className="hidden xl:inline">Scroll Left</span>
            </button>
            <div className="h-3 w-px bg-slate-200 mx-0.5" />
            <button
              type="button"
              onClick={() => handleScroll('right')}
              className="p-0.5 text-slate-600 hover:text-[#0b1b3d] hover:bg-slate-100 rounded-xs transition-colors cursor-pointer flex items-center gap-0.5 text-[10px] font-semibold px-1"
              title="Scroll Right"
            >
              <span className="hidden xl:inline">Scroll Right</span>
              <ChevronRight className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => handleScroll('end')}
              className="p-0.5 text-slate-600 hover:text-[#0b1b3d] hover:bg-slate-100 rounded-xs transition-colors cursor-pointer"
              title="Scroll to End (Right / TC Status)"
            >
              <ChevronsRight className="w-3 h-3" />
            </button>
          </div>

          {/* In-Table Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search PI, Inv #, TC #..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="py-0.5 px-2 text-xs bg-white border border-slate-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#0b1b3d] w-36 sm:w-44"
            />
            {tableSearch && (
              <button
                type="button"
                onClick={() => setTableSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {onSaveToGoogleSheets && (
            <button
              type="button"
              onClick={onSaveToGoogleSheets}
              className="flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-sm shadow-2xs transition-colors cursor-pointer"
              title="Save & Sync to Google Sheets"
            >
              <FileSpreadsheet className="w-3 h-3 text-emerald-700" />
              <span className="hidden sm:inline">Google Sheets</span>
            </button>
          )}

          {onExport && (
            <button
              type="button"
              onClick={onExport}
              className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-sm transition-colors cursor-pointer"
              title="Export CSV"
            >
              <span>CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table View with Scrollbar & Frozen Headers + Frozen Columns (Left: Date, PI No | Right: TC Status) */}
      <div
        ref={tableContainerRef}
        className={`overflow-x-auto overflow-y-auto table-scrollbar relative border-b border-slate-200 ${
          isFullPage
            ? 'h-[calc(100vh-215px)] max-h-[calc(100vh-215px)] min-h-[420px]'
            : 'max-h-[calc(100vh-220px)] min-h-[460px]'
        }`}
      >
        <table className="w-full text-left border-collapse min-w-[1780px]">
          <thead className="sticky top-0 z-30 shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
            <tr className="bg-[#0b1b3d] text-white text-[10px] font-bold uppercase tracking-wider select-none">
              {/* 0. CHECKBOX - FROZEN TOP & LEFT */}
              <th className="py-1.5 px-2 text-center border-r border-[#1a386b] whitespace-nowrap sticky top-0 left-0 z-40 bg-[#0b1b3d] w-9 shadow-[2px_2px_4px_-1px_rgba(0,0,0,0.25)]">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="w-3.5 h-3.5 accent-blue-500 rounded-xs cursor-pointer"
                  title={isAllSelected ? 'Deselect All' : 'Select All Filtered PIs'}
                />
              </th>

              {/* 1. ORDER DATE - FROZEN TOP & LEFT */}
              <th
                onClick={() => handleSort('orderDate')}
                className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 left-[36px] z-40 bg-[#0b1b3d] shadow-[2px_2px_4px_-1px_rgba(0,0,0,0.25)]"
              >
                <div className="flex items-center gap-1">
                  <span>Order Date</span>
                  {renderSortIcon('orderDate')}
                </div>
              </th>

              {/* 2. AGE (DAYS) - FROZEN TOP & LEFT */}
              <th
                onClick={() => handleSort('piAgeDays')}
                className="py-1.5 px-2 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap text-center sticky top-0 left-[125px] z-40 bg-[#0b1b3d] shadow-[2px_2px_4px_-1px_rgba(0,0,0,0.25)]"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Age (Days)</span>
                  {renderSortIcon('piAgeDays')}
                </div>
              </th>

              {/* 3. PI NO - FROZEN TOP & LEFT */}
              <th
                onClick={() => handleSort('piNumber')}
                className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 left-[205px] z-40 bg-[#0b1b3d] shadow-[4px_2px_6px_-2px_rgba(0,0,0,0.25)]"
              >
                <div className="flex items-center gap-1">
                  <span>PI No</span>
                  {renderSortIcon('piNumber')}
                </div>
              </th>

              {/* 3.5. INVOICE NUMBER - FROZEN TOP */}
              <th
                onClick={() => handleSort('invoiceNumber' as any)}
                className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
              >
                <div className="flex items-center gap-1">
                  <span>Invoice Number</span>
                  {renderSortIcon('invoiceNumber' as any)}
                </div>
              </th>

              {/* 4. BUYER - FROZEN TOP */}
              <th
                onClick={() => handleSort('buyer')}
                className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
              >
                <div className="flex items-center gap-1">
                  <span>Buyer</span>
                  {renderSortIcon('buyer')}
                </div>
              </th>

              {/* 5. CUSTOMER - FROZEN TOP */}
              <th
                onClick={() => handleSort('customer')}
                className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
              >
                <div className="flex items-center gap-1">
                  <span>Customer</span>
                  {renderSortIcon('customer')}
                </div>
              </th>

              {/* 6. CONTACT PERSON - FROZEN TOP */}
              <th
                onClick={() => handleSort('contactPerson')}
                className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
              >
                <div className="flex items-center gap-1">
                  <span>Contact Person</span>
                  {renderSortIcon('contactPerson')}
                </div>
              </th>

              {/* 7. ORDER QUANTITY - FROZEN TOP */}
              <th
                onClick={() => handleSort('orderQuantity')}
                className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap text-right sticky top-0 z-30 bg-[#0b1b3d]"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Order Qty</span>
                  {renderSortIcon('orderQuantity')}
                </div>
              </th>

              {/* 8. DELIVERY QUANTITY - FROZEN TOP */}
              <th
                onClick={() => handleSort('deliveryQuantity')}
                className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap text-right sticky top-0 z-30 bg-[#0b1b3d]"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Delivery Qty</span>
                  {renderSortIcon('deliveryQuantity')}
                </div>
              </th>

              {/* 9. BALANCE QUANTITY - FROZEN TOP */}
              <th
                onClick={() => handleSort('balanceQuantity')}
                className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap text-right sticky top-0 z-30 bg-[#0b1b3d]"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Balance Qty</span>
                  {renderSortIcon('balanceQuantity')}
                </div>
              </th>

              {/* 10. DELIVERY STATUS - FROZEN TOP */}
              <th
                onClick={() => handleSort('deliveryStatus')}
                className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
              >
                <div className="flex items-center gap-1">
                  <span>Delivery Status</span>
                  {renderSortIcon('deliveryStatus')}
                </div>
              </th>

              {/* 9. TC REQUEST DATE - FROZEN TOP */}
              <th
                onClick={() => handleSort('tcRequestDate')}
                className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
              >
                <div className="flex items-center gap-1">
                  <span>TC Request Date</span>
                  {renderSortIcon('tcRequestDate')}
                </div>
              </th>

              {/* 10. RECEIVED COMMERCIAL DOC DATE - FROZEN TOP */}
              <th
                onClick={() => handleSort('receivedCommercialDocDate')}
                className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
              >
                <div className="flex items-center gap-1">
                  <span>Rec Comm Doc Date</span>
                  {renderSortIcon('receivedCommercialDocDate')}
                </div>
              </th>

              {/* 11. DRAFT TC DATE - FROZEN TOP */}
              <th
                onClick={() => handleSort('draftTcDate')}
                className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
              >
                <div className="flex items-center gap-1">
                  <span>Draft TC Date</span>
                  {renderSortIcon('draftTcDate')}
                </div>
              </th>

              {/* 12. DRAFT CONFIRMATION DATE - FROZEN TOP */}
              <th
                onClick={() => handleSort('draftConfirmationDate')}
                className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
              >
                <div className="flex items-center gap-1">
                  <span>Draft Confirm Date</span>
                  {renderSortIcon('draftConfirmationDate')}
                </div>
              </th>

              {/* 13. REVISION QTY - FROZEN TOP */}
              <th
                onClick={() => handleSort('revisionQty')}
                className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap text-right sticky top-0 z-30 bg-[#0b1b3d]"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Revision Qty</span>
                  {renderSortIcon('revisionQty')}
                </div>
              </th>

              {/* 14. FINAL TC APPLY DATE - FROZEN TOP */}
              <th
                onClick={() => handleSort('finalTcApplyDate')}
                className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
              >
                <div className="flex items-center gap-1">
                  <span>Final TC Apply Date</span>
                  {renderSortIcon('finalTcApplyDate')}
                </div>
              </th>

              {/* 15. FINAL TC RECEIVED DATE - FROZEN TOP */}
              <th
                onClick={() => handleSort('finalTcReceivedDate')}
                className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
              >
                <div className="flex items-center gap-1">
                  <span>Final TC Rec Date</span>
                  {renderSortIcon('finalTcReceivedDate')}
                </div>
              </th>

              {/* 16. TC NUMBER - FROZEN TOP */}
              <th
                onClick={() => handleSort('tcNumber')}
                className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
              >
                <div className="flex items-center gap-1">
                  <span>TC Number</span>
                  {renderSortIcon('tcNumber')}
                </div>
              </th>

              {/* 17. TC STATUS (Auto Determined) - FROZEN TOP & RIGHT */}
              <th
                onClick={() => handleSort('tcStatus')}
                className="py-1.5 px-3 cursor-pointer hover:bg-[#132c5e] transition-colors whitespace-nowrap sticky top-0 right-0 z-40 bg-[#0b1b3d] shadow-[-6px_2px_10px_-2px_rgba(0,0,0,0.35)] border-l border-[#1a386b]"
              >
                <div className="flex items-center justify-between gap-1 min-w-[140px]">
                  <div className="flex items-center gap-1">
                    <Pin className="w-3 h-3 text-blue-300" />
                    <span>TC Status (Auto)</span>
                  </div>
                  {renderSortIcon('tcStatus')}
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 text-xs">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={19} className="py-8 text-center text-slate-500 bg-slate-50/50">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <CheckCircle2 className="w-6 h-6 text-slate-400" />
                    <span className="font-semibold text-slate-700">No PIs match the selected view criteria</span>
                    <span className="text-[11px] text-slate-400">Try adjusting your filters above</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredData.map((pi, idx) => {
                const isSelected = selectedPiId === pi.id;
                const isBatchSelected = selectedIds.includes(pi.id);
                const autoStatus = computeAutomatedTcStatus(pi);
                const currentStatus = autoStatus !== 'Not Requested' ? autoStatus : (pi.tcStatus || 'Not Requested');

                const rawOrderQ = pi.orderQuantity ?? pi.quantityPcs ?? 0;
                let orderQ = rawOrderQ <= 1 ? 0 : rawOrderQ;
                const delivQ =
                  orderQ === 0
                    ? 0
                    : pi.deliveryQuantity !== undefined && pi.deliveryQuantity > 1
                    ? pi.deliveryQuantity
                    : pi.deliveryStatus === 'Delivered'
                    ? orderQ
                    : pi.deliveryStatus === 'In Transit'
                    ? Math.floor(orderQ * 0.8)
                    : 0;
                // Rule: If balance is 1, subtract 1 from Order Qty so Balance becomes 0
                if (orderQ > 0 && orderQ - delivQ === 1) {
                  orderQ = orderQ - 1;
                }
                const balQ = Math.max(0, orderQ - delivQ);

                return (
                  <tr
                    key={pi.id}
                    onClick={() => onSelectPI(pi)}
                    className={`transition-colors cursor-pointer group ${
                      isBatchSelected
                        ? 'bg-blue-100/70 hover:bg-blue-100 font-medium'
                        : isSelected
                        ? 'bg-blue-50/80 hover:bg-blue-100/80 font-medium'
                        : idx % 2 === 0
                        ? 'bg-white hover:bg-slate-50'
                        : 'bg-[#fafbfc] hover:bg-slate-50'
                    }`}
                  >
                    {/* 0. CHECKBOX - FROZEN LEFT */}
                    <td
                      className="py-1.5 px-2 text-center border-r border-slate-100 sticky left-0 z-10 bg-inherit w-9 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isBatchSelected}
                        onChange={(e) => toggleSelectRow(pi.id, e as any)}
                        className="w-3.5 h-3.5 accent-[#0b1b3d] rounded-xs cursor-pointer"
                      />
                    </td>

                    {/* 1. ORDER DATE - FROZEN LEFT */}
                    <td className="py-1.5 px-2.5 font-mono font-medium text-slate-800 whitespace-nowrap tabular-nums border-r border-slate-100 sticky left-[36px] z-10 bg-inherit shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                      <span>{pi.orderDate}</span>
                    </td>

                    {/* 2. AGE (DAYS) - FROZEN LEFT */}
                    <td className="py-1.5 px-2 text-center font-mono font-medium whitespace-nowrap tabular-nums border-r border-slate-100 sticky left-[125px] z-10 bg-inherit shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                      {(() => {
                        const calculatedDays = calculatePiAgeDays(pi.orderDate, pi.piAgeDays);
                        return (
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded-xs text-[10px] font-bold font-mono ${
                              calculatedDays >= 90
                                ? 'bg-red-100 text-red-800 border border-red-300'
                                : calculatedDays >= 40
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-slate-100 text-slate-700 border border-slate-300'
                            }`}
                          >
                            {calculatedDays} Days
                          </span>
                        );
                      })()}
                    </td>

                    {/* 3. PI NO - FROZEN LEFT */}
                    <td className="py-1.5 px-2.5 font-mono font-bold text-[#0b1b3d] whitespace-nowrap border-r border-slate-100 sticky left-[205px] z-10 bg-inherit shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)]">
                      <span className="group-hover:underline underline-offset-2">{pi.piNumber}</span>
                    </td>

                    {/* 3.5. INVOICE NUMBER */}
                    <td className="py-1.5 px-2.5 whitespace-nowrap border-r border-slate-100 font-mono text-slate-800 font-semibold">
                      {pi.invoiceNumber ? (
                        <span className="px-2 py-0.5 bg-blue-50 border border-blue-300 text-blue-950 rounded-xs text-[10px] font-bold inline-block shadow-2xs">
                          {pi.invoiceNumber}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 border border-dashed border-slate-300 text-slate-400 rounded-xs text-[9px] font-normal hover:border-blue-400 hover:text-blue-700 transition-colors">
                          + Add Inv #
                        </span>
                      )}
                    </td>

                    {/* 4. BUYER */}
                    <td className="py-1.5 px-2.5 font-semibold text-slate-900 whitespace-nowrap border-r border-slate-100">
                      {pi.buyer}
                    </td>

                    {/* 5. CUSTOMER */}
                    <td className="py-1.5 px-2.5 text-slate-700 whitespace-nowrap border-r border-slate-100 truncate max-w-[180px]">
                      {pi.customer}
                    </td>

                    {/* 6. CONTACT PERSON */}
                    <td className="py-1.5 px-2.5 font-medium text-slate-800 whitespace-nowrap border-r border-slate-100">
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.2 rounded-xs text-[10px]">
                        {pi.contactPerson || 'System'}
                      </span>
                    </td>

                    {/* 7. ORDER QUANTITY */}
                    <td className="py-1.5 px-2.5 font-mono text-right text-slate-900 font-semibold whitespace-nowrap tabular-nums border-r border-slate-100">
                      {orderQ.toLocaleString()}
                    </td>

                    {/* 8. DELIVERY QUANTITY */}
                    <td className="py-1.5 px-2.5 font-mono text-right text-emerald-800 font-medium whitespace-nowrap tabular-nums border-r border-slate-100">
                      {delivQ.toLocaleString()}
                    </td>

                    {/* 9. BALANCE QUANTITY */}
                    <td className="py-1.5 px-2.5 font-mono text-right whitespace-nowrap tabular-nums border-r border-slate-100">
                      <span
                        className={`font-semibold ${
                          balQ > 0 ? 'text-amber-800' : 'text-slate-400'
                        }`}
                      >
                        {balQ.toLocaleString()}
                      </span>
                    </td>

                    {/* 10. DELIVERY STATUS */}
                    <td className="py-1.5 px-2.5 whitespace-nowrap border-r border-slate-100">
                      <span className="font-medium text-slate-800 text-[10px]">
                        {pi.deliveryStatus}
                      </span>
                    </td>

                    {/* 11. TC REQUEST DATE */}
                    <td className="py-1.5 px-2.5 font-mono text-slate-700 whitespace-nowrap border-r border-slate-100">
                      {pi.tcRequestDate || <span className="text-slate-300">-</span>}
                    </td>

                    {/* 10. RECEIVED COMMERCIAL DOC DATE */}
                    <td className="py-1.5 px-2.5 font-mono text-slate-700 whitespace-nowrap border-r border-slate-100">
                      {pi.receivedCommercialDocDate || <span className="text-slate-300">-</span>}
                    </td>

                    {/* 11. DRAFT TC DATE */}
                    <td className="py-1.5 px-2.5 font-mono text-slate-700 whitespace-nowrap border-r border-slate-100">
                      {pi.draftTcDate || <span className="text-slate-300">-</span>}
                    </td>

                    {/* 12. DRAFT CONFIRMATION DATE */}
                    <td className="py-1.5 px-2.5 font-mono text-slate-700 whitespace-nowrap border-r border-slate-100">
                      {pi.draftConfirmationDate || <span className="text-slate-300">-</span>}
                    </td>

                    {/* 13. REVISION QTY */}
                    <td className="py-1.5 px-2.5 font-mono text-right whitespace-nowrap tabular-nums border-r border-slate-100">
                      {pi.revisionQty && pi.revisionQty > 0 ? (
                        <span className="font-bold text-amber-900 bg-amber-50 px-1 rounded-xs">
                          {pi.revisionQty.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* 14. FINAL TC APPLY DATE */}
                    <td className="py-1.5 px-2.5 font-mono text-slate-700 whitespace-nowrap border-r border-slate-100">
                      {pi.finalTcApplyDate || <span className="text-slate-300">-</span>}
                    </td>

                    {/* 15. FINAL TC RECEIVED DATE */}
                    <td className="py-1.5 px-2.5 font-mono text-emerald-800 font-semibold whitespace-nowrap border-r border-slate-100">
                      {pi.finalTcReceivedDate || <span className="text-slate-300">-</span>}
                    </td>

                    {/* 16. TC NUMBER */}
                    <td className="py-1.5 px-2.5 font-mono font-bold text-[#0b1b3d] whitespace-nowrap border-r border-slate-100">
                      {pi.tcNumber ? (
                        <span className="bg-blue-50 text-blue-900 px-1.5 py-0.5 rounded-xs border border-blue-200">
                          {pi.tcNumber}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* 17. TC STATUS (Auto Determined) - FROZEN / STICKY RIGHT */}
                    <td
                      className={`py-1.5 px-3 whitespace-nowrap sticky right-0 z-10 border-l border-slate-200 shadow-[-6px_0_10px_-2px_rgba(0,0,0,0.08)] ${
                        isSelected
                          ? 'bg-blue-100'
                          : idx % 2 === 0
                          ? 'bg-white group-hover:bg-slate-50'
                          : 'bg-[#fafbfc] group-hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 min-w-[140px]">
                        {renderStatusBadge(currentStatus)}
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#1e3a8a] transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {filteredData.length > 0 && (() => {
            const totals = filteredData.reduce(
              (acc, item) => {
                const rawOrderQ = item.orderQuantity ?? item.quantityPcs ?? 0;
                let orderQ = rawOrderQ <= 1 ? 0 : rawOrderQ;
                const delivQ =
                  orderQ === 0
                    ? 0
                    : item.deliveryQuantity !== undefined && item.deliveryQuantity > 1
                    ? item.deliveryQuantity
                    : item.deliveryStatus === 'Delivered'
                    ? orderQ
                    : item.deliveryStatus === 'In Transit'
                    ? Math.floor(orderQ * 0.8)
                    : 0;

                // Rule: If balance is 1, subtract 1 from order quantity
                if (orderQ > 0 && orderQ - delivQ === 1) {
                  orderQ = orderQ - 1;
                }
                const balQ = Math.max(0, orderQ - delivQ);

                acc.totalOrder += orderQ;
                acc.totalDeliv += delivQ;
                acc.totalBal += balQ;
                acc.totalCost += item.tcCost;
                if (item.revisionQty) acc.totalRev += item.revisionQty;
                return acc;
              },
              { totalOrder: 0, totalDeliv: 0, totalBal: 0, totalCost: 0, totalRev: 0 }
            );

            return (
              <tfoot className="bg-[#0b1b3d] text-white font-mono text-[10px] font-bold border-t-2 border-[#132c5e] sticky bottom-0 z-30 shadow-[0_-2px_6px_rgba(0,0,0,0.25)]">
                <tr>
                  <td colSpan={6} className="py-1.5 px-2.5 uppercase tracking-wider text-left border-r border-[#1a386b] sticky bottom-0 left-0 z-40 bg-[#0b1b3d] shadow-[2px_-2px_4px_rgba(0,0,0,0.25)]">
                    TOTAL SUMMARY ({filteredData.length} PIs)
                  </td>
                  {/* 5. Total Order Quantity */}
                  <td className="py-1.5 px-2.5 text-right tabular-nums text-white border-r border-[#1a386b]">
                    {totals.totalOrder.toLocaleString()}
                  </td>
                  {/* 6. Total Delivery Quantity */}
                  <td className="py-1.5 px-2.5 text-right tabular-nums text-emerald-300 border-r border-[#1a386b]">
                    {totals.totalDeliv.toLocaleString()}
                  </td>
                  {/* 7. Total Balance Quantity */}
                  <td className="py-1.5 px-2.5 text-right tabular-nums text-amber-300 border-r border-[#1a386b]">
                    {totals.totalBal.toLocaleString()}
                  </td>
                  {/* 8. Delivery Status */}
                  <td className="py-1.5 px-2.5 border-r border-[#1a386b] text-center text-slate-400 font-sans text-[10px]">
                    -
                  </td>
                  {/* 8.5. Invoice Number */}
                  <td className="py-1.5 px-2.5 border-r border-[#1a386b] text-center text-slate-400 font-sans text-[10px]">
                    -
                  </td>
                  {/* 9, 10, 11, 12 */}
                  <td colSpan={4} className="py-1.5 px-2.5 border-r border-[#1a386b] text-center text-slate-400 font-sans text-[10px]">
                    Workflow Stages
                  </td>
                  {/* 13. Total Revision Qty */}
                  <td className="py-1.5 px-2.5 text-right tabular-nums text-amber-300 border-r border-[#1a386b]">
                    {totals.totalRev > 0 ? totals.totalRev.toLocaleString() : '-'}
                  </td>
                  {/* 14, 15, 16 */}
                  <td colSpan={3} className="py-1.5 px-2.5 text-right text-slate-300 font-sans text-[10px] border-r border-[#1a386b]">
                    Auto Determined Status
                  </td>
                  {/* 17. TC Status Footer - FROZEN BOTTOM & RIGHT */}
                  <td className="py-1.5 px-3 text-right font-mono text-[10px] text-emerald-300 font-bold whitespace-nowrap sticky bottom-0 right-0 z-40 bg-[#0b1b3d] border-l border-[#1a386b] shadow-[-6px_-2px_10px_-2px_rgba(0,0,0,0.35)]">
                    Live Status Frozen
                  </td>
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>

      {/* Table Footer Bar */}
      <div className="p-1.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-1.5">
        <div className="flex items-center gap-2 text-[10px]">
          <span>Showing <strong className="text-slate-800">{filteredData.length}</strong> records</span>
          <span>·</span>
          <span>Scroll horizontally or use arrow buttons to explore all 19 columns</span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span>
            Total Order Qty:{' '}
            <strong className="text-slate-900">
              {filteredData
                .reduce((acc, i) => {
                  const rawOrderQ = i.orderQuantity ?? i.quantityPcs ?? 0;
                  let orderQ = rawOrderQ <= 1 ? 0 : rawOrderQ;
                  const delivQ =
                    orderQ === 0
                      ? 0
                      : i.deliveryQuantity !== undefined && i.deliveryQuantity > 1
                      ? i.deliveryQuantity
                      : i.deliveryStatus === 'Delivered'
                      ? orderQ
                      : i.deliveryStatus === 'In Transit'
                      ? Math.floor(orderQ * 0.8)
                      : 0;
                  if (orderQ > 0 && orderQ - delivQ === 1) {
                    orderQ = orderQ - 1;
                  }
                  return acc + orderQ;
                }, 0)
                .toLocaleString()}
            </strong>
          </span>
          <span>·</span>
          <span>
            Total TC Cost:{' '}
            <strong className="text-[#0b1b3d]">
              ${filteredData.reduce((acc, i) => acc + i.tcCost, 0).toLocaleString()} USD
            </strong>
          </span>
        </div>
      </div>

      {/* Batch / Bulk Update Modal */}
      <BatchUpdateModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        selectedPIs={data.filter((p) => selectedIds.includes(p.id))}
        onApplyBatchUpdate={(ids, updates) => {
          if (onBatchUpdatePIs) {
            onBatchUpdatePIs(ids, updates);
          }
          setSelectedIds([]);
        }}
      />
    </div>
  );
};
