import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  PIData,
  computeAutomatedTcStatus,
  computeActionableWaitingStatus,
  getDaysBetweenDates,
  getDaysFromDateToToday,
} from '../types/tc';
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
  Siren,
  Flame,
  Sliders,
  RotateCcw,
  Check,
  X,
  Settings2,
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
  | 'signalLevel'
  | 'tcStatus';

type SignalLevel = 'critical' | 'warning' | 'normal' | 'none';

export interface SlaSettings {
  totalSlaDays: number;
  warningDays: number;
  s1Target: number;
  s2Target: number;
  s3Target: number;
  s4Target: number;
  s5Target: number;
}

const DEFAULT_SLA_SETTINGS: SlaSettings = {
  totalSlaDays: 20,
  warningDays: 14,
  s1Target: 4,
  s2Target: 5,
  s3Target: 3,
  s4Target: 3,
  s5Target: 5,
};

const STORAGE_KEY = 'mainetti_custom_tc_sla_settings';

/**
 * Calculates days between two date strings
 */
function getDaysBetween(startStr?: string, endStr?: string): number | null {
  return getDaysBetweenDates(startStr, endStr);
}

/**
 * Calculates days passed from date string to today
 */
function getDaysToToday(dateStr?: string): number | null {
  return getDaysFromDateToToday(dateStr);
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
  const [leadTimeFilter, setLeadTimeFilter] = useState<
    'all' | 'critical_signals' | 'warning_signals' | 'on_track' | 'completed' | 'in_progress'
  >('all');

  // Load custom SLA settings from localStorage or fallback to defaults
  const [slaSettings, setSlaSettings] = useState<SlaSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_SLA_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.error('Failed to load custom SLA settings', e);
    }
    return DEFAULT_SLA_SETTINGS;
  });

  const [isSlaModalOpen, setIsSlaModalOpen] = useState<boolean>(false);
  const [tempSlaSettings, setTempSlaSettings] = useState<SlaSettings>(slaSettings);

  const [sortField, setSortField] = useState<SortField>('totalLeadDays');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [tableSearch, setTableSearch] = useState<string>('');
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Save to localStorage whenever SLA settings change
  const updateSlaSettings = (newSettings: Partial<SlaSettings>) => {
    setSlaSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save SLA settings', e);
      }
      return updated;
    });
  };

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

  // Pre-calculate lead times, bottlenecks & alarm signals for all items based on custom SLA
  const enhancedList = useMemo(() => {
    return data.map((item) => {
      const hasReq = !!(item.tcRequestDate && item.tcRequestDate.trim());
      const hasCommDoc = !!(item.receivedCommercialDocDate && item.receivedCommercialDocDate.trim());
      const hasDraftTc = !!(item.draftTcDate && item.draftTcDate.trim());
      const hasDraftConf = !!(item.draftConfirmationDate && item.draftConfirmationDate.trim());
      const hasFinalApply = !!(item.finalTcApplyDate && item.finalTcApplyDate.trim());
      const hasFinalRec = !!(item.finalTcReceivedDate && item.finalTcReceivedDate.trim());

      // Stage 1: Request -> Comm Doc Received (or to today if currently waiting in Stage 1)
      const stage1 =
        hasReq && hasCommDoc
          ? getDaysBetween(item.tcRequestDate, item.receivedCommercialDocDate)
          : hasReq && !hasCommDoc && !hasDraftTc && !hasDraftConf && !hasFinalApply && !hasFinalRec
          ? getDaysToToday(item.tcRequestDate)
          : null;

      // Stage 2: Comm Doc -> Draft TC Received (or to today if currently waiting in Stage 2)
      const stage2 =
        hasCommDoc && hasDraftTc
          ? getDaysBetween(item.receivedCommercialDocDate, item.draftTcDate)
          : !hasCommDoc && hasReq && hasDraftTc
          ? getDaysBetween(item.tcRequestDate, item.draftTcDate)
          : hasCommDoc && !hasDraftTc && !hasDraftConf && !hasFinalApply && !hasFinalRec
          ? getDaysToToday(item.receivedCommercialDocDate)
          : null;

      // Stage 3: Draft TC -> Draft Confirmed (or to today if Draft TC is done & waiting for Confirmation)
      const stage3 =
        hasDraftTc && hasDraftConf
          ? getDaysBetween(item.draftTcDate, item.draftConfirmationDate)
          : hasDraftTc && !hasDraftConf && !hasFinalApply && !hasFinalRec
          ? getDaysToToday(item.draftTcDate)
          : null;

      // Stage 4: Draft Confirmed -> Final TC Applied (or to today if currently waiting in Stage 4)
      const stage4 =
        hasDraftConf && hasFinalApply
          ? getDaysBetween(item.draftConfirmationDate, item.finalTcApplyDate)
          : hasDraftConf && !hasFinalApply && !hasFinalRec
          ? getDaysToToday(item.draftConfirmationDate)
          : null;

      // Stage 5: Final TC Applied -> Final TC Received (or to today if currently waiting in Stage 5)
      const stage5 =
        hasFinalApply && hasFinalRec
          ? getDaysBetween(item.finalTcApplyDate, item.finalTcReceivedDate)
          : hasFinalApply && !hasFinalRec
          ? getDaysToToday(item.finalTcApplyDate)
          : null;

      // Total Lead Time: from earliest workflow start date to Final TC Received (or to today if in progress)
      const firstStartDate =
        item.tcRequestDate ||
        item.receivedCommercialDocDate ||
        item.draftTcDate ||
        item.draftConfirmationDate ||
        item.finalTcApplyDate;
      const hasAnyWorkflowDate = !!(firstStartDate && firstStartDate.trim());

      let totalLeadDays: number | null = null;
      let isCompleted = false;

      if (hasAnyWorkflowDate && hasFinalRec) {
        totalLeadDays = getDaysBetween(firstStartDate, item.finalTcReceivedDate);
        isCompleted = true;
      } else if (hasAnyWorkflowDate) {
        totalLeadDays = getDaysToToday(firstStartDate);
        isCompleted = false;
      }

      // Determine Signal Level (Overdue Alert, Warning, On-track) dynamically with custom SLA
      let signalLevel: SignalLevel = 'none';
      if (hasAnyWorkflowDate && totalLeadDays !== null) {
        if (totalLeadDays > slaSettings.totalSlaDays) {
          signalLevel = 'critical'; // Exceeded custom SLA
        } else if (totalLeadDays >= slaSettings.warningDays) {
          signalLevel = 'warning'; // Near deadline
        } else {
          signalLevel = 'normal'; // Fast & On-track
        }
      }

      // Identify the biggest delay bottleneck stage based on custom stage targets
      const stageChecks = [
        { name: 'S1:Doc', days: stage1, target: slaSettings.s1Target },
        { name: 'S2:Draft', days: stage2, target: slaSettings.s2Target },
        { name: 'S3:Conf', days: stage3, target: slaSettings.s3Target },
        { name: 'S4:Apply', days: stage4, target: slaSettings.s4Target },
        { name: 'S5:TC', days: stage5, target: slaSettings.s5Target },
      ];

      let worstBottleneck: string | null = null;
      let maxExcess = 0;

      stageChecks.forEach((s) => {
        if (s.days !== null && s.days > s.target) {
          const excess = s.days - s.target;
          if (excess > maxExcess) {
            maxExcess = excess;
            worstBottleneck = `${s.name} (+${excess}d)`;
          }
        }
      });

      return {
        ...item,
        stage1Days: stage1,
        stage2Days: stage2,
        stage3Days: stage3,
        stage4Days: stage4,
        stage5Days: stage5,
        totalLeadDays,
        isCompleted,
        hasReq: hasAnyWorkflowDate,
        signalLevel,
        worstBottleneck,
      };
    });
  }, [data, slaSettings]);

  // Summary Metrics & Live Signals
  const metrics = useMemo(() => {
    let completedCount = 0;
    let inProgressCount = 0;
    let completedDaysSum = 0;
    let criticalCount = 0;
    let warningCount = 0;
    let onTrackCount = 0;
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

      if (item.signalLevel === 'critical') criticalCount++;
      if (item.signalLevel === 'warning') warningCount++;
      if (item.signalLevel === 'normal') onTrackCount++;

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
      criticalCount,
      warningCount,
      onTrackCount,
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

    // Filter by lead time signal / state
    if (leadTimeFilter === 'critical_signals') {
      list = list.filter((i) => i.signalLevel === 'critical');
    } else if (leadTimeFilter === 'warning_signals') {
      list = list.filter((i) => i.signalLevel === 'warning');
    } else if (leadTimeFilter === 'on_track') {
      list = list.filter((i) => i.signalLevel === 'normal');
    } else if (leadTimeFilter === 'completed') {
      list = list.filter((i) => i.isCompleted);
    } else if (leadTimeFilter === 'in_progress') {
      list = list.filter((i) => i.hasReq && !i.isCompleted);
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

      if (sortField === 'signalLevel') {
        const order = { critical: 3, warning: 2, normal: 1, none: 0 };
        valA = order[a.signalLevel] ?? 0;
        valB = order[b.signalLevel] ?? 0;
      }

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
      'S1 (Req to Doc Days)',
      'S2 (Doc to Draft Days)',
      'S3 (Draft to Confirm Days)',
      'S4 (Confirm to Apply Days)',
      'S5 (Apply to Final TC Days)',
      'Total Lead Time (Days)',
      'Lead Time Signal',
      'Bottleneck Stage',
      'TC Status',
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
      `"${d.signalLevel === 'critical' ? 'CRITICAL OVERDUE' : d.signalLevel === 'warning' ? 'WARNING' : 'ON TRACK'}"`,
      `"${d.worstBottleneck || 'None'}"`,
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
      `Mainetti_TC_Lead_Time_Signals_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render individual stage cell with strict uniform single-line height
  const renderStageCell = (days: number | null, maxTargetDays: number = 4) => {
    if (days === null) return <span className="text-slate-300 font-mono text-xs">-</span>;
    const isOver = days > maxTargetDays;

    return (
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-xs font-mono font-bold text-[11px] leading-tight ${
          isOver
            ? 'bg-red-100 text-red-900 border border-red-300 shadow-2xs font-extrabold'
            : days <= 2
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-blue-50 text-blue-800 border border-blue-200'
        }`}
        title={isOver ? `Delayed: exceeded custom target (${maxTargetDays}d)` : 'On track'}
      >
        {isOver && <AlertTriangle className="w-2.5 h-2.5 text-red-600 shrink-0" />}
        <span>{days}d</span>
      </span>
    );
  };

  return (
    <div className="space-y-1 flex flex-col">
      {/* 1. FilterBar */}
      <FilterBar
        filters={filters}
        onFilterChange={onFilterChange}
        onReset={onResetFilters}
        totalResults={filteredAndSortedList.length}
        customers={availableCustomers}
        buyers={availableBuyers}
      />

      {/* 2. ULTRA-COMPACT SLIM TOP SUMMARY STRIP */}
      <div className="bg-white border border-slate-200 rounded-sm px-2 py-1 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        {/* Left Side: Key KPIs in compact inline pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* KPI 1: Avg Total Lead Time */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-sm">
            <Timer className="w-3.5 h-3.5 text-blue-900" />
            <span className="text-[10px] text-slate-500 font-semibold uppercase">Avg Lead Time:</span>
            <span className="font-mono font-black text-xs text-[#0b1b3d]">{metrics.avgTotal}d</span>
            <span className="text-[10px] text-slate-400 font-mono">(SLA ≤{slaSettings.totalSlaDays}d)</span>
          </div>

          {/* KPI 2: Critical Overdue Signal Alert (Clickable) */}
          <button
            type="button"
            onClick={() => setLeadTimeFilter(leadTimeFilter === 'critical_signals' ? 'all' : 'critical_signals')}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-bold transition-all cursor-pointer border ${
              metrics.criticalCount > 0
                ? leadTimeFilter === 'critical_signals'
                  ? 'bg-red-800 text-white border-red-950 shadow-xs'
                  : 'bg-red-50 text-red-800 hover:bg-red-100 border-red-300'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
            title="Filter by Overdue Signals"
          >
            <Siren className={`w-3.5 h-3.5 ${metrics.criticalCount > 0 ? 'text-red-600 animate-pulse' : 'text-slate-400'}`} />
            <span>Overdue Signals:</span>
            <span className={`font-mono px-1 rounded-xs ${metrics.criticalCount > 0 ? 'bg-red-600 text-white font-black' : 'bg-slate-200 text-slate-700'}`}>
              {metrics.criticalCount}
            </span>
          </button>

          {/* KPI 3: In-Progress / Warning */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-sm text-xs">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-[10px] text-slate-500 font-semibold uppercase">Active / Warning:</span>
            <span className="font-mono font-bold text-amber-700">{metrics.inProgressCount}</span>
            <span className="text-[10px] text-slate-400">({metrics.warningCount} Warning)</span>
          </div>

          {/* KPI 4: Completed */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-sm text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[10px] text-slate-500 font-semibold uppercase">Done:</span>
            <span className="font-mono font-bold text-emerald-700">{metrics.completedCount}</span>
            <span className="text-[10px] text-slate-400">/ {metrics.totalTracked}</span>
          </div>
        </div>

        {/* Right Side: Stage Averages Micro-Strip & Customizable SLA Target */}
        <div className="flex items-center gap-2">
          {/* Stage Averages Micro-Strip */}
          <div className="hidden lg:flex items-center gap-1 bg-[#0b1b3d] text-white px-2 py-0.5 rounded-sm font-mono text-[10px] border border-[#1a386b]">
            <span className="text-blue-200 uppercase text-[9px] mr-1">Stage Avgs:</span>
            <span title={`Stage 1 Target: ≤${slaSettings.s1Target}d`} className="bg-white/10 px-1 rounded-xs">
              S1:<strong>{metrics.avgS1}d</strong>
            </span>
            <span title={`Stage 2 Target: ≤${slaSettings.s2Target}d`} className="bg-white/10 px-1 rounded-xs">
              S2:<strong>{metrics.avgS2}d</strong>
            </span>
            <span title={`Stage 3 Target: ≤${slaSettings.s3Target}d`} className="bg-white/10 px-1 rounded-xs">
              S3:<strong>{metrics.avgS3}d</strong>
            </span>
            <span title={`Stage 4 Target: ≤${slaSettings.s4Target}d`} className="bg-white/10 px-1 rounded-xs">
              S4:<strong>{metrics.avgS4}d</strong>
            </span>
            <span title={`Stage 5 Target: ≤${slaSettings.s5Target}d`} className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1 rounded-xs">
              S5:<strong>{metrics.avgS5}d</strong>
            </span>
          </div>

          {/* FULLY CUSTOMIZABLE SLA INPUT & POPUP */}
          <div className="flex items-center gap-1 bg-white border border-blue-300 hover:border-blue-500 rounded-sm px-1.5 py-0.5 text-xs text-slate-700 shadow-2xs transition-colors">
            <span className="text-[9px] font-mono font-bold text-blue-900 uppercase">SLA:</span>
            
            {/* Direct Editable Number Input for Total SLA Days */}
            <input
              type="number"
              min={1}
              max={180}
              value={slaSettings.totalSlaDays}
              onChange={(e) => {
                const val = Math.max(1, Math.min(180, Number(e.target.value) || 1));
                updateSlaSettings({
                  totalSlaDays: val,
                  warningDays: Math.max(1, Math.round(val * 0.75)), // auto scale warning threshold
                });
              }}
              className="w-9 text-center font-black font-mono text-xs bg-blue-50 border border-blue-200 rounded-xs py-0.2 focus:outline-hidden focus:bg-white focus:ring-1 focus:ring-blue-600 text-[#0b1b3d] tabular-nums"
              title="Click or type any custom number of days for SLA target"
            />
            <span className="text-[10px] font-mono text-slate-500 font-bold">d</span>

            {/* Quick Settings Gear Button */}
            <button
              type="button"
              onClick={() => {
                setTempSlaSettings(slaSettings);
                setIsSlaModalOpen(true);
              }}
              className="p-0.5 text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded-xs transition-colors cursor-pointer ml-0.5"
              title="Click to customize SLA target and all stage targets"
            >
              <Settings2 className="w-3.5 h-3.5 text-blue-700 hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Grid Container */}
      <div className="bg-white border border-slate-200 rounded-sm shadow-xs overflow-hidden">
        {/* Table Sub-Header Controls & Signal Toggles */}
        <div className="px-2 py-1 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-1.5">
          {/* Quick Signal Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setLeadTimeFilter('all')}
              className={`px-2 py-0.5 text-xs font-semibold rounded-xs transition-colors cursor-pointer border ${
                leadTimeFilter === 'all'
                  ? 'bg-[#0b1b3d] text-white border-blue-950 shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
              }`}
            >
              All Tracked ({enhancedList.length})
            </button>

            {/* Critical Overdue Signal Filter */}
            <button
              type="button"
              onClick={() => setLeadTimeFilter('critical_signals')}
              className={`px-2 py-0.5 text-xs font-semibold rounded-xs transition-colors cursor-pointer border flex items-center gap-1 ${
                leadTimeFilter === 'critical_signals'
                  ? 'bg-red-800 text-white border-red-950 shadow-xs'
                  : 'bg-red-50 text-red-800 hover:bg-red-100 border-red-300'
              }`}
            >
              <Siren className="w-3 h-3 text-red-600" />
              <span>Overdue Signals ({metrics.criticalCount})</span>
            </button>

            {/* Warning Signals Filter */}
            <button
              type="button"
              onClick={() => setLeadTimeFilter('warning_signals')}
              className={`px-2 py-0.5 text-xs font-semibold rounded-xs transition-colors cursor-pointer border flex items-center gap-1 ${
                leadTimeFilter === 'warning_signals'
                  ? 'bg-amber-800 text-white border-amber-950 shadow-xs'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-300'
              }`}
            >
              <Clock className="w-3 h-3 text-amber-600" />
              <span>Warning ({metrics.warningCount})</span>
            </button>

            {/* On-Track Filter */}
            <button
              type="button"
              onClick={() => setLeadTimeFilter('on_track')}
              className={`px-2 py-0.5 text-xs font-semibold rounded-xs transition-colors cursor-pointer border flex items-center gap-1 ${
                leadTimeFilter === 'on_track'
                  ? 'bg-emerald-800 text-white border-emerald-950 shadow-xs'
                  : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border-emerald-300'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>On-Track ({metrics.onTrackCount})</span>
            </button>
          </div>

          {/* Right Toolbar: Search, Export, Scroll Navigation */}
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
              title="Export Lead Time Data with Signals to CSV"
            >
              <Download className="w-3 h-3 text-slate-500" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* 4. EXPANDED TABLE WITH EXACT UNIFORM ROW HEIGHT (h-8 across all rows) */}
        <div
          ref={tableContainerRef}
          className="overflow-x-auto overflow-y-auto table-scrollbar relative border-b border-slate-200 h-[calc(100vh-190px)] max-h-[calc(100vh-190px)] min-h-[460px]"
        >
          <table className="w-full text-left border-collapse min-w-[1440px]">
            <thead className="sticky top-0 z-30 shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
              <tr className="bg-[#0b1b3d] text-white text-[10px] font-bold uppercase tracking-wider select-none h-8">
                {/* 1. ORDER DATE */}
                <th
                  onClick={() => handleSort('orderDate')}
                  className="py-1 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 left-0 z-40 bg-[#0b1b3d] shadow-[2px_2px_4px_-1px_rgba(0,0,0,0.25)] h-8"
                >
                  <div className="flex items-center gap-1">
                    <span>Order Date</span>
                    {renderSortIcon('orderDate')}
                  </div>
                </th>

                {/* 2. PI NO */}
                <th
                  onClick={() => handleSort('piNumber')}
                  className="py-1 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 left-[90px] z-40 bg-[#0b1b3d] shadow-[4px_2px_6px_-2px_rgba(0,0,0,0.25)] h-8"
                >
                  <div className="flex items-center gap-1">
                    <span>PI No</span>
                    {renderSortIcon('piNumber')}
                  </div>
                </th>

                {/* 3. BUYER */}
                <th
                  onClick={() => handleSort('buyer')}
                  className="py-1 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d] h-8"
                >
                  <div className="flex items-center gap-1">
                    <span>Buyer</span>
                    {renderSortIcon('buyer')}
                  </div>
                </th>

                {/* 4. CUSTOMER */}
                <th
                  onClick={() => handleSort('customer')}
                  className="py-1 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d] h-8"
                >
                  <div className="flex items-center gap-1">
                    <span>Customer</span>
                    {renderSortIcon('customer')}
                  </div>
                </th>

                {/* 5. TC REQUEST DATE */}
                <th
                  onClick={() => handleSort('tcRequestDate')}
                  className="py-1 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d] h-8"
                >
                  <div className="flex items-center gap-1">
                    <span>TC Req Date</span>
                    {renderSortIcon('tcRequestDate')}
                  </div>
                </th>

                {/* 6. STAGE 1: Req -> Comm Doc */}
                <th
                  onClick={() => handleSort('stage1Days')}
                  className="py-1 px-2 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap text-center sticky top-0 z-30 bg-[#0b1b3d] h-8"
                  title={`Stage 1: TC Request to Commercial Document (Custom Target: ≤${slaSettings.s1Target}d)`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>S1: Comm Doc</span>
                    {renderSortIcon('stage1Days')}
                  </div>
                </th>

                {/* 7. STAGE 2: Comm Doc -> Draft TC */}
                <th
                  onClick={() => handleSort('stage2Days')}
                  className="py-1 px-2 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap text-center sticky top-0 z-30 bg-[#0b1b3d] h-8"
                  title={`Stage 2: Commercial Doc to Draft TC (Custom Target: ≤${slaSettings.s2Target}d)`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>S2: Draft TC</span>
                    {renderSortIcon('stage2Days')}
                  </div>
                </th>

                {/* 8. STAGE 3: Draft TC -> Draft Confirmed */}
                <th
                  onClick={() => handleSort('stage3Days')}
                  className="py-1 px-2 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap text-center sticky top-0 z-30 bg-[#0b1b3d] h-8"
                  title={`Stage 3: Draft TC to Draft Confirmed (Custom Target: ≤${slaSettings.s3Target}d)`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>S3: Confirm</span>
                    {renderSortIcon('stage3Days')}
                  </div>
                </th>

                {/* 9. STAGE 4: Confirmed -> Final Apply */}
                <th
                  onClick={() => handleSort('stage4Days')}
                  className="py-1 px-2 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap text-center sticky top-0 z-30 bg-[#0b1b3d] h-8"
                  title={`Stage 4: Draft Confirmed to Final TC Applied (Custom Target: ≤${slaSettings.s4Target}d)`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>S4: Final Apply</span>
                    {renderSortIcon('stage4Days')}
                  </div>
                </th>

                {/* 10. STAGE 5: Final Apply -> Final TC Received */}
                <th
                  onClick={() => handleSort('stage5Days')}
                  className="py-1 px-2 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap text-center sticky top-0 z-30 bg-[#0b1b3d] h-8"
                  title={`Stage 5: Final TC Applied to Final TC Received (Custom Target: ≤${slaSettings.s5Target}d)`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>S5: Final TC</span>
                    {renderSortIcon('stage5Days')}
                  </div>
                </th>

                {/* 11. TOTAL LEAD TIME */}
                <th
                  onClick={() => handleSort('totalLeadDays')}
                  className="py-1 px-3 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d] shadow-[-2px_0_4px_rgba(0,0,0,0.2)] h-8"
                >
                  <div className="flex items-center gap-1 text-amber-300">
                    <Timer className="w-3.5 h-3.5" />
                    <span>Total Lead Time (SLA ≤{slaSettings.totalSlaDays}d)</span>
                    {renderSortIcon('totalLeadDays')}
                  </div>
                </th>

                {/* 12. LEAD TIME SIGNAL */}
                <th
                  onClick={() => handleSort('signalLevel')}
                  className="py-1 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d] h-8"
                >
                  <div className="flex items-center gap-1 text-red-300">
                    <Siren className="w-3.5 h-3.5" />
                    <span>Lead Time Signal</span>
                    {renderSortIcon('signalLevel')}
                  </div>
                </th>

                {/* 13. STATUS / TC # */}
                <th className="py-1 px-2.5 border-r border-[#1a386b] whitespace-nowrap sticky top-0 z-30 bg-[#0b1b3d] h-8">
                  <span>Status / TC #</span>
                </th>
              </tr>
            </thead>

            {/* TBODY WITH STRICT UNIFORM h-8 HEIGHT FOR EVERY ROW */}
            <tbody className="divide-y divide-slate-200 text-xs font-mono">
              {filteredAndSortedList.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-500 bg-white">
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
                      className={`group hover:bg-blue-50/60 cursor-pointer transition-colors h-8 max-h-8 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      } ${isCurrentActive ? 'bg-blue-100/70 ring-1 ring-blue-500' : ''} ${
                        pi.signalLevel === 'critical' ? 'bg-red-50/20' : ''
                      }`}
                    >
                      {/* 1. ORDER DATE */}
                      <td
                        className={`py-1 px-2.5 text-slate-700 whitespace-nowrap border-r border-slate-200 sticky left-0 z-20 h-8 align-middle ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'
                        } group-hover:bg-blue-50/90 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]`}
                      >
                        {pi.orderDate}
                      </td>

                      {/* 2. PI NO */}
                      <td
                        className={`py-1 px-2.5 font-bold text-[#0b1b3d] whitespace-nowrap border-r border-slate-200 sticky left-[90px] z-20 h-8 align-middle ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'
                        } group-hover:bg-blue-50/90 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.1)]`}
                      >
                        {pi.piNumber}
                      </td>

                      {/* 3. BUYER */}
                      <td className="py-1 px-2.5 text-slate-800 font-sans font-bold whitespace-nowrap border-r border-slate-200 h-8 align-middle">
                        {pi.buyer}
                      </td>

                      {/* 4. CUSTOMER */}
                      <td className="py-1 px-2.5 text-slate-700 font-sans font-medium whitespace-nowrap border-r border-slate-200 max-w-[170px] truncate h-8 align-middle" title={pi.customer}>
                        {pi.customer}
                      </td>

                      {/* 5. TC REQUEST DATE */}
                      <td className="py-1 px-2.5 whitespace-nowrap border-r border-slate-200 h-8 align-middle">
                        {pi.tcRequestDate ? (
                          <span className="bg-slate-100 px-1.5 py-0.2 rounded-xs border border-slate-200 text-slate-800 text-[11px]">
                            {pi.tcRequestDate}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* 6. STAGE 1 (Custom Target) */}
                      <td className="py-1 px-2 text-center whitespace-nowrap border-r border-slate-200 h-8 align-middle">
                        {renderStageCell(pi.stage1Days, slaSettings.s1Target)}
                      </td>

                      {/* 7. STAGE 2 (Custom Target) */}
                      <td className="py-1 px-2 text-center whitespace-nowrap border-r border-slate-200 h-8 align-middle">
                        {renderStageCell(pi.stage2Days, slaSettings.s2Target)}
                      </td>

                      {/* 8. STAGE 3 (Custom Target) */}
                      <td className="py-1 px-2 text-center whitespace-nowrap border-r border-slate-200 h-8 align-middle">
                        {renderStageCell(pi.stage3Days, slaSettings.s3Target)}
                      </td>

                      {/* 9. STAGE 4 (Custom Target) */}
                      <td className="py-1 px-2 text-center whitespace-nowrap border-r border-slate-200 h-8 align-middle">
                        {renderStageCell(pi.stage4Days, slaSettings.s4Target)}
                      </td>

                      {/* 10. STAGE 5 (Custom Target) */}
                      <td className="py-1 px-2 text-center whitespace-nowrap border-r border-slate-200 h-8 align-middle">
                        {renderStageCell(pi.stage5Days, slaSettings.s5Target)}
                      </td>

                      {/* 11. TOTAL LEAD TIME (Strict Single Line) */}
                      <td className="py-1 px-3 whitespace-nowrap border-r border-slate-200 h-8 align-middle">
                        {pi.totalLeadDays !== null ? (
                          <div className="flex items-center gap-1.5 leading-none">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs font-mono font-bold text-xs ${
                                pi.signalLevel === 'critical'
                                  ? 'bg-red-100 text-red-900 border border-red-300 font-black shadow-2xs'
                                  : pi.signalLevel === 'warning'
                                  ? 'bg-amber-50 text-amber-900 border border-amber-300'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                              }`}
                            >
                              <Timer className="w-3 h-3 text-slate-500" />
                              <span>{pi.totalLeadDays} Days</span>
                            </span>

                            {pi.isCompleted ? (
                              <span className="text-[10px] font-sans text-emerald-700 font-bold bg-emerald-100/80 px-1 py-0.2 rounded-xs">
                                Done
                              </span>
                            ) : (
                              <span className="text-[10px] font-sans text-amber-700 font-bold bg-amber-100/80 px-1 py-0.2 rounded-xs">
                                Active
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* 12. LEAD TIME SIGNAL (Strict Single Line Badge) */}
                      <td className="py-1 px-2.5 whitespace-nowrap border-r border-slate-200 h-8 align-middle">
                        {pi.signalLevel === 'critical' ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs font-bold text-[10px] bg-red-600 text-white border border-red-700 shadow-xs font-mono uppercase"
                            title={pi.worstBottleneck ? `Overdue Alert! Delay source: ${pi.worstBottleneck}` : `Exceeded SLA Target (> ${slaSettings.totalSlaDays}d)`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" />
                            <span>🚨 OVERDUE SIGNAL</span>
                          </span>
                        ) : pi.signalLevel === 'warning' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs font-bold text-[10px] bg-amber-100 text-amber-900 border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                            <span>⚠️ Warning (≥{slaSettings.warningDays}d)</span>
                          </span>
                        ) : pi.signalLevel === 'normal' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs font-bold text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span>🟢 On-Time</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* 13. ACTIONABLE STATUS / WAITING STAGE */}
                      <td className="py-1 px-2.5 whitespace-nowrap border-r border-slate-200 h-8 align-middle">
                        {(() => {
                          const actionable = computeActionableWaitingStatus(pi);
                          return (
                            <div className="flex items-center gap-1.5 leading-none" title={actionable.actionText}>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-xs font-sans font-bold text-[11px] border shadow-2xs ${actionable.badgeBg} ${actionable.badgeText} ${actionable.badgeBorder}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${actionable.dotColor} shrink-0`} />
                                <span>{actionable.statusLabel}</span>
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Sticky Navy Summary Footer */}
            <tfoot className="sticky bottom-0 z-30 shadow-[0_-2px_4px_rgba(0,0,0,0.2)] select-none">
              <tr className="bg-[#0b1b3d] text-white text-[11px] font-mono font-bold h-8">
                <td
                  colSpan={4}
                  className="py-1.5 px-2.5 border-r border-[#1a386b] whitespace-nowrap sticky bottom-0 left-0 z-40 bg-[#0b1b3d] shadow-[4px_0_6px_-2px_rgba(0,0,0,0.35)] h-8 align-middle"
                >
                  <div className="flex items-center justify-between">
                    <span className="uppercase text-[10px] tracking-wider text-blue-200">Averages Summary</span>
                    <span className="text-white text-[10px]">{filteredAndSortedList.length} PIs</span>
                  </div>
                </td>

                <td className="py-1.5 px-2.5 text-slate-300 border-r border-[#1a386b] text-[10px] font-sans h-8 align-middle">
                  Stage Averages:
                </td>

                <td className="py-1.5 px-2 text-center text-blue-200 border-r border-[#1a386b] h-8 align-middle">
                  {metrics.avgS1}d
                </td>

                <td className="py-1.5 px-2 text-center text-blue-200 border-r border-[#1a386b] h-8 align-middle">
                  {metrics.avgS2}d
                </td>

                <td className="py-1.5 px-2 text-center text-blue-200 border-r border-[#1a386b] h-8 align-middle">
                  {metrics.avgS3}d
                </td>

                <td className="py-1.5 px-2 text-center text-blue-200 border-r border-[#1a386b] h-8 align-middle">
                  {metrics.avgS4}d
                </td>

                <td className="py-1.5 px-2 text-center text-emerald-300 border-r border-[#1a386b] h-8 align-middle">
                  {metrics.avgS5}d
                </td>

                <td className="py-1.5 px-3 border-r border-[#1a386b] text-amber-300 font-bold h-8 align-middle">
                  Avg: {metrics.avgTotal} Days
                </td>

                <td className="py-1.5 px-2.5 text-red-300 border-r border-[#1a386b] h-8 align-middle">
                  Overdue: {metrics.criticalCount}
                </td>

                <td className="py-1.5 px-2.5 text-slate-300 text-[10px] font-sans h-8 align-middle">
                  Done: {metrics.completedCount} / {metrics.totalTracked}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 5. CUSTOM SLA CONFIGURATION MODAL */}
      {isSlaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-md border border-slate-300 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#0b1b3d] text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-300" />
                <h3 className="font-bold text-sm tracking-wide">Customize SLA & Lead Time Targets</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSlaModalOpen(false)}
                className="text-slate-300 hover:text-white p-1 rounded-xs hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3.5 text-xs">
              <p className="text-slate-600 text-xs leading-relaxed">
                আপনার প্রয়োজন অনুযায়ী যেকোনো SLA দিন সংখ্যা টাইপ করুন। ওভারডিউ সিগন্যাল ও স্টেজ বটলেনেক স্বয়ংক্রিয়ভাবে আপডেট হবে।
              </p>

              {/* Overall Total SLA Target */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-sm p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Timer className="w-4 h-4 text-blue-800" />
                    <span>Overall Total TC SLA Target:</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={tempSlaSettings.totalSlaDays}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(180, Number(e.target.value) || 1));
                        setTempSlaSettings((prev) => ({
                          ...prev,
                          totalSlaDays: val,
                          warningDays: Math.max(1, Math.round(val * 0.75)),
                        }));
                      }}
                      className="w-16 px-2 py-1 text-center font-black font-mono text-sm bg-white border border-blue-400 rounded-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden text-[#0b1b3d]"
                    />
                    <span className="font-bold font-mono text-slate-700">Days</span>
                  </div>
                </div>

                {/* Warning Alert Threshold */}
                <div className="flex items-center justify-between pt-1 border-t border-blue-200/60 text-slate-600 text-[11px]">
                  <span>Warning Alert Threshold:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={tempSlaSettings.totalSlaDays}
                      value={tempSlaSettings.warningDays}
                      onChange={(e) =>
                        setTempSlaSettings((prev) => ({
                          ...prev,
                          warningDays: Math.max(1, Number(e.target.value) || 1),
                        }))
                      }
                      className="w-12 px-1 py-0.5 text-center font-mono text-xs bg-white border border-slate-300 rounded-xs"
                    />
                    <span>Days</span>
                  </div>
                </div>
              </div>

              {/* Stage-wise Targets */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono block">
                  Stage-by-Stage Targets (Days):
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-sm border border-slate-200">
                  {/* S1 */}
                  <div className="flex items-center justify-between bg-white px-2 py-1 rounded-xs border border-slate-200">
                    <span className="font-medium text-slate-700">S1: Comm Doc:</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={tempSlaSettings.s1Target}
                      onChange={(e) => setTempSlaSettings((p) => ({ ...p, s1Target: Number(e.target.value) || 1 }))}
                      className="w-10 text-center font-bold font-mono text-xs border border-slate-300 rounded-xs py-0.5"
                    />
                  </div>

                  {/* S2 */}
                  <div className="flex items-center justify-between bg-white px-2 py-1 rounded-xs border border-slate-200">
                    <span className="font-medium text-slate-700">S2: Draft TC:</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={tempSlaSettings.s2Target}
                      onChange={(e) => setTempSlaSettings((p) => ({ ...p, s2Target: Number(e.target.value) || 1 }))}
                      className="w-10 text-center font-bold font-mono text-xs border border-slate-300 rounded-xs py-0.5"
                    />
                  </div>

                  {/* S3 */}
                  <div className="flex items-center justify-between bg-white px-2 py-1 rounded-xs border border-slate-200">
                    <span className="font-medium text-slate-700">S3: Confirm:</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={tempSlaSettings.s3Target}
                      onChange={(e) => setTempSlaSettings((p) => ({ ...p, s3Target: Number(e.target.value) || 1 }))}
                      className="w-10 text-center font-bold font-mono text-xs border border-slate-300 rounded-xs py-0.5"
                    />
                  </div>

                  {/* S4 */}
                  <div className="flex items-center justify-between bg-white px-2 py-1 rounded-xs border border-slate-200">
                    <span className="font-medium text-slate-700">S4: Final Apply:</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={tempSlaSettings.s4Target}
                      onChange={(e) => setTempSlaSettings((p) => ({ ...p, s4Target: Number(e.target.value) || 1 }))}
                      className="w-10 text-center font-bold font-mono text-xs border border-slate-300 rounded-xs py-0.5"
                    />
                  </div>

                  {/* S5 */}
                  <div className="flex items-center justify-between bg-white px-2 py-1 rounded-xs border border-slate-200 sm:col-span-2">
                    <span className="font-medium text-slate-700">S5: Final TC Received:</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={tempSlaSettings.s5Target}
                      onChange={(e) => setTempSlaSettings((p) => ({ ...p, s5Target: Number(e.target.value) || 1 }))}
                      className="w-10 text-center font-bold font-mono text-xs border border-slate-300 rounded-xs py-0.5"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between border-t border-slate-200">
              <button
                type="button"
                onClick={() => setTempSlaSettings(DEFAULT_SLA_SETTINGS)}
                className="flex items-center gap-1 text-slate-600 hover:text-slate-900 text-xs font-semibold px-2 py-1 rounded-xs hover:bg-slate-200 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Defaults</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSlaModalOpen(false)}
                  className="px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateSlaSettings(tempSlaSettings);
                    setIsSlaModalOpen(false);
                  }}
                  className="flex items-center gap-1 px-3.5 py-1 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-xs shadow-xs transition-colors cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Apply SLA Target</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
