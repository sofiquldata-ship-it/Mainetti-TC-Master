import React, { useState, useEffect } from 'react';
import { PIData, UploadedFileInfo } from '../types/tc';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  X,
  Loader2,
  LogOut,
  Sparkles,
  Link,
  RefreshCw,
  Zap,
  Unlink,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  Database,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { googleSignIn, googleSignOut, gisTokenClientSignIn, getStoredTokenAndUser } from '../utils/googleAuth';
import {
  exportDataToGoogleSheets,
  syncDataToExistingSpreadsheet,
  importDataFromGoogleSpreadsheet,
  getSavedLinkedSheet,
  saveLinkedSheetConfig,
  extractSpreadsheetIdFromUrlOrId,
  LinkedSheetConfig,
  GoogleSheetsExportResult,
} from '../utils/googleSheetsService';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PIData[];
  user: User | null;
  accessToken: string | null;
  onAuthSuccess: (user: User, token: string) => void;
  onSignOut: () => void;
  onDataImported?: (newData: PIData[], fileInfo: UploadedFileInfo) => void;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  data,
  user,
  accessToken,
  onAuthSuccess,
  onSignOut,
  onDataImported,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [exportResult, setExportResult] = useState<GoogleSheetsExportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Linked Sheet State
  const [linkedSheet, setLinkedSheet] = useState<LinkedSheetConfig | null>(getSavedLinkedSheet());
  const [mode, setMode] = useState<'sync' | 'new' | 'custom_url'>('sync');

  // Custom Sheet Inputs
  const [customSheetUrl, setCustomSheetUrl] = useState('');
  const [sheetTitle, setSheetTitle] = useState(
    () => `Mainetti TC Master Database - Live Sync`
  );

  useEffect(() => {
    if (isOpen) {
      const saved = getSavedLinkedSheet();
      setLinkedSheet(saved);
      if (saved) {
        setMode('sync');
      } else {
        setMode('new');
      }
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const ensureActiveToken = async (): Promise<string | null> => {
    if (accessToken) return accessToken;
    const stored = getStoredTokenAndUser();
    if (stored) {
      onAuthSuccess(stored.user, stored.token);
      return stored.token;
    }
    try {
      const res = await googleSignIn();
      if (res) {
        onAuthSuccess(res.user, res.accessToken);
        return res.accessToken;
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Please sign in with Google to continue.');
    }
    return null;
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMsg(null);
    try {
      const res = await googleSignIn();
      if (res) {
        onAuthSuccess(res.user, res.accessToken);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sign in with Google');
    } finally {
      setIsSigningIn(false);
    }
  };

  // 1. Sync / Push to currently linked sheet (Maintains Permanent URL)
  const handleSyncToLinkedSheet = async () => {
    if (!linkedSheet) return;
    const token = await ensureActiveToken();
    if (!token) return;

    setIsSyncing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await syncDataToExistingSpreadsheet(token, linkedSheet.spreadsheetId, data);
      setExportResult(res);
      const updated = getSavedLinkedSheet();
      setLinkedSheet(updated);
      setSuccessMsg(`Successfully synchronized all ${data.length} records to your Google Sheet! All rows match 1:1.`);
    } catch (err: any) {
      console.error('Sync failed:', err);
      if (err.message?.includes('401') || err.message?.includes('UNAUTHENTICATED')) {
        setErrorMsg('Session expired. Please sign in again to continue.');
        onSignOut();
      } else {
        setErrorMsg(err.message || 'Failed to sync data to Google Sheet.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // 2. Pull / Import live data FROM Google Sheet into App
  const handlePullFromLinkedSheet = async () => {
    if (!linkedSheet) return;
    const token = await ensureActiveToken();
    if (!token) return;

    setIsPulling(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const result = await importDataFromGoogleSpreadsheet(token, linkedSheet.spreadsheetId);
      const fileInfo: UploadedFileInfo = {
        fileName: `${result.title}.gsheet`,
        fileSize: result.rowCount * 128,
        uploadDate: new Date().toLocaleString(),
        totalRowsFound: result.rowCount,
        validRowsWithTcCost: result.rowCount,
        filteredOutZeroCostRows: 0,
        totalCostUsd: result.data.reduce((s, i) => s + i.tcCost, 0),
      };

      if (onDataImported) {
        onDataImported(result.data, fileInfo);
      }
      setSuccessMsg(`Successfully pulled ${result.rowCount} live records from Google Sheet into the App!`);
    } catch (err: any) {
      console.error('Pull failed:', err);
      setErrorMsg(err.message || 'Failed to pull data from Google Sheet.');
    } finally {
      setIsPulling(false);
    }
  };

  // 3. Create brand new sheet and permanently link it
  const handleCreateNewSheet = async () => {
    const token = await ensureActiveToken();
    if (!token) return;

    setIsSyncing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await exportDataToGoogleSheets(token, data, sheetTitle);
      setExportResult(res);
      const updated = getSavedLinkedSheet();
      setLinkedSheet(updated);
      setMode('sync');
      setSuccessMsg(`New permanent Google Sheet created and linked with ${data.length} records!`);
    } catch (err: any) {
      console.error('Create sheet failed:', err);
      if (err.message?.includes('401') || err.message?.includes('UNAUTHENTICATED')) {
        setErrorMsg('Session expired. Please sign in again to continue.');
        onSignOut();
      } else {
        setErrorMsg(err.message || 'Failed to create Google Sheet.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // 4. Link an existing sheet via URL / ID
  const handleLinkExistingUrl = async () => {
    if (!customSheetUrl.trim()) {
      setErrorMsg('Please paste a valid Google Sheet URL or ID.');
      return;
    }
    const extractedId = extractSpreadsheetIdFromUrlOrId(customSheetUrl);
    if (!extractedId || extractedId.length < 5) {
      setErrorMsg('Invalid Google Sheet URL or ID format.');
      return;
    }

    const token = await ensureActiveToken();
    if (!token) return;

    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const res = await syncDataToExistingSpreadsheet(token, extractedId, data);
      setExportResult(res);
      const updated = getSavedLinkedSheet();
      setLinkedSheet(updated);
      setMode('sync');
      setSuccessMsg(`Connected & synchronized ${data.length} records to your Google Sheet!`);
    } catch (err: any) {
      console.error('Custom link failed:', err);
      setErrorMsg(err.message || 'Could not connect to that Google Sheet. Make sure you have edit permissions.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleAutoSync = (enabled: boolean) => {
    if (linkedSheet) {
      const updated: LinkedSheetConfig = { ...linkedSheet, autoSync: enabled };
      saveLinkedSheetConfig(updated);
      setLinkedSheet(updated);
    }
  };

  const handleUnlink = () => {
    if (confirm('Disconnect this Google Sheet from auto-sync? (The sheet will remain safe in your Google Drive)')) {
      saveLinkedSheetConfig(null);
      setLinkedSheet(null);
      setExportResult(null);
      setMode('new');
    }
  };

  const handleCopyLink = () => {
    const url = exportResult?.spreadsheetUrl || linkedSheet?.spreadsheetUrl;
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-sm border border-slate-300 shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 bg-[#0b1b3d] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-600/30 border border-emerald-400/40 rounded-sm">
              <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-tight">
                Google Sheets Real-Time Sync & Match
              </h3>
              <p className="text-[11px] text-slate-300">
                1:1 Two-Way Synchronization with Google Drive Sheets
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-300 hover:text-white rounded-sm hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* User Auth Status Bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 flex items-center justify-between">
            {user ? (
              <div className="flex items-center gap-2.5 min-w-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full border border-slate-300 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#0b1b3d] text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {user.displayName || user.email}
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-xs">
                      Connected
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 truncate block font-mono">
                    {user.email}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-600">
                <span className="font-semibold text-slate-800">Not connected to Google</span>
                <p className="text-[11px] text-slate-500">Sign in to sync your Google Sheets database</p>
              </div>
            )}

            {user ? (
              <button
                type="button"
                onClick={async () => {
                  await googleSignOut();
                  onSignOut();
                }}
                className="text-[11px] font-medium text-slate-500 hover:text-red-700 flex items-center gap-1 px-2 py-1 hover:bg-slate-200/60 rounded-xs transition-colors cursor-pointer"
                title="Sign out of Google"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 rounded-sm shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                {isSigningIn ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                )}
                <span>Sign in</span>
              </button>
            )}
          </div>

          {/* Success Banner */}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-sm text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Active Linked Sheet Section */}
          {linkedSheet ? (
            <div className="bg-emerald-50/50 border border-emerald-300 rounded-sm p-4 space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-[#0b1b3d] uppercase tracking-tight">
                        {linkedSheet.title}
                      </h4>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-xs">
                        Connected ({data.length} PIs)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Last Synced: <span className="font-semibold text-slate-700">{linkedSheet.lastSyncedAt || 'Just now'}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleUnlink}
                  className="text-[11px] text-slate-400 hover:text-red-600 flex items-center gap-1 cursor-pointer"
                  title="Unlink Sheet"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Unlink</span>
                </button>
              </div>

              {/* Direct Open & Copy Link */}
              <div className="bg-white border border-slate-200 rounded-sm p-2.5 flex items-center justify-between gap-2">
                <a
                  href={linkedSheet.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 truncate hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{linkedSheet.spreadsheetUrl}</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xs text-slate-700 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Auto Sync Toggle */}
              <div className="flex items-center justify-between pt-1 border-t border-emerald-200/60">
                <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Continuous Auto-Sync</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkedSheet.autoSync}
                    onChange={(e) => handleToggleAutoSync(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Two-Way Actions: Push to Sheet & Pull from Sheet */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                {/* 1. Push / Overwrite with Clean App Data */}
                <button
                  type="button"
                  onClick={handleSyncToLinkedSheet}
                  disabled={isSyncing || isPulling}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-sm shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  title="Overwrite Google Sheet with current app records so all 95 rows match 1:1"
                >
                  {isSyncing ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <ArrowUpFromLine className="w-4 h-4 text-emerald-200" />
                  )}
                  <span>Push Clean Data ({data.length} PIs)</span>
                </button>

                {/* 2. Pull / Read live data from Google Sheet into App */}
                <button
                  type="button"
                  onClick={handlePullFromLinkedSheet}
                  disabled={isSyncing || isPulling}
                  className="flex items-center justify-center gap-2 py-2 px-3 bg-[#0b1b3d] hover:bg-[#132c5e] text-white text-xs font-bold rounded-sm shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  title="Load live records directly from Google Sheet into the dashboard"
                >
                  {isPulling ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <ArrowDownToLine className="w-4 h-4 text-blue-200" />
                  )}
                  <span>Pull Data From Sheet</span>
                </button>
              </div>
            </div>
          ) : (
            /* Mode Selector when not yet linked */
            <div className="space-y-3">
              <div className="flex border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setMode('new')}
                  className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                    mode === 'new'
                      ? 'border-[#0b1b3d] text-[#0b1b3d]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Create New Permanent Sheet
                </button>
                <button
                  type="button"
                  onClick={() => setMode('custom_url')}
                  className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                    mode === 'custom_url'
                      ? 'border-[#0b1b3d] text-[#0b1b3d]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Link Existing Google Sheet URL
                </button>
              </div>

              {mode === 'new' ? (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      New Sheet Title:
                    </label>
                    <input
                      type="text"
                      value={sheetTitle}
                      onChange={(e) => setSheetTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-sm text-slate-900 focus:outline-hidden focus:border-[#0b1b3d]"
                      placeholder="Enter Google Sheet title..."
                    />
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    This will create a dedicated Google Spreadsheet in your Google Drive and lock this link permanently. Whenever data is updated, this same sheet will be updated.
                  </p>

                  <button
                    type="button"
                    onClick={handleCreateNewSheet}
                    disabled={isSyncing}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-sm shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {isSyncing ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                    )}
                    <span>Create & Link Permanent Sheet ({data.length} Records)</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Existing Google Sheet URL or ID:
                    </label>
                    <input
                      type="text"
                      value={customSheetUrl}
                      onChange={(e) => setCustomSheetUrl(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-sm text-slate-900 focus:outline-hidden focus:border-[#0b1b3d]"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                    />
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Paste your existing Google Sheet link. We will link this exact spreadsheet and match your TC records into it.
                  </p>

                  <button
                    type="button"
                    onClick={handleLinkExistingUrl}
                    disabled={isSyncing || !customSheetUrl.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#0b1b3d] hover:bg-[#132c5e] text-white text-xs font-bold rounded-sm shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {isSyncing ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Link className="w-4 h-4 text-blue-200" />
                    )}
                    <span>Link & Sync to This URL</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="space-y-2">
              {errorMsg.includes('unauthorized-domain') ? (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-sm text-xs text-amber-950 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-900 uppercase text-[11px] tracking-wide">
                        Vercel Domain Authorization Needed in Firebase
                      </h4>
                      <p className="text-slate-700 text-[11px] mt-0.5 leading-relaxed">
                        Firebase blocks authentication from new Vercel domains until added to Authorized Domains.
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-amber-200 rounded p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-700">Your Current Vercel Domain:</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.hostname);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-slate-700 font-mono text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-600" />}
                        <span>{copied ? 'Copied' : window.location.hostname}</span>
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-1 pt-1 border-t border-slate-100">
                      <p className="font-semibold text-slate-800">Quick Fix Steps (1 minute):</p>
                      <ol className="list-decimal list-inside space-y-0.5 text-slate-600 pl-1">
                        <li>Go to <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-700 font-bold underline">Firebase Console</a></li>
                        <li>Select project <span className="font-mono bg-slate-100 px-1 rounded text-slate-800 font-bold">gen-lang-client-0665362944</span></li>
                        <li>Click <strong>Authentication</strong> ➔ <strong>Settings</strong> ➔ <strong>Authorized domains</strong></li>
                        <li>Click <strong>Add Domain</strong> and paste: <span className="font-mono font-bold text-blue-900 bg-blue-50 px-1 rounded">{window.location.hostname}</span></li>
                      </ol>
                    </div>
                  </div>

                  {/* Alternative GIS Button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        setIsSigningIn(true);
                        setErrorMsg(null);
                        try {
                          const res = await gisTokenClientSignIn();
                          if (res) {
                            onAuthSuccess(res.user, res.accessToken);
                          }
                        } catch (err: any) {
                          setErrorMsg(err.message || 'Direct GIS sign-in failed');
                        } finally {
                          setIsSigningIn(false);
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#0b1b3d] hover:bg-[#132c5e] text-white text-xs font-bold rounded-sm shadow-xs transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Connect with Google GIS Client Directly (Bypass Domain Check)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-sm text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded-sm transition-colors cursor-pointer"
          >
            Close
          </button>

          {linkedSheet && (
            <a
              href={linkedSheet.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900"
            >
              <span>Open in Google Sheets</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

