import React, { useState, useMemo, useRef } from 'react';
import {
  PIData,
  TCStatus,
  computeAutomatedTcStatus,
  calculatePiAgeDays,
} from '../types/tc';
import { FilterBar } from './FilterBar';
import { BatchUpdateModal } from './BatchUpdateModal';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  AlertTriangle,
  FileQuestion,
  FileCheck2,
  FileSpreadsheet,
  Download,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Search,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

interface CommercialFollowUpViewProps {
  data: PIData[];
  filters: any;
  onFilterChange: (newFilters: any) => void;
  onResetFilters: () => void;
  availableCustomers: string[];
  availableBuyers: string[];
  onSelectPI: (pi: PIData) => void;
  selectedPiId?: string;
  onExportCSV?: () => void;
  onSaveToGoogleSheets?: () => void;
  onBatchUpdatePIs?: (ids: string[], updates: Partial<PIData>) => void;
  onUpdatePI?: (updatedPI: PIData) => void;
}

type SortField =
  | 'orderDate'
  | 'piAgeDays'
  | 'piNumber'
  | 'buyer'
  | 'customer'
  | 'orderQuantity'
  | 'deliveryQuantity'
  | 'deliveryStatus'
  | 'tcRequestDate'
  | 'daysPending'
  | 'receivedCommercialDocDate';

type FollowUpViewMode = 'waiting' | 'waiting_15plus' | 'no_tc_date' | 'received' | 'all';

/**
 * Calculates days passed since a given date string (e.g. YYYY-MM-DD)
 */
