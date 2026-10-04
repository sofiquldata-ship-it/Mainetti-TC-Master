import React, { useState, useRef, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  UploadCloud,
  FileText,
  Search,
  Download,
  Trash2,
  RefreshCw,
  Layers,
  Table,
  CheckCircle2,
  AlertCircle,
  Eye,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Zap,
  Info,
  Building2,
  FileCheck2,
  Globe,
  Grid3X3,
  ListFilter,
  Copy,
  Check,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export interface ParsedSheetData {
  name: string;
  headers: string[];
  rows: Record<string, any>[];
  raw2D: any[][];
  rowCount: number;
  colCount: number;
  detectedCommercialFields: { label: string; field: string; sample: string }[];
}

export const CommercialDocReaderView: React.FC = () => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [sheets, setSheets] = useState<ParsedSheetData[]>([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState<number | 'overview'>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Search & Filter within Active Sheet
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'json' | 'cards'>('table');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to detect commercial document fields (Invoice, PI, BL, Buyer, Item, Qty, Dates)
  const detectCommercialFields = (headers: string[], rows: Record<string, any>[]) => {
    const detected: { label: string; field: string; sample: string }[] = [];
    const firstRow = rows[0] || {};

    const patterns = [
      { regex: /invoice|inv\s*no|commercial\s*inv/i, label: 'Invoice No' },
      { regex: /pi\s*no|pi\s*number|proforma|order\s*no|po\s*no/i, label: 'PI / Order Ref' },
      { regex: /bl\s*no|b\/l|bill\s*of\s*lading|awb|container/i, label: 'BL / Shipping Ref' },
      { regex: /buyer|importer|customer|client/i, label: 'Buyer / Importer' },
      { regex: /supplier|factory|exporter|shipper|beneficiary|vendor/i, label: 'Factory / Supplier' },
      { regex: /item|description|style|fabric|product|goods/i, label: 'Product / Style' },
      { regex: /quantity|qty|pcs|volume|order\s*qty|deliv/i, label: 'Quantity (PCS)' },
      { regex: /date|inv\s*date|ship\s*date|tc\s*date|order\s*date/i, label: 'Document Date' },
      { regex: /hs\s*code|hscode|tariff/i, label: 'HS Code' },
      { regex: /value|amount|total|usd|price|cost/i, label: 'Amount / Value' },
      { regex: /gross\s*weight|net\s*weight|gw|nw/i, label: 'Weight (KG)' },
    ];

    patterns.forEach((pat) => {
      const matchHeader = headers.find((h) => pat.regex.test(h));
      if (matchHeader && firstRow[matchHeader] !== undefined) {
        const val = String(firstRow[matchHeader] || '').trim();
        if (val) {
          detected.push({
            label: pat.label,
            field: matchHeader,
            sample: val,
          });
        }
      }
    });

    return detected;
  };

  // Process uploaded Excel File (Reads all 5+ sheets in memory without saving to DB)
  const processExcelFile = (file: File) => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('Could not read file binary buffer');

        const workbook = XLSX.read(data, {
          type: 'array',
          cellDates: true,
          cellNF: false,
          cellText: false,
        });

        const sheetNames = workbook.SheetNames || [];
        if (sheetNames.length === 0) {
          throw new Error('No sheets found in this Excel workbook.');
        }

        const parsedSheets: ParsedSheetData[] = sheetNames.map((name) => {
          const ws = workbook.Sheets[name];
          const rawJson: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

          if (!rawJson || rawJson.length === 0) {
            return {
              name,
              headers: [],
              rows: [],
              raw2D: [],
              rowCount: 0,
              colCount: 0,
              detectedCommercialFields: [],
            };
          }

          // Find first non-empty row as header
          let headerRowIdx = 0;
          for (let i = 0; i < Math.min(10, rawJson.length); i++) {
            const nonEmpties = rawJson[i].filter((cell) => cell !== '' && cell !== null && cell !== undefined);
            if (nonEmpties.length >= 2) {
              headerRowIdx = i;
              break;
            }
          }

          const rawHeaders = (rawJson[headerRowIdx] || []).map((h, colIdx) =>
            h !== undefined && h !== null && String(h).trim() !== ''
              ? String(h).trim()
              : `Column_${colIdx + 1}`
          );

          // Deduplicate headers
          const headerCounts: Record<string, number> = {};
          const headers = rawHeaders.map((h) => {
            if (headerCounts[h] === undefined) {
              headerCounts[h] = 1;
              return h;
            } else {
              headerCounts[h]++;
              return `${h}_${headerCounts[h]}`;
            }
          });

          // Build row records
          const dataRows = rawJson.slice(headerRowIdx + 1);
          const rows: Record<string, any>[] = [];

          dataRows.forEach((rowArr) => {
            const isRowEmpty = rowArr.every((cell) => cell === '' || cell === null || cell === undefined);
            if (!isRowEmpty) {
              const record: Record<string, any> = {};
              headers.forEach((hdr, colIdx) => {
                let cellVal = rowArr[colIdx];
                if (cellVal instanceof Date) {
                  cellVal = cellVal.toISOString().slice(0, 10);
                }
                record[hdr] = cellVal !== undefined && cellVal !== null ? cellVal : '';
              });
              rows.push(record);
            }
          });

          const detectedCommercialFields = detectCommercialFields(headers, rows);

          return {
            name,
            headers,
            rows,
            raw2D: rawJson,
            rowCount: rows.length,
            colCount: headers.length,
            detectedCommercialFields,
          };
        });

        setSheets(parsedSheets);
        setActiveSheetIdx(0);
        setPage(1);
        setIsLoading(false);
      } catch (err: any) {
        console.error('Error parsing commercial excel file:', err);
        setError(err?.message || 'Failed to read Excel workbook. Please check file format.');
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setError('File reading error. Please try uploading again.');
      setIsLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processExcelFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processExcelFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    setFileName(null);
    setFileSize(null);
    setSheets([]);
    setActiveSheetIdx(0);
    setSearchQuery('');
    setGlobalSearch('');
    setSelectedRow(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Active Sheet
  const currentSheet = typeof activeSheetIdx === 'number' ? sheets[activeSheetIdx] : null;

  // Filter & Sort current sheet rows
  const filteredAndSortedRows = useMemo(() => {
    if (!currentSheet) return [];
    let list = [...currentSheet.rows];

    // Local Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((row) =>
        Object.values(row).some((val) => String(val).toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortCol) {
      list.sort((a, b) => {
        let valA = a[sortCol] ?? '';
        let valB = b[sortCol] ?? '';

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }

        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [currentSheet, searchQuery, sortCol, sortAsc]);

  // Global Search across all sheets
  const globalSearchResults = useMemo(() => {
    if (!globalSearch.trim() || sheets.length === 0) return [];
    const q = globalSearch.toLowerCase().trim();

    const results: {
      sheetName: string;
      sheetIndex: number;
      matchingRows: { rowIndex: number; record: Record<string, any>; matchedField: string; val: string }[];
    }[] = [];

    sheets.forEach((sheet, sIdx) => {
      const matches: { rowIndex: number; record: Record<string, any>; matchedField: string; val: string }[] = [];

      sheet.rows.forEach((row, rIdx) => {
        for (const [key, val] of Object.entries(row)) {
          const strVal = String(val);
          if (strVal.toLowerCase().includes(q)) {
            matches.push({
              rowIndex: rIdx + 1,
              record: row,
              matchedField: key,
              val: strVal,
            });
            break;
          }
        }
      });

      if (matches.length > 0) {
        results.push({
          sheetName: sheet.name,
          sheetIndex: sIdx,
          matchingRows: matches,
        });
      }
    });

    return results;
  }, [sheets, globalSearch]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSortedRows.slice(start, start + pageSize);
  }, [filteredAndSortedRows, page, pageSize]);

  // Export Active Sheet to CSV
  const handleExportCSV = () => {
    if (!currentSheet || currentSheet.rows.length === 0) return;

    const headers = currentSheet.headers;
    const rows = filteredAndSortedRows.map((r) =>
      headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
    );

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute(
      'download',
      `${fileName?.replace(/\.[^/.]+$/, '')}_${currentSheet.name}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-2.5 flex flex-col font-sans">
      {/* 1. TOP HEADER & CONTROLS */}
      <div className="bg-white border border-slate-200 rounded-sm p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#0b1b3d] text-white rounded-sm flex items-center justify-center shadow-xs">
            <FileSpreadsheet className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#0b1b3d] uppercase tracking-wide">
                Commercial Document Multi-Sheet Reader & Inspector
              </h1>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 font-mono font-bold px-1.5 py-0.2 rounded-xs border border-emerald-200">
                In-Memory Session Viewer
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Reads all 5+ workbook sheets simultaneously without modifying database records
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {fileName ? (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-sm shadow-2xs transition-colors cursor-pointer"
                title="Upload another Excel file"
              >
                <UploadCloud className="w-3.5 h-3.5 text-blue-900" />
                <span>Upload New File</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-[#0b1b3d] hover:bg-[#152d59] text-white rounded-sm shadow-xs transition-colors cursor-pointer"
                title="Export active sheet rows to CSV"
              >
                <Download className="w-3.5 h-3.5 text-blue-200" />
                <span>Export Active Sheet CSV</span>
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-300 rounded-sm transition-colors cursor-pointer"
                title="Clear current Excel file view"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-[#0b1b3d] hover:bg-[#152d59] text-white rounded-sm shadow-xs transition-colors cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-blue-300" />
              <span>Choose Commercial Excel File</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv, .xlsm"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      </div>

      {/* 2. UPLOAD DROPZONE WHEN NO FILE IS LOADED */}
      {!fileName && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`bg-white border-2 border-dashed rounded-sm p-12 text-center cursor-pointer transition-all shadow-xs flex flex-col items-center justify-center gap-3 ${
            isDragging
              ? 'border-blue-700 bg-blue-50/70 scale-[1.005]'
              : 'border-slate-300 hover:border-[#0b1b3d] hover:bg-slate-50/50'
          }`}
        >
          <div className="w-16 h-16 bg-blue-50 text-[#0b1b3d] rounded-full flex items-center justify-center border border-blue-200 shadow-2xs">
            <FileSpreadsheet className="w-8 h-8 text-blue-900" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#0b1b3d] uppercase tracking-wide">
              Drag & Drop Your Commercial Document Excel File
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Supports <strong>.xlsx, .xls, .csv</strong> files containing up to <strong>5+ sheets</strong>. All sheets (Invoice, Packing List, BL, TC, PI) will be parsed and ready for inspection instantly.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2 text-[11px] font-mono text-slate-500">
            <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-xs border border-slate-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Multi-Sheet Tabbed View</span>
            </span>
            <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-xs border border-slate-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>No Database Override</span>
            </span>
            <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-xs border border-slate-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Global 5-Sheet Search</span>
            </span>
          </div>
        </div>
      )}

      {/* ERROR BANNER */}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-900 px-3 py-2 rounded-sm text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. MULTI-SHEET WORKBOOK LOADED VIEW */}
      {sheets.length > 0 && (
        <div className="space-y-2">
          {/* File Meta & Global Search Strip */}
          <div className="bg-white border border-slate-200 rounded-sm p-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* File Info */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#0b1b3d] font-mono flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-xs border border-blue-200">
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-900" />
                <span>{fileName}</span>
              </span>
              <span className="text-slate-400 font-mono text-[11px]">{fileSize}</span>
              <span className="text-slate-300">·</span>
              <span className="font-bold font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-xs">
                {sheets.length} Total Sheets Detected
              </span>
            </div>

            {/* Global Search across all 5+ sheets */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Global Search in All 5 Sheets (e.g. PI#, Inv#)..."
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  className="py-1 pl-7 pr-6 text-xs bg-slate-50 border border-slate-300 rounded-sm focus:outline-hidden focus:border-[#0b1b3d] focus:bg-white w-56 sm:w-80"
                />
                {globalSearch && (
                  <button
                    type="button"
                    onClick={() => setGlobalSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* GLOBAL SEARCH RESULTS (If user types in global search) */}
          {globalSearch.trim() && (
            <div className="bg-blue-50/80 border border-blue-300 rounded-sm p-3 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-[#0b1b3d]">
                  <Sparkles className="w-4 h-4 text-blue-900" />
                  <span>
                    Global Search Matches for "{globalSearch}": {globalSearchResults.reduce((sum, s) => sum + s.matchingRows.length, 0)} Matches across {globalSearchResults.length} Sheets
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setGlobalSearch('')}
                  className="text-xs text-blue-900 font-semibold underline cursor-pointer"
                >
                  Close Global Results
                </button>
              </div>

              {globalSearchResults.length === 0 ? (
                <p className="text-xs text-slate-500">No matching text found across any of the workbook sheets.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                  {globalSearchResults.map((res) => (
                    <div
                      key={res.sheetName}
                      onClick={() => {
                        setActiveSheetIdx(res.sheetIndex);
                        setSearchQuery(globalSearch);
                      }}
                      className="bg-white border border-blue-200 hover:border-blue-500 rounded-sm p-2 text-xs shadow-2xs cursor-pointer transition-all hover:bg-blue-50/50"
                    >
                      <div className="flex items-center justify-between font-bold text-[#0b1b3d]">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-blue-800" />
                          <span>{res.sheetName}</span>
                        </span>
                        <span className="font-mono text-[10px] bg-blue-100 text-blue-900 px-1 rounded-xs">
                          {res.matchingRows.length} matches
                        </span>
                      </div>
                      <div className="mt-1 space-y-0.5 text-[11px] text-slate-600 font-mono">
                        {res.matchingRows.slice(0, 3).map((m, idx) => (
                          <div key={idx} className="truncate">
                            Row {m.rowIndex}: <strong className="text-slate-900">{m.matchedField}</strong> = <span className="bg-yellow-200 px-1 rounded-xs">{m.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. SHEET TABS NAVIGATION (SHEET 1 TO 5+) */}
          <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-2 pt-1.5 rounded-t-sm overflow-x-auto">
            <div className="flex items-center gap-1">
              {sheets.map((sheet, idx) => {
                const isActive = activeSheetIdx === idx;
                return (
                  <button
                    type="button"
                    key={sheet.name}
                    onClick={() => {
                      setActiveSheetIdx(idx);
                      setPage(1);
                      setSearchQuery('');
                      setSortCol(null);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-t-sm transition-all cursor-pointer border-t border-x ${
                      isActive
                        ? 'bg-white text-[#0b1b3d] border-slate-300 -mb-px shadow-xs'
                        : 'bg-slate-200/70 text-slate-600 hover:text-slate-900 hover:bg-slate-200 border-transparent'
                    }`}
                  >
                    <Layers className={`w-3.5 h-3.5 ${isActive ? 'text-blue-900' : 'text-slate-400'}`} />
                    <span>{sheet.name}</span>
                    <span
                      className={`font-mono text-[10px] px-1 rounded-xs ${
                        isActive ? 'bg-blue-100 text-blue-950 font-bold' : 'bg-slate-300 text-slate-700'
                      }`}
                    >
                      {sheet.rowCount} rows
                    </span>
                  </button>
                );
              })}

              {/* Overview Tab */}
              <button
                type="button"
                onClick={() => setActiveSheetIdx('overview')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-t-sm transition-all cursor-pointer border-t border-x ${
                  activeSheetIdx === 'overview'
                    ? 'bg-white text-[#0b1b3d] border-slate-300 -mb-px shadow-xs'
                    : 'bg-slate-200/70 text-slate-600 hover:text-slate-900 hover:bg-slate-200 border-transparent'
                }`}
              >
                <Grid3X3 className="w-3.5 h-3.5 text-slate-500" />
                <span>All Sheets Overview</span>
              </button>
            </div>
          </div>

          {/* 5. ACTIVE SHEET CONTENT VIEW */}
          {activeSheetIdx === 'overview' ? (
            /* ALL SHEETS CONSOLIDATED OVERVIEW CARDS */
            <div className="bg-white border border-slate-200 rounded-b-sm p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-[#0b1b3d] uppercase tracking-wide">
                    Multi-Sheet Commercial Document Structure
                  </h3>
                  <p className="text-xs text-slate-500">
                    Summary of all {sheets.length} sheets parsed from <strong>{fileName}</strong>
                  </p>
                </div>
                <span className="text-xs font-mono font-bold bg-blue-50 text-blue-900 px-2 py-1 rounded-xs border border-blue-200">
                  Total Rows across sheets: {sheets.reduce((sum, s) => sum + s.rowCount, 0)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sheets.map((sheet, idx) => (
                  <div
                    key={sheet.name}
                    className="border border-slate-200 rounded-sm p-3 bg-slate-50/50 hover:bg-white hover:border-[#0b1b3d] hover:shadow-sm transition-all flex flex-col justify-between space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[#0b1b3d]">
                        <span className="w-5 h-5 bg-blue-100 text-blue-900 rounded-xs flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="truncate">{sheet.name}</span>
                      </div>
                      <span className="font-mono text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded-xs font-bold">
                        {sheet.rowCount} Rows · {sheet.colCount} Cols
                      </span>
                    </div>

                    {/* Detected Commercial Keys */}
                    {sheet.detectedCommercialFields.length > 0 ? (
                      <div className="space-y-1 bg-white p-2 rounded-xs border border-slate-200 text-[11px]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">
                          Detected Commercial Keys:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {sheet.detectedCommercialFields.map((f, fIdx) => (
                            <span
                              key={fIdx}
                              className="bg-blue-50 text-blue-900 border border-blue-200 px-1 py-0.2 rounded-xs font-mono text-[10px]"
                              title={`${f.label}: ${f.sample}`}
                            >
                              {f.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">Standard tabular data sheet</p>
                    )}

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSheetIdx(idx);
                          setPage(1);
                        }}
                        className="px-2.5 py-1 bg-[#0b1b3d] text-white text-xs font-semibold rounded-xs hover:bg-[#152d59] transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3 text-blue-200" />
                        <span>Inspect Sheet {idx + 1}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : currentSheet ? (
            /* ACTIVE SHEET TABLE & CONTROLS */
            <div className="bg-white border border-slate-200 rounded-b-sm shadow-xs overflow-hidden">
              {/* Sheet Sub-Header: Search & Detected Fields */}
              <div className="p-2 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs">
                {/* Detected Trade Fields Bar */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase font-mono flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-700" />
                    <span>Commercial Keys:</span>
                  </span>
                  {currentSheet.detectedCommercialFields.length > 0 ? (
                    currentSheet.detectedCommercialFields.map((f, idx) => (
                      <span
                        key={idx}
                        className="bg-white border border-slate-300 text-slate-800 px-1.5 py-0.5 rounded-xs font-mono text-[10px] flex items-center gap-1 shadow-2xs"
                        title={`Field: ${f.field} | Sample Value: ${f.sample}`}
                      >
                        <span className="font-bold text-blue-900">{f.label}:</span>
                        <span className="text-slate-600 truncate max-w-[120px]">{f.sample}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 font-mono text-[10px]">No specific standard headers detected</span>
                  )}
                </div>

                {/* In-Sheet Search & Page Size */}
                <div className="flex items-center gap-2 ml-auto">
                  <div className="relative">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={`Search in ${currentSheet.name}...`}
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      className="py-0.5 pl-6 pr-6 text-xs bg-white border border-slate-300 rounded-sm focus:outline-hidden focus:border-[#0b1b3d] w-36 sm:w-48"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-white border border-slate-300 rounded-sm text-xs py-0.5 px-1.5 focus:outline-hidden font-mono text-slate-700 cursor-pointer"
                  >
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                </div>
              </div>

              {/* SHEET DATA TABLE */}
              <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-290px)] min-h-[380px] table-scrollbar relative">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-[#0b1b3d] text-white z-20 select-none shadow-[0_2px_4px_rgba(0,0,0,0.15)] text-[10px] font-bold uppercase tracking-wider">
                    <tr className="h-8">
                      {/* Row Index # */}
                      <th className="py-1 px-2 border-r border-[#1a386b] text-center w-10 sticky left-0 z-30 bg-[#0b1b3d]">
                        #
                      </th>
                      {currentSheet.headers.map((header) => {
                        const isSorted = sortCol === header;
                        return (
                          <th
                            key={header}
                            onClick={() => {
                              if (sortCol === header) {
                                setSortAsc(!sortAsc);
                              } else {
                                setSortCol(header);
                                setSortAsc(true);
                              }
                            }}
                            className="py-1 px-2.5 cursor-pointer hover:bg-[#132c5e] transition-colors border-r border-[#1a386b] whitespace-nowrap"
                          >
                            <div className="flex items-center gap-1">
                              <span>{header}</span>
                              {isSorted ? (
                                sortAsc ? (
                                  <ArrowUp className="w-3 h-3 text-blue-300 font-bold" />
                                ) : (
                                  <ArrowDown className="w-3 h-3 text-blue-300 font-bold" />
                                )
                              ) : (
                                <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-50" />
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 font-mono text-xs">
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={currentSheet.headers.length + 1}
                          className="py-12 text-center text-slate-400 font-sans"
                        >
                          No matching records found in this sheet
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row, rIdx) => {
                        const actualIdx = (page - 1) * pageSize + rIdx + 1;
                        const isRowSelected = selectedRow === row;

                        return (
                          <tr
                            key={rIdx}
                            onClick={() => setSelectedRow(row)}
                            className={`hover:bg-blue-50/70 cursor-pointer transition-colors h-8 ${
                              rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                            } ${isRowSelected ? 'bg-blue-100/70 ring-1 ring-blue-500' : ''}`}
                          >
                            {/* Row Index # */}
                            <td className="py-1 px-2 text-center text-slate-400 border-r border-slate-200 sticky left-0 z-10 bg-inherit font-mono text-[11px] align-middle">
                              {actualIdx}
                            </td>

                            {/* Column Cells */}
                            {currentSheet.headers.map((header) => {
                              const val = row[header];
                              const strVal = String(val !== undefined && val !== null ? val : '');
                              return (
                                <td
                                  key={header}
                                  className="py-1 px-2.5 text-slate-800 whitespace-nowrap border-r border-slate-200 max-w-[260px] truncate align-middle"
                                  title={`${header}: ${strVal}`}
                                >
                                  {strVal || <span className="text-slate-300">-</span>}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* TABLE FOOTER / PAGINATION */}
              <div className="p-2 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div className="text-slate-600 text-[11px]">
                  Showing <strong>{filteredAndSortedRows.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> to{' '}
                  <strong>{Math.min(page * pageSize, filteredAndSortedRows.length)}</strong> of{' '}
                  <strong>{filteredAndSortedRows.length}</strong> entries (Total Sheet: {currentSheet.rowCount} rows)
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage(1)}
                    disabled={page <= 1}
                    className="p-1 bg-white border border-slate-300 rounded-xs disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                    title="First Page"
                  >
                    <ChevronsLeft className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1 bg-white border border-slate-300 rounded-xs disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <span className="px-2 text-slate-700 font-bold">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1 bg-white border border-slate-300 rounded-xs disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages}
                    className="p-1 bg-white border border-slate-300 rounded-xs disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                    title="Last Page"
                  >
                    <ChevronsRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* 6. ROW DETAIL INSPECTOR MODAL (When clicking any row) */}
      {selectedRow && currentSheet && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-md border border-slate-300 shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 font-sans">
            {/* Modal Header */}
            <div className="bg-[#0b1b3d] text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-300" />
                <h3 className="font-bold text-sm tracking-wide">
                  Record Inspector ({currentSheet.name})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="text-slate-300 hover:text-white p-1 rounded-xs hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: All Fields Key-Value List */}
            <div className="p-4 overflow-y-auto space-y-2 text-xs font-mono max-h-[calc(85vh-100px)]">
              {currentSheet.headers.map((header) => {
                const val = selectedRow[header];
                const strVal = String(val !== undefined && val !== null ? val : '');
                return (
                  <div
                    key={header}
                    className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 p-1.5 rounded-xs bg-slate-50 border border-slate-200 hover:bg-blue-50/50"
                  >
                    <span className="font-bold text-slate-600 font-sans">{header}:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900 break-all">
                        {strVal || <span className="text-slate-400 font-normal">-</span>}
                      </span>
                      {strVal && (
                        <button
                          type="button"
                          onClick={() => handleCopy(strVal)}
                          className="p-0.5 text-slate-400 hover:text-slate-700"
                          title="Copy field value"
                        >
                          {copiedText === strVal ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-100 px-4 py-2 flex items-center justify-between border-t border-slate-200 text-xs">
              <span className="text-slate-500 font-mono text-[11px]">
                {currentSheet.headers.length} attributes extracted
              </span>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="px-3 py-1 bg-[#0b1b3d] text-white font-semibold rounded-xs hover:bg-[#152d59] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
