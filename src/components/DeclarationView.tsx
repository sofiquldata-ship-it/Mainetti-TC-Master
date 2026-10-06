import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PIData, TCStatus, computeAutomatedTcStatus } from '../types/tc';
import { getSignatureDataUrl } from '../assets/signatureData';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  FileCheck2,
  Download,
  Printer,
  Copy,
  Check,
  Calendar,
  Building2,
  AlertTriangle,
  Clock,
  Layers,
  Search,
  CheckCircle2,
  FileText,
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Upload,
} from 'lucide-react';

interface DeclarationViewProps {
  data: PIData[];
  onSelectPI?: (pi: PIData) => void;
  onUpdatePI?: (pi: PIData) => void;
  onSaveToGoogleSheets?: () => void;
}

export const DeclarationView: React.FC<DeclarationViewProps> = ({
  data,
  onSelectPI,
  onUpdatePI,
  onSaveToGoogleSheets,
}) => {
  // Helper to calculate days difference from a date string to today (or fixed reference date)
  const getDaysFromDate = (dateStr?: string): number => {
    if (!dateStr) return 0;
    try {
      const targetTime = new Date(dateStr).getTime();
      if (isNaN(targetTime)) return 0;
      // Fixed reference time for FY2026 system context or current system time
      const today = new Date().getTime();
      const diffMs = today - targetTime;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    } catch {
      return 0;
    }
  };

  // Helper to format date in long form, e.g. "15 August 2026"
  const formatLongDate = (dateInput: Date | string): string => {
    try {
      const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (isNaN(d.getTime())) return '15 August 2026';
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return '15 August 2026';
    }
  };

  // Threshold state: '90' (90+ days / 90-179 days), '180' (180+ days), or 'all' (all 90+ days)
  const [dayThreshold, setDayThreshold] = useState<'90' | '180' | 'all'>('90');

  // Base list of all overdue orders (Where Final TC is NOT issued & Days from Invoice Date > 90 strictly)
  const allOverdueList = useMemo(() => {
    return data
      .map((item) => {
        const autoStatus = computeAutomatedTcStatus(item);
        const effectiveStatus = autoStatus !== 'Not Requested' ? autoStatus : (item.tcStatus || 'Not Requested');
        const isFinalIssued =
          effectiveStatus === 'Final TC Received' ||
          effectiveStatus === 'Issued' ||
          Boolean(item.finalTcReceivedDate);

        // Strict Rule: ONLY Invoice Date is used (Not Order Date)
        const invoiceDate = item.invoiceDate ? String(item.invoiceDate).trim() : '';
        const daysOver = invoiceDate ? getDaysFromDate(invoiceDate) : 0;

        return {
          ...item,
          effectiveStatus,
          isFinalIssued,
          invoiceDate,
          daysOver,
          is90DaysOver: !isFinalIssued && Boolean(invoiceDate) && daysOver > 90,
          is180DaysOver: !isFinalIssued && Boolean(invoiceDate) && daysOver > 180,
        };
      })
      .filter((item) => item.is90DaysOver)
      .sort((a, b) => b.daysOver - a.daysOver);
  }, [data]);

  // Specific 180+ Days list (strictly daysOver > 180)
  const list180Days = useMemo(() => {
    return allOverdueList.filter((item) => item.is180DaysOver);
  }, [allOverdueList]);

  // Specific 90 to 180 Days list (strictly 90 < daysOver <= 180, excluding 180+ days)
  const list90To179Days = useMemo(() => {
    return allOverdueList.filter((item) => !item.is180DaysOver);
  }, [allOverdueList]);

  // Active overdue list based on selected threshold (STRICT EXCLUSION: 180+ days orders only in 180D mode, not in 90D mode)
  const overduePiList = useMemo(() => {
    if (dayThreshold === '180') {
      return list180Days;
    }
    if (dayThreshold === '90') {
      return list90To179Days;
    }
    return allOverdueList;
  }, [allOverdueList, list180Days, list90To179Days, dayThreshold]);

  // Selected PIs state
  const [selectedPiIds, setSelectedPiIds] = useState<string[]>(() => {
    return list90To179Days.length > 0
      ? list90To179Days.map((p) => p.id)
      : list180Days.map((p) => p.id);
  });

  // Auto-update selected PIs when switching threshold tab
  const handleThresholdChange = (newThreshold: '90' | '180' | 'all') => {
    setDayThreshold(newThreshold);
    const targetList =
      newThreshold === '180'
        ? list180Days
        : newThreshold === '90'
        ? list90To179Days
        : allOverdueList;
    setSelectedPiIds(targetList.map((p) => p.id));

    if (newThreshold === '180') {
      setSubjectText('Declaration letter to issue Transaction Certificate, 180 days over orders');
    } else {
      setSubjectText('Declaration letter to issue Transaction Certificate, 90 days over orders');
    }
  };

  // Sync selected IDs if overdue list changes
  const selectedPIs = useMemo(() => {
    return overduePiList.filter((p) => selectedPiIds.includes(p.id));
  }, [overduePiList, selectedPiIds]);

  // Persistent Storage Keys
  const STORAGE_KEY_SIGNATURE = 'mainetti_declaration_signature';
  const STORAGE_KEY_RECIPIENT = 'mainetti_declaration_recipient';
  const STORAGE_KEY_SUBJECT = 'mainetti_declaration_subject';
  const STORAGE_KEY_TARGET_DATE = 'mainetti_declaration_target_date';
  const STORAGE_KEY_SIG_NAME = 'mainetti_declaration_sig_name';
  const STORAGE_KEY_SIG_TITLE = 'mainetti_declaration_sig_title';
  const STORAGE_KEY_COMPANY = 'mainetti_declaration_company';

  // Editable Letter Fields with Persistence
  const [letterDate, setLetterDate] = useState<string>(() => formatLongDate(new Date()));
  const [recipientTo, setRecipientTo] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_RECIPIENT) || 'Control Union Bangladesh\nDhaka, Bangladesh';
  });
  const [subjectText, setSubjectText] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_SUBJECT) || 'Declaration letter to issue Transaction Certificate, 90 days over orders';
  });
  const [targetImplementationDate, setTargetImplementationDate] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_TARGET_DATE) || "30th December'2026";
  });
  const [signatoryName, setSignatoryName] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_SIG_NAME) || 'Ashraf Uddin Khan';
  });
  const [signatoryDesignation, setSignatoryDesignation] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_SIG_TITLE) || 'Manager, Operations & Development';
  });
  const [companyName, setCompanyName] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_COMPANY) || 'Mainetti Packaging Bangladesh Pvt Ltd';
  });

  // Persistent Signature State
  const [signatureImage, setSignatureImage] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SIGNATURE);
    if (saved && saved.startsWith('data:image')) {
      return saved;
    }
    return '';
  });

  const [isSavedFeedback, setIsSavedFeedback] = useState<boolean>(false);

  useEffect(() => {
    if (!signatureImage) {
      const saved = localStorage.getItem(STORAGE_KEY_SIGNATURE);
      if (saved && saved.startsWith('data:image')) {
        setSignatureImage(saved);
      } else {
        const defaultSig = getSignatureDataUrl();
        setSignatureImage(defaultSig);
      }
    }
  }, [signatureImage]);

  const handleRecipientChange = (val: string) => {
    setRecipientTo(val);
    localStorage.setItem(STORAGE_KEY_RECIPIENT, val);
  };

  const handleSubjectChange = (val: string) => {
    setSubjectText(val);
    localStorage.setItem(STORAGE_KEY_SUBJECT, val);
  };

  const handleTargetDateChange = (val: string) => {
    setTargetImplementationDate(val);
    localStorage.setItem(STORAGE_KEY_TARGET_DATE, val);
  };

  const handleSigNameChange = (val: string) => {
    setSignatoryName(val);
    localStorage.setItem(STORAGE_KEY_SIG_NAME, val);
  };

  const handleSigTitleChange = (val: string) => {
    setSignatoryDesignation(val);
    localStorage.setItem(STORAGE_KEY_SIG_TITLE, val);
  };

  const signatureInputRef = useRef<HTMLInputElement>(null);

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const base64Data = String(ev.target.result);
          setSignatureImage(base64Data);
          try {
            localStorage.setItem(STORAGE_KEY_SIGNATURE, base64Data);
            setIsSavedFeedback(true);
            setTimeout(() => setIsSavedFeedback(false), 3000);
          } catch (storageErr) {
            console.warn('Could not save signature to localStorage:', storageErr);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetSignature = () => {
    localStorage.removeItem(STORAGE_KEY_SIGNATURE);
    const defaultSig = getSignatureDataUrl();
    setSignatureImage(defaultSig);
    if (signatureInputRef.current) signatureInputRef.current.value = '';
    setIsSavedFeedback(true);
    setTimeout(() => setIsSavedFeedback(false), 2000);
  };

  // Search in overdue list
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  const letterContainerRef = useRef<HTMLDivElement>(null);

  // Filter list by search query
  const filteredOverdueList = useMemo(() => {
    if (!searchQuery.trim()) return overduePiList;
    const q = searchQuery.toLowerCase().trim();
    return overduePiList.filter(
      (p) =>
        p.piNumber.toLowerCase().includes(q) ||
        (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(q)) ||
        (p.buyer && p.buyer.toLowerCase().includes(q)) ||
        (p.customer && p.customer.toLowerCase().includes(q))
    );
  }, [overduePiList, searchQuery]);

  const handleToggleSelectAll = () => {
    if (selectedPiIds.length === filteredOverdueList.length) {
      setSelectedPiIds([]);
    } else {
      setSelectedPiIds(filteredOverdueList.map((p) => p.id));
    }
  };

  const handleTogglePi = (id: string) => {
    setSelectedPiIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleCopyPiList = () => {
    const listText = selectedPIs.map((p) => p.piNumber).join('\n');
    navigator.clipboard.writeText(listText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate & Download EXACT PDF matching the attached letter
  const handleDownloadPDF = async () => {
    if (selectedPIs.length === 0) return;

    setIsGeneratingPdf(true);

    try {
      // 1. Create jsPDF document with standard A4 in points
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const leftMargin = 54; // standard 0.75 in margin
      const rightMargin = 54;
      const contentWidth = pageWidth - leftMargin - rightMargin;

      let currentY = 72; // Start from top margin

      // 1. Date
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(20, 20, 20);
      pdf.text(`Date: ${letterDate}`, leftMargin, currentY);
      currentY += 28;

      // 2. To Address
      pdf.setFont('helvetica', 'bold');
      pdf.text('To,', leftMargin, currentY);
      currentY += 16;
      pdf.setFont('helvetica', 'normal');
      const recipientLines = recipientTo.split('\n');
      recipientLines.forEach((line) => {
        if (line.trim()) {
          pdf.text(line.trim(), leftMargin, currentY);
          currentY += 15;
        }
      });
      currentY += 18;

      // 3. Subject (Bold & Underlined)
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      const subjectFull = `Subject: ${subjectText}`;
      pdf.text(subjectFull, leftMargin, currentY);
      
      // Draw underline for subject
      const subjectWidth = pdf.getTextWidth(subjectFull);
      pdf.setLineWidth(0.8);
      pdf.setDrawColor(20, 20, 20);
      pdf.line(leftMargin, currentY + 2, Math.min(leftMargin + subjectWidth, pageWidth - rightMargin), currentY + 2);
      currentY += 26;

      // 4. Salutation
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('Dear Sir/Madam,', leftMargin, currentY);
      currentY += 22;

      // 5. Body Paragraph (Exact wording with dynamic 90/180 days threshold)
      const thresholdDaysNum = dayThreshold === '180' ? 180 : 90;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      const bodyParagraph = `With this letter, we would like to inform you that following PI No orders Transaction certificate is required which is ${thresholdDaysNum} days over. Due to lack of system implementation didn’t apply for the Transaction certificate before ${thresholdDaysNum} days. System implementation work in progress and expecting from ${targetImplementationDate} all the Transaction certificates will be applied before ${thresholdDaysNum} days.`;

      const splitBody = pdf.splitTextToSize(bodyParagraph, contentWidth);
      pdf.text(splitBody, leftMargin, currentY, { lineHeightFactor: 1.35 });
      currentY += splitBody.length * 15 + 18;

      // 6. PI No List Heading
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('PI No List:', leftMargin, currentY);
      currentY += 18;

      // 7. PI Numbers (Clean listing, support multi-column if many)
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10.5);

      const numCols = selectedPIs.length > 20 ? 3 : selectedPIs.length > 10 ? 2 : 1;
      const colW = contentWidth / numCols;

      selectedPIs.forEach((pi, idx) => {
        // Multi-page check
        if (currentY > pageHeight - 160) {
          pdf.addPage();
          currentY = 60;
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          pdf.text('PI No List (Continued):', leftMargin, currentY);
          currentY += 18;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10.5);
        }

        const colIndex = idx % numCols;
        const xPos = leftMargin + colIndex * colW;
        pdf.text(pi.piNumber, xPos, currentY);

        if (colIndex === numCols - 1 || idx === selectedPIs.length - 1) {
          currentY += 15;
        }
      });

      currentY += 28;

      // Check if space for signature, otherwise add page
      if (currentY > pageHeight - 130) {
        pdf.addPage();
        currentY = 70;
      }

      // 8. Signature Graphic (Exact Signature matching uploaded document)
      const sigX = leftMargin;
      const sigY = currentY;

      if (signatureImage) {
        try {
          pdf.addImage(signatureImage, 'PNG', sigX, sigY - 10, 68, 58);
        } catch (imgErr) {
          console.warn('Could not add signature image to PDF, drawing fallback vector:', imgErr);
        }
      }

      currentY += 52;

      // 9. Signatory details
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(20, 20, 20);
      pdf.text(signatoryName, leftMargin, currentY);
      currentY += 15;
      pdf.text(signatoryDesignation, leftMargin, currentY);
      currentY += 38;

      // 10. Company Footer Name
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(companyName, leftMargin, currentY);

      const fileName = `Declaration_Letter_${thresholdDaysNum}_Days_Over_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);
      setIsGeneratingPdf(false);
    } catch (err) {
      console.error('Failed to generate declaration PDF:', err);
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-3 font-sans pb-8">
      {/* 1. Header Banner */}
      <div className="bg-white border border-slate-200 rounded-sm p-3.5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#0b1b3d] text-white rounded-sm flex items-center justify-center shadow-xs">
            <FileCheck2 className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#0b1b3d] uppercase tracking-wide">
                Declaration Letter Generator ({dayThreshold === '180' ? '180+ Days' : '90+ Days'} Overdue Orders)
              </h1>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-xs border ${
                dayThreshold === '180'
                  ? 'bg-red-100 text-red-900 border-red-300'
                  : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}>
                {dayThreshold === '180' ? '180 Days Threshold' : '90 Days Threshold'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Auto-filters orders without Final TC where Invoice Date is {dayThreshold === '180' ? 'over 180 days' : 'between 90 and 180 days'} & generates official declaration letter
            </p>
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyPiList}
            disabled={selectedPIs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-sm shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Copy all selected PI numbers to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copied ? 'Copied PIs!' : 'Copy PI List'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-sm shadow-2xs transition-colors cursor-pointer"
            title="Print Declaration Letter"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isGeneratingPdf || selectedPIs.length === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-sm shadow-xs transition-all cursor-pointer disabled:opacity-50"
            title={`Download official ${dayThreshold === '180' ? '180' : '90'} Days Declaration PDF`}
          >
            {isGeneratingPdf ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Download {dayThreshold === '180' ? '180D' : '90D'} PDF ({selectedPIs.length})</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div
          onClick={() => handleThresholdChange('90')}
          className={`bg-white border rounded-sm p-3 shadow-2xs cursor-pointer transition-all ${
            dayThreshold === '90'
              ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              90 - 180 Days Over
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-slate-900">
              {list90To179Days.length}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">PI Orders</span>
          </div>
        </div>

        <div
          onClick={() => handleThresholdChange('180')}
          className={`bg-white border rounded-sm p-3 shadow-2xs cursor-pointer transition-all ${
            dayThreshold === '180'
              ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-red-700 uppercase tracking-wider flex items-center gap-1">
              <span>180+ Days Critical</span>
            </span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-red-700">
              {list180Days.length}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">PI Orders</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Selected in Letter ({dayThreshold === '180' ? '180D' : '90D'})
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-emerald-700">
              {selectedPIs.length}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">of {overduePiList.length} PIs</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Max Overdue Elapsed
            </span>
            <Clock className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-red-700">
              {overduePiList.length > 0 ? Math.max(...overduePiList.map((p) => p.daysOver)) : 0}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Days</span>
          </div>
        </div>
      </div>

      {/* 3. Main Workspace: Split Grid (Left: Settings & PI Picker | Right: Live Exact Letter Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left Column: Overdue PI List & Customization (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Overdue Orders Picker */}
          <div className="bg-white border border-slate-200 rounded-sm shadow-2xs overflow-hidden flex flex-col">
            {/* Mode Switcher Tabs for 90-180 Days vs 180+ Days */}
            <div className="p-2 border-b border-slate-200 bg-slate-100/90 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleThresholdChange('90')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-xs transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  dayThreshold === '90'
                    ? 'bg-[#0b1b3d] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
                title="Only orders with Invoice Date between 90 and 180 days overdue (180+ days excluded)"
              >
                <Clock className={`w-3.5 h-3.5 ${dayThreshold === '90' ? 'text-amber-300' : 'text-amber-600'}`} />
                <span>90 Days Over (90-180D)</span>
                <span className={`px-1.5 py-0.2 text-[10px] font-mono rounded-xs font-bold ${
                  dayThreshold === '90' ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 text-amber-900'
                }`}>
                  {list90To179Days.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleThresholdChange('180')}
                className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-xs transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  dayThreshold === '180'
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
                title="Only orders with Invoice Date over 180 days overdue"
              >
                <AlertTriangle className={`w-3.5 h-3.5 ${dayThreshold === '180' ? 'text-white' : 'text-red-600'}`} />
                <span>180 Days Over (180D+)</span>
                <span className={`px-1.5 py-0.2 text-[10px] font-mono rounded-xs font-bold ${
                  dayThreshold === '180' ? 'bg-white text-red-900' : 'bg-red-100 text-red-900'
                }`}>
                  {list180Days.length}
                </span>
              </button>
            </div>

            {/* Search and Select Bar */}
            <div className="p-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={
                    filteredOverdueList.length > 0 &&
                    selectedPiIds.length === filteredOverdueList.length
                  }
                  onChange={handleToggleSelectAll}
                  className="w-4 h-4 accent-[#0b1b3d] rounded-xs cursor-pointer"
                  title="Select / Deselect All Overdue PIs"
                />
                <span className="text-xs font-bold text-[#0b1b3d] uppercase tracking-wide">
                  Qualifying PIs ({overduePiList.length})
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search PI/Inv#..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="py-0.5 pl-6 pr-2 text-xs bg-white border border-slate-300 rounded-xs focus:outline-none focus:border-blue-700 w-32"
                />
              </div>
            </div>

            {/* Overdue PIs Table List */}
            <div className="overflow-y-auto max-h-[380px] divide-y divide-slate-100 text-xs">
              {filteredOverdueList.length === 0 ? (
                <div className="py-10 text-center text-slate-400 font-sans space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-70" />
                  <p className="font-semibold text-slate-700">
                    No Orders Over {dayThreshold === '180' ? '180' : '90'} Days Pending TC
                  </p>
                  <p className="text-[11px] text-slate-400">
                    All current active orders have received Final TC or are within {dayThreshold === '180' ? '180' : '90'} days.
                  </p>
                </div>
              ) : (
                filteredOverdueList.map((pi) => {
                  const isChecked = selectedPiIds.includes(pi.id);
                  const is180Plus = pi.daysOver > 180;
                  return (
                    <div
                      key={pi.id}
                      onClick={() => handleTogglePi(pi.id)}
                      className={`p-2.5 flex items-start gap-2.5 cursor-pointer transition-colors hover:bg-slate-50 ${
                        isChecked ? 'bg-blue-50/50' : 'bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="w-3.5 h-3.5 mt-0.5 accent-[#0b1b3d] rounded-xs cursor-pointer shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-bold text-xs text-[#0b1b3d] truncate">
                            {pi.piNumber}
                          </span>
                          <span className={`px-1.5 py-0.2 font-mono text-[10px] font-bold rounded-xs shrink-0 ${
                            is180Plus
                              ? 'bg-red-100 text-red-900 border border-red-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}>
                            {pi.daysOver} Days Over
                          </span>
                        </div>

                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                          <span className="truncate">
                            Invoice Date: <strong className="text-slate-900">{pi.invoiceDate}</strong>
                          </span>
                          <span>
                            Inv#: <strong>{pi.invoiceNumber || 'N/A'}</strong>
                          </span>
                        </div>

                        <div className="mt-0.5 text-[10px] text-slate-400 truncate">
                          Buyer: <span className="text-slate-700">{pi.buyer}</span> | Qty: {pi.orderQuantity?.toLocaleString() || pi.quantityPcs?.toLocaleString()} PCS
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-2 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 font-mono flex items-center justify-between">
              <span>{selectedPIs.length} PIs included in Letter</span>
              <button
                type="button"
                onClick={() => setSelectedPiIds(overduePiList.map((p) => p.id))}
                className="text-blue-700 hover:underline font-semibold cursor-pointer"
              >
                Select All
              </button>
            </div>
          </div>

          {/* Letter Settings & Customization Card */}
          <div className="bg-white border border-slate-200 rounded-sm p-3.5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-blue-800" />
                <h3 className="font-bold text-xs text-[#0b1b3d] uppercase tracking-wide">
                  Letter Details & Signatory
                </h3>
              </div>
              {isSavedFeedback && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-xs border border-emerald-200 flex items-center gap-1 animate-pulse">
                  <Check className="w-3 h-3 text-emerald-600" />
                  Auto-Saved
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">
                  Letter Date
                </label>
                <input
                  type="text"
                  value={letterDate}
                  onChange={(e) => setLetterDate(e.target.value)}
                  className="w-full py-1 px-2 border border-slate-300 rounded-xs font-mono text-xs focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">
                  Recipient To (Certification Body)
                </label>
                <textarea
                  rows={2}
                  value={recipientTo}
                  onChange={(e) => handleRecipientChange(e.target.value)}
                  className="w-full py-1 px-2 border border-slate-300 rounded-xs text-xs focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">
                  Target Resolution Expectation Date
                </label>
                <input
                  type="text"
                  value={targetImplementationDate}
                  onChange={(e) => handleTargetDateChange(e.target.value)}
                  className="w-full py-1 px-2 border border-slate-300 rounded-xs font-mono text-xs focus:outline-none focus:border-blue-600"
                  placeholder="30th December'2026"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">
                    Signatory Name
                  </label>
                  <input
                    type="text"
                    value={signatoryName}
                    onChange={(e) => handleSigNameChange(e.target.value)}
                    className="w-full py-1 px-2 border border-slate-300 rounded-xs text-xs focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-0.5">
                    Signatory Title
                  </label>
                  <input
                    type="text"
                    value={signatoryDesignation}
                    onChange={(e) => handleSigTitleChange(e.target.value)}
                    className="w-full py-1 px-2 border border-slate-300 rounded-xs text-xs focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Signature Upload & Status */}
              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-14 h-11 border border-slate-200 rounded-xs bg-slate-50 flex items-center justify-center p-1 overflow-hidden shadow-2xs">
                    {signatureImage ? (
                      <img src={signatureImage} alt="Signature" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-[9px] text-slate-400">None</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-800 block">
                      Official Signature
                    </span>
                    <span className="text-[9.5px] text-emerald-600 font-medium">
                      ✓ Saved to Storage
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => signatureInputRef.current?.click()}
                    className="px-2.5 py-1 text-[11px] font-bold bg-[#0b1b3d] hover:bg-[#162d59] text-white rounded-xs flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                    title="Upload & Save New Signature Image"
                  >
                    <Upload className="w-3 h-3 text-amber-300" />
                    <span>Change</span>
                  </button>
                  <input
                    ref={signatureInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleSignatureUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={handleResetSignature}
                    className="text-[10px] text-slate-500 hover:text-red-700 hover:underline cursor-pointer px-1"
                    title="Reset to default Ashraf Uddin Khan signature"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Exact Document & Letter Paper Preview (7 Cols) */}
        <div className="lg:col-span-7 space-y-2">
          {/* Paper Control Header */}
          <div className="bg-slate-100 border border-slate-300 px-3 py-2 rounded-t-sm flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-[#0b1b3d]">
                Live Official Letterhead Preview (A4 Formatted)
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              Matches Reference Document 100%
            </span>
          </div>

          {/* Clean White A4 Letter Paper with Exact Typography and Layout */}
          <div
            ref={letterContainerRef}
            className="bg-white border border-slate-300 shadow-xl rounded-b-sm p-8 sm:p-12 text-slate-900 font-sans leading-relaxed space-y-5 text-sm min-h-[620px]"
          >
            {/* 1. Date */}
            <div>
              <span className="text-slate-800 text-[13px]">Date: {letterDate}</span>
            </div>

            {/* 2. To Address */}
            <div className="space-y-0.5 text-[13px] text-slate-800">
              <span className="font-semibold block">To,</span>
              {recipientTo.split('\n').map((line, i) => (
                <span key={i} className="block text-slate-800">
                  {line}
                </span>
              ))}
            </div>

            {/* 3. Subject (Bold & Underlined) */}
            <div className="pt-1">
              <p className="font-bold text-[13px] text-slate-900 underline underline-offset-3">
                Subject: {subjectText}
              </p>
            </div>

            {/* 4. Salutation & Body Paragraph */}
            <div className="space-y-3 text-[13px] text-slate-800 leading-normal">
              <p className="font-semibold text-slate-900">Dear Sir/Madam,</p>
              <p className="text-justify">
                With this letter, we would like to inform you that following PI No orders Transaction
                certificate is required which is {dayThreshold === '180' ? '180' : '90'} days over. Due to lack of system implementation didn’t
                apply for the Transaction certificate before {dayThreshold === '180' ? '180' : '90'} days. System implementation work in progress
                and expecting from {targetImplementationDate} all the Transaction certificates will be applied
                before {dayThreshold === '180' ? '180' : '90'} days.
              </p>
            </div>

            {/* 5. PI No List */}
            <div className="pt-2 space-y-1.5 text-[13px]">
              <span className="font-bold text-slate-900 block underline underline-offset-2">
                PI No List:
              </span>
              <div
                className={`grid gap-1 font-mono text-[13px] font-medium text-slate-900 ${
                  selectedPIs.length > 20
                    ? 'grid-cols-3'
                    : selectedPIs.length > 10
                    ? 'grid-cols-2'
                    : 'grid-cols-1'
                }`}
              >
                {selectedPIs.length === 0 ? (
                  <span className="text-slate-400 italic font-sans text-xs">
                    (No PIs selected yet. Check boxes on the left to include PIs)
                  </span>
                ) : (
                  selectedPIs.map((pi) => (
                    <div key={pi.id} className="py-0.5">
                      {pi.piNumber}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 6. Exact Uploaded Signature Graphic & Signatory Details */}
            <div className="pt-6 space-y-1">
              {signatureImage && (
                <div className="h-16 w-36 select-none flex items-center">
                  <img
                    src={signatureImage}
                    alt="Ashraf Uddin Khan Signature"
                    className="h-full w-auto max-w-full object-contain"
                  />
                </div>
              )}

              <div className="text-[13px] space-y-0.5 pt-0.5">
                <div className="font-normal text-slate-900">{signatoryName}</div>
                <div className="text-slate-700">{signatoryDesignation}</div>
              </div>
            </div>

            {/* 7. Company Name */}
            <div className="pt-5">
              <div className="font-bold text-[13.5px] text-slate-950">
                {companyName}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