function getDaysSinceDate(dateStr?: string): number | null {
  if (!dateStr || !dateStr.trim()) return null;
  const target = new Date(dateStr.trim().replace(/\//g, '-'));
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffTime = nowMidnight - targetMidnight;
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * Calculates days between two date strings (e.g. TC Request Date -> Comm Doc Received Date)
 */
function getDaysBetween(startStr?: string, endStr?: string): number | null {
  if (!startStr || !startStr.trim() || !endStr || !endStr.trim()) return null;
  const start = new Date(startStr.trim().replace(/\//g, '-'));
  const end = new Date(endStr.trim().replace(/\//g, '-'));
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const diffTime = end.getTime() - start.getTime();
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

export const CommercialFollowUpView: React.FC<CommercialFollowUpViewProps> = ({
  data,
  filters,
  onFilterChange,
  onResetFilters,
  availableCustomers,
  availableBuyers,
  onSelectPI,
  selectedPiId,
  onExportCSV,
  onSaveToGoogleSheets,
  onBatchUpdatePIs,
  onUpdatePI,
}) => {
  // Default: only PIs with TC Request Date and document not received, sorted by most days pending first
  const [viewMode, setViewMode] = useState<FollowUpViewMode>('waiting');
  const [sortField, setSortField] = useState<SortField>('daysPending');
  const [sortAsc, setSortAsc] = useState<boolean>(false); // Descending by default (most days pending first)
  const [tableSearch, setTableSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [quickReceivedDate, setQuickReceivedDate] = useState<string>(new Date().toISOString().slice(0, 10));
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

  // 3 Summary counts computed from entire dataset:
  const counts = useMemo(() => {
    let waiting = 0;
    let waiting15Plus = 0;
    let noTcDate = 0;
    let received = 0;

    data.forEach((p) => {
      const hasTcRequest = !!(p.tcRequestDate && p.tcRequestDate.trim());
      const hasReceivedDoc = !!(p.receivedCommercialDocDate && p.receivedCommercialDocDate.trim());

      if (hasReceivedDoc) {
        received++;
      } else if (hasTcRequest) {
        waiting++;
        const days = getDaysSinceDate(p.tcRequestDate);
        if (days !== null && days >= 15) {
          waiting15Plus++;
        }
      } else {
        noTcDate++;
      }
    });

    return {
      waiting,
      waiting15Plus,
      noTcDate,
      received,
      total: data.length,
    };
  }, [data]);

  // Filter and sort the table records
  const filteredAndSortedData = useMemo(() => {
    let list = [...data];

    // 1. Apply View Mode Filter
    if (viewMode === 'waiting') {
      // PIs with TC Request Date and document not received
      list = list.filter(
        (p) =>
          p.tcRequestDate &&
          p.tcRequestDate.trim() !== '' &&
          (!p.receivedCommercialDocDate || p.receivedCommercialDocDate.trim() === '')
      );
    } else if (viewMode === 'waiting_15plus') {
      // PIs waiting 15+ days
      list = list.filter((p) => {
        if (!p.tcRequestDate || p.tcRequestDate.trim() === '') return false;
        if (p.receivedCommercialDocDate && p.receivedCommercialDocDate.trim() !== '') return false;
        const days = getDaysSinceDate(p.tcRequestDate);
        return days !== null && days >= 15;
      });
    } else if (viewMode === 'no_tc_date') {
      // PIs without TC request date
      list = list.filter(
        (p) =>
          (!p.tcRequestDate || p.tcRequestDate.trim() === '') &&
          (!p.receivedCommercialDocDate || p.receivedCommercialDocDate.trim() === '')
      );
    } else if (viewMode === 'received') {
      // PIs where document is received
      list = list.filter((p) => p.receivedCommercialDocDate && p.receivedCommercialDocDate.trim() !== '');
    }

    // 2. Table search filter
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.piNumber.toLowerCase().includes(q) ||
          i.buyer.toLowerCase().includes(q) ||
          i.customer.toLowerCase().includes(q) ||
          (i.invoiceNumber && i.invoiceNumber.toLowerCase().includes(q)) ||
          (i.deliveryStatus && i.deliveryStatus.toLowerCase().includes(q)) ||
          (i.tcRequestDate && i.tcRequestDate.toLowerCase().includes(q)) ||
          (i.receivedCommercialDocDate && i.receivedCommercialDocDate.toLowerCase().includes(q))
      );
    }

    // 3. Sorting
    list.sort((a, b) => {
      const getQty = (item: PIData, type: 'order' | 'deliv') => {
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
        return type === 'order' ? orderQ : delivQ;
      };

      let valA: any = a[sortField as keyof PIData] ?? '';
      let valB: any = b[sortField as keyof PIData] ?? '';

      if (sortField === 'daysPending') {
        const hasRecA = !!(a.receivedCommercialDocDate && a.receivedCommercialDocDate.trim());
        const hasRecB = !!(b.receivedCommercialDocDate && b.receivedCommercialDocDate.trim());
        const hasReqA = !!(a.tcRequestDate && a.tcRequestDate.trim());
        const hasReqB = !!(b.tcRequestDate && b.tcRequestDate.trim());

        valA = !hasReqA
          ? -999
          : hasRecA
          ? (getDaysBetween(a.tcRequestDate, a.receivedCommercialDocDate) ?? 0)
          : (getDaysSinceDate(a.tcRequestDate) ?? 0);

        valB = !hasReqB
          ? -999
          : hasRecB
          ? (getDaysBetween(b.tcRequestDate, b.receivedCommercialDocDate) ?? 0)
          : (getDaysSinceDate(b.tcRequestDate) ?? 0);
      } else if (sortField === 'piAgeDays') {
        valA = calculatePiAgeDays(a.orderDate, a.piAgeDays);
        valB = calculatePiAgeDays(b.orderDate, b.piAgeDays);
      } else if (sortField === 'orderQuantity') {
        valA = getQty(a, 'order');
        valB = getQty(b, 'order');
      } else if (sortField === 'deliveryQuantity') {
        valA = getQty(a, 'deliv');
        valB = getQty(b, 'deliv');
      }

      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
      }
      if (typeof valB === 'string') {
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
      // For daysPending default to descending (most days pending first)
      setSortAsc(field === 'daysPending' ? false : true);
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100" />;
    }
    return sortAsc ? (
      <ArrowUp className="w-3 h-3 text-blue-300 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-300 font-bold" />
    );
  };

  // Selection helpers
  const isAllSelected =
    filteredAndSortedData.length > 0 &&
    filteredAndSortedData.every((i) => selectedIds.includes(i.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAndSortedData.map((i) => i.id));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Quick mark selected PIs as Commercial Doc Received
  const handleMarkSelectedReceived = () => {
    if (selectedIds.length === 0) return;
    if (onBatchUpdatePIs) {
      onBatchUpdatePIs(selectedIds, {
        receivedCommercialDocDate: quickReceivedDate || new Date().toISOString().slice(0, 10),
      });
    }
    setSelectedIds([]);
  };

  // Single PI mark received
  const handleMarkSingleReceived = (pi: PIData, e: React.MouseEvent) => {
    e.stopPropagation();
    const todayStr = new Date().toISOString().slice(0, 10);
    const updated: PIData = {
      ...pi,
      receivedCommercialDocDate: todayStr,
      tcStatus: computeAutomatedTcStatus({ ...pi, receivedCommercialDocDate: todayStr }),
    };
    if (onUpdatePI) {
      onUpdatePI(updated);
    } else if (onBatchUpdatePIs) {
      onBatchUpdatePIs([pi.id], { receivedCommercialDocDate: todayStr });
    }
  };

  // Export Commercial Follow-up view to CSV
  const handleExportCommercialCSV = () => {
    if (filteredAndSortedData.length === 0) return;
    const headers = [
      'Order Date',
      'Age (Days)',
      'PI Number',
      'Buyer',
      'Customer',
      'Order Qty',
      'Delivery Qty',
      'Delivery Status',
      'TC Request Date',
      'Days Commercial Doc Not Received',
      'Comm. Doc Received Date',
      'TC Status',
    ];

    const rows = filteredAndSortedData.map((d) => {
      const rawO = d.orderQuantity ?? d.quantityPcs ?? 0;
      let orderQ = rawO <= 1 ? 0 : rawO;
      const delivQ =
        orderQ === 0
          ? 0
          : d.deliveryQuantity !== undefined && d.deliveryQuantity > 1
          ? d.deliveryQuantity
          : d.deliveryStatus === 'Delivered'
          ? orderQ
          : d.deliveryStatus === 'In Transit'
          ? Math.floor(orderQ * 0.8)
          : 0;

      const age = calculatePiAgeDays(d.orderDate, d.piAgeDays);
      const isReceived = !!(d.receivedCommercialDocDate && d.receivedCommercialDocDate.trim());
      const daysPending = isReceived
        ? 'Received'
        : d.tcRequestDate && d.tcRequestDate.trim()
        ? `${getDaysSinceDate(d.tcRequestDate) ?? '-'} Days`
        : '-';

      return [
        d.orderDate,
        age,
        `"${d.piNumber}"`,
        `"${d.buyer}"`,
        `"${d.customer}"`,
        orderQ,
        delivQ,
        `"${d.deliveryStatus}"`,
        d.tcRequestDate || '',
        daysPending,
        d.receivedCommercialDocDate || '',
        `"${computeAutomatedTcStatus(d)}"`,
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
      `Mainetti_Commercial_FollowUp_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Pure Day Count Badge renderer for "Doc Pending Days"
  const renderDaysCountBadge = (pi: PIData) => {
    // If NO TC Request Date:
    if (!pi.tcRequestDate || pi.tcRequestDate.trim() === '') {
      return <span className="text-slate-400 font-mono text-xs">-</span>;
    }

    // A. If document is ALREADY received: show the actual days it took
    if (pi.receivedCommercialDocDate && pi.receivedCommercialDocDate.trim() !== '') {
      const days = getDaysBetween(pi.tcRequestDate, pi.receivedCommercialDocDate);
      if (days !== null) {
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
            <span className="font-mono">{days}</span>
            <span>{days === 1 ? 'Day' : 'Days'}</span>
          </span>
        );
      }
      return <span className="text-emerald-700 font-mono text-xs font-semibold">Received</span>;
    }

    // B. Document is still pending: calculate days from tcRequestDate to today
    const days = getDaysSinceDate(pi.tcRequestDate);
    if (days === null) {
      return <span className="text-slate-400 font-mono text-xs">-</span>;
    }

    // 0-7 Days: Green
    if (days <= 7) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-mono">{days}</span>
          <span>{days === 1 ? 'Day' : 'Days'}</span>
        </span>
      );
    }

    // 8-14 Days: Amber
    if (days <= 14) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          <span className="font-mono">{days}</span>
          <span>Days</span>
        </span>
      );
    }

    // 15+ Days: Red & Action Required
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs text-[11px] font-bold bg-red-50 text-red-700 border border-red-300 animate-pulse shadow-2xs">
        <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
        <span className="font-mono">{days}</span>
        <span>Days</span>
        <span className="text-[9px] font-mono uppercase tracking-tight bg-red-200/80 text-red-900 px-1 rounded-xs">
          15+ Overdue
        </span>
      </span>
    );
  };

  // 2. Separate renderer for "Comm. Doc Received Date" column
  const renderCommDocStatusBadge = (pi: PIData) => {
    if (pi.receivedCommercialDocDate && pi.receivedCommercialDocDate.trim() !== '') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Received</span>
          <span className="text-[10px] font-mono text-emerald-700 font-normal">
            ({pi.receivedCommercialDocDate})
          </span>
        </span>
      );
    }

    if (pi.tcRequestDate && pi.tcRequestDate.trim() !== '') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
          <span>Waiting Document</span>
        </span>
      );
    }

    return <span className="text-slate-400 font-mono text-xs">-</span>;
  };

  // Calculate totals for footer
  const footerTotals = useMemo(() => {
    let totalOrder = 0;
    let totalDeliv = 0;
    let totalDaysPendingSum = 0;
    let waitingCount = 0;

    filteredAndSortedData.forEach((i) => {
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

      totalOrder += orderQ;
      totalDeliv += delivQ;

      if (
        i.tcRequestDate &&
        i.tcRequestDate.trim() &&
        (!i.receivedCommercialDocDate || !i.receivedCommercialDocDate.trim())
      ) {
        const d = getDaysSinceDate(i.tcRequestDate);
        if (d !== null) {
          totalDaysPendingSum += d;
          waitingCount++;
        }
      }
    });

    const avgDays = waitingCount > 0 ? (totalDaysPendingSum / waitingCount).toFixed(1) : '0';

    return {
      totalOrder,
      totalDeliv,
      totalBalance: Math.max(0, totalOrder - totalDeliv),
      avgDays,
      waitingCount,
    };
  }, [filteredAndSortedData]);

  return (
    <div className="space-y-1.5 flex flex-col">
      {/* 1. Reusable Filters Bar (Date, Customer, Buyer, Delivery, TC Status, Search) */}
      <FilterBar
        filters={filters}
        onFilterChange={onFilterChange}
        onReset={onResetFilters}
        totalResults={filteredAndSortedData.length}
        customers={availableCustomers}
        buyers={availableBuyers}
      />

      {/* 2. 3 Required Summary Chips + Quick Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-sm shadow-xs p-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Summary Chips (Clickable Quick Filters) */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Chip 1: Waiting for document (Default) */}
            <button
              type="button"
              onClick={() => setViewMode('waiting')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-semibold transition-all cursor-pointer border ${
                viewMode === 'waiting'
                  ? 'bg-blue-900 text-white border-blue-950 shadow-xs'
                  : 'bg-blue-50 text-blue-900 hover:bg-blue-100 border-blue-200'
              }`}
            >
              <Clock className={`w-4 h-4 ${viewMode === 'waiting' ? 'text-blue-200' : 'text-blue-700'}`} />
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] uppercase tracking-wider font-mono opacity-80">Follow-up</span>
                <span className="font-bold">Waiting for Document</span>
              </div>
              <span
                className={`font-mono text-xs px-1.5 py-0.5 rounded-xs font-bold ${
                  viewMode === 'waiting'
                    ? 'bg-blue-800 text-white'
                    : 'bg-blue-200 text-blue-950'
                }`}
              >
                {counts.waiting}
              </span>
            </button>

            {/* Chip 2: Waiting 15+ days (Urgent Red) */}
            <button
              type="button"
              onClick={() => setViewMode('waiting_15plus')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-semibold transition-all cursor-pointer border ${
                viewMode === 'waiting_15plus'
                  ? 'bg-red-800 text-white border-red-950 shadow-xs'
                  : 'bg-red-50 text-red-900 hover:bg-red-100 border-red-200'
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 ${viewMode === 'waiting_15plus' ? 'text-red-200' : 'text-red-600'} animate-pulse`}
              />
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] uppercase tracking-wider font-mono opacity-80">Critical Attention</span>
                <span className="font-bold">Waiting 15+ Days</span>
              </div>
              <span
                className={`font-mono text-xs px-1.5 py-0.5 rounded-xs font-bold ${
                  viewMode === 'waiting_15plus'
                    ? 'bg-red-900 text-white'
                    : 'bg-red-200 text-red-950'
                }`}
              >
                {counts.waiting15Plus}
              </span>
            </button>

            {/* Chip 3: No TC request date */}
            <button
              type="button"
              onClick={() => setViewMode('no_tc_date')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-semibold transition-all cursor-pointer border ${
                viewMode === 'no_tc_date'
                  ? 'bg-slate-800 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-300'
              }`}
            >
              <FileQuestion
                className={`w-4 h-4 ${viewMode === 'no_tc_date' ? 'text-slate-300' : 'text-slate-500'}`}
              />
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] uppercase tracking-wider font-mono opacity-80">Uninitiated</span>
                <span className="font-bold">No TC Request Date</span>
              </div>
              <span
                className={`font-mono text-xs px-1.5 py-0.5 rounded-xs font-bold ${
                  viewMode === 'no_tc_date'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-200 text-slate-800'
                }`}
              >
                {counts.noTcDate}
              </span>
            </button>

            {/* Chip 4: Document Received */}
            <button
              type="button"
              onClick={() => setViewMode('received')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-semibold transition-all cursor-pointer border ${
                viewMode === 'received'
                  ? 'bg-emerald-800 text-white border-emerald-950 shadow-xs'
                  : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border-emerald-200'
              }`}
            >
              <FileCheck2
                className={`w-3.5 h-3.5 ${viewMode === 'received' ? 'text-emerald-200' : 'text-emerald-700'}`}
              />
              <span>Doc Received</span>
              <span
                className={`font-mono text-xs px-1 rounded-xs ${
                  viewMode === 'received' ? 'bg-emerald-900 text-white' : 'bg-emerald-200 text-emerald-950'
                }`}
              >
                {counts.received}
              </span>
            </button>

            {/* Chip 5: All PIs */}
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-semibold transition-all cursor-pointer border ${
                viewMode === 'all'
                  ? 'bg-[#0b1b3d] text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-300'
              }`}
            >
              <span>All ({counts.total})</span>
            </button>
          </div>

          {/* Current view indicator & helper */}
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono ml-auto">
            <span className="hidden xl:inline text-[11px] text-slate-400">
              {viewMode === 'waiting'
                ? 'Showing PIs with TC Request Date & pending commercial doc'
                : viewMode === 'waiting_15plus'
                ? 'Showing critical PIs waiting 15+ days since TC Request'
                : viewMode === 'no_tc_date'
                ? 'Showing PIs without TC Request Date'
                : viewMode === 'received'
                ? 'Showing PIs where commercial document is received'
                : 'Showing all records in current filter'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Follow-up Grid Container */}
      <div className="bg-white border border-slate-200 rounded-sm shadow-xs overflow-hidden">
        {/* Bulk Selection Notification Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-[#0b1b3d] text-white px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-blue-900 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white font-mono text-xs px-2 py-0.5 rounded-xs font-bold">
                {selectedIds.length} Selected
              </span>
              <span className="text-xs text-slate-200">
                Bulk action on selected Commercial Follow-up records:
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-0.5 rounded-sm border border-slate-600 text-xs">
                <span className="text-[10px] text-slate-300 uppercase">Received Date:</span>
                <input
                  type="date"
                  value={quickReceivedDate}
                  onChange={(e) => setQuickReceivedDate(e.target.value)}
                  className="bg-slate-900 text-white text-xs px-1 py-0.5 rounded-xs border border-slate-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleMarkSelectedReceived}
                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xs transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Mark Received</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsBatchModalOpen(true)}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xs transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <Sparkles className="w-3 h-3 text-blue-200" />
                <span>Full Batch Edit</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-slate-300 hover:text-white px-2 py-1 text-xs hover:bg-white/10 rounded-xs transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Table Toolbar (Sub-Header) */}
        <div className="px-2.5 py-1.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
          {/* Left Title & Status */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#0b1b3d] text-xs uppercase font-mono tracking-tight">
                Commercial Follow-up Console
              </span>
              <span className="bg-slate-200 text-slate-800 font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-xs">
                {filteredAndSortedData.length} records
              </span>
            </div>
          </div>

          {/* Right Toolbar Controls: Navigation, In-Table Search, Google Sheets, CSV */}
          <div className="flex flex-wrap items-center gap-1.5 grow sm:grow-0 justify-end ml-auto">
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
                title="Scroll to End (Right)"
              >
                <ChevronsRight className="w-3 h-3" />
              </button>
            </div>

            {/* In-Table Search */}
            <div className="relative">
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search PI, Buyer, Customer..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="py-0.5 pl-6 pr-6 text-xs bg-white border border-slate-300 rounded-sm focus:outline-hidden focus:border-[#0b1b3d] w-36 sm:w-48"
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

            {/* Google Sheets Sync Button */}
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

            {/* CSV Export Button */}
            <button
              type="button"
              onClick={handleExportCommercialCSV}
              className="flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-sm transition-colors cursor-pointer shadow-2xs"
              title="Export Commercial Follow-up to CSV"
            >
              <Download className="w-3 h-3 text-slate-500" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* 4. Main Scrollable Table with Sticky Navy Header & Sticky Summary Footer */}
        <div
          ref={tableContainerRef}
          className="overflow-x-auto overflow-y-auto table-scrollbar relative border-b border-slate-200 h-[calc(100vh-250px)] max-h-[calc(100vh-250px)] min-h-[420px]"
        >
          <table className="w-full text-left border-collapse min-w-[1300px]">
            {/* Sticky Navy Header */}
            <thead className="sticky top-0 z-30 shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
              <tr className="bg-[#0b1b3d] text-white text-[10px] font-bold uppercase tracking-wider select-none">
                {/* 0. Checkbox */}
                <th className="py-1.5 px-2 text-center border-r border-[#1a386b] whitespace-nowrap sticky top-0 left-0 z-40 bg-[#0b1b3d] w-9 shadow-[2px_2px_4px_-1px_rgba(0,0,0,0.25)]">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 accent-blue-500 rounded-xs cursor-pointer"
                    title={isAllSelected ? 'Deselect All' : 'Select All PIs'}
                  />
                </th>

                {/* 1. ORDER DATE - Frozen Top & Left */}
                <th
                  onClick={() => handleSort('orderDate')}
                  className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 left-[36px] z-40 bg-[#0b1b3d] shadow-[2px_2px_4px_-1px_rgba(0,0,0,0.25)]"
                >
                  <div className="flex items-center gap-1">
                    <span>Order Date</span>
                    {renderSortIcon('orderDate')}
                  </div>
                </th>

                {/* 2. AGE (DAYS) */}
                <th
                  onClick={() => handleSort('piAgeDays')}
                  className="py-1.5 px-2 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap text-center sticky top-0 left-[125px] z-40 bg-[#0b1b3d] shadow-[2px_2px_4px_-1px_rgba(0,0,0,0.25)]"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Age (Days)</span>
                    {renderSortIcon('piAgeDays')}
                  </div>
                </th>

                {/* 3. PI NO - Frozen Top & Left */}
                <th
                  onClick={() => handleSort('piNumber')}
                  className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 left-[205px] z-40 bg-[#0b1b3d] shadow-[4px_2px_6px_-2px_rgba(0,0,0,0.25)]"
                >
                  <div className="flex items-center gap-1">
                    <span>PI No</span>
                    {renderSortIcon('piNumber')}
                  </div>
                </th>

                {/* 4. BUYER */}
                <th
                  onClick={() => handleSort('buyer')}
                  className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
                >
                  <div className="flex items-center gap-1">
                    <span>Buyer</span>
                    {renderSortIcon('buyer')}
                  </div>
                </th>

                {/* 5. CUSTOMER */}
                <th
                  onClick={() => handleSort('customer')}
                  className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
                >
                  <div className="flex items-center gap-1">
                    <span>Customer</span>
                    {renderSortIcon('customer')}
                  </div>
                </th>

                {/* 6. ORDER QTY */}
                <th
                  onClick={() => handleSort('orderQuantity')}
                  className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap text-right sticky top-0 z-30 bg-[#0b1b3d]"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Order Qty</span>
                    {renderSortIcon('orderQuantity')}
                  </div>
                </th>

                {/* 7. DELIVERY QTY */}
                <th
                  onClick={() => handleSort('deliveryQuantity')}
                  className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap text-right sticky top-0 z-30 bg-[#0b1b3d]"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Delivery Qty</span>
                    {renderSortIcon('deliveryQuantity')}
                  </div>
                </th>

                {/* 8. DELIVERY STATUS */}
                <th
                  onClick={() => handleSort('deliveryStatus')}
                  className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
                >
                  <div className="flex items-center gap-1">
                    <span>Delivery Status</span>
                    {renderSortIcon('deliveryStatus')}
                  </div>
                </th>

                {/* 9. TC REQUEST DATE (Read-only from TC Master) */}
                <th
                  onClick={() => handleSort('tcRequestDate')}
                  className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
                >
                  <div className="flex items-center gap-1">
                    <span>TC Request Date</span>
                    {renderSortIcon('tcRequestDate')}
                  </div>
                </th>

                {/* 10. DOC PENDING DAYS (Day Count Column) */}
                <th
                  onClick={() => handleSort('daysPending')}
                  className="py-1.5 px-3 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d] shadow-[-2px_0_4px_rgba(0,0,0,0.2)]"
                >
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-300" />
                    <span>Doc Pending Days</span>
                    {renderSortIcon('daysPending')}
                  </div>
                </th>

                {/* 11. DOC RECEIVED DATE / STATUS */}
                <th
                  onClick={() => handleSort('receivedCommercialDocDate')}
                  className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
                >
                  <div className="flex items-center gap-1">
                    <span>Doc Received Date</span>
                    {renderSortIcon('receivedCommercialDocDate')}
                  </div>
                </th>

                {/* 12. QUICK ACTION: MARK COMM. DOC RECEIVED */}
                <th className="py-1.5 px-2.5 text-center border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]">
                  <span>Action / Follow-up</span>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-200 text-xs font-mono">
              {filteredAndSortedData.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-500 bg-white">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileQuestion className="w-8 h-8 text-slate-400" />
                      <p className="font-semibold text-sm text-slate-700">No records found matching criteria</p>
                      <p className="text-xs text-slate-400">
                        {viewMode === 'waiting'
                          ? 'Great job! No pending commercial documents waiting on TC Request.'
                          : 'Try adjusting filters or view modes above.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedData.map((pi, idx) => {
                  const isSelected = selectedIds.includes(pi.id);
                  const isCurrentActive = selectedPiId === pi.id;
                  const rawO = pi.orderQuantity ?? pi.quantityPcs ?? 0;
                  let orderQ = rawO <= 1 ? 0 : rawO;
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

                  const age = calculatePiAgeDays(pi.orderDate, pi.piAgeDays);
                  const isDocReceived = !!(pi.receivedCommercialDocDate && pi.receivedCommercialDocDate.trim());

                  return (
                    <tr
                      key={pi.id}
                      onClick={() => onSelectPI(pi)}
                      className={`group hover:bg-blue-50/60 cursor-pointer transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      } ${isCurrentActive ? 'bg-blue-100/70 ring-1 ring-blue-500' : ''}`}
                    >
                      {/* 0. Checkbox */}
                      <td
                        onClick={(e) => toggleSelectOne(pi.id, e)}
                        className={`py-1.5 px-2 text-center border-r border-slate-200 sticky left-0 z-20 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'
                        } group-hover:bg-blue-50/90 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 accent-blue-600 rounded-xs cursor-pointer"
                        />
                      </td>

                      {/* 1. ORDER DATE - Frozen Left */}
                      <td
                        className={`py-1.5 px-2.5 text-slate-700 whitespace-nowrap border-r border-slate-200 sticky left-[36px] z-20 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'
                        } group-hover:bg-blue-50/90 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]`}
                      >
                        {pi.orderDate}
                      </td>

                      {/* 2. AGE (DAYS) */}
                      <td
                        className={`py-1.5 px-2 text-center whitespace-nowrap border-r border-slate-200 sticky left-[125px] z-20 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'
                        } group-hover:bg-blue-50/90 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]`}
                      >
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded-xs text-[11px] font-bold ${
                            age > 60
                              ? 'bg-slate-100 text-slate-700 border border-slate-300'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {age} Days
                        </span>
                      </td>

                      {/* 3. PI NO - Frozen Left */}
                      <td
                        className={`py-1.5 px-2.5 font-bold text-[#0b1b3d] whitespace-nowrap border-r border-slate-200 sticky left-[205px] z-20 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'
                        } group-hover:bg-blue-50/90 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.1)]`}
                      >
                        {pi.piNumber}
                      </td>

                      {/* 4. BUYER */}
                      <td className="py-1.5 px-2.5 text-slate-800 font-sans font-bold whitespace-nowrap border-r border-slate-200">
                        {pi.buyer}
                      </td>

                      {/* 5. CUSTOMER */}
                      <td className="py-1.5 px-2.5 text-slate-700 font-sans font-medium whitespace-nowrap border-r border-slate-200 max-w-[200px] truncate" title={pi.customer}>
                        {pi.customer}
                      </td>

                      {/* 6. ORDER QTY */}
                      <td className="py-1.5 px-2.5 text-right font-bold text-slate-900 whitespace-nowrap border-r border-slate-200 tabular-nums">
                        {orderQ.toLocaleString()}
                      </td>

                      {/* 7. DELIVERY QTY */}
                      <td className="py-1.5 px-2.5 text-right font-bold text-emerald-700 whitespace-nowrap border-r border-slate-200 tabular-nums">
                        {delivQ.toLocaleString()}
                      </td>

                      {/* 8. DELIVERY STATUS */}
                      <td className="py-1.5 px-2.5 whitespace-nowrap border-r border-slate-200">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-xs text-[10px] font-bold ${
                            pi.deliveryStatus === 'Delivered'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                              : pi.deliveryStatus === 'In Transit'
                              ? 'bg-blue-50 text-blue-800 border border-blue-300'
                              : 'bg-amber-50 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {pi.deliveryStatus || 'Pending'}
                        </span>
                      </td>

                      {/* 9. TC REQUEST DATE */}
                      <td className="py-1.5 px-2.5 text-slate-800 whitespace-nowrap border-r border-slate-200">
                        {pi.tcRequestDate ? (
                          <span className="font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded-xs border border-slate-200">
                            {pi.tcRequestDate}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* 10. DAYS COMMERCIAL DOC NOT RECEIVED (Pure Day Count Badge) */}
                      <td className="py-1.5 px-3 whitespace-nowrap border-r border-slate-200">
                        {renderDaysCountBadge(pi)}
                      </td>

                      {/* 11. COMM. DOC RECEIVED DATE / STATUS (Dedicated Column) */}
                      <td className="py-1.5 px-2.5 whitespace-nowrap border-r border-slate-200">
                        {renderCommDocStatusBadge(pi)}
                      </td>

                      {/* 12. QUICK ACTION: MARK COMM. DOC RECEIVED */}
                      <td className="py-1 px-2 text-center whitespace-nowrap border-r border-slate-200">
                        {isDocReceived ? (
                          <span className="text-[10px] text-emerald-700 font-semibold font-sans">
                            Completed
                          </span>
                        ) : pi.tcRequestDate ? (
                          <button
                            type="button"
                            onClick={(e) => handleMarkSingleReceived(pi, e)}
                            className="px-2 py-0.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 hover:border-emerald-500 rounded-xs text-[10px] font-semibold transition-colors cursor-pointer shadow-2xs inline-flex items-center gap-1"
                            title="Mark Commercial Document Received Today"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Mark Received</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-sans">
                            Set Req Date in Master
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Sticky Navy Summary Footer */}
            <tfoot className="sticky bottom-0 z-30 shadow-[0_-2px_4px_rgba(0,0,0,0.2)] select-none">
              <tr className="bg-[#0b1b3d] text-white text-[11px] font-mono font-bold">
                {/* 0, 1, 2, 3: Frozen Footer Label */}
                <td
                  colSpan={4}
                  className="py-2 px-2.5 border-r border-[#1a386b] whitespace-nowrap sticky bottom-0 left-0 z-40 bg-[#0b1b3d] shadow-[4px_0_6px_-2px_rgba(0,0,0,0.35)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="uppercase text-[10px] tracking-wider text-blue-200">Total Summary</span>
                    <span className="bg-blue-900/80 px-1.5 py-0.2 rounded-xs text-[10px] text-white">
                      {filteredAndSortedData.length} records
                    </span>
                  </div>
                </td>

                {/* 4, 5: Empty space */}
                <td colSpan={2} className="py-2 px-2.5 border-r border-[#1a386b] text-slate-300 text-[10px] font-sans">
                  Total Order & Delivery Volume
                </td>

                {/* 6. Total Order Qty */}
                <td className="py-2 px-2.5 text-right font-bold text-white border-r border-[#1a386b] tabular-nums">
                  {footerTotals.totalOrder.toLocaleString()}
                </td>

                {/* 7. Total Delivery Qty */}
                <td className="py-2 px-2.5 text-right font-bold text-emerald-300 border-r border-[#1a386b] tabular-nums">
                  {footerTotals.totalDeliv.toLocaleString()}
                </td>

                {/* 8. Delivery Status Col */}
                <td className="py-2 px-2.5 text-slate-300 border-r border-[#1a386b] text-[10px] font-sans">
                  Bal: {footerTotals.totalBalance.toLocaleString()}
                </td>

                {/* 9. TC Request Date Col */}
                <td className="py-2 px-2.5 text-slate-300 border-r border-[#1a386b] text-[10px] font-sans">
                  Waiting: {footerTotals.waitingCount} PIs
                </td>

                {/* 10. Avg Days Pending (Day Count col) */}
                <td className="py-2 px-3 border-r border-[#1a386b] whitespace-nowrap">
                  <span className="text-amber-300 text-xs font-bold">
                    Avg: {footerTotals.avgDays} Days
                  </span>
                </td>

                {/* 11. Comm. Doc Status Col */}
                <td className="py-2 px-2.5 text-slate-300 border-r border-[#1a386b] text-[10px] font-sans">
                  Received: {counts.received} PIs
                </td>

                {/* 12. Action footer */}
                <td className="py-2 px-2 text-center text-slate-400 text-[10px] font-sans">
                  Live Follow-up
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bottom Sub-Bar */}
        <div className="p-1.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-1.5">
          <div className="flex items-center gap-2 text-[10px]">
            <span>Showing <strong className="text-slate-800">{filteredAndSortedData.length}</strong> records</span>
            <span>·</span>
            <span>Badge Colors: <strong className="text-emerald-700">0-7 days green</strong>, <strong className="text-amber-700">8-14 amber</strong>, <strong className="text-red-700">15+ red (Urgent)</strong></span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>
              Waiting for Doc:{' '}
              <strong className="text-blue-900">{counts.waiting}</strong>
            </span>
            <span>·</span>
            <span>
              15+ Days Overdue:{' '}
              <strong className="text-red-700">{counts.waiting15Plus}</strong>
            </span>
            <span>·</span>
            <span>
              Doc Received:{' '}
              <strong className="text-emerald-700">{counts.received}</strong>
            </span>
          </div>
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
