import React from 'react';
import {
  FileText,
  AlertCircle,
  Clock,
  CheckCircle2,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
} from 'lucide-react';
import { KPIStats } from '../types/tc';

interface KpiCardGridProps {
  stats: KPIStats;
  currentStatusFilter: string;
  onSelectStatusFilter: (status: string) => void;
}

export const KpiCardGrid: React.FC<KpiCardGridProps> = ({
  stats,
  currentStatusFilter,
  onSelectStatusFilter,
}) => {
  const issuedRate =
    stats.totalPi > 0 ? ((stats.tcIssued / stats.totalPi) * 100).toFixed(1) : '0';
  const avgCost =
    stats.totalPi > 0 ? (stats.totalTcCost / stats.totalPi).toFixed(0) : '0';

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      {/* 1. Total PI */}
      <div
        onClick={() => onSelectStatusFilter('All Statuses')}
        className={`bg-white border rounded-sm p-3 transition-all cursor-pointer hover:border-slate-400 relative overflow-hidden group ${
          currentStatusFilter === 'All Statuses'
            ? 'border-l-4 border-l-[#0b1b3d] border-slate-300 shadow-xs'
            : 'border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Total PI
          </span>
          <FileText className="w-4 h-4 text-[#0b1b3d]" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-[#0b1b3d] tabular-nums">
            {stats.totalPi}
          </span>
          <span className="text-[11px] font-medium text-slate-500">Orders</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1">
          <span>Tracked Volume</span>
          <span className="font-mono text-slate-700">100%</span>
        </div>
      </div>

      {/* 2. TC Required */}
      <div
        onClick={() => onSelectStatusFilter('Required')}
        className={`bg-white border rounded-sm p-3 transition-all cursor-pointer hover:border-slate-400 relative overflow-hidden group ${
          currentStatusFilter === 'Required'
            ? 'border-l-4 border-l-slate-700 border-slate-300 shadow-xs'
            : 'border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            TC Required
          </span>
          <AlertCircle className="w-4 h-4 text-slate-600" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-slate-800 tabular-nums">
            {stats.tcRequired}
          </span>
          <span className="text-[11px] font-medium text-slate-500">To Submit</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1">
          <span>Draft / Prep</span>
          <span className="font-mono text-slate-700">
            {stats.totalPi > 0
              ? Math.round((stats.tcRequired / stats.totalPi) * 100)
              : 0}
            %
          </span>
        </div>
      </div>

      {/* 3. TC Pending */}
      <div
        onClick={() => onSelectStatusFilter('Pending')}
        className={`bg-white border rounded-sm p-3 transition-all cursor-pointer hover:border-amber-400 relative overflow-hidden group ${
          currentStatusFilter === 'Pending'
            ? 'border-l-4 border-l-amber-600 border-amber-300 shadow-xs bg-amber-50/20'
            : 'border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">
            TC Pending
          </span>
          <Clock className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-amber-950 tabular-nums">
            {stats.tcPending}
          </span>
          <span className="text-[11px] font-medium text-amber-700">In Review</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1">
          <span>Cert Body SLA</span>
          <span className="font-mono text-amber-800 font-semibold">Underway</span>
        </div>
      </div>

      {/* 4. TC Issued */}
      <div
        onClick={() => onSelectStatusFilter('Issued')}
        className={`bg-white border rounded-sm p-3 transition-all cursor-pointer hover:border-emerald-400 relative overflow-hidden group ${
          currentStatusFilter === 'Issued'
            ? 'border-l-4 border-l-emerald-600 border-emerald-300 shadow-xs bg-emerald-50/20'
            : 'border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
            TC Issued
          </span>
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-emerald-950 tabular-nums">
            {stats.tcIssued}
          </span>
          <span className="text-[11px] font-medium text-emerald-700">Certified</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1">
          <span>Completion</span>
          <span className="font-mono text-emerald-800 font-semibold">
            {issuedRate}%
          </span>
        </div>
      </div>

      {/* 5. Total TC Cost */}
      <div className="bg-white border border-slate-200 rounded-sm p-3 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0b1b3d]">
            Total TC Cost
          </span>
          <DollarSign className="w-4 h-4 text-[#1e3a8a]" />
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold font-mono text-[#0b1b3d] tabular-nums">
            ${stats.totalTcCost.toLocaleString()}
          </span>
          <span className="text-[11px] font-semibold text-slate-500">USD</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1">
          <span>Avg / PI</span>
          <span className="font-mono text-slate-700">${avgCost}</span>
        </div>
      </div>

      {/* 6. Overdue (Limited Red Accent) */}
      <div
        onClick={() => onSelectStatusFilter('Overdue')}
        className={`bg-white border rounded-sm p-3 transition-all cursor-pointer hover:border-red-400 relative overflow-hidden group ${
          currentStatusFilter === 'Overdue'
            ? 'border-l-4 border-l-red-600 border-red-300 shadow-xs bg-red-50/30'
            : stats.overdue > 0
            ? 'border-red-200 bg-red-50/10'
            : 'border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-800">
            Overdue
          </span>
          <AlertTriangle className="w-4 h-4 text-red-600 animate-pulse" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-red-600 tabular-nums">
            {stats.overdue}
          </span>
          <span className="text-[11px] font-semibold text-red-700 uppercase">
            Action Req.
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-red-700 border-t border-red-100 pt-1">
          <span>Past Target Date</span>
          <span className="font-mono font-bold flex items-center gap-0.5">
            View <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  );
};
