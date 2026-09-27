import React from 'react';
import { PIData, DeliveryStatus } from '../types/tc';
import { Truck, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

interface OrderDeliverySnapshotProps {
  data: PIData[];
  onFilterDelivery?: (status: DeliveryStatus) => void;
  activeDeliveryFilter?: string;
}

export const OrderDeliverySnapshot: React.FC<OrderDeliverySnapshotProps> = ({
  data,
  onFilterDelivery,
  activeDeliveryFilter,
}) => {
  const deliveryStages: {
    status: DeliveryStatus;
    label: string;
    matches: (d: PIData) => boolean;
  }[] = [
    {
      status: 'Delivered',
      label: 'Delivered',
      matches: (d) => d.deliveryStatus === 'Delivered',
    },
    {
      status: 'Dispatched',
      label: 'Dispatched',
      matches: (d) =>
        d.deliveryStatus === 'Dispatched' ||
        d.deliveryStatus === 'In Transit' ||
        d.deliveryStatus === 'Port Clearance' ||
        d.deliveryStatus === 'Production Complete',
    },
    {
      status: 'Pending Dispatch',
      label: 'Pending Dispatch',
      matches: (d) => d.deliveryStatus === 'Pending Dispatch',
    },
  ];

  const total = data.length || 1;

  // Calculate items at risk: Delivered or Dispatched where TC is NOT Issued (Pending or Overdue)
  const deliveryAtRisk = data.filter(
    (d) =>
      (d.deliveryStatus === 'Delivered' || d.deliveryStatus === 'Dispatched' || d.deliveryStatus === 'In Transit') &&
      d.tcStatus !== 'Issued' &&
      d.tcStatus !== 'Final TC Received'
  );

  return (
    <div className="bg-white border border-slate-200 rounded-sm p-3.5 shadow-xs flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-[#0b1b3d]" />
          <h3 className="text-xs font-bold text-[#0b1b3d] uppercase tracking-wide">
            Order & Delivery Snapshot
          </h3>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          {deliveryAtRisk.length > 0 ? (
            <span className="flex items-center gap-1 text-red-700 font-bold bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-xs">
              <AlertTriangle className="w-3 h-3" />
              {deliveryAtRisk.length} Post-Shipment Pending
            </span>
          ) : (
            <span className="text-emerald-700 font-medium">All Goods In Sync</span>
          )}
        </div>
      </div>

      {/* Breakdown Grid */}
      <div className="py-2.5 space-y-2.5">
        {deliveryStages.map(({ status, label, matches }) => {
          const matching = data.filter((d) => matches(d));
          const count = matching.length;
          const issuedCount = matching.filter((d) => d.tcStatus === 'Issued').length;
          const pendingCount = matching.filter(
            (d) => d.tcStatus === 'Pending' || d.tcStatus === 'Under Review'
          ).length;
          const overdueCount = matching.filter((d) => d.tcStatus === 'Overdue').length;
          const requiredCount = matching.filter((d) => d.tcStatus === 'Required' || d.tcStatus === 'Not Requested').length;

          const pct = (count / total) * 100;
          const isAtRisk = (status === 'Delivered' || status === 'Port Clearance') && (overdueCount > 0 || pendingCount > 0);
          const isSelected = activeDeliveryFilter === status;

          return (
            <div
              key={status}
              onClick={() => onFilterDelivery && onFilterDelivery(status)}
              className={`flex flex-col gap-0.5 p-1 rounded transition-all cursor-pointer ${
                isSelected
                  ? 'bg-blue-50 border border-blue-200 shadow-2xs'
                  : 'hover:bg-slate-50 border border-transparent'
              }`}
              title={`Click to filter table by ${label}`}
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[11px] font-medium truncate ${
                      isSelected
                        ? 'text-blue-900 font-bold'
                        : isAtRisk
                        ? 'text-red-900 font-semibold'
                        : 'text-slate-700'
                    }`}
                  >
                    {label}
                  </span>
                  {overdueCount > 0 && (
                    <span className="text-[10px] font-mono font-bold text-red-600 bg-red-50 px-1 rounded-xs">
                      {overdueCount} Overdue
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-slate-500">
                    <strong className="text-slate-900 font-bold">{count}</strong> PIs
                  </span>
                  <span className="text-[10px] text-slate-400">({pct.toFixed(0)}%)</span>
                </div>
              </div>

              {/* Progress Distribution Bar */}
              <div className="w-full bg-slate-100 h-1.5 rounded-xs overflow-hidden flex">
                {count > 0 ? (
                  <>
                    <div
                      style={{ width: `${(issuedCount / count) * 100}%` }}
                      className="bg-[#1e3a8a] h-full"
                      title={`${issuedCount} TC Issued`}
                    />
                    <div
                      style={{ width: `${(pendingCount / count) * 100}%` }}
                      className="bg-amber-500 h-full"
                      title={`${pendingCount} TC Pending`}
                    />
                    <div
                      style={{ width: `${(requiredCount / count) * 100}%` }}
                      className="bg-slate-400 h-full"
                      title={`${requiredCount} TC Required`}
                    />
                    <div
                      style={{ width: `${(overdueCount / count) * 100}%` }}
                      className="bg-red-600 h-full"
                      title={`${overdueCount} TC Overdue`}
                    />
                  </>
                ) : (
                  <div className="bg-slate-200 w-full h-full" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Legend */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-xs bg-[#1e3a8a]" /> TC Issued
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-xs bg-amber-500" /> Pending
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-xs bg-slate-400" /> Required
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-xs bg-red-600" /> Overdue
        </span>
      </div>
    </div>
  );
};
