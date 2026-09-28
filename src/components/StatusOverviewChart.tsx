import React, { useState, useMemo } from 'react';
import { PIData, computeAutomatedTcStatus } from '../types/tc';
import { PieChart, ListFilter, Info, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface StatusOverviewChartProps {
  data: PIData[];
  onSelectStatus?: (status: string) => void;
}

export const StatusOverviewChart: React.FC<StatusOverviewChartProps> = ({
  data,
  onSelectStatus,
}) => {
  const [viewMode, setViewMode] = useState<'all' | 'summary'>('all');
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const total = data.length || 1;

  // 1. Compute granular PI counts for all 9 automated pipeline conditions
  const autoConditionsList = useMemo(() => {
    const counts: Record<string, number> = {
      'Final TC Received': 0,
      'Final TC Applied': 0,
      'Draft Confirmed': 0,
      'Revision': 0,
      'Draft TC Received': 0,
      'Commercial Doc Received': 0,
      'TC Requested': 0,
      'Not Requested': 0,
      'Overdue': 0,
    };

    data.forEach((item) => {
      let st: string = item.tcStatus;
      if (st === 'Overdue') {
        counts['Overdue'] += 1;
        return;
      }
      if (st === 'Issued' || st === 'Final TC Received') {
        counts['Final TC Received'] += 1;
        return;
      }

      const computed = computeAutomatedTcStatus(item);
      if (computed in counts) {
        counts[computed] += 1;
      } else if (st === 'Required') {
        counts['Not Requested'] += 1;
      } else {
        counts['Not Requested'] += 1;
      }
    });

    const stages = [
      { name: 'Final TC Received', label: 'Final TC Received', color: '#15803d', barClass: 'bg-emerald-600' },
      { name: 'Final TC Applied', label: 'Final TC Applied', color: '#0d9488', barClass: 'bg-teal-600' },
      { name: 'Draft Confirmed', label: 'Draft Confirmed', color: '#0284c7', barClass: 'bg-sky-600' },
      { name: 'Revision', label: 'Revision', color: '#d97706', barClass: 'bg-amber-600' },
      { name: 'Draft TC Received', label: 'Draft TC Received', color: '#2563eb', barClass: 'bg-blue-600' },
      { name: 'Commercial Doc Received', label: 'Comm. Doc Rec.', color: '#4f46e5', barClass: 'bg-indigo-600' },
      { name: 'TC Requested', label: 'TC Requested', color: '#7c3aed', barClass: 'bg-purple-600' },
      { name: 'Overdue', label: 'Overdue', color: '#dc2626', barClass: 'bg-red-600' },
      { name: 'Not Requested', label: 'Not Requested', color: '#64748b', barClass: 'bg-slate-500' },
    ];

    return stages.map((stage) => {
      const count = counts[stage.name] || 0;
      return {
        ...stage,
        count,
        pct: (count / total) * 100,
      };
    });
  }, [data, total]);

  // 2. Summary 4-bucket grouping
  const issued = data.filter((d) => d.tcStatus === 'Issued' || d.tcStatus === 'Final TC Received');
  const pending = data.filter((d) => d.tcStatus === 'Pending' || d.tcStatus === 'Under Review' || (d.tcStatus !== 'Issued' && d.tcStatus !== 'Final TC Received' && d.tcStatus !== 'Required' && d.tcStatus !== 'Not Requested' && d.tcStatus !== 'Overdue'));
  const required = data.filter((d) => d.tcStatus === 'Required' || d.tcStatus === 'Not Requested');
  const overdue = data.filter((d) => d.tcStatus === 'Overdue');

  const segments = [
    {
      name: 'Issued',
      label: 'TC Issued / Received',
      count: issued.length,
      color: '#15803d',
      pct: (issued.length / total) * 100,
    },
    {
      name: 'Pending',
      label: 'TC In-Pipeline',
      count: pending.length,
      color: '#d97706',
      pct: (pending.length / total) * 100,
    },
    {
      name: 'Required',
      label: 'TC Not Requested',
      count: required.length,
      color: '#64748b',
      pct: (required.length / total) * 100,
    },
    {
      name: 'Overdue',
      label: 'TC Overdue',
      count: overdue.length,
      color: '#dc2626',
      pct: (overdue.length / total) * 100,
    },
  ];

  // SVG Donut calculation for summary
  let cumulativePct = 0;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="bg-white border border-slate-200 rounded-sm p-2 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <PieChart className="w-3.5 h-3.5 text-[#0b1b3d]" />
          <h3 className="text-[11px] font-bold text-[#0b1b3d] uppercase tracking-wide">
            TC Status Overview ({data.length} PIs)
          </h3>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
          <button
            onClick={() => setViewMode('all')}
            className={`px-1.5 py-0.5 text-[9px] font-medium rounded transition-all ${
              viewMode === 'all'
                ? 'bg-white text-blue-900 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All 9 Auto Conditions
          </button>
          <button
            onClick={() => setViewMode('summary')}
            className={`px-1.5 py-0.5 text-[9px] font-medium rounded transition-all ${
              viewMode === 'summary'
                ? 'bg-white text-blue-900 font-bold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Donut
          </button>
        </div>
      </div>

      {/* Main Area: All 9 Granular Conditions View */}
      {viewMode === 'all' ? (
        <div className="py-1 grid grid-cols-1 gap-1 max-h-[160px] overflow-y-auto pr-0.5">
          {autoConditionsList.map((st) => (
            <div
              key={st.name}
              onClick={() => onSelectStatus && onSelectStatus(st.name)}
              className="flex items-center justify-between text-xs py-0.5 px-1.5 rounded bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-100"
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span
                  className="w-2 h-2 rounded-xs shrink-0"
                  style={{ backgroundColor: st.color }}
                />
                <span className="text-[10px] font-medium text-slate-800 truncate">
                  {st.label}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                <div className="w-14 bg-slate-200 h-1.5 rounded-full overflow-hidden hidden sm:block">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${st.pct}%`,
                      backgroundColor: st.color,
                    }}
                  />
                </div>
                <span className="font-bold text-[#0b1b3d] tabular-nums bg-white px-1 py-0.2 rounded border border-slate-200 min-w-[36px] text-center text-[10px]">
                  {st.count} PIs
                </span>
                <span className="text-[9px] text-slate-400 tabular-nums w-6 text-right">
                  {st.pct.toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Donut Summary View */
        <div className="py-1.5 flex items-center justify-center gap-3">
          <div className="relative w-28 h-28 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke="#f1f5f9"
                strokeWidth="16"
              />
              {segments.map((seg) => {
                if (seg.pct <= 0) return null;
                const strokeDasharray = `${(seg.pct / 100) * circumference} ${circumference}`;
                const strokeDashoffset = -((cumulativePct / 100) * circumference);
                cumulativePct += seg.pct;

                const isHovered = hoveredSegment === seg.name;

                return (
                  <circle
                    key={seg.name}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth={isHovered ? '19' : '16'}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={() => setHoveredSegment(seg.name)}
                    onMouseLeave={() => setHoveredSegment(null)}
                    onClick={() => onSelectStatus && onSelectStatus(seg.name)}
                  />
                );
              })}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-sm font-bold font-mono text-[#0b1b3d] leading-none">
                {hoveredSegment
                  ? segments.find((s) => s.name === hoveredSegment)?.count
                  : data.length}
              </span>
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-tight mt-0.5">
                {hoveredSegment
                  ? segments.find((s) => s.name === hoveredSegment)?.name
                  : 'Active PIs'}
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-1.5">
            {segments.map((seg) => {
              const isHovered = hoveredSegment === seg.name;
              return (
                <div
                  key={seg.name}
                  onMouseEnter={() => setHoveredSegment(seg.name)}
                  onMouseLeave={() => setHoveredSegment(null)}
                  onClick={() => onSelectStatus && onSelectStatus(seg.name)}
                  className={`flex items-center justify-between text-xs p-1 rounded-sm cursor-pointer transition-colors ${
                    isHovered ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-[11px] font-medium text-slate-700 truncate">
                      {seg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                    <span className="font-bold text-slate-900 tabular-nums">
                      {seg.count} PIs
                    </span>
                    <span className="text-slate-500 tabular-nums w-10 text-right">
                      {seg.pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Summary Strip */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1">
          <Info className="w-3 h-3 text-slate-400" />
          <span>Click any status to filter dataset</span>
        </div>
        <span className="font-mono font-bold text-blue-900">
          9 Automated Workflow Conditions
        </span>
      </div>
    </div>
  );
};
