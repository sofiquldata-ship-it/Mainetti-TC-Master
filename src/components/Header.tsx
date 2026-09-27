import React from 'react';
import { Menu, Calendar, ShieldCheck, Download, RefreshCw, Layers, FileSpreadsheet, ExternalLink, Zap, Check, Loader2, CloudCheck } from 'lucide-react';
import { LinkedSheetConfig } from '../utils/googleSheetsService';

interface HeaderProps {
  onToggleMobileSidebar: () => void;
  onRefresh?: () => void;
  onExport?: () => void;
  onOpenGoogleSheetsSync?: () => void;
  linkedSheet?: LinkedSheetConfig | null;
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
  lastAutoSyncTime?: string | null;
  isGoogleSignedIn?: boolean;
  filteredCount: number;
  totalCount: number;
  activeTab: string;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileSidebar,
  onRefresh,
  onExport,
  onOpenGoogleSheetsSync,
  linkedSheet,
  syncStatus = 'idle',
  lastAutoSyncTime,
  isGoogleSignedIn = false,
  filteredCount,
  totalCount,
  activeTab,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-13">
          {/* Left: Mobile Toggle + Breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleMobileSidebar}
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-sm border border-slate-300 transition-colors"
              aria-label="Toggle navigation sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Trail */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-500 uppercase tracking-wide">
                Mainetti Operations
              </span>
              <span className="text-slate-300">/</span>
              <span className="font-bold text-[#0b1b3d] font-mono uppercase tracking-tight">
                {activeTab}
              </span>
            </div>
          </div>

          {/* Right: Operational Date Stamp & Quick Stats */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-sm">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono text-[11px] text-slate-700">
                FY 2026 · Cycle Q3
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-700 rounded-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span>
                <strong>{filteredCount}</strong>/{totalCount} Records
              </span>
            </div>

            {/* Real-time Google Sheet Auto-Save Status / Button */}
            {onOpenGoogleSheetsSync && (
              <button
                type="button"
                onClick={onOpenGoogleSheetsSync}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-sm transition-all cursor-pointer shadow-2xs ${
                  syncStatus === 'syncing'
                    ? 'text-blue-900 bg-blue-100 border border-blue-400 animate-pulse'
                    : linkedSheet
                    ? 'text-emerald-900 bg-emerald-100/90 hover:bg-emerald-200 border border-emerald-400'
                    : isGoogleSignedIn
                    ? 'text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300'
                    : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300'
                }`}
                title={
                  syncStatus === 'syncing'
                    ? 'Auto-saving data to Google Sheet...'
                    : linkedSheet
                    ? `Auto-Saved to: ${linkedSheet.title} (Auto-sync active)`
                    : 'Save & Auto-Sync to Google Sheets'
                }
              >
                {syncStatus === 'syncing' ? (
                  <Loader2 className="w-3.5 h-3.5 text-blue-700 animate-spin" />
                ) : linkedSheet ? (
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                )}

                <span className="hidden sm:inline font-mono text-[11px]">
                  {syncStatus === 'syncing'
                    ? 'Auto-Saving to Sheet...'
                    : linkedSheet
                    ? lastAutoSyncTime
                      ? `Auto-Saved (${lastAutoSyncTime})`
                      : 'Auto-Saved to Sheet'
                    : 'Auto-Sync Google Sheet'}
                </span>

                {linkedSheet && syncStatus !== 'syncing' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                )}
              </button>
            )}

            {onExport && (
              <button
                type="button"
                onClick={onExport}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-[#0b1b3d] bg-white border border-slate-300 hover:bg-slate-50 rounded-sm transition-colors cursor-pointer"
                title="Export current view to CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>CSV</span>
              </button>
            )}

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-[#0b1b3d] bg-white border border-slate-300 hover:bg-slate-50 rounded-sm transition-colors cursor-pointer"
                title="Reload latest data from Database / Google Sheet"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden md:inline font-mono text-[11px]">Sync / Reload</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

