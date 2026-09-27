import React, { useState } from 'react';
import { PIData } from '../types/tc';
import { PieChart, Info } from 'lucide-react';

interface StatusOverviewChartProps {
  data: PIData[];
  onSelectStatus?: (status: string) => void;
}

export const StatusOverviewChart: React.FC<StatusOverviewChartProps> = ({
  data,
  onSelectStatus,
}) => {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const issued = data.filter((d) => d.tcStatus === 'Issued');
  const pending = data.filter((d) => d.tcStatus === 'Pending' || d.tcStatus === 'Under Review');
  const required = data.filter((d) => d.tcStatus === 'Required');
  const overdue = data.filter((d) => d.tcStatus === 'Overdue');

  const total = data.length || 1;

  const segments = [
    {
      name: 'Issued',
      label: 'TC Issued',
      count: issued.length,
      cost: issued.reduce((acc, i) => acc + i.tcCost, 0),
      color: '#1e3a8a', // Deep corporate navy blue
      barColor: 'bg-[#1e3a8a]',
      textColor: 'text-[#1e3a8a]',
      pct: (issued.length / total) * 100,
    },
    {
      name: 'Pending',
      label: 'TC Pending Review',
      count: pending.length,
      cost: pending.reduce((acc, i) => acc + i.tcCost, 0),
      color: '#d97706', // Amber
      barColor: 'bg-amber-600',
      textColor: 'text-amber-800',
      pct: (pending.length / total) * 100,
    },
    {
      name: 'Required',
      label: 'TC Required / Prep',
      count: required.length,
      cost: required.reduce((acc, i) => acc + i.tcCost, 0),
      color: '#64748b', // Slate
      barColor: 'bg-slate-500',
      textColor: 'text-slate-700',
      pct: (required.length / total) * 100,
    },
    {
      name: 'Overdue',
      label: 'TC Overdue',
      count: overdue.length,
      cost: overdue.reduce((acc, i) => acc + i.tcCost, 0),
      color: '#dc2626', // Red Accent
      barColor: 'bg-red-600',
      textColor: 'text-red-700',
      pct: (overdue.length / total) * 100,
    },
  ];

  // SVG Donut calculation
  let cumulativePct = 0;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="bg-white border border-slate-200 rounded-sm p-3.5 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-[#0b1b3d]" />
          <h3 className="text-xs font-bold text-[#0b1b3d] uppercase tracking-wide">
            TC Status Overview
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          Total: <strong className="text-slate-800">{data.length}</strong> PIs
        </span>
      </div>

      {/* Main Chart Area */}
      <div className="py-3 flex items-center justify-center gap-5">
        {/* SVG Donut */}
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

          {/* Donut Center Counter */}
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

        {/* Legend / Breakdown Strip */}
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
                    {seg.count}
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

      {/* Footer Summary Strip */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1">
          <Info className="w-3 h-3 text-slate-400" />
          <span>Click segment to filter table</span>
        </div>
        <span className="font-mono font-semibold text-slate-800">
          ${segments.reduce((a, b) => a + b.cost, 0).toLocaleString()} USD Total
        </span>
      </div>
    </div>
  );
};
