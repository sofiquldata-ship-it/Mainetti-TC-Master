import React, { useState, useMemo } from 'react';
import { PIData, computeAutomatedTcStatus, isCancelledStatus, isCancelledOrder, isCancelledPi } from '../types/tc';
import {
  BarChart3,
  Users,
  Building2,
  Download,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  FileSpreadsheet,
  TrendingUp,
  ShieldCheck,
  PieChart,
  Activity,
  FileText,
  ArrowUpRight,
  Sparkles,
  Zap,
  FolderKanban,
} from 'lucide-react';

interface TcSummaryPageViewProps {
  data: PIData[];
  onSelectPI: (pi: PIData) => void;
  onSelectBuyer?: (buyer: string) => void;
  onSelectCustomer?: (customer: string) => void;
  onSaveToGoogleSheets?: () => void;
}

type BuyerSortKey = 'buyer' | 'piCount' | 'tcRequested' | 'docReceived' | 'issued' | 'pending' | 'overdue';
type CustomerSortKey = 'customer' | 'piCount' | 'docReceived' | 'issued' | 'pending' | 'overdue';

export const TcSummaryPageView: React.FC<TcSummaryPageViewProps> = ({
  data,
  onSelectPI,
  onSelectBuyer,
  onSelectCustomer,
  onSaveToGoogleSheets,
}) => {
  const [buyerSearch, setBuyerSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedBuyerFilter, setSelectedBuyerFilter] = useState('all');

  const [buyerSortField, setBuyerSortField] = useState<BuyerSortKey>('piCount');
  const [buyerSortAsc, setBuyerSortAsc] = useState(false);

  const [customerSortField, setCustomerSortField] = useState<CustomerSortKey>('piCount');
  const [customerSortAsc, setCustomerSortAsc] = useState(false);

  // Active uncancelled data
  const activeData = useMemo(() => {
    const uncancelled = data.filter(
      (d) =>
        !isCancelledOrder(d) &&
        !isCancelledPi(d.piNumber) &&
        !isCancelledStatus(d.orderStatus) &&
        !isCancelledStatus(d.deliveryStatus) &&
        !isCancelledStatus(d.tcStatus)
    );
    if (selectedBuyerFilter === 'all') return uncancelled;
    return uncancelled.filter((d) => d.buyer.toLowerCase() === selectedBuyerFilter.toLowerCase());
  }, [data, selectedBuyerFilter]);

  // Total PI Count
  const totalPIs = activeData.length || 0;

  // TC Workflow Status Counts across the entire active dataset
  const tcStatusCounts = useMemo(() => {
    let completed = 0;
    let inProgress = 0;
    let overdue = 0;
    let docReceived = 0;
    let tcRequested = 0;
    let draftTcReceived = 0;
    let draftConfirmed = 0;
    let finalApplied = 0;

    activeData.forEach((item) => {
      const computedSt = computeAutomatedTcStatus(item);
      const actualSt = computedSt !== 'Not Requested' ? computedSt : item.tcStatus;

      if (item.tcRequestDate && item.tcRequestDate.trim()) tcRequested++;
      if (item.receivedCommercialDocDate && item.receivedCommercialDocDate.trim()) docReceived++;
      if (item.draftTcDate && item.draftTcDate.trim()) draftTcReceived++;
      if (item.draftConfirmationDate && item.draftConfirmationDate.trim()) draftConfirmed++;
      if (item.finalTcApplyDate && item.finalTcApplyDate.trim()) finalApplied++;

      if (actualSt === 'Final TC Received' || actualSt === 'Issued' || item.finalTcReceivedDate) {
        completed++;
      } else if (actualSt === 'Overdue') {
        overdue++;
      } else {
        inProgress++;
      }
    });

    return {
      completed,
      inProgress,
      overdue,
      docReceived,
      tcRequested,
      draftTcReceived,
      draftConfirmed,
      finalApplied,
    };
  }, [activeData]);

  // Buyer Summary Breakdown (Pure PI Counts & Workflow Statuses)
  const buyerSummary = useMemo(() => {
    const map: Record<
      string,
      {
        buyer: string;
        piCount: number;
        tcRequested: number;
        docReceived: number;
        issued: number;
        pending: number;
        overdue: number;
      }
    > = {};

    activeData.forEach((item) => {
      const b = item.buyer || 'Unknown Buyer';

      if (!map[b]) {
        map[b] = {
          buyer: b,
          piCount: 0,
          tcRequested: 0,
          docReceived: 0,
          issued: 0,
          pending: 0,
          overdue: 0,
        };
      }
      map[b].piCount += 1;

      if (item.tcRequestDate && item.tcRequestDate.trim()) map[b].tcRequested += 1;
      if (item.receivedCommercialDocDate && item.receivedCommercialDocDate.trim()) map[b].docReceived += 1;

      const computedSt = computeAutomatedTcStatus(item);
      const actualSt = computedSt !== 'Not Requested' ? computedSt : item.tcStatus;
      if (actualSt === 'Final TC Received' || actualSt === 'Issued' || item.finalTcReceivedDate) {
        map[b].issued += 1;
      } else if (actualSt === 'Overdue') {
        map[b].overdue += 1;
      } else {
        map[b].pending += 1;
      }
    });

    let list = Object.values(map);
    if (buyerSearch.trim()) {
      const q = buyerSearch.toLowerCase();
      list = list.filter((b) => b.buyer.toLowerCase().includes(q));
    }

    return list.sort((a, b) => {
      const valA = a[buyerSortField];
      const valB = b[buyerSortField];
      if (typeof valA === 'string') {
        return buyerSortAsc ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
      }
      return buyerSortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
  }, [activeData, buyerSearch, buyerSortField, buyerSortAsc]);

  // Customer / Factory Breakdown (Pure PI Counts & Workflow Statuses)
  const customerSummary = useMemo(() => {
    const map: Record<
      string,
      {
        customer: string;
        primaryBuyer: string;
        piCount: number;
        docReceived: number;
        issued: number;
        pending: number;
        overdue: number;
      }
    > = {};

    activeData.forEach((item) => {
      const c = item.customer || 'Unknown Factory';

      if (!map[c]) {
        map[c] = {
          customer: c,
          primaryBuyer: item.buyer || '',
          piCount: 0,
          docReceived: 0,
          issued: 0,
          pending: 0,
          overdue: 0,
        };
      }
      map[c].piCount += 1;

      if (item.receivedCommercialDocDate && item.receivedCommercialDocDate.trim()) map[c].docReceived += 1;

      const computedSt = computeAutomatedTcStatus(item);
      const actualSt = computedSt !== 'Not Requested' ? computedSt : item.tcStatus;
      if (actualSt === 'Final TC Received' || actualSt === 'Issued' || item.finalTcReceivedDate) {
        map[c].issued += 1;
      } else if (actualSt === 'Overdue') {
        map[c].overdue += 1;
      } else {
        map[c].pending += 1;
      }
    });

    let list = Object.values(map);
    if (customerSearch.trim()) {
      const q = customerSearch.toLowerCase();
      list = list.filter((c) => c.customer.toLowerCase().includes(q) || c.primaryBuyer.toLowerCase().includes(q));
    }

    return list.sort((a, b) => {
      const valA = a[customerSortField];
      const valB = b[customerSortField];
      if (typeof valA === 'string') {
        return customerSortAsc ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
      }
      return customerSortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
  }, [activeData, customerSearch, customerSortField, customerSortAsc]);

  const allBuyers = useMemo(() => {
    const set = new Set<string>();
    data.forEach((d) => {
      if (d.buyer) set.add(d.buyer);
    });
    return Array.from(set).sort();
  }, [data]);

  // Top 5 Buyers by Order / PI Count
  const topBuyers = useMemo(() => {
    const list = [...buyerSummary].sort((a, b) => b.piCount - a.piCount);
    return list.slice(0, 5);
  }, [buyerSummary]);

  const buyerColors = ['bg-blue-600', 'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-slate-400'];

  const handleBuyerSort = (field: BuyerSortKey) => {
    if (buyerSortField === field) {
      setBuyerSortAsc(!buyerSortAsc);
    } else {
      setBuyerSortField(field);
      setBuyerSortAsc(false);
    }
  };

  const handleCustomerSort = (field: CustomerSortKey) => {
    if (customerSortField === field) {
      setCustomerSortAsc(!customerSortAsc);
    } else {
      setCustomerSortField(field);
      setCustomerSortAsc(false);
    }
  };

  const handleExportFullSummary = () => {
    const headers = [
      'Buyer Name',
      'PI Count',
      'Share of Orders %',
      'TC Requested PIs',
      'Commercial Doc Received',
      'Final TC Issued',
      'In-Progress PIs',
      'Overdue PIs',
    ];
    const rows = buyerSummary.map((b) => [
      `"${b.buyer}"`,
      b.piCount,
      totalPIs > 0 ? ((b.piCount / totalPIs) * 100).toFixed(1) + '%' : '0%',
      b.tcRequested,
      b.docReceived,
      b.issued,
      b.pending,
      b.overdue,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Mainetti_TC_Executive_Summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3 flex flex-col font-sans">
      {/* 1. TOP EXECUTIVE HEADER */}
      <div className="bg-white border border-slate-200 rounded-sm p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#0b1b3d] text-white rounded-sm flex items-center justify-center shadow-xs">
            <FolderKanban className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#0b1b3d] uppercase tracking-wide">
                Executive TC Portfolio & Order Status Console
              </h1>
              <span className="text-[10px] bg-blue-50 text-blue-800 font-mono font-bold px-1.5 py-0.2 rounded-xs border border-blue-200">
                FY 2026 Q3
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Portfolio distribution, buyer order breakdown & Transaction Certificate workflow pipeline tracking
            </p>
          </div>
        </div>

        {/* Global Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Buyer Scope Filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-sm px-2 py-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedBuyerFilter}
              onChange={(e) => setSelectedBuyerFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
            >
              <option value="all">Global Portfolio ({allBuyers.length} Buyers)</option>
              {allBuyers.map((b) => (
                <option key={b} value={b}>
                  Buyer: {b}
                </option>
              ))}
            </select>
          </div>

          {onSaveToGoogleSheets && (
            <button
              type="button"
              onClick={onSaveToGoogleSheets}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-sm shadow-2xs transition-colors cursor-pointer"
              title="Save Executive Summary to Google Sheets"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Google Sheets</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportFullSummary}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-[#0b1b3d] hover:bg-[#152d59] text-white rounded-sm shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-200" />
            <span>Export Summary CSV</span>
          </button>
        </div>
      </div>

      {/* 2. 4 EXECUTIVE KPI SUMMARY CARDS (PURE PI & WORKFLOW METRICS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* KPI 1: Total Orders / PIs */}
        <div className="bg-white border border-slate-200 rounded-sm p-3 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-500">
              Total Tracked Orders (PIs)
            </span>
            <div className="w-7 h-7 bg-blue-50 text-blue-900 rounded-xs flex items-center justify-center border border-blue-200">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-[#0b1b3d] tabular-nums">
              {totalPIs}
            </span>
            <span className="text-xs font-bold text-slate-500">Active PIs</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>{buyerSummary.length} Buyers</span>
            <span className="text-slate-300">·</span>
            <span>{customerSummary.length} Factories</span>
          </div>
        </div>

        {/* KPI 2: TC Issued / Completed */}
        <div className="bg-white border border-slate-200 rounded-sm p-3 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-500">
              Final TC Issued / Done
            </span>
            <div className="w-7 h-7 bg-emerald-50 text-emerald-800 rounded-xs flex items-center justify-center border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-emerald-700 tabular-nums">
              {tcStatusCounts.completed}
            </span>
            <span className="text-xs font-bold text-slate-500">Certificates Done</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Completed Rate:</span>
            <span className="text-emerald-700 font-bold">
              {totalPIs > 0 ? ((tcStatusCounts.completed / totalPIs) * 100).toFixed(0) : 0}%
            </span>
          </div>
        </div>

        {/* KPI 3: TC Workflow Status Breakdown */}
        <div className="bg-white border border-slate-200 rounded-sm p-3 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-500">
              Active TC Pipeline
            </span>
            <div className="w-7 h-7 bg-amber-50 text-amber-800 rounded-xs flex items-center justify-center border border-amber-200">
              <Clock className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-amber-700 tabular-nums">
              {tcStatusCounts.inProgress}
            </span>
            <span className="text-xs font-bold text-amber-800">In Pipeline</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">TC Requested: <strong className="text-slate-800">{tcStatusCounts.tcRequested}</strong></span>
            <span className={tcStatusCounts.overdue > 0 ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
              {tcStatusCounts.overdue} Overdue
            </span>
          </div>
        </div>

        {/* KPI 4: Commercial Doc Readiness */}
        <div className="bg-white border border-slate-200 rounded-sm p-3 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-500">
              Commercial Doc Readiness
            </span>
            <div className="w-7 h-7 bg-indigo-50 text-indigo-800 rounded-xs flex items-center justify-center border border-indigo-200">
              <ShieldCheck className="w-4 h-4 text-indigo-700" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-indigo-900 tabular-nums">
              {tcStatusCounts.docReceived}
            </span>
            <span className="text-xs font-bold text-slate-500">Docs Received</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Waiting Doc: <strong className="text-slate-800">{Math.max(0, tcStatusCounts.tcRequested - tcStatusCounts.docReceived)}</strong></span>
            <span className="text-emerald-700 font-bold">Verified</span>
          </div>
        </div>
      </div>

      {/* 3. VISUAL ANALYTICS: BUYER ORDER SHARE BAR */}
      <div className="bg-white border border-slate-200 rounded-sm p-3 shadow-2xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-blue-900" />
            <span className="text-xs font-bold uppercase tracking-wide text-slate-800">
              Buyer Portfolio Share (% of Total PIs)
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">Total: {totalPIs} Orders</span>
        </div>

        {/* Stacked Proportional Bar */}
        <div className="w-full h-3.5 rounded-sm overflow-hidden flex bg-slate-100 shadow-inner">
          {topBuyers.map((b, idx) => {
            const pct = totalPIs > 0 ? (b.piCount / totalPIs) * 100 : 0;
            return (
              <div
                key={b.buyer}
                className={`${buyerColors[idx % buyerColors.length]} h-full transition-all`}
                style={{ width: `${pct}%` }}
                title={`${b.buyer}: ${b.piCount} PIs (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>

        {/* Interactive Legend Pills */}
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
          {topBuyers.map((b, idx) => {
            const pct = totalPIs > 0 ? ((b.piCount / totalPIs) * 100).toFixed(1) : '0';
            return (
              <button
                type="button"
                key={b.buyer}
                onClick={() => {
                  if (onSelectBuyer) onSelectBuyer(b.buyer);
                  setSelectedBuyerFilter(b.buyer);
                }}
                className="flex items-center gap-1.5 text-slate-700 hover:text-blue-900 transition-colors cursor-pointer group"
              >
                <span className={`w-2.5 h-2.5 rounded-xs ${buyerColors[idx % buyerColors.length]} shrink-0`} />
                <span className="font-semibold text-[11px] group-hover:underline">{b.buyer}</span>
                <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1 py-0.2 rounded-xs">
                  {b.piCount} PIs ({pct}%)
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. MAIN DUAL INTELLIGENCE GRIDS (PURE ORDER COUNTS & TC STATUSES) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {/* GRID A: BUYER-WISE TC ORDER & STATUS MATRIX */}
        <div className="bg-white border border-slate-200 rounded-sm shadow-xs flex flex-col overflow-hidden">
          {/* Grid Header & Search */}
          <div className="p-2.5 bg-[#0b1b3d] text-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-300" />
              <h2 className="text-xs font-bold uppercase tracking-wider">
                Buyer-Wise TC Order & Status Breakdown ({buyerSummary.length})
              </h2>
            </div>

            {/* In-Grid Search */}
            <div className="relative">
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Buyer..."
                value={buyerSearch}
                onChange={(e) => setBuyerSearch(e.target.value)}
                className="py-0.5 pl-6 pr-5 text-xs bg-[#132c5e] text-white placeholder:text-slate-400 border border-[#1a386b] rounded-xs focus:outline-hidden focus:border-blue-400 w-28 sm:w-36"
              />
              {buyerSearch && (
                <button
                  type="button"
                  onClick={() => setBuyerSearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Table */}
          <div className="overflow-x-auto max-h-[440px] overflow-y-auto table-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-600 tracking-wider select-none">
                <tr>
                  <th
                    onClick={() => handleBuyerSort('buyer')}
                    className="py-2 px-2.5 cursor-pointer hover:bg-slate-200 border-r border-slate-200"
                  >
                    Buyer Name
                  </th>
                  <th
                    onClick={() => handleBuyerSort('piCount')}
                    className="py-2 px-2.5 text-center cursor-pointer hover:bg-slate-200 border-r border-slate-200 text-blue-950 font-black"
                  >
                    Total PIs
                  </th>
                  <th
                    onClick={() => handleBuyerSort('tcRequested')}
                    className="py-2 px-2 text-center cursor-pointer hover:bg-slate-200 border-r border-slate-200"
                  >
                    TC Requested
                  </th>
                  <th
                    onClick={() => handleBuyerSort('docReceived')}
                    className="py-2 px-2 text-center cursor-pointer hover:bg-slate-200 border-r border-slate-200 text-indigo-900"
                  >
                    Comm Doc
                  </th>
                  <th
                    onClick={() => handleBuyerSort('issued')}
                    className="py-2 px-2 text-center cursor-pointer hover:bg-slate-200 border-r border-slate-200 text-emerald-800"
                  >
                    Done / Issued
                  </th>
                  <th
                    onClick={() => handleBuyerSort('pending')}
                    className="py-2 px-2 text-center cursor-pointer hover:bg-slate-200 border-r border-slate-200 text-amber-800"
                  >
                    In Pipeline
                  </th>
                  <th className="py-2 px-2 text-right border-r border-slate-200">Share %</th>
                  <th className="py-2 px-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-xs">
                {buyerSummary.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                      No matching buyer records found
                    </td>
                  </tr>
                ) : (
                  buyerSummary.map((b, idx) => {
                    const piShare = totalPIs > 0 ? ((b.piCount / totalPIs) * 100).toFixed(1) : '0';
                    return (
                      <tr
                        key={b.buyer}
                        onClick={() => onSelectBuyer && onSelectBuyer(b.buyer)}
                        className={`hover:bg-blue-50/70 transition-colors cursor-pointer ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                        }`}
                      >
                        <td className="py-1.5 px-2.5 font-sans font-bold text-slate-900 border-r border-slate-200 flex items-center gap-1.5">
                          <span className="w-5 h-5 bg-blue-100 text-blue-900 rounded-xs flex items-center justify-center text-[10px] font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <span className="truncate">{b.buyer}</span>
                        </td>
                        <td className="py-1.5 px-2.5 text-center font-black text-[#0b1b3d] border-r border-slate-200 bg-blue-50/30">
                          {b.piCount}
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-slate-200">
                          <span className={b.tcRequested > 0 ? 'text-slate-800 font-bold' : 'text-slate-400'}>
                            {b.tcRequested}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-slate-200">
                          <span className={b.docReceived > 0 ? 'text-indigo-800 font-bold bg-indigo-50 px-1.5 py-0.2 rounded-xs border border-indigo-200' : 'text-slate-400'}>
                            {b.docReceived}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-slate-200">
                          <span className={b.issued > 0 ? 'text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded-xs border border-emerald-200' : 'text-slate-400'}>
                            {b.issued}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-slate-200">
                          <span className={b.pending > 0 ? 'text-amber-800 font-bold bg-amber-50 px-1.5 py-0.2 rounded-xs border border-amber-200' : 'text-slate-400'}>
                            {b.pending}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right border-r border-slate-200 font-bold text-slate-600">
                          {piShare}%
                        </td>
                        <td className="py-1.5 px-2 text-center font-sans">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectBuyer) onSelectBuyer(b.buyer);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-900 hover:bg-slate-100 rounded-xs transition-colors"
                            title="Filter PIs for this buyer"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="sticky bottom-0 bg-[#0b1b3d] text-white text-[11px] font-mono font-bold select-none">
                <tr>
                  <td className="py-1.5 px-2.5 uppercase font-sans">Total ({buyerSummary.length} Buyers)</td>
                  <td className="py-1.5 px-2.5 text-center text-amber-300 font-black">{totalPIs}</td>
                  <td className="py-1.5 px-2 text-center text-blue-200">{tcStatusCounts.tcRequested}</td>
                  <td className="py-1.5 px-2 text-center text-indigo-300">{tcStatusCounts.docReceived}</td>
                  <td className="py-1.5 px-2 text-center text-emerald-300">{tcStatusCounts.completed}</td>
                  <td className="py-1.5 px-2 text-center text-amber-300">{tcStatusCounts.inProgress}</td>
                  <td className="py-1.5 px-2 text-right text-blue-200">100%</td>
                  <td className="py-1.5 px-2 text-center text-[10px] text-slate-400 font-sans">Summary</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* GRID B: GARMENT FACTORY / CUSTOMER BREAKDOWN */}
        <div className="bg-white border border-slate-200 rounded-sm shadow-xs flex flex-col overflow-hidden">
          {/* Grid Header & Search */}
          <div className="p-2.5 bg-[#0b1b3d] text-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-300" />
              <h2 className="text-xs font-bold uppercase tracking-wider">
                Garment Factory / Customer Breakdown ({customerSummary.length})
              </h2>
            </div>

            {/* In-Grid Search */}
            <div className="relative">
              <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Factory..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="py-0.5 pl-6 pr-5 text-xs bg-[#132c5e] text-white placeholder:text-slate-400 border border-[#1a386b] rounded-xs focus:outline-hidden focus:border-emerald-400 w-28 sm:w-36"
              />
              {customerSearch && (
                <button
                  type="button"
                  onClick={() => setCustomerSearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Table */}
          <div className="overflow-x-auto max-h-[440px] overflow-y-auto table-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-600 tracking-wider select-none">
                <tr>
                  <th
                    onClick={() => handleCustomerSort('customer')}
                    className="py-2 px-2.5 cursor-pointer hover:bg-slate-200 border-r border-slate-200"
                  >
                    Factory / Customer
                  </th>
                  <th
                    onClick={() => handleCustomerSort('piCount')}
                    className="py-2 px-2.5 text-center cursor-pointer hover:bg-slate-200 border-r border-slate-200 text-blue-950 font-black"
                  >
                    Total PIs
                  </th>
                  <th
                    onClick={() => handleCustomerSort('docReceived')}
                    className="py-2 px-2.5 text-center cursor-pointer hover:bg-slate-200 border-r border-slate-200 text-indigo-900"
                  >
                    Comm Doc
                  </th>
                  <th
                    onClick={() => handleCustomerSort('issued')}
                    className="py-2 px-2.5 text-center cursor-pointer hover:bg-slate-200 border-r border-slate-200 text-emerald-800"
                  >
                    Done / Issued
                  </th>
                  <th
                    onClick={() => handleCustomerSort('pending')}
                    className="py-2 px-2.5 text-center cursor-pointer hover:bg-slate-200 border-r border-slate-200 text-amber-800"
                  >
                    In Pipeline
                  </th>
                  <th className="py-2 px-2 text-right border-r border-slate-200">Share %</th>
                  <th className="py-2 px-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-xs">
                {customerSummary.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                      No matching factory records found
                    </td>
                  </tr>
                ) : (
                  customerSummary.map((c, idx) => {
                    const cShare = totalPIs > 0 ? ((c.piCount / totalPIs) * 100).toFixed(1) : '0';
                    return (
                      <tr
                        key={c.customer}
                        onClick={() => onSelectCustomer && onSelectCustomer(c.customer)}
                        className={`hover:bg-emerald-50/60 transition-colors cursor-pointer ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                        }`}
                      >
                        <td className="py-1.5 px-2.5 font-sans font-bold text-slate-900 border-r border-slate-200 max-w-[200px] truncate" title={c.customer}>
                          <div className="flex flex-col">
                            <span className="truncate">{c.customer}</span>
                            {c.primaryBuyer && (
                              <span className="text-[10px] text-slate-400 font-normal font-mono">
                                Buyer: {c.primaryBuyer}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-2.5 text-center font-black text-[#0b1b3d] border-r border-slate-200 bg-emerald-50/30">
                          {c.piCount}
                        </td>
                        <td className="py-1.5 px-2.5 text-center border-r border-slate-200">
                          <span className={c.docReceived > 0 ? 'text-indigo-800 font-bold bg-indigo-50 px-1.5 py-0.2 rounded-xs border border-indigo-200' : 'text-slate-400'}>
                            {c.docReceived}
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 text-center border-r border-slate-200">
                          <span className={c.issued > 0 ? 'text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded-xs border border-emerald-200' : 'text-slate-400'}>
                            {c.issued}
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 text-center border-r border-slate-200">
                          <span className={c.pending > 0 ? 'text-amber-800 font-bold bg-amber-50 px-1.5 py-0.2 rounded-xs border border-amber-200' : 'text-slate-400'}>
                            {c.pending}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right border-r border-slate-200 font-bold text-slate-600">
                          {cShare}%
                        </td>
                        <td className="py-1.5 px-2 text-center font-sans">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectCustomer) onSelectCustomer(c.customer);
                            }}
                            className="p-1 text-slate-400 hover:text-emerald-900 hover:bg-slate-100 rounded-xs transition-colors"
                            title="Filter PIs for this factory"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="sticky bottom-0 bg-[#0b1b3d] text-white text-[11px] font-mono font-bold select-none">
                <tr>
                  <td className="py-1.5 px-2.5 uppercase font-sans">Total ({customerSummary.length} Factories)</td>
                  <td className="py-1.5 px-2.5 text-center text-amber-300 font-black">{totalPIs}</td>
                  <td className="py-1.5 px-2.5 text-center text-indigo-300">{tcStatusCounts.docReceived}</td>
                  <td className="py-1.5 px-2.5 text-center text-emerald-300">{tcStatusCounts.completed}</td>
                  <td className="py-1.5 px-2.5 text-center text-amber-300">{tcStatusCounts.inProgress}</td>
                  <td className="py-1.5 px-2 text-right text-blue-200">100%</td>
                  <td className="py-1.5 px-2 text-center text-[10px] text-slate-400 font-sans">Summary</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
