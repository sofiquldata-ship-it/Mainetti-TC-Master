import React, { useState, useMemo } from 'react';
import { PIData, MonthlyTrendData } from '../types/tc';
import { MONTHLY_TREND_DATA } from '../data/mockData';
import { TrendingUp, Layers } from 'lucide-react';

interface MonthlyCostTrendChartProps {
  data?: PIData[];
}

export const MonthlyCostTrendChart: React.FC<MonthlyCostTrendChartProps> = ({ data }) => {
  // Dynamically compute monthly trends if data is provided, otherwise fallback to default
  const trendData = useMemo<MonthlyTrendData[]>(() => {
    if (!data || data.length === 0) return MONTHLY_TREND_DATA;

    const monthMap: Record<
      string,
      {
        cost: number;
        issued: number;
        pending: number;
        grs: number;
        fsc: number;
        gots: number;
      }
    > = {};

    data.forEach((item) => {
      const d = new Date(item.orderDate);
      const monthKey = !isNaN(d.getTime())
        ? d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
        : 'Aug 2026';

      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {
          cost: 0,
          issued: 0,
          pending: 0,
          grs: 0,
          fsc: 0,
          gots: 0,
        };
      }

      monthMap[monthKey].cost += item.tcCost;
      if (item.tcStatus === 'Issued') {
        monthMap[monthKey].issued += 1;
      } else {
        monthMap[monthKey].pending += 1;
      }

      const std = (item.standard || '').toUpperCase();
      if (std.includes('FSC')) {
        monthMap[monthKey].fsc += item.tcCost;
      } else if (std.includes('GOTS')) {
        monthMap[monthKey].gots += item.tcCost;
      } else {
        monthMap[monthKey].grs += item.tcCost;
      }
    });

    const entries = Object.entries(monthMap);
    if (entries.length === 0) return MONTHLY_TREND_DATA;

    return entries.map(([month, stats]) => ({
      month,
      cost: stats.cost,
      tcIssuedCount: stats.issued,
      tcPendingCount: stats.pending,
      grsCost: stats.grs,
      fscCost: stats.fsc,
      gotsCost: stats.gots,
    }));
  }, [data]);

  const [activeMonthIndex, setActiveMonthIndex] = useState<number>(0);

  // Keep index within bounds if data length changes
  const safeIndex = Math.min(activeMonthIndex, Math.max(0, trendData.length - 1));
  const activeItem = trendData[safeIndex] || trendData[0];
  const maxCost = Math.max(...trendData.map((d) => d.cost), 100) * 1.15;

  return (
    <div className="bg-white border border-slate-200 rounded-sm p-3.5 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#0b1b3d]" />
          <h3 className="text-xs font-bold text-[#0b1b3d] uppercase tracking-wide">
            Monthly TC Cost Trend
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-[#0b1b3d]" /> GRS/RCS
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-[#1e3a8a]" /> FSC
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-[#64748b]" /> GOTS
          </span>
        </div>
      </div>

      {/* Interactive Bar Chart Area */}
      <div className="py-2">
        <div className="h-28 flex items-end justify-between gap-2 pt-4 px-1">
          {trendData.map((item, idx) => {
            const heightPct = Math.max(8, (item.cost / maxCost) * 100);
            const totalItemCost = item.cost || 1;
            const grsPct = (item.grsCost / totalItemCost) * 100;
            const fscPct = (item.fscCost / totalItemCost) * 100;
            const gotsPct = (item.gotsCost / totalItemCost) * 100;
            const isSelected = safeIndex === idx;

            return (
              <div
                key={item.month}
                onMouseEnter={() => setActiveMonthIndex(idx)}
                className="flex-1 flex flex-col items-center group cursor-pointer h-full justify-end"
              >
                {/* Value tooltip tag above bar on hover */}
                <div
                  className={`text-[10px] font-mono font-bold transition-opacity whitespace-nowrap mb-1 ${
                    isSelected
                      ? 'text-[#0b1b3d] opacity-100'
                      : 'text-slate-400 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  ${item.cost >= 1000 ? `${(item.cost / 1000).toFixed(1)}k` : item.cost}
                </div>

                {/* Stacked Bar Container */}
                <div
                  className={`w-full max-w-[28px] rounded-xs flex flex-col overflow-hidden transition-all duration-200 ${
                    isSelected
                      ? 'ring-2 ring-blue-500 ring-offset-1'
                      : 'hover:brightness-110'
                  }`}
                  style={{ height: `${heightPct}%` }}
                >
                  <div
                    style={{ height: `${gotsPct}%` }}
                    className="bg-[#64748b] w-full"
                    title={`GOTS: $${item.gotsCost}`}
                  />
                  <div
                    style={{ height: `${fscPct}%` }}
                    className="bg-[#1e3a8a] w-full"
                    title={`FSC: $${item.fscCost}`}
                  />
                  <div
                    style={{ height: `${grsPct}%` }}
                    className="bg-[#0b1b3d] w-full"
                    title={`GRS: $${item.grsCost}`}
                  />
                </div>

                {/* Month Label */}
                <span
                  className={`mt-1.5 text-[10px] font-mono whitespace-nowrap ${
                    isSelected
                      ? 'font-bold text-[#0b1b3d]'
                      : 'text-slate-500 group-hover:text-slate-900'
                  }`}
                >
                  {item.month.split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Month Detail Strip */}
      {activeItem && (
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-[11px] text-slate-600">
            <Layers className="w-3.5 h-3.5 text-blue-900" />
            <strong className="text-[#0b1b3d]">{activeItem.month}:</strong>
            <span className="font-mono text-slate-500">
              {activeItem.tcIssuedCount} Issued · {activeItem.tcPendingCount} In-Pipe
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-slate-500">Total:</span>
            <span className="font-bold text-[#0b1b3d] tabular-nums">
              ${activeItem.cost.toLocaleString()} USD
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
