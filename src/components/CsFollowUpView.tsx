import React, { useState, useMemo, useRef } from 'react';
import {
  PIData,
  computeAutomatedTcStatus,
  calculatePiAgeDays,
  getDaysFromDateToToday,
  getDaysBetweenDates,
  isCancelledOrder,
  isCancelledPi,
} from '../types/tc';
import {
  Search,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  Mail,
  Send,
  Calendar,
  Layers,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ExternalLink,
  MessageSquare,
  X,
  Building2,
  Tag,
  ShieldAlert,
  HelpCircle,
  FileText,
} from 'lucide-react';

interface CsFollowUpViewProps {
  data: PIData[];
  filters?: any;
  onFilterChange?: (newFilters: any) => void;
  availableCustomers?: string[];
  availableBuyers?: string[];
  onSelectPI: (pi: PIData) => void;
  selectedPiId?: string;
  onExportCSV?: () => void;
  onSaveToGoogleSheets?: () => void;
  onBatchUpdatePIs?: (ids: string[], updates: Partial<PIData>) => void;
  onUpdatePI?: (updatedPI: PIData) => void;
}

type CsViewFilter = 'all_pending' | 'critical' | 'severe' | 'normal' | 'all_drafts';
type SortField =
  | 'daysWaiting'
  | 'draftTcDate'
  | 'piAgeDays'
  | 'orderDate'
  | 'piNumber'
  | 'tcNumber'
  | 'buyer'
  | 'customer'
  | 'contactPerson'
  | 'orderQuantity';

