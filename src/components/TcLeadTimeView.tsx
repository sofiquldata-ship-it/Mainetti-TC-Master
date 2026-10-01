import React, { useState, useMemo, useRef } from 'react';
import { PIData, computeAutomatedTcStatus } from '../types/tc';
import { FilterBar } from './FilterBar';
import {
  Timer,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Download,
  FileSpreadsheet,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Zap,
} from 'lucide-react';

interface TcLeadTimeViewProps {
  data: PIData[];
  filters: any;
  onFilterChange: (newFilters: any) => void;
  onResetFilters: () => void;
  availableCustomers: string[];
  availableBuyers: string[];
  onSelectPI: (pi: PIData) => void;
  selectedPiId?: string;
  onSaveToGoogleSheets?: () => void;
}

type SortField =
  | 'orderDate'
  | 'piNumber'
  | 'buyer'
  | 'customer'
  | 'tcRequestDate'
  | 'stage1Days'
  | 'stage2Days'
  | 'stage3Days'
  | 'stage4Days'
  | 'stage5Days'
  | 'totalLeadDays'
  | 'tcStatus';

/**
 * Calculates days between two date strings (YYYY-MM-DD)
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

/**
 * Calculates days passed from date string to today
 */
function getDaysToToday(dateStr?: string): number | null {
  if (!dateStr || !dateStr.trim()) return null;
  const start = new Date(dateStr.trim().replace(/\//g, '-'));
  if (isNaN(start.getTime())) return null;
  const now = new Date();
  const diffTime = now.getTime() - start.getTime();
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

export const TcLeadTimeView: React.FC<TcLeadTimeViewProps> = ({
  data,
  filters,
  onFilterChange,
  onResetFilters,
  availableCustomers,
  availableBuyers,
  onSelectPI,
  selectedPiId,
  onSaveToGoogleSheets,
}) => {
  const [leadTimeFilter, setLeadTimeFilter] = useState<'all' | 'completed' | 'in_progress' | 'over_20d'>('all');
  const [sortField, setSortField] = useState<SortField>('totalLeadDays');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [tableSearch, setTableSearch] = useState<string>('');
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

  // Pre-calculate lead times for all items
  const enhancedList = useMemo(() => {
    return data.map((item) => {
      const hasReq = !!(item.tcRequestDate && item.tcRequestDate.trim());
      const hasCommDoc = !!(item.receivedCommercialDocDate && item.receivedCommercialDocDate.trim());
      const hasDraftTc = !!(item.draftTcDate && item.draftTcDate.trim());
      const hasDraftConf = !!(item.draftConfirmationDate && item.draftConfirmationDate.trim());
      const hasFinalApply = !!(item.finalTcApplyDate && item.finalTcApplyDate.trim());
      const hasFinalRec = !!(item.finalTcReceivedDate && item.finalTcReceivedDate.trim());

      // Stage 1: Request -> Comm Doc Received
      const stage1 = hasReq && hasCommDoc ? getDaysBetween(item.tcRequestDate, item.receivedCommercialDocDate) : null;
      // Stage 2: Comm Doc -> Draft TC Received
      const stage2 = hasCommDoc && hasDraftTc ? getDaysBetween(item.receivedCommercialDocDate, item.draftTcDate) : null;
      // Stage 3: Draft TC -> Draft Confirmed
      const stage3 = hasDraftTc && hasDraftConf ? getDaysBetween(item.draftTcDate, item.draftConfirmationDate) : null;
      // Stage 4: Draft Confirmed -> Final TC Applied
      const stage4 = hasDraftConf && hasFinalApply ? getDaysBetween(item.draftConfirmationDate, item.finalTcApplyDate) : null;
      // Stage 5: Final TC Applied -> Final TC Received
      const stage5 = hasFinalApply && hasFinalRec ? getDaysBetween(item.finalTcApplyDate, item.finalTcReceivedDate) : null;

      // Total Lead Time: from TC Request to Final TC Received (or to today if in progress)
      let totalLeadDays: number | null = null;
      let isCompleted = false;

      if (hasReq && hasFinalRec) {
        totalLeadDays = getDaysBetween(item.tcRequestDate, item.finalTcReceivedDate);
        isCompleted = true;
      } else if (hasReq) {
        totalLeadDays = getDaysToToday(item.tcRequestDate);
        isCompleted = false;
      }

      return {
        ...item,
        stage1Days: stage1,
        stage2Days: stage2,
        stage3Days: stage3,
        stage4Days: stage4,
        stage5Days: stage5,
        totalLeadDays,
        isCompleted,
        hasReq,
      };
    });
  }, [data]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let completedCount = 0;
    let inProgressCount = 0;
    let completedDaysSum = 0;
    let s1Sum = 0, s1Count = 0;
    let s2Sum = 0, s2Count = 0;
    let s3Sum = 0, s3Count = 0;
    let s4Sum = 0, s4Count = 0;
    let s5Sum = 0, s5Count = 0;

    enhancedList.forEach((item) => {
      if (item.isCompleted && item.totalLeadDays !== null) {
        completedCount++;
        completedDaysSum += item.totalLeadDays;
      } else if (item.hasReq) {
        inProgressCount++;
      }

      if (item.stage1Days !== null) { s1Sum += item.stage1Days; s1Count++; }
      if (item.stage2Days !== null) { s2Sum += item.stage2Days; s2Count++; }
      if (item.stage3Days !== null) { s3Sum += item.stage3Days; s3Count++; }
      if (item.stage4Days !== null) { s4Sum += item.stage4Days; s4Count++; }
      if (item.stage5Days !== null) { s5Sum += item.stage5Days; s5Count++; }
    });

    const avgTotal = completedCount > 0 ? (completedDaysSum / completedCount).toFixed(1) : '0';
    const avgS1 = s1Count > 0 ? (s1Sum / s1Count).toFixed(1) : '0';
    const avgS2 = s2Count > 0 ? (s2Sum / s2Count).toFixed(1) : '0';
    const avgS3 = s3Count > 0 ? (s3Sum / s3Count).toFixed(1) : '0';
    const avgS4 = s4Count > 0 ? (s4Sum / s4Count).toFixed(1) : '0';
    const avgS5 = s5Count > 0 ? (s5Sum / s5Count).toFixed(1) : '0';

    return {
      completedCount,
      inProgressCount,
      avgTotal,
      avgS1,
      avgS2,
      avgS3,
      avgS4,
      avgS5,
      totalTracked: enhancedList.filter((i) => i.hasReq).length,
    };
  }, [enhancedList]);

  // Filter and Sort Table
  const filteredAndSortedList = useMemo(() => {
    let list = [...enhancedList];

    // Filter by lead time state
    if (leadTimeFilter === 'completed') {
      list = list.filter((i) => i.isCompleted);
    } else if (leadTimeFilter === 'in_progress') {
      list = list.filter((i) => i.hasReq && !i.isCompleted);
    } else if (leadTimeFilter === 'over_20d') {
      list = list.filter((i) => i.totalLeadDays !== null && i.totalLeadDays >= 20);
    }

    // Search filter
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.piNumber.toLowerCase().includes(q) ||
          i.buyer.toLowerCase().includes(q) ||
          i.customer.toLowerCase().includes(q) ||
          (i.tcNumber && i.tcNumber.toLowerCase().includes(q))
      );
    }

    // Sort
    list.sort((a, b) => {
      let valA: any = a[sortField as keyof typeof a] ?? -999;
      let valB: any = b[sortField as keyof typeof b] ?? -999;

      if (valA === null) valA = -999;
      if (valB === null) valB = -999;

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [enhancedList, leadTimeFilter, tableSearch, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // Default descending (highest days first)
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />;
    }
    return sortAsc ? (
      <ArrowUp className="w-3 h-3 text-blue-300 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-300 font-bold" />
    );
  };

  const handleExportCSV = () => {
    if (filteredAndSortedList.length === 0) return;
    const headers = [
      'PI Number',
      'Buyer',
      'Customer',
      'TC Request Date',
      'Stage 1 (Req to Comm Doc Days)',
      'Stage 2 (Doc to Draft TC Days)',
      'Stage 3 (Draft to Confirm Days)',
      'Stage 4 (Confirm to Apply Days)',
      'Stage 5 (Apply to Final TC Days)',
      'Total Lead Time (Days)',
      'Status',
      'TC Number',
    ];

    const rows = filteredAndSortedList.map((d) => [
      `"${d.piNumber}"`,
      `"${d.buyer}"`,
      `"${d.customer}"`,
      d.tcRequestDate || '',
      d.stage1Days !== null ? d.stage1Days : '-',
      d.stage2Days !== null ? d.stage2Days : '-',
      d.stage3Days !== null ? d.stage3Days : '-',
      d.stage4Days !== null ? d.stage4Days : '-',
      d.stage5Days !== null ? d.stage5Days : '-',
      d.totalLeadDays !== null ? d.totalLeadDays : '-',
      `"${d.isCompleted ? 'Completed' : d.hasReq ? 'In Progress' : 'Not Requested'}"`,
      `"${d.tcNumber || ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Mainetti_TC_Lead_Time_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderDaysCell = (days: number | null) => {
    if (days === null) return <span className="text-slate-300 font-mono text-xs">-</span>;
    return (
      <span
        className={`inline-block px-1.5 py-0.2 rounded-xs font-mono font-bold text-xs ${
          days <= 3
            ? 'text-emerald-700 bg-emerald-50'
            : days <= 7
            ? 'text-blue-800 bg-blue-50'
            : days <= 12
            ? 'text-amber-800 bg-amber-50'
            : 'text-red-700 bg-red-50'
        }`}
      >
        {days}d
      </span>
    );
  };

  return (
    <div className="space-y-1.5 flex flex-col">
      {/* 1. FilterBar */}
      <FilterBar
        filters={filters}
        onFilterChange={onFilterChange}
        onReset={onResetFilters}
        totalResults={filteredAndSortedList.length}
        customers={availableCustomers}
        buyers={availableBuyers}
      />

      {/* 2. Concise Top Summary: Lead Time Cards & Stage Averages */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
        {/* Card 1: Total Avg Lead Time */}
        <div className="bg-white border border-slate-200 rounded-sm p-2.5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Avg Total Lead Time
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-[#0b1b3d] font-mono">{metrics.avgTotal}</span>
              <span className="text-xs font-bold text-slate-500">Days / TC</span>
            </div>
          </div>
          <div className="w-9 h-9 bg-blue-50 text-blue-900 rounded-sm flex items-center justify-center border border-blue-200">
            <Timer className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Completed TCs */}
        <div className="bg-white border border-slate-200 rounded-sm p-2.5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Final TC Received
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-emerald-700 font-mono">{metrics.completedCount}</span>
              <span className="text-xs font-medium text-slate-500">of {metrics.totalTracked} Requested</span>
            </div>
          </div>
          <div className="w-9 h-9 bg-emerald-50 text-emerald-700 rounded-sm flex items-center justify-center border border-emerald-200">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: In-Progress TCs */}
        <div className="bg-white border border-slate-200 rounded-sm p-2.5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              Active In Progress
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-amber-700 font-mono">{metrics.inProgressCount}</span>
              <span className="text-xs font-medium text-slate-500">Under Pipeline</span>
            </div>
          </div>
          <div className="w-9 h-9 bg-amber-50 text-amber-700 rounded-sm flex items-center justify-center border border-amber-200">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Stage Breakdown Strip */}
        <div className="bg-[#0b1b3d] text-white border border-[#1a386b] rounded-sm p-2 shadow-2xs flex flex-col justify-center">
          <div className="text-[9px] font-bold uppercase tracking-wider text-blue-200 font-mono mb-1">
            Stage Lead Time Averages
          </div>
          <div className="grid grid-cols-5 gap-1 text-center font-mono text-[10px]">
            <div className="bg-white/10 p-0.5 rounded-xs" title="Stage 1: TC Req to Commercial Doc">
              <span className="block text-[8px] text-blue-200">S1:Doc</span>
              <strong className="text-white">{metrics.avgS1}d</strong>
            </div>
            <div className="bg-white/10 p-0.5 rounded-xs" title="Stage 2: Comm Doc to Draft TC">
              <span className="block text-[8px] text-blue-200">S2:Drft</span>
              <strong className="text-white">{metrics.avgS2}d</strong>
            </div>
            <div className="bg-white/10 p-0.5 rounded-xs" title="Stage 3: Draft to Confirmation">
              <span className="block text-[8px] text-blue-200">S3:Conf</span>
              <strong className="text-white">{metrics.avgS3}d</strong>
            </div>
            <div className="bg-white/10 p-0.5 rounded-xs" title="Stage 4: Confirmation to Final Apply">
              <span className="block text-[8px] text-blue-200">S4:App</span>
              <strong className="text-white">{metrics.avgS4}d</strong>
            </div>
            <div className="bg-emerald-500/20 border border-emerald-400/30 p-0.5 rounded-xs" title="Stage 5: Apply to Final TC">
              <span className="block text-[8px] text-emerald-300">S5:TC</span>
              <strong className="text-emerald-300">{metrics.avgS5}d</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Grid Container */}
      <div className="bg-white border border-slate-200 rounded-sm shadow-xs overflow-hidden">
        {/* Table Sub-Header Controls */}
        <div className="px-2.5 py-1.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-200/70 p-0.5 rounded-sm">
            <button
              type="button"
              onClick={() => setLeadTimeFilter('all')}
              className={`px-2 py-0.5 text-xs font-semibold rounded-xs transition-colors cursor-pointer ${
                leadTimeFilter === 'all'
                  ? 'bg-white text-[#0b1b3d] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All PIs ({enhancedList.length})
            </button>
            <button
              type="button"
              onClick={() => setLeadTimeFilter('completed')}
              className={`px-2 py-0.5 text-xs font-semibold rounded-xs transition-colors cursor-pointer flex items-center gap-1 ${
                leadTimeFilter === 'completed'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Final TC Done ({metrics.completedCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setLeadTimeFilter('in_progress')}
              className={`px-2 py-0.5 text-xs font-semibold rounded-xs transition-colors cursor-pointer flex items-center gap-1 ${
                leadTimeFilter === 'in_progress'
                  ? 'bg-white text-amber-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3 h-3 text-amber-600" />
              <span>In Progress ({metrics.inProgressCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setLeadTimeFilter('over_20d')}
              className={`px-2 py-0.5 text-xs font-semibold rounded-xs transition-colors cursor-pointer flex items-center gap-1 ${
                leadTimeFilter === 'over_20d'
                  ? 'bg-white text-red-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-red-600" />
              <span>20+ Days</span>
            </button>
          </div>

          {/* Right Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 ml-auto">
            {/* Scroll Navigation */}
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
                className="p-0.5 text-slate-600 hover:text-[#0b1b3d] hover:bg-slate-100 rounded-xs transition-colors cursor-pointer"
                title="Scroll Left"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => handleScroll('right')}
                className="p-0.5 text-slate-600 hover:text-[#0b1b3d] hover:bg-slate-100 rounded-xs transition-colors cursor-pointer"
                title="Scroll Right"
              >
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
                placeholder="Search PI, Buyer..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="py-0.5 pl-6 pr-6 text-xs bg-white border border-slate-300 rounded-sm focus:outline-hidden focus:border-[#0b1b3d] w-36 sm:w-44"
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

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-sm transition-colors cursor-pointer shadow-2xs"
              title="Export Lead Time Data to CSV"
            >
              <Download className="w-3 h-3 text-slate-500" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* 4. Table with Sticky Navy Header */}
        <div
          ref={tableContainerRef}
          className="overflow-x-auto overflow-y-auto table-scrollbar relative border-b border-slate-200 h-[calc(100vh-270px)] max-h-[calc(100vh-270px)] min-h-[400px]"
        >
          <table className="w-full text-left border-collapse min-w-[1360px]">
            <thead className="sticky top-0 z-30 shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
              <tr className="bg-[#0b1b3d] text-white text-[10px] font-bold uppercase tracking-wider select-none">
                {/* 1. ORDER DATE */}
                <th
                  onClick={() => handleSort('orderDate')}
                  className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 left-0 z-40 bg-[#0b1b3d] shadow-[2px_2px_4px_-1px_rgba(0,0,0,0.25)]"
                >
                  <div className="flex items-center gap-1">
                    <span>Order Date</span>
                    {renderSortIcon('orderDate')}
                  </div>
                </th>

                {/* 2. PI NO */}
                <th
                  onClick={() => handleSort('piNumber')}
                  className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 left-[90px] z-40 bg-[#0b1b3d] shadow-[4px_2px_6px_-2px_rgba(0,0,0,0.25)]"
                >
                  <div className="flex items-center gap-1">
                    <span>PI No</span>
                    {renderSortIcon('piNumber')}
                  </div>
                </th>

                {/* 3. BUYER */}
                <th
                  onClick={() => handleSort('buyer')}
                  className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
                >
                  <div className="flex items-center gap-1">
                    <span>Buyer</span>
                    {renderSortIcon('buyer')}
                  </div>
                </th>

                {/* 4. CUSTOMER */}
                <th
                  onClick={() => handleSort('customer')}
                  className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
                >
                  <div className="flex items-center gap-1">
                    <span>Customer</span>
                    {renderSortIcon('customer')}
                  </div>
                </th>

                {/* 5. TC REQUEST DATE */}
                <th
                  onClick={() => handleSort('tcRequestDate')}
                  className="py-1.5 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]"
                >
                  <div className="flex items-center gap-1">
                    <span>TC Req Date</span>
                    {renderSortIcon('tcRequestDate')}
                  </div>
                </th>

                {/* 6. STAGE 1: Req -> Comm Doc */}
                <th
                  onClick={() => handleSort('stage1Days')}
                  className="py-1.5 px-2 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap text-center sticky top-0 z-30 bg-[#0b1b3d]"
                  title="Stage 1: TC Request to Commercial Document Received"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>S1: Comm Doc</span>
                    {renderSortIcon('stage1Days')}
                  </div>
                </th>

                {/* 7. STAGE 2: Comm Doc -> Draft TC */}
                <th
                  onClick={() => handleSort('stage2Days')}
                  className="py-1.5 px-2 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap text-center sticky top-0 z-30 bg-[#0b1b3d]"
                  title="Stage 2: Commercial Doc to Draft TC Received"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>S2: Draft TC</span>
                    {renderSortIcon('stage2Days')}
                  </div>
                </th>

                {/* 8. STAGE 3: Draft TC -> Draft Confirmed */}
                <th
                  onClick={() => handleSort('stage3Days')}
                  className="py-1.5 px-2 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap text-center sticky top-0 z-30 bg-[#0b1b3d]"
                  title="Stage 3: Draft TC to Draft Confirmed"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>S3: Confirm</span>
                    {renderSortIcon('stage3Days')}
                  </div>
                </th>

                {/* 9. STAGE 4: Confirmed -> Final Apply */}
                <th
                  onClick={() => handleSort('stage4Days')}
                  className="py-1.5 px-2 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap text-center sticky top-0 z-30 bg-[#0b1b3d]"
                  title="Stage 4: Draft Confirmed to Final TC Applied"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>S4: Final Apply</span>
                    {renderSortIcon('stage4Days')}
                  </div>
                </th>

                {/* 10. STAGE 5: Final Apply -> Final TC Received */}
                <th
                  onClick={() => handleSort('stage5Days')}
                  className="py-1.5 px-2 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap text-center sticky top-0 z-30 bg-[#0b1b3d]"
                  title="Stage 5: Final TC Applied to Final TC Received"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>S5: Final TC</span>
                    {renderSortIcon('stage5Days')}
                  </div>
                </th>

                {/* 11. TOTAL LEAD TIME */}
                <th
                  onClick={() => handleSort('totalLeadDays')}
                  className="py-1.5 px-3 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d] shadow-[-2px_0_4px_rgba(0,0,0,0.2)]"
                >
                  <div className="flex items-center gap-1 text-amber-300">
                    <Timer className="w-3.5 h-3.5" />
                    <span>Total Lead Time</span>
                    {renderSortIcon('totalLeadDays')}
                  </div>
                </th>

                {/* 12. CURRENT STATUS */}
                <th className="py-1.5 px-2.5 border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d]">
                  <span>Status / TC #</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-xs font-mono">
              {filteredAndSortedList.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500 bg-white">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Timer className="w-8 h-8 text-slate-400" />
                      <p className="font-semibold text-sm text-slate-700">No matching lead time records found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedList.map((pi, idx) => {
                  const isCurrentActive = selectedPiId === pi.id;

                  return (
                    <tr
                      key={pi.id}
                      onClick={() => onSelectPI(pi)}
                      className={`group hover:bg-blue-50/60 cursor-pointer transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      } ${isCurrentActive ? 'bg-blue-100/70 ring-1 ring-blue-500' : ''}`}
                    >
                      {/* 1. ORDER DATE */}
                      <td
                        className={`py-1.5 px-2.5 text-slate-700 whitespace-nowrap border-r border-slate-200 sticky left-0 z-20 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'
                        } group-hover:bg-blue-50/90 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]`}
                      >
                        {pi.orderDate}
                      </td>

                      {/* 2. PI NO */}
                      <td
                        className={`py-1.5 px-2.5 font-bold text-[#0b1b3d] whitespace-nowrap border-r border-slate-200 sticky left-[90px] z-20 ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'
                        } group-hover:bg-blue-50/90 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.1)]`}
                      >
                        {pi.piNumber}
                      </td>

                      {/* 3. BUYER */}
                      <td className="py-1.5 px-2.5 text-slate-800 font-sans font-bold whitespace-nowrap border-r border-slate-200">
                        {pi.buyer}
                      </td>

                      {/* 4. CUSTOMER */}
                      <td className="py-1.5 px-2.5 text-slate-700 font-sans font-medium whitespace-nowrap border-r border-slate-200 max-w-[180px] truncate" title={pi.customer}>
                        {pi.customer}
                      </td>

                      {/* 5. TC REQUEST DATE */}
                      <td className="py-1.5 px-2.5 whitespace-nowrap border-r border-slate-200">
                        {pi.tcRequestDate ? (
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded-xs border border-slate-200 text-slate-800">
                            {pi.tcRequestDate}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* 6. STAGE 1 */}
                      <td className="py-1.5 px-2 text-center whitespace-nowrap border-r border-slate-200">
                        {renderDaysCell(pi.stage1Days)}
                      </td>

                      {/* 7. STAGE 2 */}
                      <td className="py-1.5 px-2 text-center whitespace-nowrap border-r border-slate-200">
                        {renderDaysCell(pi.stage2Days)}
                      </td>

                      {/* 8. STAGE 3 */}
                      <td className="py-1.5 px-2 text-center whitespace-nowrap border-r border-slate-200">
                        {renderDaysCell(pi.stage3Days)}
                      </td>

                      {/* 9. STAGE 4 */}
                      <td className="py-1.5 px-2 text-center whitespace-nowrap border-r border-slate-200">
                        {renderDaysCell(pi.stage4Days)}
                      </td>

                      {/* 10. STAGE 5 */}
                      <td className="py-1.5 px-2 text-center whitespace-nowrap border-r border-slate-200">
                        {renderDaysCell(pi.stage5Days)}
                      </td>

                      {/* 11. TOTAL LEAD TIME */}
                      <td className="py-1.5 px-3 whitespace-nowrap border-r border-slate-200">
                        {pi.totalLeadDays !== null ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-xs font-bold text-xs ${
                                pi.isCompleted
                                  ? pi.totalLeadDays <= 15
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                    : pi.totalLeadDays <= 30
                                    ? 'bg-blue-50 text-blue-800 border border-blue-300'
                                    : 'bg-amber-50 text-amber-800 border border-amber-300'
                                  : 'bg-slate-100 text-slate-800 border border-slate-300'
                              }`}
                            >
                              <Timer className="w-3 h-3 text-slate-500" />
                              <span>{pi.totalLeadDays} Days</span>
                            </span>
                            {pi.isCompleted ? (
                              <span className="text-[10px] font-sans text-emerald-700 font-semibold">Done</span>
                            ) : (
                              <span className="text-[10px] font-sans text-amber-600 font-semibold">Running</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* 12. STATUS / TC # */}
                      <td className="py-1.5 px-2.5 whitespace-nowrap border-r border-slate-200">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-slate-800 font-sans">
                            {computeAutomatedTcStatus(pi)}
                          </span>
                          {pi.tcNumber && (
                            <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-1 rounded-xs">
                              #{pi.tcNumber}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Sticky Navy Summary Footer */}
            <tfoot className="sticky bottom-0 z-30 shadow-[0_-2px_4px_rgba(0,0,0,0.2)] select-none">
              <tr className="bg-[#0b1b3d] text-white text-[11px] font-mono font-bold">
                <td
                  colSpan={4}
                  className="py-2 px-2.5 border-r border-[#1a386b] whitespace-nowrap sticky bottom-0 left-0 z-40 bg-[#0b1b3d] shadow-[4px_0_6px_-2px_rgba(0,0,0,0.35)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="uppercase text-[10px] tracking-wider text-blue-200">Averages Summary</span>
                    <span className="text-white text-[10px]">{filteredAndSortedList.length} PIs</span>
                  </div>
                </td>

                <td className="py-2 px-2.5 text-slate-300 border-r border-[#1a386b] text-[10px] font-sans">
                  Stage Averages:
                </td>

                <td className="py-2 px-2 text-center text-blue-200 border-r border-[#1a386b]">
                  {metrics.avgS1}d
                </td>

                <td className="py-2 px-2 text-center text-blue-200 border-r border-[#1a386b]">
                  {metrics.avgS2}d
                </td>

                <td className="py-2 px-2 text-center text-blue-200 border-r border-[#1a386b]">
                  {metrics.avgS3}d
                </td>

                <td className="py-2 px-2 text-center text-blue-200 border-r border-[#1a386b]">
                  {metrics.avgS4}d
                </td>

                <td className="py-2 px-2 text-center text-emerald-300 border-r border-[#1a386b]">
                  {metrics.avgS5}d
                </td>

                <td className="py-2 px-3 border-r border-[#1a386b] text-amber-300 font-bold">
                  Avg: {metrics.avgTotal} Days
                </td>

                <td className="py-2 px-2.5 text-slate-300 text-[10px] font-sans">
                  Completed: {metrics.completedCount} / {metrics.totalTracked}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
