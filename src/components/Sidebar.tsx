import React from 'react';
import {
  Layers,
  LayoutDashboard,
  UploadCloud,
  BarChart3,
  Table,
  FolderClock,
  Timer,
  Download,
  RefreshCw,
  PanelLeftClose,
  FileText,
  FileSpreadsheet,
  FileCheck2,
} from 'lucide-react';
import { UploadedFileInfo } from '../types/tc';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  filteredCount: number;
  totalCount: number;
  overdueCount: number;
  pendingCount: number;
  declarationCount?: number;
  activeFileInfo: UploadedFileInfo | null;
  onRefresh?: () => void;
  onExport?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  filteredCount,
  totalCount,
  overdueCount,
  pendingCount,
  declarationCount = 0,
  activeFileInfo,
  onRefresh,
  onExport,
  isOpenMobile = false,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
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
      id: 'Commercial Follow-up',
      label: 'Commercial Follow-up',
      icon: FolderClock,
      badge: null,
    },
    {
      id: 'TC Lead Time',
      label: 'TC Lead Time',
      icon: Timer,
      badge: null,
    },
    {
      id: 'Executive Summary',
      label: 'Executive Summary',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'Declaration',
      label: 'Declaration (90+ Days)',
      icon: FileCheck2,
      badge: declarationCount > 0 ? `${declarationCount}` : 'Letter',
      badgeColor: declarationCount > 0
        ? 'bg-amber-500/25 text-amber-300 border-amber-500/40 font-bold'
        : 'bg-blue-500/20 text-blue-300 border-blue-500/30 font-semibold',
    },
    {
      id: 'Document',
      label: 'Document',
      icon: FileText,
      badge: 'PDF',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30 font-semibold',
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
    {
      id: 'Commercial Doc Reader',
      label: 'Commercial Doc Reader',
      icon: FileSpreadsheet,
      badge: '5 Sheets',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-semibold',
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
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 bg-[#08152e] text-slate-200 flex flex-col border-r border-[#16294d] transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
          isOpenMobile ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${
          isCollapsed
            ? 'lg:w-0 lg:opacity-0 lg:pointer-events-none lg:border-r-0'
            : 'lg:w-64 lg:opacity-100'
        }`}
      >
        <div className="w-64 flex flex-col h-full shrink-0">
          {/* Brand Header */}
          <div className="p-3.5 border-b border-[#142647] bg-[#061024]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="bg-[#1e3a8a] text-white p-1.5 rounded-sm border border-blue-400/30 flex items-center justify-center shadow-inner shrink-0">
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
                </div>
              </div>

              {/* Hide / Collapse Sidebar Button */}
              <button
                type="button"
                onClick={() => {
                  if (isOpenMobile && onCloseMobile) {
                    onCloseMobile();
                  } else if (onToggleCollapse) {
                    onToggleCollapse();
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-sm transition-colors cursor-pointer ml-1 shrink-0"
                title="Hide Sidebar"
                aria-label="Hide Sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation Options List */}
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
            <div className="px-3 pb-1 text-[10px] font-bold font-mono uppercase tracking-wider text-slate-400">
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
        </div>
      </aside>
    </>
  );
};