export const CsFollowUpView: React.FC<CsFollowUpViewProps> = ({
  data,
  availableCustomers = [],
  availableBuyers = [],
  onSelectPI,
  selectedPiId,
  onExportCSV,
  onSaveToGoogleSheets,
  onBatchUpdatePIs,
  onUpdatePI,
}) => {
  // Filters & State
  const [viewFilter, setViewFilter] = useState<CsViewFilter>('all_pending');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [buyerFilter, setBuyerFilter] = useState<string>('ALL');
  const [standardFilter, setStandardFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('daysWaiting');
  const [sortAsc, setSortAsc] = useState<boolean>(false); // Descending: longest waiting first
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals & Drawers
  const [pushMailModalPi, setPushMailModalPi] = useState<PIData | null>(null);
  const [isBatchPushOpen, setIsBatchPushOpen] = useState<boolean>(false);
  const [csEmailRecipient, setCsEmailRecipient] = useState<string>('cs.team@mainetti.com');
  const [csEmailCc, setCsEmailCc] = useState<string>('');

  const [confirmModalPi, setConfirmModalPi] = useState<PIData | null>(null);
  const [confirmDateInput, setConfirmDateInput] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [confirmNotesInput, setConfirmNotesInput] = useState<string>('');

  const [isBatchConfirmOpen, setIsBatchConfirmOpen] = useState<boolean>(false);
  const [batchConfirmDate, setBatchConfirmDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const [noticeModalPi, setNoticeModalPi] = useState<PIData | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Identify all Draft TC records
  // "sudu draft tc hoice but draft confirmation hoi ne"
  const allDraftRecords = useMemo(() => {
    return data.filter((item) => {
      if (isCancelledOrder(item) || isCancelledPi(item.piNumber)) return false;
      const hasDraftTc = Boolean(
        item.draftTcDate && item.draftTcDate.trim() && item.draftTcDate.trim() !== '-'
      );
      return hasDraftTc;
    });
  }, [data]);

  // Subset: Only those pending draft confirmation
  const pendingConfirmationRecords = useMemo(() => {
    return allDraftRecords.filter((item) => {
      const hasDraftConf = Boolean(
        item.draftConfirmationDate &&
          item.draftConfirmationDate.trim() &&
          item.draftConfirmationDate.trim() !== '-'
      );
      return !hasDraftConf;
    });
  }, [allDraftRecords]);

  // KPI Metrics Calculation
  const kpis = useMemo(() => {
    const totalPending = pendingConfirmationRecords.length;
    let criticalCount = 0; // > 7 days
    let severeCount = 0; // > 14 days
    let normalCount = 0; // <= 3 days
    let totalWaitingDays = 0;
    let totalPcs = 0;

    pendingConfirmationRecords.forEach((item) => {
      const days = getDaysFromDateToToday(item.draftTcDate) ?? 0;
      totalWaitingDays += days;
      totalPcs += item.orderQuantity ?? item.quantityPcs ?? 0;

      if (days >= 15) {
        severeCount++;
        criticalCount++;
      } else if (days >= 8) {
        criticalCount++;
      } else {
        normalCount++;
      }
    });

    const avgWaitingDays = totalPending > 0 ? (totalWaitingDays / totalPending).toFixed(1) : '0';

    // Breakdown by Buyer
    const buyerMap: Record<string, { count: number; maxDays: number }> = {};
    pendingConfirmationRecords.forEach((item) => {
      const b = item.buyer || 'Unknown';
      const days = getDaysFromDateToToday(item.draftTcDate) ?? 0;
      if (!buyerMap[b]) buyerMap[b] = { count: 0, maxDays: 0 };
      buyerMap[b].count++;
      if (days > buyerMap[b].maxDays) buyerMap[b].maxDays = days;
    });

    const topBuyers = Object.entries(buyerMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 4)
      .map(([buyer, stats]) => ({ buyer, ...stats }));

    return {
      totalPending,
      criticalCount,
      severeCount,
      normalCount,
      avgWaitingDays,
      totalPcs,
      topBuyers,
      totalConfirmed: allDraftRecords.length - totalPending,
    };
  }, [pendingConfirmationRecords, allDraftRecords]);

  // Unique Buyers in current pending list
  const filterBuyers = useMemo(() => {
    const set = new Set<string>();
    pendingConfirmationRecords.forEach((r) => {
      if (r.buyer) set.add(r.buyer);
    });
    return Array.from(set).sort();
  }, [pendingConfirmationRecords]);

  // 2. Filter & Sort records for the table
  const displayedRecords = useMemo(() => {
    let list: PIData[] = [];

    // Filter by View Mode
    if (viewFilter === 'all_pending') {
      list = [...pendingConfirmationRecords];
    } else if (viewFilter === 'critical') {
      list = pendingConfirmationRecords.filter((item) => {
        const days = getDaysFromDateToToday(item.draftTcDate) ?? 0;
        return days >= 8;
      });
    } else if (viewFilter === 'severe') {
      list = pendingConfirmationRecords.filter((item) => {
        const days = getDaysFromDateToToday(item.draftTcDate) ?? 0;
        return days >= 15;
      });
    } else if (viewFilter === 'normal') {
      list = pendingConfirmationRecords.filter((item) => {
        const days = getDaysFromDateToToday(item.draftTcDate) ?? 0;
        return days <= 3;
      });
    } else if (viewFilter === 'all_drafts') {
      list = [...allDraftRecords];
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((item) => {
        return (
          item.piNumber.toLowerCase().includes(q) ||
          (item.buyer && item.buyer.toLowerCase().includes(q)) ||
          (item.customer && item.customer.toLowerCase().includes(q)) ||
          (item.contactPerson && item.contactPerson.toLowerCase().includes(q)) ||
          (item.invoiceNumber && item.invoiceNumber.toLowerCase().includes(q)) ||
          (item.tcNumber && item.tcNumber.toLowerCase().includes(q)) ||
          (item.poReference && item.poReference.toLowerCase().includes(q)) ||
          (item.standard && item.standard.toLowerCase().includes(q))
        );
      });
    }

    // Filter by Buyer
    if (buyerFilter !== 'ALL') {
      list = list.filter((item) => item.buyer === buyerFilter);
    }

    // Filter by Standard
    if (standardFilter !== 'ALL') {
      list = list.filter((item) => (item.standard || '').toUpperCase().includes(standardFilter));
    }

    // Sorting
    list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (sortField === 'daysWaiting') {
        const isConfA = Boolean(a.draftConfirmationDate && a.draftConfirmationDate.trim());
        const isConfB = Boolean(b.draftConfirmationDate && b.draftConfirmationDate.trim());

        valA = isConfA
          ? getDaysBetweenDates(a.draftTcDate, a.draftConfirmationDate) ?? 0
          : getDaysFromDateToToday(a.draftTcDate) ?? 0;

        valB = isConfB
          ? getDaysBetweenDates(b.draftTcDate, b.draftConfirmationDate) ?? 0
          : getDaysFromDateToToday(b.draftTcDate) ?? 0;
      } else if (sortField === 'draftTcDate') {
        valA = new Date(a.draftTcDate || '1970-01-01').getTime();
        valB = new Date(b.draftTcDate || '1970-01-01').getTime();
      } else if (sortField === 'piAgeDays') {
        valA = calculatePiAgeDays(a.orderDate, a.piAgeDays);
        valB = calculatePiAgeDays(b.orderDate, b.piAgeDays);
      } else if (sortField === 'orderDate') {
        valA = new Date(a.orderDate || '1970-01-01').getTime();
        valB = new Date(b.orderDate || '1970-01-01').getTime();
      } else if (sortField === 'piNumber') {
        valA = a.piNumber;
        valB = b.piNumber;
      } else if (sortField === 'tcNumber') {
        valA = a.tcNumber || '';
        valB = b.tcNumber || '';
      } else if (sortField === 'buyer') {
        valA = a.buyer || '';
        valB = b.buyer || '';
      } else if (sortField === 'customer') {
        valA = a.customer || '';
        valB = b.customer || '';
      } else if (sortField === 'contactPerson') {
        valA = a.contactPerson || '';
        valB = b.contactPerson || '';
      } else if (sortField === 'orderQuantity') {
        valA = a.orderQuantity ?? a.quantityPcs ?? 0;
        valB = b.orderQuantity ?? b.quantityPcs ?? 0;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [
    pendingConfirmationRecords,
    allDraftRecords,
    viewFilter,
    searchQuery,
    buyerFilter,
    standardFilter,
    sortField,
    sortAsc,
  ]);

  // Handle Sort Change
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(
        field === 'piNumber' ||
          field === 'tcNumber' ||
          field === 'buyer' ||
          field === 'customer'
      );
    }
  };

  // Selection Checkbox Handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(displayedRecords.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Single Confirm Draft TC Submit Handler
  const handleConfirmSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmModalPi || !onUpdatePI) return;

    const dateVal = confirmDateInput.trim();
    if (!dateVal) {
      showToast('Please enter a valid confirmation date');
      return;
    }

    const updated: PIData = {
      ...confirmModalPi,
      draftConfirmationDate: dateVal,
      notes: confirmNotesInput.trim()
        ? confirmModalPi.notes
          ? `${confirmModalPi.notes} | CS: ${confirmNotesInput.trim()}`
          : `CS: ${confirmNotesInput.trim()}`
        : confirmModalPi.notes,
      lastUpdatedDate: new Date().toISOString(),
      updatedBy: 'CS Team',
    };

    // Recompute TC status (now will be 'Draft Confirmed')
    updated.tcStatus = computeAutomatedTcStatus(updated);

    onUpdatePI(updated);
    showToast(`PI ${confirmModalPi.piNumber} Draft TC Confirmed successfully!`);
    setConfirmModalPi(null);
  };

  // Batch Confirm Draft TCs Handler
  const handleBatchConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0 || !onBatchUpdatePIs) return;

    onBatchUpdatePIs(selectedIds, {
      draftConfirmationDate: batchConfirmDate.trim(),
      lastUpdatedDate: new Date().toISOString(),
      updatedBy: 'CS Team Batch',
    });

    showToast(`${selectedIds.length} PIs Draft TC Confirmed successfully!`);
    setIsBatchConfirmOpen(false);
    setSelectedIds([]);
  };

  // Export CSV Handler
  const handleExportCsCSV = () => {
    if (displayedRecords.length === 0) return;

    const headers = [
      'Sl',
      'PI Number',
      'Buyer',
      'Customer',
      'Standard',
      'Model / Description',
      'Invoice Number',
      'Invoice Date',
      'Order Qty (Pcs)',
      'Delivery Qty (Pcs)',
      'Delivery Status',
      'Draft TC Date',
      'Days Waiting For Confirmation',
      'Confirmation Status',
      'Order Date',
      'PI Age (Days)',
      'Cert Body',
    ];

    const rows = displayedRecords.map((d, idx) => {
      const isConfirmed = Boolean(d.draftConfirmationDate && d.draftConfirmationDate.trim());
      const days = isConfirmed
        ? getDaysBetweenDates(d.draftTcDate, d.draftConfirmationDate)
        : getDaysFromDateToToday(d.draftTcDate);

      const rawO = d.orderQuantity ?? d.quantityPcs ?? 0;
      const delivQ = d.deliveryQuantity ?? (d.deliveryStatus === 'Delivered' ? rawO : 0);
      const age = calculatePiAgeDays(d.orderDate, d.piAgeDays);

      return [
        idx + 1,
        `"${d.piNumber}"`,
        `"${d.buyer}"`,
        `"${d.customer}"`,
        `"${d.standard}"`,
        `"${d.model || d.productDescription || ''}"`,
        `"${d.invoiceNumber || ''}"`,
        `"${d.invoiceDate || ''}"`,
        rawO,
        delivQ,
        `"${d.deliveryStatus}"`,
        `"${d.draftTcDate || ''}"`,
        days !== null ? days : '-',
        isConfirmed ? `Confirmed (${d.draftConfirmationDate})` : 'Awaiting Confirmation',
        `"${d.orderDate}"`,
        age,
        `"${d.certBody}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Mainetti_CS_Draft_FollowUp_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate Push Email to CS Team (Draft confirmation not received)
  const formatDateLong = (dateStr?: string) => {
    if (!dateStr || !dateStr.trim() || dateStr.trim() === '-') return '-';
    const cleanStr = dateStr.trim();
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];
      if (monthIdx >= 0 && monthIdx < 12 && !isNaN(day)) {
        return `${day} ${months[monthIdx]} ${year}`;
      }
    }
    return cleanStr;
  };

  const generatePushEmailSubject = (item: PIData) => {
    const tcNoStr = item.tcNumber && item.tcNumber.trim() ? ` [TC: ${item.tcNumber}]` : '';
    return `[URGENT] Draft TC Confirmation Pending - PI: ${item.piNumber}${tcNoStr}`;
  };

  const generatePushEmailBody = (item: PIData) => {
    const days = getDaysFromDateToToday(item.draftTcDate) ?? 0;
    const rawAttn = item.contactPerson && item.contactPerson.trim() ? item.contactPerson.trim() : '';
    let greeting = 'Dear CS Team,';
    if (rawAttn) {
      const lower = rawAttn.toLowerCase();
      if (lower.startsWith('mr.') || lower.startsWith('ms.') || lower.startsWith('mrs.') || lower.startsWith('dr.')) {
        greeting = `Dear ${rawAttn},`;
      } else {
        greeting = `Dear Mr. ${rawAttn},`;
      }
    }

    const tcNoStr = item.tcNumber && item.tcNumber.trim() ? item.tcNumber : '';
    const draftDateStr = formatDateLong(item.draftTcDate);

    return (
      `${greeting}\n\n` +
      `Buyer approval for the draft TC is pending for the following order:\n` +
      `•\tPI: ${item.piNumber}\n` +
      `•\tBuyer: ${item.buyer || '-'}\n` +
      `•\tCustomer: ${item.customer || '-'}\n` +
      `•\tTC Number: ${tcNoStr}\n` +
      `•\tDraft Date: ${draftDateStr}\n` +
      `•\tPending Duration: ${days} Days\n\n` +
      `Please coordinate with the buyer and obtain the draft TC approval urgently so that we can proceed with the final TC submission.`
    );
  };

  const generateMailtoUrl = (item: PIData, to = csEmailRecipient, cc = csEmailCc) => {
    const subject = generatePushEmailSubject(item);
    const body = generatePushEmailBody(item);
    let url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (cc && cc.trim()) {
      url += `&cc=${encodeURIComponent(cc.trim())}`;
    }
    return url;
  };

  const handleCopyNotice = (item: PIData) => {
    const text = generatePushEmailBody(item);
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    showToast(`Push CS email for PI ${item.piNumber} copied to clipboard!`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Batch Push Email Generator
  const generateBatchPushEmailSubject = (items: PIData[]) => {
    return `[URGENT] Draft TC Confirmation Pending - ${items.length} Orders`;
  };

  const generateBatchPushEmailBody = (items: PIData[]) => {
    const lines = items.map((item, idx) => {
      const days = getDaysFromDateToToday(item.draftTcDate) ?? 0;
      const attn = item.contactPerson && item.contactPerson.trim() ? item.contactPerson.trim() : '-';
      const tcStr = item.tcNumber && item.tcNumber.trim() ? item.tcNumber : '-';
      const draftDateStr = formatDateLong(item.draftTcDate);
      return (
        `${idx + 1}. PI: ${item.piNumber} | TC: ${tcStr}\n` +
        `   • Buyer: ${item.buyer || '-'} | Customer: ${item.customer || '-'}\n` +
        `   • Attn: ${attn} | Draft Date: ${draftDateStr} | Pending: ${days} Days`
      );
    });

    return (
      `Dear CS Team,\n\n` +
      `Buyer approval for draft TCs is pending for the following ${items.length} orders:\n\n` +
      lines.join('\n\n') +
      `\n\nPlease coordinate with the respective buyers and obtain draft TC approvals urgently so that we can proceed with final TC submissions.`
    );
  };

  const generateBatchMailtoUrl = (items: PIData[], to = csEmailRecipient, cc = csEmailCc) => {
    const subject = generateBatchPushEmailSubject(items);
    const body = generateBatchPushEmailBody(items);
    let url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (cc && cc.trim()) {
      url += `&cc=${encodeURIComponent(cc.trim())}`;
    }
    return url;
  };

  return (
    <div className="space-y-2.5 w-full min-w-0 font-sans">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#061024] text-white px-4 py-2.5 rounded-lg shadow-xl border border-blue-500/40 flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 shadow-2xs">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  CS Team Follow-up: Draft TC Confirmation
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  {kpis.totalPending} Awaiting Confirmation
                </span>
                {kpis.criticalCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                    {kpis.criticalCount} Critical &gt;7d
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                যে সকল অর্ডারের <strong>Draft TC ইস্যু হয়েছে কিন্তু Draft Confirmation এখনো পাওয়া যায়নি</strong> — CS টিমকে মেইলে তাগাদা ও পুশ করার ডেডিকেটেড ফলো-আপ ড্যাশবোর্ড।
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {onSaveToGoogleSheets && (
              <button
                type="button"
                onClick={onSaveToGoogleSheets}
                className="px-2.5 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                title="Sync records to Google Sheet"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Save in Google Sheet</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCsCSV}
              className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Export CS Follow-up list to Excel / CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        {/* Card 1: Total Pending */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Pending Confirmation
            </span>
            <div className="p-1 rounded bg-amber-50 text-amber-600 border border-amber-200">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {kpis.totalPending}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              Orders ({kpis.totalPcs.toLocaleString()} Pcs)
            </span>
          </div>
          <div className="mt-1.5 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Total Draft Issued: {allDraftRecords.length}</span>
            <span className="text-emerald-700 font-semibold">{kpis.totalConfirmed} Confirmed</span>
          </div>
        </div>

        {/* Card 2: Critical Overdue (>7 Days) */}
        <div
          onClick={() => setViewFilter(viewFilter === 'critical' ? 'all_pending' : 'critical')}
          className={`bg-white p-3 rounded-lg border shadow-2xs flex flex-col justify-between cursor-pointer transition-all hover:border-rose-400 ${
            viewFilter === 'critical' ? 'ring-2 ring-rose-500 border-rose-300 bg-rose-50/20' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
              Critical &gt;7 Days
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
            </span>
            <div className="p-1 rounded bg-rose-50 text-rose-600 border border-rose-200">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-rose-700 font-mono">
              {kpis.criticalCount}
            </span>
            <span className="text-[11px] font-semibold text-rose-600">
              {kpis.totalPending > 0
                ? `${Math.round((kpis.criticalCount / kpis.totalPending) * 100)}% of pending`
                : '0%'}
            </span>
          </div>
          <div className="mt-1.5 text-[10px] text-rose-600 font-medium">
            Immediate Follow-up Required
          </div>
        </div>

        {/* Card 3: Severe Overdue (>14 Days) */}
        <div
          onClick={() => setViewFilter(viewFilter === 'severe' ? 'all_pending' : 'severe')}
          className={`bg-white p-3 rounded-lg border shadow-2xs flex flex-col justify-between cursor-pointer transition-all hover:border-red-400 ${
            viewFilter === 'severe' ? 'ring-2 ring-red-500 border-red-300 bg-red-50/20' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-800">
              Severe Delay &gt;14d
            </span>
            <div className="p-1 rounded bg-red-100 text-red-700 border border-red-200">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-red-800 font-mono">
              {kpis.severeCount}
            </span>
            <span className="text-[11px] font-semibold text-red-700">Orders Escalated</span>
          </div>
          <div className="mt-1.5 text-[10px] text-red-700 font-medium">
            Risk of Certificate Expiry
          </div>
        </div>

        {/* Card 4: Average Waiting Days & Top Buyers */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Avg Waiting Time
            </span>
            <div className="p-1 rounded bg-blue-50 text-blue-600 border border-blue-200">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-blue-900 font-mono">
              {kpis.avgWaitingDays}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">Days Elapsed</span>
          </div>
          <div className="mt-1.5 text-[10px] text-slate-600 truncate">
            Top: {kpis.topBuyers.map((b) => `${b.buyer} (${b.count})`).join(', ') || 'N/A'}
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        {/* Table Toolbar & Filters */}
        <div className="p-2 sm:p-2.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {/* View Filter Segmented Pills */}
            <div className="inline-flex rounded-md shadow-2xs bg-slate-200/80 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewFilter('all_pending')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  viewFilter === 'all_pending'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Pending ({kpis.totalPending})
              </button>
              <button
                type="button"
                onClick={() => setViewFilter('critical')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                  viewFilter === 'critical'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-700 hover:text-rose-900'
                }`}
              >
                <span>&gt;7d Critical</span>
                <span className="px-1 py-0.2 rounded-full text-[9px] bg-rose-200/50 text-current">
                  {kpis.criticalCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setViewFilter('severe')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${
                  viewFilter === 'severe'
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'text-red-700 hover:text-red-900'
                }`}
              >
                <span>&gt;14d Severe</span>
                <span className="px-1 py-0.2 rounded-full text-[9px] bg-red-200/50 text-current">
                  {kpis.severeCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setViewFilter('normal')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  viewFilter === 'normal'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                ≤3d Recent ({kpis.normalCount})
              </button>
              <button
                type="button"
                onClick={() => setViewFilter('all_drafts')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  viewFilter === 'all_drafts'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Drafts ({allDraftRecords.length})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-56">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PI, Buyer, Inv..."
                className="w-full text-xs pl-8 pr-2.5 py-1.5 bg-white rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
              />
            </div>

            {/* Filter by Buyer */}
            <select
              value={buyerFilter}
              onChange={(e) => setBuyerFilter(e.target.value)}
              className="text-xs py-1.5 px-2 bg-white rounded-md border border-slate-300 text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none font-sans"
            >
              <option value="ALL">All Buyers ({filterBuyers.length})</option>
              {filterBuyers.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            {/* Filter by Standard */}
            <select
              value={standardFilter}
              onChange={(e) => setStandardFilter(e.target.value)}
              className="text-xs py-1.5 px-2 bg-white rounded-md border border-slate-300 text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none font-sans"
            >
              <option value="ALL">All Standards</option>
              <option value="GRS">GRS Standard</option>
              <option value="RCS">RCS Standard</option>
              <option value="FSC">FSC Standard</option>
            </select>
          </div>

          {/* Right: Record count & Batch Actions */}
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsBatchPushOpen(true)}
                  className="px-2.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Generate combined push email to CS team for selected orders"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Push CS Selected ({selectedIds.length})</span>
                </button>

                {onBatchUpdatePIs && (
                  <button
                    type="button"
                    onClick={() => setIsBatchConfirmOpen(true)}
                    className="px-2 py-1 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                    title="Record confirmation if already received"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Confirm</span>
                  </button>
                )}
              </div>
            )}

            <div className="text-[11px] text-slate-500 font-medium">
              Showing <strong className="text-slate-800">{displayedRecords.length}</strong> items
            </div>
          </div>
        </div>

        {/* Table View */}
        <div ref={tableContainerRef} className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 whitespace-nowrap text-[11px]">
                <th className="py-2 px-2.5 text-center w-8">
                  <input
                    type="checkbox"
                    checked={
                      displayedRecords.length > 0 &&
                      selectedIds.length === displayedRecords.length
                    }
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-2 px-2 text-center w-8">#</th>
                <th
                  className="py-2 px-2.5 cursor-pointer hover:bg-slate-200 transition-colors"
                  onClick={() => handleSort('piNumber')}
                >
                  <div className="flex items-center gap-1">
                    <span>PI Number</span>
                    {sortField === 'piNumber' && (
                      sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th
                  className="py-2 px-2.5 cursor-pointer hover:bg-slate-200 transition-colors"
                  onClick={() => handleSort('tcNumber')}
                >
                  <div className="flex items-center gap-1">
                    <span>TC Number</span>
                    {sortField === 'tcNumber' && (
                      sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th
                  className="py-2 px-2.5 cursor-pointer hover:bg-slate-200 transition-colors"
                  onClick={() => handleSort('buyer')}
                >
                  <div className="flex items-center gap-1">
                    <span>Buyer</span>
                    {sortField === 'buyer' && (
                      sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th
                  className="py-2 px-2.5 cursor-pointer hover:bg-slate-200 transition-colors"
                  onClick={() => handleSort('customer')}
                >
                  <div className="flex items-center gap-1">
                    <span>Customer</span>
                    {sortField === 'customer' && (
                      sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th
                  className="py-2 px-2.5 cursor-pointer hover:bg-slate-200 transition-colors"
                  onClick={() => handleSort('contactPerson')}
                >
                  <div className="flex items-center gap-1">
                    <span>Contact Person</span>
                    {sortField === 'contactPerson' && (
                      sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    )}
                  </div>
                </th>

                <th
                  className="py-2 px-2.5 text-right cursor-pointer hover:bg-slate-200 transition-colors"
                  onClick={() => handleSort('orderQuantity')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Order Qty</span>
                    {sortField === 'orderQuantity' && (
                      sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th
                  className="py-2 px-2.5 cursor-pointer hover:bg-slate-200 transition-colors"
                  onClick={() => handleSort('draftTcDate')}
                >
                  <div className="flex items-center gap-1">
                    <span>Draft TC Date</span>
                    {sortField === 'draftTcDate' && (
                      sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    )}
                  </div>
                </th>

                {/* THE CORE REQUESTED COLUMN: Waiting Days for Draft TC Confirmation */}
                <th
                  className="py-2 px-3 text-center bg-amber-100/70 text-amber-950 font-bold border-x border-amber-300 cursor-pointer hover:bg-amber-200/80 transition-colors"
                  onClick={() => handleSort('daysWaiting')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Waiting for Draft Confirmation</span>
                    {sortField === 'daysWaiting' ? (
                      sortAsc ? <ArrowUp className="w-3.5 h-3.5 text-amber-900" /> : <ArrowDown className="w-3.5 h-3.5 text-amber-900" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-amber-700/60" />
                    )}
                  </div>
                </th>

                <th
                  className="py-2 px-2.5 text-center cursor-pointer hover:bg-slate-200 transition-colors"
                  onClick={() => handleSort('piAgeDays')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>PI Age</span>
                    {sortField === 'piAgeDays' && (
                      sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th className="py-2 px-2.5 text-center">Status</th>
                <th className="py-2 px-2.5 text-center w-36">Push CS / Follow-up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {displayedRecords.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="p-3 bg-slate-100 rounded-full text-slate-400">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      </div>
                      <span className="font-semibold text-slate-700 text-sm">
                        No Draft TC Pending Confirmation!
                      </span>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Great job! There are currently no draft certificates awaiting buyer or merchant confirmation under the selected filter.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedRecords.map((item, idx) => {
                  const isSelected = selectedIds.includes(item.id);
                  const isConfirmed = Boolean(
                    item.draftConfirmationDate &&
                      item.draftConfirmationDate.trim() &&
                      item.draftConfirmationDate.trim() !== '-'
                  );
                  const daysWaiting = isConfirmed
                    ? getDaysBetweenDates(item.draftTcDate, item.draftConfirmationDate) ?? 0
                    : getDaysFromDateToToday(item.draftTcDate) ?? 0;

                  const rawO = item.orderQuantity ?? item.quantityPcs ?? 0;
                  const age = calculatePiAgeDays(item.orderDate, item.piAgeDays);

                  // Color tiering for Waiting Days
                  let badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-300';
                  let urgencyLabel = 'Within SLA';
                  let dotColor = 'bg-emerald-500';

                  if (isConfirmed) {
                    badgeBg = 'bg-slate-100 text-slate-700 border-slate-300';
                    urgencyLabel = 'Confirmed';
                    dotColor = 'bg-slate-400';
                  } else if (daysWaiting >= 15) {
                    badgeBg = 'bg-red-100 text-red-900 border-red-300 font-black';
                    urgencyLabel = 'Severe Delay (>14d)';
                    dotColor = 'bg-red-600 animate-ping';
                  } else if (daysWaiting >= 8) {
                    badgeBg = 'bg-rose-50 text-rose-800 border-rose-300 font-bold';
                    urgencyLabel = 'Critical (>7d)';
                    dotColor = 'bg-rose-500';
                  } else if (daysWaiting >= 4) {
                    badgeBg = 'bg-amber-50 text-amber-800 border-amber-300 font-semibold';
                    urgencyLabel = 'Attention';
                    dotColor = 'bg-amber-500';
                  }

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition-colors border-b border-slate-100 font-sans text-xs ${
                        isSelected ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2 px-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(item.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* # Index */}
                      <td className="py-2 px-2 text-center text-slate-400 text-[11px] font-mono">
                        {idx + 1}
                      </td>

                      {/* PI Number */}
                      <td className="py-2 px-2.5">
                        <button
                          type="button"
                          onClick={() => onSelectPI(item)}
                          className="font-bold text-blue-700 hover:text-blue-900 font-mono hover:underline text-left cursor-pointer flex items-center gap-1"
                        >
                          <span>{item.piNumber}</span>
                        </button>
                      </td>

                      {/* TC Number */}
                      <td className="py-2 px-2.5 font-mono text-slate-700">
                        {item.tcNumber && item.tcNumber.trim() ? (
                          <span className="font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                            {item.tcNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Draft TC</span>
                        )}
                      </td>

                      {/* Buyer */}
                      <td className="py-2 px-2.5">
                        <span className="font-bold text-slate-900 text-xs">
                          {item.buyer || 'Unknown'}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="py-2 px-2.5">
                        <span className="text-xs text-slate-700 font-medium">
                          {item.customer || '-'}
                        </span>
                      </td>

                      {/* Contact Person */}
                      <td className="py-2 px-2.5">
                        <span className="text-xs text-indigo-950 font-semibold bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-100/80">
                          {item.contactPerson || '-'}
                        </span>
                      </td>

                      {/* Order Qty */}
                      <td className="py-2 px-2.5 text-right font-mono text-slate-900 font-medium">
                        {rawO > 0 ? rawO.toLocaleString() : '-'}
                      </td>

                      {/* Draft TC Date */}
                      <td className="py-2 px-2.5 font-mono text-slate-700">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{item.draftTcDate || '-'}</span>
                        </div>
                      </td>

                      {/* THE CORE COLUMN: Waiting for Draft Confirmation */}
                      <td className="py-2 px-3 bg-amber-50/40 border-x border-amber-200 text-center">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs shadow-2xs ${badgeBg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                            <span className="font-mono font-black">
                              {daysWaiting} {daysWaiting === 1 ? 'Day' : 'Days'}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-500 font-sans">
                            {urgencyLabel}
                          </span>
                        </div>
                      </td>

                      {/* PI Age */}
                      <td className="py-2 px-2.5 text-center font-mono text-slate-600 text-[11px]">
                        {age}d
                      </td>

                      {/* Status */}
                      <td className="py-2 px-2.5 text-center">
                        {isConfirmed ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600" />
                            Confirmed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100/70 text-amber-900 border border-amber-300">
                            <Clock className="w-3 h-3 text-amber-700" />
                            Awaiting Conf.
                          </span>
                        )}
                      </td>

                      {/* CS Actions */}
                      <td className="py-2 px-2.5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {/* 1. Primary Action: Push CS via Mail */}
                          <button
                            type="button"
                            onClick={() => setPushMailModalPi(item)}
                            className="px-2 py-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                            title="Push CS Team via Mail (Draft Confirmation Not Received)"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>Push CS</span>
                          </button>

                          {/* 2. Direct Mail Launch link */}
                          <a
                            href={generateMailtoUrl(item)}
                            className="p-1 rounded bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-300 transition-colors"
                            title="Direct launch in default Email App (Outlook / Gmail)"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </a>

                          {/* 3. Copy Push Email Text */}
                          <button
                            type="button"
                            onClick={() => handleCopyNotice(item)}
                            className={`p-1 rounded border transition-colors cursor-pointer ${
                              copiedId === item.id
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300'
                            }`}
                            title="Copy ready-to-send Push Email text for CS Team"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* 4. Secondary: Record Confirmation (when approval received from CS/Buyer) */}
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmModalPi(item);
                              setConfirmDateInput(
                                item.draftConfirmationDate || new Date().toISOString().slice(0, 10)
                              );
                              setConfirmNotesInput('');
                            }}
                            className="p-1 rounded bg-white hover:bg-emerald-50 text-slate-400 hover:text-emerald-700 border border-slate-200 transition-colors cursor-pointer"
                            title={
                              isConfirmed
                                ? 'Edit draft confirmation date'
                                : 'Record confirmation date (when received from CS / Buyer)'
                            }
                          >
                            <CheckCircle2
                              className={`w-3.5 h-3.5 ${
                                isConfirmed ? 'text-emerald-600' : 'text-slate-400'
                              }`}
                            />
                          </button>

                          {/* 5. View Full Detail Drawer */}
                          <button
                            type="button"
                            onClick={() => onSelectPI(item)}
                            className="p-1 rounded bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 transition-colors cursor-pointer"
                            title="Open full PI detail"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Modal 1: Single Confirm Draft TC Modal                                    */}
      {/* ========================================================================= */}
      {confirmModalPi && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Confirm Draft TC (Buyer Approval)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModalPi(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSingle} className="p-5 space-y-4">
              {/* Order Info Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1.5 font-sans">
                <div className="flex justify-between">
                  <span className="text-slate-500">PI Number:</span>
                  <strong className="font-mono text-slate-900">{confirmModalPi.piNumber}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Buyer:</span>
                  <strong className="text-slate-900">{confirmModalPi.buyer}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Draft TC Date:</span>
                  <strong className="font-mono text-slate-900">{confirmModalPi.draftTcDate}</strong>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Waiting Time:</span>
                  <span className="font-mono font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                    {getDaysFromDateToToday(confirmModalPi.draftTcDate)} Days
                  </span>
                </div>
              </div>

              {/* Draft Confirmation Date Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Draft Confirmation Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={confirmDateInput}
                    onChange={(e) => setConfirmDateInput(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Confirmation date save korle order-ti automatically <strong>Draft Confirmed</strong> stage-e jabe ebong Next Step: <em>Final TC Application</em> hobe।
                </p>
              </div>

              {/* Optional CS Remark */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  CS Remark / Merchant Approval Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Approved via email from buyer merchant Mr. Rahim"
                  value={confirmNotesInput}
                  onChange={(e) => setConfirmNotesInput(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setConfirmModalPi(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Confirmation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal 2: Batch Confirm Draft TCs Modal                                    */}
      {/* ========================================================================= */}
      {isBatchConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Batch Confirm Draft TCs ({selectedIds.length} Orders)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchConfirmOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBatchConfirmSubmit} className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                You have selected <strong>{selectedIds.length}</strong> orders. Enter the confirmation date to update all selected draft certificates simultaneously:
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Draft Confirmation Date for All Selected <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={batchConfirmDate}
                  onChange={(e) => setBatchConfirmDate(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsBatchConfirmOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm All {selectedIds.length} Orders</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal 3: Push CS Email Modal (Draft Confirmation Pending)                 */}
      {/* ========================================================================= */}
      {pushMailModalPi && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-indigo-50/70">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-xs">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Push CS Team — Draft Confirmation Reminder
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Draft TC issue kora hoyeche, kintu confirmation paoa jayni
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPushMailModalPi(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs font-sans">
              {/* Order Quick Summary Card */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 space-y-1.5 text-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">PI Number:</span>
                  <span className="font-mono font-bold text-blue-700 text-sm">
                    {pushMailModalPi.piNumber}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">TC Number:</span>
                  <span className="font-mono font-bold text-slate-800 text-xs">
                    {pushMailModalPi.tcNumber || 'Draft TC Issued'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Attention Person:</span>
                  <span className="font-bold text-indigo-900 text-xs bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                    {pushMailModalPi.contactPerson || 'Concerned CS / Merchant'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Buyer:</span>
                  <span className="font-semibold text-slate-900">
                    {pushMailModalPi.buyer || 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Customer:</span>
                  <span className="text-slate-800">
                    {pushMailModalPi.customer || '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Draft TC Issue Date:</span>
                  <span className="font-mono text-slate-800">
                    {pushMailModalPi.draftTcDate || '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-amber-200">
                  <span className="text-amber-900 font-bold">Waiting for Confirmation:</span>
                  <span className="font-mono font-black text-rose-700 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded text-xs">
                    {getDaysFromDateToToday(pushMailModalPi.draftTcDate)} Days Awaiting Conf.
                  </span>
                </div>
              </div>

              {/* Recipient & CC Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    To (CS Team Email):
                  </label>
                  <input
                    type="email"
                    value={csEmailRecipient}
                    onChange={(e) => setCsEmailRecipient(e.target.value)}
                    placeholder="cs.team@mainetti.com"
                    className="w-full text-xs py-1.5 px-2.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Cc (Optional):
                  </label>
                  <input
                    type="text"
                    value={csEmailCc}
                    onChange={(e) => setCsEmailCc(e.target.value)}
                    placeholder="head.cs@mainetti.com"
                    className="w-full text-xs py-1.5 px-2.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Email Subject:
                </label>
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-md font-mono text-[11px] text-slate-800 select-all">
                  {generatePushEmailSubject(pushMailModalPi)}
                </div>
              </div>

              {/* Body Preview */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Email Message Body:
                </label>
                <textarea
                  readOnly
                  rows={8}
                  value={generatePushEmailBody(pushMailModalPi)}
                  className="w-full text-xs p-2.5 rounded-md border border-slate-300 bg-slate-50/50 font-sans focus:outline-none text-slate-800 leading-relaxed resize-none"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleCopyNotice(pushMailModalPi)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {copiedId === pushMailModalPi.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                    <span>Copy Email Text</span>
                  </>
                )}
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setPushMailModalPi(null)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <a
                  href={generateMailtoUrl(pushMailModalPi)}
                  onClick={() => {
                    showToast(`Opening Email Client for PI ${pushMailModalPi.piNumber}...`);
                    setTimeout(() => setPushMailModalPi(null), 800);
                  }}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Open in Mail Client (Outlook/Gmail)</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal 4: Batch Push CS Email Modal                                        */}
      {/* ========================================================================= */}
      {isBatchPushOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-indigo-50/70">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-xs">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Batch Push CS Team ({selectedIds.length} Orders)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Selected orders-er compiled follow-up list CS team-ke mail pathan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchPushOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs font-sans">
              {/* Recipient inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    To (CS Team Email):
                  </label>
                  <input
                    type="email"
                    value={csEmailRecipient}
                    onChange={(e) => setCsEmailRecipient(e.target.value)}
                    placeholder="cs.team@mainetti.com"
                    className="w-full text-xs py-1.5 px-2.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Cc (Optional):
                  </label>
                  <input
                    type="text"
                    value={csEmailCc}
                    onChange={(e) => setCsEmailCc(e.target.value)}
                    placeholder="head.cs@mainetti.com"
                    className="w-full text-xs py-1.5 px-2.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Message preview */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Compiled Follow-up Email to CS:
                </label>
                <textarea
                  readOnly
                  rows={9}
                  value={generateBatchPushEmailBody(
                    displayedRecords.filter((d) => selectedIds.includes(d.id))
                  )}
                  className="w-full text-xs p-2.5 rounded-md border border-slate-300 bg-slate-50/50 font-sans focus:outline-none text-slate-800 leading-relaxed resize-none font-mono"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  const text = generateBatchPushEmailBody(
                    displayedRecords.filter((d) => selectedIds.includes(d.id))
                  );
                  navigator.clipboard.writeText(text);
                  showToast(`Batch Push email for ${selectedIds.length} orders copied to clipboard!`);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5 text-slate-600" />
                <span>Copy Batch Email Text</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsBatchPushOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <a
                  href={generateBatchMailtoUrl(
                    displayedRecords.filter((d) => selectedIds.includes(d.id))
                  )}
                  onClick={() => {
                    showToast(`Opening Email Client with ${selectedIds.length} orders...`);
                    setTimeout(() => setIsBatchPushOpen(false), 800);
                  }}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Open in Mail Client</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
