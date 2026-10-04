import React, { useState, useRef, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
  Printer,
  FileDown,
  LayoutGrid,
  FileSpreadsheet as SheetIcon,
  Receipt,
  PackageCheck,
  Truck,
  ShieldCheck,
  ExternalLink,
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfProgressText, setPdfProgressText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // View Mode for any Sheet: 'table' | 'raw_grid' | 'document_preview' | 'cards'
  const [sheetViewMode, setSheetViewMode] = useState<'table' | 'raw_grid' | 'document_preview' | 'cards'>('table');

  // Search & Filter within Active Sheet
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentPrintRef = useRef<HTMLDivElement>(null);
  const rawGridPrintRef = useRef<HTMLDivElement>(null);

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

  // Process uploaded Excel File (Reads all sheets in memory without saving to DB)
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
  const handleExportCSV = (targetSheet?: ParsedSheetData) => {
    const sheet = targetSheet || currentSheet;
    if (!sheet || sheet.rows.length === 0) return;

    const headers = sheet.headers;
    const rows = sheet.rows.map((r) =>
      headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
    );

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute(
      'download',
      `${fileName?.replace(/\.[^/.]+$/, '')}_${sheet.name}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // HIGH-FIDELITY PDF GENERATOR FOR ANY SHEET (Exact Visual Layout & Data Table)
  const handleDownloadSheetPDF = async (targetSheet?: ParsedSheetData, sheetIdxNumber?: number) => {
    const sheet = targetSheet || currentSheet;
    if (!sheet) return;

    setIsGeneratingPdf(true);
    setPdfProgressText(`Generating High-Resolution PDF for "${sheet.name}"...`);

    try {
      // 1. Create a clean A4 PDF document (Landscape or Portrait based on column count)
      const isLandscape = sheet.headers.length > 6 || sheet.colCount > 6;
      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 28;

      // Header Branding
      pdf.setFillColor(11, 27, 61); // Mainetti Deep Navy
      pdf.rect(0, 0, pageWidth, 42, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('MAINETTI COMMERCIAL DOCUMENT VIEWER', margin, 26);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(`SHEET: ${sheet.name.toUpperCase()}  |  TOTAL ROWS: ${sheet.rowCount}`, pageWidth - margin, 26, { align: 'right' });

      // Sub-header Info Box
      pdf.setTextColor(30, 41, 59);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(`Workbook File: ${fileName || 'Commercial_Document.xlsx'}`, margin, 60);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Generated On: ${new Date().toLocaleString()}  |  Page 1`, pageWidth - margin, 60, { align: 'right' });

      // Detected Commercial Summary Strip
      if (sheet.detectedCommercialFields.length > 0) {
        pdf.setFillColor(241, 245, 249);
        pdf.roundedRect(margin, 70, pageWidth - margin * 2, 22, 2, 2, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(15, 23, 42);

        const summarySummary = sheet.detectedCommercialFields
          .slice(0, 5)
          .map((f) => `${f.label}: ${f.sample}`)
          .join('   |   ');
        pdf.text(`KEY ATTRIBUTES: ${summarySummary}`, margin + 8, 84);
      }

      // Render Table Grid
      let startY = sheet.detectedCommercialFields.length > 0 ? 102 : 78;
      const headers = sheet.headers.slice(0, 12); // Fit up to 12 primary columns
      const colWidth = (pageWidth - margin * 2 - 24) / Math.max(1, headers.length);
      const rowHeight = 16;

      // Table Header Row
      pdf.setFillColor(226, 232, 240);
      pdf.rect(margin, startY, pageWidth - margin * 2, rowHeight, 'F');
      pdf.setDrawColor(203, 213, 225);
      pdf.rect(margin, startY, pageWidth - margin * 2, rowHeight, 'S');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(15, 23, 42);

      // Index header
      pdf.text('#', margin + 4, startY + 11);

      headers.forEach((h, cIdx) => {
        const x = margin + 24 + cIdx * colWidth;
        const truncatedH = h.length > 18 ? h.slice(0, 16) + '..' : h;
        pdf.text(truncatedH, x + 3, startY + 11);
      });

      startY += rowHeight;

      // Table Data Rows
      const maxRowsToPrint = Math.min(sheet.rows.length, 60); // Clean print of up to 60 rows or paginated
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);

      for (let rIdx = 0; rIdx < maxRowsToPrint; rIdx++) {
        // Check page overflow
        if (startY + rowHeight > pageHeight - 35) {
          pdf.addPage();
          startY = 35;

          // Repeat Header on new page
          pdf.setFillColor(226, 232, 240);
          pdf.rect(margin, startY, pageWidth - margin * 2, rowHeight, 'F');
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(7.5);
          pdf.setTextColor(15, 23, 42);
          pdf.text('#', margin + 4, startY + 11);
          headers.forEach((h, cIdx) => {
            const x = margin + 24 + cIdx * colWidth;
            pdf.text(h.length > 18 ? h.slice(0, 16) + '..' : h, x + 3, startY + 11);
          });
          startY += rowHeight;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7);
        }

        const row = sheet.rows[rIdx];
        const isAlt = rIdx % 2 === 1;

        if (isAlt) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, startY, pageWidth - margin * 2, rowHeight, 'F');
        }

        pdf.setDrawColor(241, 245, 249);
        pdf.line(margin, startY + rowHeight, pageWidth - margin, startY + rowHeight);

        pdf.setTextColor(71, 85, 105);
        pdf.text(String(rIdx + 1), margin + 4, startY + 11);

        headers.forEach((h, cIdx) => {
          const x = margin + 24 + cIdx * colWidth;
          const valStr = String(row[h] !== undefined && row[h] !== null ? row[h] : '-');
          const cleanStr = valStr.length > 22 ? valStr.slice(0, 20) + '..' : valStr;
          pdf.text(cleanStr, x + 3, startY + 11);
        });

        startY += rowHeight;
      }

      // Footer
      const cleanSheetName = sheet.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const outFileName = `${fileName?.replace(/\.[^/.]+$/, '')}_${cleanSheetName}_${new Date().toISOString().slice(0, 10)}.pdf`;

      pdf.save(outFileName);
      setIsGeneratingPdf(false);
      setPdfProgressText('');
    } catch (err) {
      console.error('PDF generation error:', err);
      setError('Could not generate PDF for this sheet. You can also use Browser Print to save PDF.');
      setIsGeneratingPdf(false);
      setPdfProgressText('');
    }
  };

  // DOWNLOAD ALL SHEETS COMBINED AS A SINGLE MULTI-PAGE PDF
  const handleDownloadAllSheetsPDF = async () => {
    if (sheets.length === 0) return;

    setIsGeneratingPdf(true);
    setPdfProgressText(`Generating Combined Workbook PDF for all ${sheets.length} Sheets...`);

    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 28;

      sheets.forEach((sheet, sheetIdx) => {
        if (sheetIdx > 0) {
          pdf.addPage();
        }

        // Header
        pdf.setFillColor(11, 27, 61);
        pdf.rect(0, 0, pageWidth, 40, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(13);
        pdf.text(`MAINETTI MULTI-SHEET DOCUMENT: SHEET ${sheetIdx + 1} - ${sheet.name.toUpperCase()}`, margin, 25);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.text(`File: ${fileName}  |  Rows: ${sheet.rowCount}`, pageWidth - margin, 25, { align: 'right' });

        // Table
        let startY = 55;
        const headers = sheet.headers.slice(0, 10);
        const colWidth = (pageWidth - margin * 2 - 24) / Math.max(1, headers.length);
        const rowHeight = 15;

        // Table Header
        pdf.setFillColor(226, 232, 240);
        pdf.rect(margin, startY, pageWidth - margin * 2, rowHeight, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(15, 23, 42);
        pdf.text('#', margin + 4, startY + 10);

        headers.forEach((h, cIdx) => {
          const x = margin + 24 + cIdx * colWidth;
          pdf.text(h.length > 18 ? h.slice(0, 16) + '..' : h, x + 3, startY + 10);
        });

        startY += rowHeight;

        // Print rows up to 40 per sheet in combined PDF
        const maxRows = Math.min(sheet.rows.length, 36);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);

        for (let rIdx = 0; rIdx < maxRows; rIdx++) {
          const row = sheet.rows[rIdx];
          if (rIdx % 2 === 1) {
            pdf.setFillColor(248, 250, 252);
            pdf.rect(margin, startY, pageWidth - margin * 2, rowHeight, 'F');
          }
          pdf.setDrawColor(241, 245, 249);
          pdf.line(margin, startY + rowHeight, pageWidth - margin, startY + rowHeight);

          pdf.setTextColor(71, 85, 105);
          pdf.text(String(rIdx + 1), margin + 4, startY + 10);

          headers.forEach((h, cIdx) => {
            const x = margin + 24 + cIdx * colWidth;
            const valStr = String(row[h] !== undefined && row[h] !== null ? row[h] : '-');
            pdf.text(valStr.length > 20 ? valStr.slice(0, 18) + '..' : valStr, x + 3, startY + 10);
          });

          startY += rowHeight;
        }
      });

      pdf.save(`${fileName?.replace(/\.[^/.]+$/, '')}_ALL_SHEETS_${new Date().toISOString().slice(0, 10)}.pdf`);
      setIsGeneratingPdf(false);
      setPdfProgressText('');
    } catch (err) {
      console.error('Combined PDF generation error:', err);
      setError('Failed to generate combined PDF.');
      setIsGeneratingPdf(false);
      setPdfProgressText('');
    }
  };

  // Browser Print Trigger
  const handlePrint = () => {
    window.print();
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
                Commercial Doc Multi-Sheet Reader & PDF Exporter
              </h1>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 font-mono font-bold px-1.5 py-0.2 rounded-xs border border-emerald-200">
                Universal Multi-Sheet Viewer
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              View any sheet with identical layout & download high-resolution PDF for any sheet instantly
            </p>
          </div>
        </div>

        {/* Top Action Buttons */}
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
                <span>Upload File</span>
              </button>

              {/* PDF Download Button for Active Sheet */}
              {currentSheet && (
                <button
                  type="button"
                  onClick={() => handleDownloadSheetPDF()}
                  disabled={isGeneratingPdf}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-sm shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  title="Download active sheet as PDF"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Download Sheet PDF</span>
                </button>
              )}

              {/* Combined All Sheets PDF */}
              {sheets.length > 1 && (
                <button
                  type="button"
                  onClick={handleDownloadAllSheetsPDF}
                  disabled={isGeneratingPdf}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-[#1e3a8a] hover:bg-[#172554] text-white rounded-sm shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  title="Download all workbook sheets in one combined PDF"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-200" />
                  <span>All Sheets PDF ({sheets.length})</span>
                </button>
              )}

              {/* Export Active Sheet to CSV */}
              {currentSheet && (
                <button
                  type="button"
                  onClick={() => handleExportCSV()}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-[#0b1b3d] hover:bg-[#152d59] text-white rounded-sm shadow-xs transition-colors cursor-pointer"
                  title="Export active sheet rows to CSV"
                >
                  <Download className="w-3.5 h-3.5 text-blue-200" />
                  <span>CSV</span>
                </button>
              )}

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

      {/* Generating PDF Progress Toast */}
      {isGeneratingPdf && (
        <div className="p-3 bg-blue-900 text-white text-xs font-bold rounded-sm flex items-center justify-between shadow-md animate-pulse">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-300 animate-spin" />
            <span>{pdfProgressText || 'Preparing PDF Document...'}</span>
          </div>
          <span className="text-[10px] font-mono text-blue-200">Please wait...</span>
        </div>
      )}

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
          className={`border-2 border-dashed rounded-sm p-12 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-blue-600 bg-blue-50/70 scale-[1.005]'
              : 'border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400'
          }`}
        >
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-16 h-16 bg-blue-50 text-[#0b1b3d] rounded-full flex items-center justify-center mx-auto border border-blue-200 shadow-xs">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Drag & Drop Multi-Sheet Commercial Document Here
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Reads <strong>all sheets</strong> in the workbook simultaneously (Commercial Invoice, Packing List, Challan, PI, etc.) with instant PDF download and same-to-same view for each sheet.
              </p>
            </div>
            <div className="pt-2">
              <span className="inline-block px-4 py-1.5 bg-[#0b1b3d] text-white text-xs font-bold rounded-sm shadow-xs">
                Browse Excel File (.xlsx, .xls, .csv)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-sm text-xs text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900 font-bold cursor-pointer"
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
                {sheets.length} Total Sheets Available
              </span>
            </div>

            {/* Global Search across all sheets */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Global Search in All Sheets (e.g. PI#, Inv#, Style)..."
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

          {/* GLOBAL SEARCH RESULTS BANNER */}
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

              {/* All Sheets Overview Tab */}
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
                <span>All Sheets Overview ({sheets.length})</span>
              </button>
            </div>
          </div>

          {/* 5. ACTIVE SHEET CONTENT VIEW */}
          {activeSheetIdx === 'overview' ? (
            /* ALL SHEETS CONSOLIDATED OVERVIEW CARDS */
            <div className="bg-white border border-slate-200 rounded-b-sm p-4 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-2 gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#0b1b3d] uppercase tracking-wide">
                    Multi-Sheet Commercial Document Structure
                  </h3>
                  <p className="text-xs text-slate-500">
                    Summary of all {sheets.length} sheets in <strong>{fileName}</strong>. You can view or download PDF for any sheet below.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadAllSheetsPDF}
                    disabled={isGeneratingPdf}
                    className="px-3 py-1 bg-[#1e3a8a] hover:bg-[#172554] text-white text-xs font-bold rounded-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <FileDown className="w-3.5 h-3.5 text-blue-200" />
                    <span>Download All Sheets PDF ({sheets.length})</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {sheets.map((sheet, idx) => (
                  <div
                    key={sheet.name}
                    className="border border-slate-200 rounded-sm p-3.5 bg-slate-50/50 hover:bg-white hover:border-[#0b1b3d] hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-xs text-[#0b1b3d]">
                          <span className="w-5 h-5 bg-[#0b1b3d] text-white rounded-xs flex items-center justify-center text-[10px] font-mono">
                            {idx + 1}
                          </span>
                          <span className="truncate text-sm">{sheet.name}</span>
                        </div>
                        <span className="font-mono text-[10px] bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded-xs font-bold border border-blue-200">
                          {sheet.rowCount} Rows · {sheet.colCount} Cols
                        </span>
                      </div>

                      {/* Detected Commercial Keys */}
                      <div className="mt-2.5 space-y-1 bg-white p-2 rounded-xs border border-slate-200 text-[11px]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">
                          Extracted Key Columns:
                        </span>
                        {sheet.detectedCommercialFields.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {sheet.detectedCommercialFields.map((f, fIdx) => (
                              <span
                                key={fIdx}
                                className="bg-blue-50 text-blue-900 border border-blue-200 px-1.5 py-0.5 rounded-xs font-mono text-[10px]"
                                title={`${f.label}: ${f.sample}`}
                              >
                                {f.label}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {sheet.headers.slice(0, 4).map((h, hIdx) => (
                              <span
                                key={hIdx}
                                className="bg-slate-100 text-slate-700 border border-slate-200 px-1 py-0.2 rounded-xs font-mono text-[10px] truncate max-w-[110px]"
                              >
                                {h}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Bar for this specific sheet */}
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSheetIdx(idx);
                          setSheetViewMode('table');
                          setPage(1);
                        }}
                        className="px-2.5 py-1 bg-[#0b1b3d] text-white text-xs font-semibold rounded-xs hover:bg-[#152d59] transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <Eye className="w-3 h-3 text-blue-200" />
                        <span>View Sheet {idx + 1}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDownloadSheetPDF(sheet, idx + 1)}
                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-800 border border-red-300 text-xs font-bold rounded-xs transition-colors cursor-pointer flex items-center gap-1"
                          title="Download PDF for this sheet"
                        >
                          <FileDown className="w-3 h-3 text-red-600" />
                          <span>PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExportCSV(sheet)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-medium rounded-xs transition-colors cursor-pointer"
                          title="Export CSV for this sheet"
                        >
                          CSV
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : currentSheet ? (
            /* ACTIVE SHEET VIEW (SUPPORTS SAME-TO-SAME VIEW OPTIONS & PDF DOWNLOAD FOR ANY SHEET) */
            <div className="bg-white border border-slate-200 rounded-b-sm shadow-xs overflow-hidden flex flex-col">
              {/* Sheet Control Bar: View Modes, Search, Actions */}
              <div className="p-2 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs">
                {/* View Mode Toggle Buttons (Same-to-Same View Options for Every Sheet) */}
                <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-sm">
                  <button
                    type="button"
                    onClick={() => setSheetViewMode('table')}
                    className={`px-2.5 py-1 rounded-xs font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                      sheetViewMode === 'table'
                        ? 'bg-white text-[#0b1b3d] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Table className="w-3.5 h-3.5 text-blue-700" />
                    <span>Table View</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSheetViewMode('raw_grid')}
                    className={`px-2.5 py-1 rounded-xs font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                      sheetViewMode === 'raw_grid'
                        ? 'bg-white text-[#0b1b3d] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Grid3X3 className="w-3.5 h-3.5 text-indigo-700" />
                    <span>Exact Excel Grid (Same-to-Same)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSheetViewMode('document_preview')}
                    className={`px-2.5 py-1 rounded-xs font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                      sheetViewMode === 'document_preview'
                        ? 'bg-white text-[#0b1b3d] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Document / PDF Print View</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSheetViewMode('cards')}
                    className={`px-2.5 py-1 rounded-xs font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                      sheetViewMode === 'cards'
                        ? 'bg-white text-[#0b1b3d] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5 text-amber-700" />
                    <span>Cards View</span>
                  </button>
                </div>

                {/* Right Side Controls: Search, PDF Download & Page Size */}
                <div className="flex items-center gap-2 ml-auto">
                  {/* Quick PDF Download for Current Sheet */}
                  <button
                    type="button"
                    onClick={() => handleDownloadSheetPDF()}
                    disabled={isGeneratingPdf}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xs shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                    title="Download this sheet as PDF"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Download Sheet PDF</span>
                  </button>

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

                  {sheetViewMode === 'table' && (
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
                  )}
                </div>
              </div>

              {/* VIEW MODE 1: INTERACTIVE DATA TABLE */}
              {sheetViewMode === 'table' && (
                <>
                  <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-310px)] min-h-[380px] table-scrollbar relative">
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
                </>
              )}

              {/* VIEW MODE 2: EXACT SAME-TO-SAME RAW 2D EXCEL GRID VIEW */}
              {sheetViewMode === 'raw_grid' && (
                <div className="p-3 bg-slate-100 space-y-2">
                  <div className="bg-blue-50 border border-blue-200 p-2 rounded-xs flex items-center justify-between text-xs text-blue-950 font-sans">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Grid3X3 className="w-4 h-4 text-blue-800" />
                      <span>Original 2D Spreadsheet Grid: Preserves all cell positions, blank headers, and original document formatting.</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDownloadSheetPDF()}
                      className="px-2.5 py-0.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xs flex items-center gap-1 shadow-2xs"
                    >
                      <FileDown className="w-3 h-3" />
                      <span>Export Grid PDF</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] min-h-[380px] bg-white border border-slate-300 rounded-sm shadow-xs">
                    <table className="w-full text-left border-collapse font-mono text-[11px]">
                      <tbody>
                        {currentSheet.raw2D.map((rowArr, rIdx) => {
                          const isRowEmpty = rowArr.every((c) => c === '' || c === null || c === undefined);
                          return (
                            <tr
                              key={rIdx}
                              className={`border-b border-slate-200 hover:bg-amber-50/50 ${
                                isRowEmpty ? 'bg-slate-50/30' : rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                              }`}
                            >
                              {/* Row Index Coordinate */}
                              <td className="py-1 px-2 border-r border-slate-300 text-center font-bold text-slate-400 bg-slate-100 select-none w-10">
                                {rIdx + 1}
                              </td>

                              {/* Row Cell Data */}
                              {rowArr.map((cellVal: any, cIdx: number) => {
                                const strVal = String(cellVal !== undefined && cellVal !== null ? cellVal : '');
                                const isHeaderCandidate = rIdx < 3 && strVal.length > 0 && isNaN(Number(strVal));
                                return (
                                  <td
                                    key={cIdx}
                                    className={`py-1 px-2.5 border-r border-slate-200 whitespace-nowrap max-w-[280px] truncate ${
                                      isHeaderCandidate ? 'font-bold text-[#0b1b3d]' : 'text-slate-800'
                                    }`}
                                    title={strVal}
                                  >
                                    {strVal || <span className="text-slate-300">-</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* VIEW MODE 3: SAME-TO-SAME DOCUMENT / PRINT / PDF PREVIEW */}
              {sheetViewMode === 'document_preview' && (
                <div className="p-4 bg-slate-200/80 overflow-y-auto max-h-[calc(100vh-310px)] min-h-[420px] flex flex-col items-center">
                  <div className="w-full max-w-4xl bg-white border border-slate-300 rounded-sm p-6 shadow-xl space-y-4 font-sans text-slate-900" ref={documentPrintRef}>
                    {/* Document Header Letterhead */}
                    <div className="border-b-2 border-[#0b1b3d] pb-3 flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-[#0b1b3d] text-white rounded-xs flex items-center justify-center font-black text-sm">
                            M
                          </div>
                          <h2 className="text-lg font-black text-[#0b1b3d] tracking-tight">
                            MAINETTI COMMERCIAL DOCUMENT
                          </h2>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Mainetti Packaging & Garment Accessories Division · Global TC Management
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="inline-block px-2.5 py-0.5 bg-[#0b1b3d] text-white font-mono font-bold text-xs rounded-xs">
                          {currentSheet.name.toUpperCase()}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-1">
                          Date: {new Date().toISOString().slice(0, 10)}
                        </div>
                      </div>
                    </div>

                    {/* Metadata Box */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-xs border border-slate-200 text-xs font-mono">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 block uppercase font-sans">Workbook Source</span>
                        <span className="font-bold text-[#0b1b3d] truncate block">{fileName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 block uppercase font-sans">Active Sheet</span>
                        <span className="font-bold text-blue-900">{currentSheet.name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 block uppercase font-sans">Total Records</span>
                        <span className="font-bold text-emerald-800">{currentSheet.rowCount} Rows</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 block uppercase font-sans">Total Columns</span>
                        <span className="font-bold text-purple-800">{currentSheet.colCount} Columns</span>
                      </div>
                    </div>

                    {/* Formatted Commercial Document Table */}
                    <div className="border border-slate-300 rounded-xs overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs font-mono">
                        <thead className="bg-slate-100 border-b border-slate-300 text-[10px] font-bold text-slate-800 uppercase">
                          <tr>
                            <th className="py-1.5 px-2 border-r border-slate-300 text-center w-8">#</th>
                            {currentSheet.headers.map((h) => (
                              <th key={h} className="py-1.5 px-2 border-r border-slate-300 whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filteredAndSortedRows.slice(0, 40).map((row, idx) => (
                            <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                              <td className="py-1 px-2 text-center text-slate-400 border-r border-slate-200 font-bold">
                                {idx + 1}
                              </td>
                              {currentSheet.headers.map((h) => (
                                <td key={h} className="py-1 px-2 border-r border-slate-200 whitespace-nowrap truncate max-w-[200px]">
                                  {String(row[h] !== undefined && row[h] !== null ? row[h] : '-')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Document Signatures & Seal Section */}
                    <div className="pt-4 border-t border-slate-200 grid grid-cols-3 gap-4 text-center font-sans text-xs">
                      <div>
                        <div className="h-10 border-b border-dashed border-slate-300" />
                        <span className="text-[11px] font-bold text-slate-700 block mt-1">Prepared By</span>
                        <span className="text-[10px] text-slate-400 font-mono">Commercial Dept.</span>
                      </div>
                      <div>
                        <div className="h-10 border-b border-dashed border-slate-300 flex items-center justify-center">
                          <span className="text-[10px] font-bold font-mono text-blue-900 border border-blue-300 px-2 py-0.5 rounded-xs bg-blue-50">
                            AUTHENTICATED
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-700 block mt-1">Verified & Inspected</span>
                        <span className="text-[10px] text-slate-400 font-mono">Operations Unit</span>
                      </div>
                      <div>
                        <div className="h-10 border-b border-dashed border-slate-300" />
                        <span className="text-[11px] font-bold text-slate-700 block mt-1">Authorized Signatory</span>
                        <span className="text-[10px] text-slate-400 font-mono">Mainetti Bangladesh</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW MODE 4: CARD / RECORD GRID VIEW */}
              {sheetViewMode === 'cards' && (
                <div className="p-3 bg-slate-100 overflow-y-auto max-h-[calc(100vh-310px)] min-h-[380px]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {paginatedRows.map((row, idx) => {
                      const actualIdx = (page - 1) * pageSize + idx + 1;
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedRow(row)}
                          className="bg-white border border-slate-200 hover:border-blue-500 rounded-sm p-3 shadow-2xs hover:shadow-md transition-all cursor-pointer space-y-2 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                              <span className="font-mono font-bold text-xs text-[#0b1b3d] flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5 text-blue-700" />
                                <span>Record #{actualIdx}</span>
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {currentSheet.name}
                              </span>
                            </div>

                            <div className="mt-2 space-y-1 text-xs font-mono">
                              {currentSheet.headers.slice(0, 6).map((h) => (
                                <div key={h} className="flex items-center justify-between gap-2">
                                  <span className="text-slate-500 text-[11px] truncate">{h}:</span>
                                  <span className="font-bold text-slate-900 truncate max-w-[140px]">
                                    {String(row[h] !== undefined && row[h] !== null ? row[h] : '-')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="text-blue-700 font-semibold hover:underline">
                              Inspect All Fields →
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
                className="text-slate-300 hover:text-white p-1 rounded-xs hover:bg-white/10 transition-colors cursor-pointer"
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
                          className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
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
                className="px-3 py-1 bg-[#0b1b3d] text-white font-semibold rounded-xs hover:bg-[#152d59] transition-colors cursor-pointer"
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
