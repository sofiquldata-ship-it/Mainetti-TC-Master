import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
  Trash2,
  HardDrive,
  Filter,
  ArrowRight,
  RefreshCw,
  FileCheck,
  Settings2,
  Sparkles,
  Truck,
  Hash,
} from 'lucide-react';
import { PIData, UploadedFileInfo, DeliveryReportFileInfo } from '../types/tc';
import {
  parseExcelFile,
  downloadSampleExcelTemplate,
  clearPersistentStorage,
  saveToPersistentStorage,
} from '../utils/excelParser';
import {
  parseDeliveryReportFile,
  getSavedDeliveryReportInfo,
  clearSavedDeliveryReport,
  downloadSampleDeliveryReportTemplate,
} from '../utils/deliveryReportParser';
import { mergeExcelDataWithDatabase, SyncReport } from '../utils/dataMerger';

interface ExcelUploadViewProps {
  currentData: PIData[];
  activeFileInfo: UploadedFileInfo | null;
  onDataImported: (newData: PIData[], fileInfo: UploadedFileInfo) => void;
  onClearAllData: () => void;
  onNavigateToDashboard: () => void;
}

export const ExcelUploadView: React.FC<ExcelUploadViewProps> = ({
  currentData,
  activeFileInfo,
  onDataImported,
  onClearAllData,
  onNavigateToDashboard,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);
  const [headerRowSetting, setHeaderRowSetting] = useState<number>(0);
  const [detectedRowInfo, setDetectedRowInfo] = useState<number | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<File | null>(null);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delivery Report Upload State (PI-wise Last Delivery Challan Extractor)
  const [isDeliveryDragging, setIsDeliveryDragging] = useState(false);
  const [isDeliveryProcessing, setIsDeliveryProcessing] = useState(false);
  const [deliveryReportInfo, setDeliveryReportInfo] = useState<DeliveryReportFileInfo | null>(() =>
    getSavedDeliveryReportInfo()
  );
  const [deliveryMatchedLogs, setDeliveryMatchedLogs] = useState<
    {
      piNumber: string;
      previousChallan: string;
      newLastChallan: string;
      deliveryCount: number;
      lastDeliveryDate?: string;
    }[]
  >([]);
  const deliveryFileInputRef = useRef<HTMLInputElement>(null);

  const handleDeliveryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processDeliveryReport(file);
    }
  };

  const handleDeliveryDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDeliveryDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processDeliveryReport(file);
    }
  };

  const processDeliveryReport = async (file: File) => {
    setErrorMessage(null);
    setSuccessFeedback(null);
    setIsDeliveryProcessing(true);

    try {
      if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
        throw new Error('Please upload a valid Delivery Report Excel (.xlsx, .xls) or CSV file.');
      }

      const { updatedPiList, fileInfo, matchedLogs } = await parseDeliveryReportFile(
        file,
        currentData
      );

      setDeliveryReportInfo(fileInfo);
      setDeliveryMatchedLogs(matchedLogs);

      if (currentData.length > 0) {
        const effectiveFileInfo: UploadedFileInfo = activeFileInfo || {
          fileName: 'Master Production Report',
          fileSize: file.size,
          uploadDate: new Date().toLocaleString(),
          totalRowsFound: updatedPiList.length,
          validRowsWithTcCost: updatedPiList.length,
          filteredOutZeroCostRows: 0,
          totalCostUsd: updatedPiList.reduce((s, o) => s + (o.tcCost || 0), 0),
        };
        saveToPersistentStorage(updatedPiList, effectiveFileInfo);
        onDataImported(updatedPiList, effectiveFileInfo);
      }

      setSuccessFeedback(
        `Delivery Report Synced! Extracted PI-wise Last Delivery Challan Number for ${fileInfo.totalPisWithChallan} PIs (${fileInfo.matchedDatabasePis} matched with active TC PIs).`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to parse the Delivery Report Excel file.');
    } finally {
      setIsDeliveryProcessing(false);
      if (deliveryFileInputRef.current) {
        deliveryFileInputRef.current.value = '';
      }
    }
  };

  const handleClearDeliveryReport = () => {
    clearSavedDeliveryReport();
    setDeliveryReportInfo(null);
    setDeliveryMatchedLogs([]);
    if (currentData.length > 0 && activeFileInfo) {
      const cleaned = currentData.map((p) => ({
        ...p,
        lastChallanNumber: undefined,
        lastDeliveryDate: undefined,
        allChallanNumbers: undefined,
        deliveryCount: undefined,
      }));
      saveToPersistentStorage(cleaned, activeFileInfo);
      onDataImported(cleaned, activeFileInfo);
    }
    setSuccessFeedback('Saved Delivery Report & Last Challan Numbers cleared.');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLastUploadedFile(file);
      await processFile(file, headerRowSetting);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setLastUploadedFile(file);
      await processFile(file, headerRowSetting);
    }
  };

  const processFile = async (file: File, forcedRowNumber: number) => {
    setErrorMessage(null);
    setSuccessFeedback(null);
    setIsProcessing(true);

    try {
      if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
        throw new Error('Please upload a valid Excel file (.xlsx, .xls) or CSV file.');
      }

      const { validOrders, fileInfo, detectedHeaderRow } = await parseExcelFile(
        file,
        forcedRowNumber > 0 ? forcedRowNumber : undefined
      );

      setDetectedRowInfo(detectedHeaderRow);

      if (validOrders.length === 0) {
        throw new Error(
          `Scanned "${file.name}" (Header Row: ${detectedHeaderRow}), but found NO rows matching 'TRANSACTION CERTIFICATE COST' in the Model or Description columns. Please ensure your Excel file has lines labeled 'TRANSACTION CERTIFICATE COST' with an amount/cost.`
        );
      }

      // Perform field-level delta merge with primary key = PI No
      const { mergedData, report } = mergeExcelDataWithDatabase(
        currentData,
        validOrders,
        'Excel Upload'
      );

      setSyncReport(report);
      saveToPersistentStorage(mergedData, fileInfo);
      onDataImported(mergedData, fileInfo);

      const summaryText = [];
      if (report.newAddedCount > 0) summaryText.push(`${report.newAddedCount} new PIs added`);
      if (report.updatedCount > 0) summaryText.push(`${report.updatedCount} PIs updated with field changes`);
      if (report.unchangedCount > 0) summaryText.push(`${report.unchangedCount} PIs unchanged`);
      if (report.retainedCount > 0) summaryText.push(`${report.retainedCount} previous PIs retained`);

      setSuccessFeedback(
        `Sync Complete! Primary Key matching by PI No. Total PIs in database: ${report.totalFinalRecords}. (${summaryText.join(', ')})`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process the Excel file.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleHeaderRowChange = async (newRow: number) => {
    setHeaderRowSetting(newRow);
    if (lastUploadedFile) {
      await processFile(lastUploadedFile, newRow);
    }
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to remove all saved Excel data?')) {
      clearPersistentStorage();
      onClearAllData();
      setDetectedRowInfo(null);
      setLastUploadedFile(null);
      setSuccessFeedback('All uploaded data cleared. The system is now ready for a fresh upload.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-[#0b1b3d] text-white p-4 rounded-sm border border-[#16294d] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-blue-300" />
          <h2 className="text-base font-bold font-mono tracking-tight uppercase">
            TRANSACTION CERTIFICATE COST EXTRACTOR & SUMMARY
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => downloadSampleExcelTemplate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#132c5e] hover:bg-[#1b3d82] text-white border border-[#254d9b] rounded-sm transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-blue-300" />
            <span>Download Sample Template (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => downloadSampleDeliveryReportTemplate()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 border border-emerald-600/60 rounded-sm transition-colors cursor-pointer"
          >
            <Truck className="w-4 h-4 text-emerald-300" />
            <span>Sample Delivery Report (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Error & Success Alerts */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-sm text-xs text-red-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <strong className="font-bold block">Excel Parsing Notice:</strong>
            <span>{errorMessage}</span>
            <div className="mt-1 flex items-center gap-2 pt-1 border-t border-red-200">
              <span className="font-semibold text-[11px]">Tip:</span>
              <button
                type="button"
                onClick={() => handleHeaderRowChange(2)}
                className="px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-900 text-[11px] font-bold rounded-xs border border-red-300 cursor-pointer"
              >
                Try Row 2 as Column Headers
              </button>
            </div>
          </div>
        </div>
      )}

      {successFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-sm text-xs text-emerald-900 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-bold block">Extraction & Delta Sync Ready:</strong>
            <span>{successFeedback}</span>
          </div>
        </div>
      )}

      {/* Sync Audit Report Card */}
      {syncReport && (
        <div className="bg-white border border-slate-300 rounded-sm p-4 space-y-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold font-mono uppercase text-[#0b1b3d]">
                Database Sync Audit Report (Primary Matching Key: PI No.)
              </h3>
            </div>
            <button
              type="button"
              onClick={onNavigateToDashboard}
              className="flex items-center gap-1 px-3 py-1 bg-[#0b1b3d] hover:bg-[#132c5e] text-white text-xs font-bold rounded-xs cursor-pointer transition-colors"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Sync Stats Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xs">
              <span className="block text-[10px] uppercase text-emerald-800 font-semibold">New Records</span>
              <span className="text-sm font-bold font-mono text-emerald-900">+{syncReport.newAddedCount}</span>
            </div>

            <div className="p-2 bg-blue-50 border border-blue-200 rounded-xs">
              <span className="block text-[10px] uppercase text-blue-800 font-semibold">Field Changes</span>
              <span className="text-sm font-bold font-mono text-blue-900">{syncReport.updatedCount}</span>
            </div>

            <div className="p-2 bg-slate-50 border border-slate-200 rounded-xs">
              <span className="block text-[10px] uppercase text-slate-600 font-semibold">Unchanged</span>
              <span className="text-sm font-bold font-mono text-slate-800">{syncReport.unchangedCount}</span>
            </div>

            <div className="p-2 bg-amber-50 border border-amber-200 rounded-xs">
              <span className="block text-[10px] uppercase text-amber-800 font-semibold">Retained (Not in File)</span>
              <span className="text-sm font-bold font-mono text-amber-900">{syncReport.retainedCount}</span>
            </div>

            <div className="p-2 bg-[#0b1b3d] text-white rounded-xs col-span-2 sm:col-span-1">
              <span className="block text-[10px] uppercase text-slate-300 font-semibold">Total Database PIs</span>
              <span className="text-sm font-bold font-mono">{syncReport.totalFinalRecords}</span>
            </div>
          </div>

          {/* Specific Field Delta Changes Table */}
          {syncReport.changes.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-tight flex items-center justify-between">
                <span>Field Delta Change Log ({syncReport.changes.length} fields updated)</span>
                <span className="text-slate-400 font-normal">Only modified specific fields were updated</span>
              </div>

              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xs text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-[10px] font-bold uppercase text-slate-700 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-1.5 px-2.5 border-r border-slate-200">PI Number</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-200">Field Updated</th>
                      <th className="py-1.5 px-2.5 border-r border-slate-200 text-red-700 bg-red-50/50">Previous Value</th>
                      <th className="py-1.5 px-2.5 text-emerald-800 bg-emerald-50/50">New Excel Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                    {syncReport.changes.map((ch, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2.5 font-bold text-[#0b1b3d] border-r border-slate-200 whitespace-nowrap">
                          {ch.piNumber}
                        </td>
                        <td className="py-1.5 px-2.5 font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                          {ch.fieldLabel}
                        </td>
                        <td className="py-1.5 px-2.5 text-red-600 line-through border-r border-slate-200 whitespace-nowrap bg-red-50/20">
                          {String(ch.oldValue)}
                        </td>
                        <td className="py-1.5 px-2.5 text-emerald-700 font-bold whitespace-nowrap bg-emerald-50/20">
                          {String(ch.newValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            syncReport.updatedCount === 0 && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xs text-xs text-slate-600 text-center">
                No specific fields were modified for existing records in this import.
              </div>
            )
          )}
        </div>
      )}

      {/* Live Delivery Report Match Log Audit Card */}
      {deliveryMatchedLogs.length > 0 && (
        <div className="bg-white border border-emerald-300 rounded-sm p-4 space-y-2.5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 pb-2">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-700" />
              <h3 className="text-xs font-bold font-mono uppercase text-emerald-950">
                Delivery Report Extracted: PI-Wise Last Delivery Challan Numbers ({deliveryMatchedLogs.length} PIs Updated)
              </h3>
            </div>
            <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-100 px-2 py-0.5 rounded-xs font-mono">
              Auto-Linked to Challan & Declaration
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto border border-emerald-200 rounded-xs text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-emerald-50 text-[10px] font-bold uppercase text-emerald-900 sticky top-0 border-b border-emerald-200">
                <tr>
                  <th className="py-1.5 px-2.5 border-r border-emerald-200">PI Number</th>
                  <th className="py-1.5 px-2.5 border-r border-emerald-200 text-emerald-800">
                    Extracted Last Challan No
                  </th>
                  <th className="py-1.5 px-2.5 border-r border-emerald-200">Deliveries (Challan Count)</th>
                  <th className="py-1.5 px-2.5 text-slate-700">Last Delivery Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 font-mono text-[11px]">
                {deliveryMatchedLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-emerald-50/50">
                    <td className="py-1.5 px-2.5 font-bold text-[#0b1b3d] border-r border-emerald-100 whitespace-nowrap">
                      {log.piNumber}
                    </td>
                    <td className="py-1.5 px-2.5 font-black text-emerald-900 bg-emerald-100/40 border-r border-emerald-100 whitespace-nowrap">
                      #{log.newLastChallan}
                    </td>
                    <td className="py-1.5 px-2.5 font-semibold text-slate-700 border-r border-emerald-100 whitespace-nowrap">
                      <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded-xs text-[10px]">
                        D-0{log.deliveryCount} ({log.deliveryCount} {log.deliveryCount === 1 ? 'Challan' : 'Challans'})
                      </span>
                    </td>
                    <td className="py-1.5 px-2.5 text-slate-600 whitespace-nowrap">
                      {log.lastDeliveryDate || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Zones & Saved Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Upload Dropzones (Col Span 2) */}
        <div className="lg:col-span-2 space-y-4">
          {/* CARD 1: Master Production Report Upload */}
          <div className="space-y-2">
            {/* Header Row Selection Bar */}
            <div className="bg-white border border-slate-200 rounded-sm p-2 px-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs text-slate-700">
                <FileSpreadsheet className="w-4 h-4 text-[#1e3a8a]" />
                <span className="font-bold text-[#0b1b3d] uppercase tracking-wide">1. Master Production Report</span>
                <span className="text-[10px] text-slate-400 font-mono">Header Row:</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleHeaderRowChange(0)}
                  className={`px-2 py-0.5 text-xs font-semibold rounded-xs border transition-colors cursor-pointer ${
                    headerRowSetting === 0
                      ? 'bg-[#0b1b3d] text-white border-[#0b1b3d]'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Auto-Detect {detectedRowInfo ? `(Row ${detectedRowInfo})` : ''}
                </button>

                <button
                  type="button"
                  onClick={() => handleHeaderRowChange(2)}
                  className={`px-2 py-0.5 text-xs font-bold rounded-xs border transition-colors cursor-pointer ${
                    headerRowSetting === 2
                      ? 'bg-[#0b1b3d] text-white border-[#0b1b3d]'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Row 2 (ERP)
                </button>

                <button
                  type="button"
                  onClick={() => handleHeaderRowChange(1)}
                  className={`px-2 py-0.5 text-xs font-semibold rounded-xs border transition-colors cursor-pointer ${
                    headerRowSetting === 1
                      ? 'bg-[#0b1b3d] text-white border-[#0b1b3d]'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  Row 1
                </button>
              </div>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-sm p-6 flex flex-col items-center justify-center text-center transition-all bg-white ${
                isDragging
                  ? 'border-blue-600 bg-blue-50/50 scale-[0.99]'
                  : 'border-slate-300 hover:border-slate-400'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
                id="excel-file-input"
              />

              <div className="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center mb-2 border border-slate-200">
                <UploadCloud className="w-5 h-5 text-[#0b1b3d]" />
              </div>

              <h3 className="text-xs font-bold text-[#0b1b3d] mb-0.5">
                Drag & Drop Master Production Report (.xlsx, .csv)
              </h3>
              <p className="text-[11px] text-slate-500 mb-3 max-w-md">
                Extracts orders with <strong className="text-slate-800">Model/Description</strong> = <strong className="text-blue-900">"TRANSACTION CERTIFICATE COST"</strong>.
              </p>

              <div className="flex items-center gap-3">
                <label
                  htmlFor="excel-file-input"
                  className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white bg-[#0b1b3d] hover:bg-[#162d59] rounded-sm transition-colors cursor-pointer flex items-center gap-2 ${
                    isProcessing ? 'opacity-70 pointer-events-none' : ''
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-200" />
                      <span>Processing Master Excel...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-3.5 h-3.5 text-blue-200" />
                      <span>Browse Master Report</span>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>

          {/* CARD 2: Delivery Report Upload (PI-wise Last Delivery Challan Extractor) */}
          <div className="space-y-2">
            <div className="bg-emerald-950/90 text-white border border-emerald-900 rounded-sm p-2 px-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs">
                <Truck className="w-4 h-4 text-emerald-300" />
                <span className="font-bold tracking-wide uppercase">2. Delivery Report Upload</span>
                <span className="text-[10px] text-emerald-200 font-mono">
                  (Extracts PI-Wise Last Delivery Challan Number)
                </span>
              </div>
              <span className="text-[10px] font-mono bg-emerald-800 text-emerald-100 px-1.5 py-0.5 rounded-xs font-semibold">
                Challan Sync
              </span>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDeliveryDragging(true);
              }}
              onDragLeave={() => setIsDeliveryDragging(false)}
              onDrop={handleDeliveryDrop}
              className={`border-2 border-dashed rounded-sm p-6 flex flex-col items-center justify-center text-center transition-all bg-emerald-50/20 ${
                isDeliveryDragging
                  ? 'border-emerald-600 bg-emerald-50 scale-[0.99]'
                  : 'border-emerald-300/80 hover:border-emerald-500'
              }`}
            >
              <input
                ref={deliveryFileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleDeliveryFileChange}
                className="hidden"
                id="delivery-report-file-input"
              />

              <div className="w-11 h-11 bg-emerald-100/70 rounded-full flex items-center justify-center mb-2 border border-emerald-300">
                <Truck className="w-5 h-5 text-emerald-800" />
              </div>

              <h3 className="text-xs font-bold text-emerald-950 mb-0.5">
                Drag & Drop Delivery Report Excel File (.xlsx, .csv)
              </h3>
              <p className="text-[11px] text-slate-600 mb-3 max-w-md">
                Scans all rows, groups by <strong className="text-slate-900">PI Number</strong>, and pulls the <strong className="text-emerald-900 font-bold">PI-wise LAST Delivery Challan Number</strong> into the system.
              </p>

              <div className="flex items-center gap-3">
                <label
                  htmlFor="delivery-report-file-input"
                  className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white bg-emerald-800 hover:bg-emerald-900 rounded-sm transition-colors cursor-pointer flex items-center gap-2 ${
                    isDeliveryProcessing ? 'opacity-70 pointer-events-none' : ''
                  }`}
                >
                  {isDeliveryProcessing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-200" />
                      <span>Extracting Last Challans...</span>
                    </>
                  ) : (
                    <>
                      <Truck className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Browse Delivery Report</span>
                    </>
                  )}
                </label>
              </div>

              <div className="mt-3 pt-3 border-t border-emerald-200/60 w-full flex items-center justify-center gap-3 text-[11px] text-emerald-800 font-mono">
                <span>Auto-Pulls Last Challan No</span>
                <span>·</span>
                <span>Handles Multiple Deliveries per PI</span>
                <span>·</span>
                <span>Syncs to Gate Pass & Declaration</span>
              </div>
            </div>
          </div>
        </div>

        {/* Persistence & Active Files Stats (Col Span 1) */}
        <div className="bg-white border border-slate-200 rounded-sm p-4 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-[#0b1b3d]" />
                <h3 className="text-xs font-bold text-[#0b1b3d] uppercase tracking-wide">
                  Saved Storage State
                </h3>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-xs bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                Persistent
              </span>
            </div>

            {/* 1. Master Production Report State */}
            {activeFileInfo ? (
              <div className="space-y-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      Master Report
                    </span>
                    <span className="text-[9px] font-mono text-blue-700 bg-blue-50 px-1 py-0.5 rounded-xs border border-blue-200 font-semibold">
                      TC Orders
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-[#0b1b3d] truncate">
                    <FileCheck className="w-4 h-4 text-[#1e3a8a] shrink-0" />
                    <span className="truncate">{activeFileInfo.fileName}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                    Loaded on: {activeFileInfo.uploadDate}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-slate-50 rounded-sm border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">PIs with TC Cost</span>
                    <span className="text-sm font-bold font-mono text-emerald-700 tabular-nums">
                      {activeFileInfo.validRowsWithTcCost}
                    </span>
                    <span className="text-[10px] text-slate-400 block">Kept in system</span>
                  </div>

                  <div className="p-2 bg-slate-50 rounded-sm border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">Non-TC Items</span>
                    <span className="text-sm font-bold font-mono text-slate-500 tabular-nums">
                      {activeFileInfo.filteredOutZeroCostRows}
                    </span>
                    <span className="text-[10px] text-red-600 block">Filtered out</span>
                  </div>
                </div>

                <div className="p-2 bg-slate-50 rounded-sm border border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] text-slate-600">Total TC Expenditure:</span>
                  <strong className="text-xs font-bold font-mono text-[#0b1b3d]">
                    ${activeFileInfo.totalCostUsd.toLocaleString()} USD
                  </strong>
                </div>
              </div>
            ) : (
              <div className="py-3 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-sm">
                No Master Production Report uploaded yet.
              </div>
            )}

            {/* 2. Delivery Report State */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase font-bold text-emerald-900 flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5 text-emerald-700" />
                  Delivery Report (Last Challan)
                </span>
                {deliveryReportInfo && (
                  <button
                    type="button"
                    onClick={handleClearDeliveryReport}
                    className="text-[10px] text-red-600 hover:text-red-800 hover:underline cursor-pointer"
                  >
                    Clear Challans
                  </button>
                )}
              </div>

              {deliveryReportInfo ? (
                <div className="p-2.5 bg-emerald-50/70 rounded-sm border border-emerald-200 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 font-mono font-bold text-emerald-950 truncate">
                    <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span className="truncate">{deliveryReportInfo.fileName}</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 block font-mono">
                    Loaded on: {deliveryReportInfo.uploadDate}
                  </span>

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <div className="p-1.5 bg-white rounded-xs border border-emerald-200 text-center">
                      <span className="text-[9px] uppercase text-slate-500 block">PIs in Report</span>
                      <span className="text-xs font-bold font-mono text-emerald-900">
                        {deliveryReportInfo.totalPisWithChallan}
                      </span>
                    </div>
                    <div className="p-1.5 bg-white rounded-xs border border-emerald-200 text-center">
                      <span className="text-[9px] uppercase text-slate-500 block">Matched with PIs</span>
                      <span className="text-xs font-bold font-mono text-emerald-700">
                        {deliveryReportInfo.matchedDatabasePis}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-3 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-sm bg-slate-50/50">
                  <Truck className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                  <span>No Delivery Report uploaded yet.</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {currentData.length > 0 && (
              <button
                type="button"
                onClick={onNavigateToDashboard}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-wider text-white bg-[#0b1b3d] hover:bg-[#162d59] rounded-sm transition-colors cursor-pointer"
              >
                <span>Open in Mainetti Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {activeFileInfo && (
              <button
                type="button"
                onClick={handleClear}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-red-700 hover:text-red-800 bg-red-50/50 hover:bg-red-100/60 border border-red-200 rounded-sm transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                <span>Clear All Saved Data</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Data Preview Table with Last Challan No Column */}
      {currentData.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-sm shadow-xs overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#0b1b3d]" />
              <h3 className="text-xs font-bold text-[#0b1b3d] uppercase tracking-wide">
                Extracted PIs with 'TRANSACTION CERTIFICATE COST' ({currentData.length} records)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              Saved in LocalStorage
            </span>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-[#0b1b3d] text-white text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 border-r border-[#1a386b]">Order Date</th>
                  <th className="py-2.5 px-3 border-r border-[#1a386b]">PI Number</th>
                  <th className="py-2.5 px-3 border-r border-[#1a386b] bg-[#112a59] text-emerald-300">
                    Last Challan No
                  </th>
                  <th className="py-2.5 px-3 border-r border-[#1a386b]">Buyer</th>
                  <th className="py-2.5 px-3 border-r border-[#1a386b]">Customer / Factory</th>
                  <th className="py-2.5 px-3 border-r border-[#1a386b] text-right">Order Qty</th>
                  <th className="py-2.5 px-3 border-r border-[#1a386b] text-right">Delivery Qty</th>
                  <th className="py-2.5 px-3 border-r border-[#1a386b] text-right">Balance Qty</th>
                  <th className="py-2.5 px-3 border-r border-[#1a386b]">Delivery Status</th>
                  <th className="py-2.5 px-3 border-r border-[#1a386b]">TC Status</th>
                  <th className="py-2.5 px-3 text-right">TC Cost (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {currentData.map((order, idx) => {
                  const rawOrderQ = order.orderQuantity ?? order.quantityPcs ?? 0;
                  const orderQ = rawOrderQ <= 1 ? 0 : rawOrderQ;
                  const delivQ =
                    orderQ === 0
                      ? 0
                      : order.deliveryQuantity !== undefined && order.deliveryQuantity > 1
                      ? order.deliveryQuantity
                      : order.deliveryStatus === 'Delivered'
                      ? orderQ
                      : order.deliveryStatus === 'In Transit'
                      ? Math.floor(orderQ * 0.8)
                      : 0;
                  const balQ = Math.max(0, orderQ - delivQ);

                  return (
                    <tr
                      key={order.id}
                      className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-[#fafbfc] hover:bg-slate-50'}
                    >
                      <td className="py-2 px-3 font-mono text-slate-800 border-r border-slate-100 whitespace-nowrap">
                        {order.orderDate}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-[#0b1b3d] border-r border-slate-100 whitespace-nowrap">
                        {order.piNumber}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold border-r border-slate-100 whitespace-nowrap bg-emerald-50/30">
                        {order.lastChallanNumber ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded-xs text-[11px] font-mono">
                              #{order.lastChallanNumber}
                            </span>
                            {order.deliveryCount && order.deliveryCount > 1 && (
                              <span className="text-[9px] text-slate-500 font-mono" title={`Total ${order.deliveryCount} deliveries for this PI`}>
                                (D-0{order.deliveryCount})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800 border-r border-slate-100 whitespace-nowrap">
                        {order.buyer}
                      </td>
                      <td className="py-2 px-3 text-slate-600 border-r border-slate-100 truncate max-w-[160px]">
                        {order.customer}
                      </td>
                      <td className="py-2 px-3 font-mono text-right text-slate-900 font-semibold border-r border-slate-100 tabular-nums whitespace-nowrap">
                        {orderQ.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 font-mono text-right text-emerald-800 font-medium border-r border-slate-100 tabular-nums whitespace-nowrap">
                        {delivQ.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 font-mono text-right border-r border-slate-100 tabular-nums whitespace-nowrap">
                        <span className={balQ > 0 ? 'text-amber-800 font-semibold' : 'text-slate-400'}>
                          {balQ.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-700 border-r border-slate-100 whitespace-nowrap">
                        {order.deliveryStatus}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] border-r border-slate-100 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            order.tcStatus === 'Overdue'
                              ? 'text-red-700'
                              : order.tcStatus === 'Issued'
                              ? 'text-emerald-700'
                              : 'text-amber-800'
                          }`}
                        >
                          {order.tcStatus}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-right text-[#0b1b3d] tabular-nums whitespace-nowrap">
                        ${order.tcCost}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
