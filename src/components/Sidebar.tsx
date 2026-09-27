import React from 'react';
import {
  Layers,
  LayoutDashboard,
  Building2,
  UploadCloud,
  BarChart3,
  Table,
  Download,
  RefreshCw,
} from 'lucide-react';
import { UploadedFileInfo } from '../types/tc';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  filteredCount: number;
  totalCount: number;
  overdueCount: number;
  pendingCount: number;
  activeFileInfo: UploadedFileInfo | null;
  onRefresh?: () => void;
  onExport?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  filteredCount,
  totalCount,
  overdueCount,
  pendingCount,
  activeFileInfo,
  onRefresh,
  onExport,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const navItems = [
    {
      id: 'Dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'TC Master',
      label: 'TC Master',
      icon: Table,
      badge: `${totalCount}`,
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30 font-semibold',
    },
    {
      id: 'Executive Summary',
      label: 'Executive Summary',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'Excel Upload',
      label: 'Excel Import / Upload',
      icon: UploadCloud,
      badge: activeFileInfo ? 'Active File' : 'Import',
      badgeColor: activeFileInfo
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-semibold'
        : 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* Sidebar Main Container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-64 bg-[#08152e] text-slate-200 flex flex-col border-r border-[#16294d] transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-[#142647] bg-[#061024]">
          <div className="flex items-center gap-3">
            <div className="bg-[#1e3a8a] text-white p-2 rounded-sm border border-blue-400/30 flex items-center justify-center shadow-inner">
              <Layers className="w-5 h-5 text-blue-200" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-widest text-white font-mono uppercase">
                  MAINETTI
                </span>
                <span className="text-red-500 font-bold text-xs">●</span>
              </div>
              <span className="text-[11px] font-semibold text-blue-200 uppercase tracking-tight truncate">
                TC Management Console
              </span>
              <span className="text-[9px] text-slate-400 font-mono tracking-tighter truncate">
                Apparel Sourcing & Compliance
              </span>
            </div>
          </div>
        </div>

        {/* Operational Scope Marker */}
        <div className="px-4 py-2 bg-[#0a1b38] border-b border-[#142647] flex items-center justify-between text-[11px] text-slate-300">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-300" />
            <span className="font-medium text-slate-200">Global Hub · EPZ</span>
          </div>
          <span className="text-[10px] font-mono bg-[#162c54] text-blue-200 px-1.5 py-0.5 rounded-xs">
            v2026.4
          </span>
        </div>

        {/* Navigation Options List */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          <div className="px-3 pb-1.5 text-[10px] font-bold font-mono uppercase tracking-wider text-slate-400">
            Main Operations
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-sm transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#132d5e] text-white font-semibold border-l-4 border-l-red-500 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-blue-300' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-xs border ${
                      item.badgeColor ||
                      'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom System Status & Actions */}
        <div className="p-3 border-t border-[#142647] bg-[#061024] space-y-2">
          {/* Live System Indicator */}
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#08152e] border border-[#18315c] text-[11px] font-mono text-slate-300 rounded-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-white">LIVE SYSTEM</span>
            </div>
            <span className="text-slate-400">
              {filteredCount}/{totalCount} PIs
            </span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-1.5">
            {onExport && (
              <button
                type="button"
                onClick={onExport}
                className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-[#132c5e] hover:bg-[#1b3d82] text-slate-100 border border-[#254d9b] rounded-sm transition-colors cursor-pointer"
                title="Export report to CSV"
              >
                <Download className="w-3.5 h-3.5 text-blue-200" />
                <span>Export CSV</span>
              </button>
            )}

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-[#132c5e] hover:bg-[#1b3d82] text-slate-100 border border-[#254d9b] rounded-sm transition-colors cursor-pointer"
                title="Sync and refresh data"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-200" />
                <span>Refresh</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
