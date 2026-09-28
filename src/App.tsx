import React, { useState, useMemo, useEffect } from 'react';
import { PIData, FilterState, TCStatus, UploadedFileInfo, computeAutomatedTcStatus } from './types/tc';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { KpiCardGrid } from './components/KpiCardGrid';
import { StatusOverviewChart } from './components/StatusOverviewChart';
import { MonthlyCostTrendChart } from './components/MonthlyCostTrendChart';
import { OrderDeliverySnapshot } from './components/OrderDeliverySnapshot';
import { PendingAttentionTable } from './components/PendingAttentionTable';
import { PiDetailDrawer } from './components/PiDetailDrawer';
import { TcSummaryPageView } from './components/TcSummaryPageView';
import { ExcelUploadView } from './components/ExcelUploadView';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import {
  loadFromPersistentStorage,
  saveToPersistentStorage,
  clearPersistentStorage,
} from './utils/excelParser';
import { initAuth } from './utils/googleAuth';
import {
  getSavedLinkedSheet,
  syncLinkedSheetFromFirestore,
  syncDataToExistingSpreadsheet,
  importDataFromGoogleSpreadsheet,
  LinkedSheetConfig,
} from './utils/googleSheetsService';
import { fetchPIDataFromFirestore } from './utils/firestoreStorage';
import { User } from 'firebase/auth';
import { UploadCloud, FileSpreadsheet, PlusCircle } from 'lucide-react';

export default function App() {
  // Initialize state with persistent storage if available
  const [piList, setPiList] = useState<PIData[]>(() => {
    const saved = loadFromPersistentStorage();
    if (saved.data && saved.data.length > 0) {
      return saved.data.map((item) => ({
        ...item,
        invoiceNumber: item.invoiceNumber || '',
        contactPerson: item.contactPerson || 'System',
        tcStatus: computeAutomatedTcStatus(item),
      }));
    }
    return [];
  });

  const [activeFileInfo, setActiveFileInfo] = useState<UploadedFileInfo | null>(() => {
    const saved = loadFromPersistentStorage();
    return saved.fileInfo;
  });

  const [selectedPi, setSelectedPi] = useState<PIData | null>(null);
  const [activeTab, setActiveTab] = useState<string>(() => {
    const saved = loadFromPersistentStorage();
    return saved.data && saved.data.length > 0 ? 'Dashboard' : 'Excel Upload';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('mainetti_sidebar_collapsed') === 'true';
  });

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsMobileSidebarOpen((prev) => !prev);
    } else {
      setIsSidebarCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem('mainetti_sidebar_collapsed', String(next));
        return next;
      });
    }
  };

  // Google Auth & Sheets State
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState<boolean>(false);
  const [linkedSheet, setLinkedSheet] = useState<LinkedSheetConfig | null>(getSavedLinkedSheet());
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastAutoSyncTime, setLastAutoSyncTime] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Initial cloud synchronization from Firestore to ensure every browser gets master sheet & dataset
  useEffect(() => {
    async function initCloudSync() {
      // 1. Fetch linked Google Sheet configuration from Firestore
      const cloudSheet = await syncLinkedSheetFromFirestore();
      if (cloudSheet) {
        setLinkedSheet(cloudSheet);
      }

      // 2. Fetch master PI dataset from Firestore if available
      const cloudPiList = await fetchPIDataFromFirestore();
      if (cloudPiList && cloudPiList.length > 0) {
        const cleaned = cloudPiList.map((item) => ({
          ...item,
          invoiceNumber: item.invoiceNumber || '',
          contactPerson: item.contactPerson || 'System',
          tcStatus: computeAutomatedTcStatus(item),
        }));
        setPiList(cleaned);
        const currentSaved = loadFromPersistentStorage();
        saveToPersistentStorage(cleaned, currentSaved.fileInfo);
      }
    }

    initCloudSync();
  }, []);

  // Real-time synchronization listener: Update UI automatically whenever persistent storage updates
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = loadFromPersistentStorage();
      if (saved.data) {
        setPiList(
          saved.data.map((item) => ({
            ...item,
            invoiceNumber: item.invoiceNumber || '',
            contactPerson: item.contactPerson || 'System',
            tcStatus: computeAutomatedTcStatus(item),
          }))
        );
        setActiveFileInfo(saved.fileInfo);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('pi_data_updated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('pi_data_updated', handleStorageChange);
    };
  }, []);

  // Background Auto-sync helper (Runs automatically without button click)
  const triggerAutoSyncIfEnabled = async (dataToSync: PIData[]) => {
    const sheet = getSavedLinkedSheet();
    setLinkedSheet(sheet);
    if (sheet && sheet.autoSync !== false && googleAccessToken && dataToSync.length > 0) {
      try {
        setSyncStatus('syncing');
        await syncDataToExistingSpreadsheet(googleAccessToken, sheet.spreadsheetId, dataToSync);
        const updated = getSavedLinkedSheet();
        setLinkedSheet(updated);
        setSyncStatus('synced');
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastAutoSyncTime(timeStr);
      } catch (err) {
        console.warn('Background auto-sync silently skipped/failed:', err);
        setSyncStatus('error');
      }
    }
  };

  // Automatic sync trigger when Google token arrives or data changes
  useEffect(() => {
    if (googleAccessToken && linkedSheet && piList.length > 0) {
      const timer = setTimeout(() => {
        triggerAutoSyncIfEnabled(piList);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [googleAccessToken, piList.length, linkedSheet?.spreadsheetId]);

  // Filters State
  const [filters, setFilters] = useState<FilterState>({
    dateRange: 'all',
    customer: 'All Customers',
    buyer: 'All Buyers',
    tcStatus: 'All Statuses',
    deliveryStatus: 'All Delivery Statuses',
    searchQuery: '',
  });

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleResetFilters = () => {
    setFilters({
      dateRange: 'all',
      customer: 'All Customers',
      buyer: 'All Buyers',
      tcStatus: 'All Statuses',
      deliveryStatus: 'All Delivery Statuses',
      searchQuery: '',
    });
  };

  // Handle Excel file import with merged database records
  const handleDataImported = (mergedData: PIData[], fileInfo: UploadedFileInfo) => {
    setPiList(mergedData);
    setActiveFileInfo(fileInfo);
    saveToPersistentStorage(mergedData, fileInfo);
    // Auto-sync to Google Sheet if enabled
    triggerAutoSyncIfEnabled(mergedData);
    // Reset filters so all data is visible
    handleResetFilters();
  };

  // Clear all data
  const handleClearAllData = () => {
    clearPersistentStorage();
    setPiList([]);
    setActiveFileInfo(null);
    handleResetFilters();
  };

  // Dynamic lists from current active dataset
  const availableCustomers = useMemo(() => {
    const set = new Set<string>();
    piList.forEach((p) => {
      if (p.customer) set.add(p.customer);
    });
    return ['All Customers', ...Array.from(set).sort()];
  }, [piList]);

  const availableBuyers = useMemo(() => {
    const set = new Set<string>();
    piList.forEach((p) => {
      if (p.buyer) set.add(p.buyer);
    });
    return ['All Buyers', ...Array.from(set).sort()];
  }, [piList]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return piList.filter((item) => {
      // Filter tab context
      if (activeTab === 'Audit Pipeline') {
        if (item.tcStatus !== 'Pending' && item.tcStatus !== 'Under Review') return false;
      } else if (activeTab === 'Compliance') {
        if (item.tcStatus !== 'Overdue') return false;
      }

      // Date filter
      if (filters.dateRange === '30days' && item.piAgeDays > 30) return false;
      if (filters.dateRange === '60days' && item.piAgeDays > 60) return false;
      if (filters.dateRange === '90days' && item.piAgeDays > 90) return false;
      if (filters.dateRange === 'aug2026' && !item.orderDate.startsWith('2026-08')) return false;
      if (filters.dateRange === 'sep2026' && !item.orderDate.startsWith('2026-09')) return false;

      // Customer filter
      if (
        filters.customer !== 'All Customers' &&
        item.customer !== filters.customer
      ) {
        return false;
      }

      // Buyer filter
      if (filters.buyer !== 'All Buyers' && item.buyer !== filters.buyer) {
        return false;
      }

      // TC Status filter
      if (filters.tcStatus !== 'All Statuses') {
        const computed = computeAutomatedTcStatus(item);
        const actualStatus = computed !== 'Not Requested' ? computed : (item.tcStatus || 'Not Requested');

        if (filters.tcStatus === 'Pending') {
          if (
            actualStatus === 'Not Requested' ||
            actualStatus === 'Final TC Received' ||
            actualStatus === 'Issued'
          ) {
            return false;
          }
        } else if (filters.tcStatus === 'Issued') {
          if (actualStatus !== 'Final TC Received' && actualStatus !== 'Issued') {
            return false;
          }
        } else if (filters.tcStatus === 'Required') {
          if (actualStatus !== 'Not Requested' && actualStatus !== 'Required') {
            return false;
          }
        } else {
          if (
            actualStatus !== filters.tcStatus &&
            item.tcStatus !== filters.tcStatus &&
            computed !== filters.tcStatus
          ) {
            return false;
          }
        }
      }

      // Delivery Status filter
      if (
        filters.deliveryStatus &&
        filters.deliveryStatus !== 'All Statuses' &&
        filters.deliveryStatus !== 'All Delivery Statuses'
      ) {
        if (item.deliveryStatus !== filters.deliveryStatus) {
          return false;
        }
      }

      // Global search
      if (filters.searchQuery.trim() !== '') {
        const query = filters.searchQuery.toLowerCase().trim();
        const matches =
          (item.piNumber && item.piNumber.toLowerCase().includes(query)) ||
          (item.invoiceNumber && item.invoiceNumber.toLowerCase().includes(query)) ||
          (item.tcNumber && item.tcNumber.toLowerCase().includes(query)) ||
          (item.buyer && item.buyer.toLowerCase().includes(query)) ||
          (item.customer && item.customer.toLowerCase().includes(query)) ||
          (item.contactPerson && item.contactPerson.toLowerCase().includes(query)) ||
          (item.standard && item.standard.toLowerCase().includes(query)) ||
          (item.certBody && item.certBody.toLowerCase().includes(query)) ||
          (item.poReference && item.poReference.toLowerCase().includes(query)) ||
          (item.deliveryStatus && item.deliveryStatus.toLowerCase().includes(query)) ||
          (item.productDescription && item.productDescription.toLowerCase().includes(query)) ||
          (item.orderDate && item.orderDate.toLowerCase().includes(query)) ||
          (item.tcRequestDate && item.tcRequestDate.toLowerCase().includes(query)) ||
          (item.receivedCommercialDocDate && item.receivedCommercialDocDate.toLowerCase().includes(query)) ||
          (item.draftTcDate && item.draftTcDate.toLowerCase().includes(query)) ||
          (item.draftConfirmationDate && item.draftConfirmationDate.toLowerCase().includes(query)) ||
          (item.finalTcApplyDate && item.finalTcApplyDate.toLowerCase().includes(query)) ||
          (item.finalTcReceivedDate && item.finalTcReceivedDate.toLowerCase().includes(query)) ||
          computeAutomatedTcStatus(item).toLowerCase().includes(query);
        if (!matches) return false;
      }

      return true;
    });
  }, [piList, filters, activeTab]);

  // KPI Calculations
  const stats = useMemo(() => {
    const totalPi = filteredData.length;
    const tcRequired = filteredData.filter((i) => {
      const st = computeAutomatedTcStatus(i);
      const actual = st !== 'Not Requested' ? st : i.tcStatus;
      return actual === 'Not Requested' || actual === 'Required';
    }).length;
    const tcPending = filteredData.filter((i) => {
      const st = computeAutomatedTcStatus(i);
      const actual = st !== 'Not Requested' ? st : i.tcStatus;
      return (
        actual === 'TC Requested' ||
        actual === 'Commercial Doc Received' ||
        actual === 'Draft TC Received' ||
        actual === 'Draft Confirmed' ||
        actual === 'Revision' ||
        actual === 'Final TC Applied' ||
        actual === 'Pending' ||
        actual === 'Under Review'
      );
    }).length;
    const tcIssued = filteredData.filter((i) => {
      const st = computeAutomatedTcStatus(i);
      const actual = st !== 'Not Requested' ? st : i.tcStatus;
      return actual === 'Final TC Received' || actual === 'Issued';
    }).length;
    const totalTcCost = filteredData.reduce((acc, curr) => acc + curr.tcCost, 0);
    const overdue = filteredData.filter((i) => i.tcStatus === 'Overdue').length;

    return {
      totalPi,
      tcRequired,
      tcPending,
      tcIssued,
      totalTcCost,
      overdue,
    };
  }, [filteredData]);

  // Update Status in local state, persistence, and auto-sync to Google Sheet
  const handleUpdateStatus = (piId: string, newStatus: TCStatus) => {
    const updated = piList.map((item) =>
      item.id === piId ? { ...item, tcStatus: newStatus } : item
    );
    setPiList(updated);
    saveToPersistentStorage(updated, activeFileInfo);
    triggerAutoSyncIfEnabled(updated);

    if (selectedPi && selectedPi.id === piId) {
      setSelectedPi((prev) => (prev ? { ...prev, tcStatus: newStatus } : null));
    }
  };

  // Full PI Update (e.g. notes, status, etc.) with instant Google Sheet Auto-Save
  const handleUpdatePI = (updatedPI: PIData) => {
    const updated = piList.map((item) =>
      item.id === updatedPI.id ? updatedPI : item
    );
    setPiList(updated);
    setSelectedPi(updatedPI);
    saveToPersistentStorage(updated, activeFileInfo);
    triggerAutoSyncIfEnabled(updated);
  };

  // Reload / Sync data from persistent storage & linked Google Sheet
  const handleReloadData = async () => {
    // 1. Reload from localStorage first
    const saved = loadFromPersistentStorage();
    if (saved.data) {
      const refreshed = saved.data.map((item) => ({
        ...item,
        tcStatus: computeAutomatedTcStatus(item),
      }));
      setPiList(refreshed);
      if (saved.fileInfo) setActiveFileInfo(saved.fileInfo);
    }

    // 2. If Google Sheet is connected and authenticated, pull latest data directly from Google Sheet
    if (googleAccessToken && linkedSheet) {
      try {
        setSyncStatus('syncing');
        const sheetRes = await importDataFromGoogleSpreadsheet(
          googleAccessToken,
          linkedSheet.spreadsheetId
        );
        if (sheetRes && sheetRes.data && sheetRes.data.length > 0) {
          const refreshedSheet = sheetRes.data.map((item: PIData) => ({
            ...item,
            tcStatus: computeAutomatedTcStatus(item),
          }));
          setPiList(refreshedSheet);
          saveToPersistentStorage(refreshedSheet, activeFileInfo);
          setSyncStatus('synced');
        }
      } catch (err) {
        console.warn('Could not auto-fetch from Google Sheet on reload:', err);
        setSyncStatus('error');
      }
    }
  };

  // Batch Update multiple PIs at once (e.g. shared Invoice Number, TC Dates, etc.)
  const handleBatchUpdatePIs = (ids: string[], updates: Partial<PIData>) => {
    const updated = piList.map((item) => {
      if (!ids.includes(item.id)) return item;
      const merged = { ...item };

      if (updates.invoiceNumber !== undefined) merged.invoiceNumber = updates.invoiceNumber;
      if (updates.tcRequestDate !== undefined) merged.tcRequestDate = updates.tcRequestDate;
      if (updates.receivedCommercialDocDate !== undefined) merged.receivedCommercialDocDate = updates.receivedCommercialDocDate;
      if (updates.draftTcDate !== undefined) merged.draftTcDate = updates.draftTcDate;
      if (updates.draftConfirmationDate !== undefined) merged.draftConfirmationDate = updates.draftConfirmationDate;
      if (updates.revisionQty !== undefined) merged.revisionQty = updates.revisionQty;
      if (updates.finalTcApplyDate !== undefined) merged.finalTcApplyDate = updates.finalTcApplyDate;
      if (updates.finalTcReceivedDate !== undefined) merged.finalTcReceivedDate = updates.finalTcReceivedDate;
      if (updates.tcNumber !== undefined) merged.tcNumber = updates.tcNumber;
      if (updates.paymentStatus !== undefined) merged.paymentStatus = updates.paymentStatus;
      if (updates.deliveryStatus !== undefined) merged.deliveryStatus = updates.deliveryStatus;

      merged.tcStatus = computeAutomatedTcStatus(merged);
      return merged;
    });

    setPiList(updated);
    saveToPersistentStorage(updated, activeFileInfo);
    triggerAutoSyncIfEnabled(updated);

    if (selectedPi && ids.includes(selectedPi.id)) {
      const refreshed = updated.find((p) => p.id === selectedPi.id);
      if (refreshed) setSelectedPi(refreshed);
    }
  };

  // CSV Export utility
  const handleExportCSV = () => {
    if (filteredData.length === 0) return;
    const headers = [
      'Order Date',
      'PI Number',
      'Invoice Number',
      'Buyer',
      'Customer',
      'Contact Person',
      'Order Qty',
      'Delivery Qty',
      'Balance Qty',
      'Delivery Status',
      'TC Request Date',
      'Received Commercial Doc Date',
      'Draft TC Date',
      'Draft Confirmation Date',
      'Revision Qty',
      'Final TC Apply Date',
      'Final TC Received Date',
      'TC Number',
      'TC Status',
      'TC Cost (USD)',
      'PI Age (Days)',
      'Standard',
      'Cert Body',
    ];

    const rows = filteredData.map((d) => {
      const rawO = d.orderQuantity ?? d.quantityPcs ?? 0;
      let orderQ = rawO <= 1 ? 0 : rawO;
      const delivQ =
        orderQ === 0
          ? 0
          : d.deliveryQuantity !== undefined && d.deliveryQuantity > 1
          ? d.deliveryQuantity
          : d.deliveryStatus === 'Delivered'
          ? orderQ
          : d.deliveryStatus === 'In Transit'
          ? Math.floor(orderQ * 0.8)
          : 0;
      if (orderQ > 0 && orderQ - delivQ === 1) {
        orderQ = orderQ - 1;
      }
      const balQ = Math.max(0, orderQ - delivQ);
      const autoSt = computeAutomatedTcStatus(d);
      const currentSt = autoSt !== 'Not Requested' ? autoSt : (d.tcStatus || 'Not Requested');

      return [
        d.orderDate,
        `"${d.piNumber}"`,
        `"${d.invoiceNumber || ''}"`,
        `"${d.buyer}"`,
        `"${d.customer}"`,
        `"${d.contactPerson || 'System'}"`,
        orderQ,
        delivQ,
        balQ,
        `"${d.deliveryStatus}"`,
        d.tcRequestDate || '',
        d.receivedCommercialDocDate || '',
        d.draftTcDate || '',
        d.draftConfirmationDate || '',
        d.revisionQty || '',
        d.finalTcApplyDate || '',
        d.finalTcReceivedDate || '',
        d.tcNumber || '',
        `"${currentSt}"`,
        d.tcCost,
        d.piAgeDays,
        `"${d.standard}"`,
        `"${d.certBody}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Mainetti_TC_Report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#f1f4f8] text-slate-900 flex font-sans">
      {/* Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        filteredCount={filteredData.length}
        totalCount={piList.length}
        overdueCount={stats.overdue}
        pendingCount={stats.tcPending}
        activeFileInfo={activeFileInfo}
        onRefresh={handleReloadData}
        onExport={handleExportCSV}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Workspace Top Header */}
        <Header
          onToggleSidebar={handleToggleSidebar}
          isSidebarCollapsed={isSidebarCollapsed}
          onRefresh={handleReloadData}
          onExport={handleExportCSV}
          onOpenGoogleSheetsSync={() => setIsGoogleSheetsModalOpen(true)}
          linkedSheet={linkedSheet}
          syncStatus={syncStatus}
          lastAutoSyncTime={lastAutoSyncTime}
          isGoogleSignedIn={!!googleUser}
          filteredCount={filteredData.length}
          totalCount={piList.length}
          activeTab={activeTab}
        />

        <main className="flex-1 p-2 sm:p-2.5 lg:p-3 space-y-2 w-full min-w-0">
          {/* View Routing */}
          {activeTab === 'Excel Upload' ? (
            <ExcelUploadView
              currentData={piList}
              activeFileInfo={activeFileInfo}
              onDataImported={handleDataImported}
              onClearAllData={handleClearAllData}
              onNavigateToDashboard={() => setActiveTab('Dashboard')}
            />
          ) : activeTab === 'Executive Summary' ? (
            <TcSummaryPageView
              data={filteredData}
              onSelectPI={(pi) => setSelectedPi(pi)}
              onSelectBuyer={(buyer) => handleFilterChange({ buyer })}
              onSelectCustomer={(customer) => handleFilterChange({ customer })}
              onSaveToGoogleSheets={() => setIsGoogleSheetsModalOpen(true)}
            />
          ) : activeTab === 'TC Master' ? (
            /* Dedicated TC Master Page: Just Filter Bar + PI Table */
            <div className="space-y-1.5 flex flex-col">
              <FilterBar
                filters={filters}
                onFilterChange={handleFilterChange}
                onReset={handleResetFilters}
                totalResults={filteredData.length}
                customers={availableCustomers}
                buyers={availableBuyers}
              />
              <PendingAttentionTable
                data={filteredData}
                onSelectPI={(pi) => setSelectedPi(pi)}
                selectedPiId={selectedPi?.id}
                onExport={handleExportCSV}
                onSaveToGoogleSheets={() => setIsGoogleSheetsModalOpen(true)}
                onBatchUpdatePIs={handleBatchUpdatePIs}
                isFullPage={true}
              />
            </div>
          ) : piList.length === 0 ? (
            /* Empty State when no data has been uploaded yet */
            <div className="bg-white border border-slate-200 rounded-sm p-12 text-center shadow-xs my-8 max-w-2xl mx-auto space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-[#0b1b3d] rounded-full flex items-center justify-center mx-auto border border-blue-200">
                <UploadCloud className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#0b1b3d] uppercase tracking-wide">
                  No Excel Data Loaded
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  All dummy records have been removed. Upload your Excel spreadsheet (.xlsx, .xls, .csv) to extract only the orders where <strong>TC Cost</strong> is present.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('Excel Upload')}
                  className="px-5 py-2.5 bg-[#0b1b3d] hover:bg-[#162d59] text-white text-xs font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer inline-flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-blue-300" />
                  <span>Go to Excel Upload Page</span>
                </button>
              </div>
            </div>
          ) : (
            /* Main Dashboard View with Real Extracted Data */
            <>
              {/* Compact Filters Strip */}
              <FilterBar
                filters={filters}
                onFilterChange={handleFilterChange}
                onReset={handleResetFilters}
                totalResults={filteredData.length}
                customers={availableCustomers}
                buyers={availableBuyers}
              />

              {/* 6 Core KPIs */}
              <KpiCardGrid
                stats={stats}
                currentStatusFilter={filters.tcStatus}
                onSelectStatusFilter={(status) =>
                  handleFilterChange({ tcStatus: status })
                }
              />

              {/* Middle Analytics Strip (TC Status Overview, Monthly TC Cost Trend, Order & Delivery Snapshot) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {/* TC Status Overview Chart */}
                <StatusOverviewChart
                  data={filteredData}
                  onSelectStatus={(status) =>
                    handleFilterChange({ tcStatus: status })
                  }
                />

                {/* Monthly TC Cost Trend */}
                <MonthlyCostTrendChart data={filteredData} />

                {/* Order & Delivery Snapshot */}
                <OrderDeliverySnapshot
                  data={piList}
                  onFilterDelivery={(status) =>
                    handleFilterChange({
                      deliveryStatus:
                        filters.deliveryStatus === status ? 'All Delivery Statuses' : status,
                    })
                  }
                  activeDeliveryFilter={filters.deliveryStatus}
                />
              </div>

              {/* TC Pending Attention Table */}
              <div>
                <PendingAttentionTable
                  data={filteredData}
                  onSelectPI={(pi) => setSelectedPi(pi)}
                  selectedPiId={selectedPi?.id}
                  onExport={handleExportCSV}
                  onSaveToGoogleSheets={() => setIsGoogleSheetsModalOpen(true)}
                  onBatchUpdatePIs={handleBatchUpdatePIs}
                />
              </div>
            </>
          )}
        </main>
      </div>

      {/* Google Sheets Synchronization Modal */}
      <GoogleSheetsSyncModal
        isOpen={isGoogleSheetsModalOpen}
        onClose={() => setIsGoogleSheetsModalOpen(false)}
        data={filteredData}
        user={googleUser}
        accessToken={googleAccessToken}
        onAuthSuccess={(user, token) => {
          setGoogleUser(user);
          setGoogleAccessToken(token);
        }}
        onSignOut={() => {
          setGoogleUser(null);
          setGoogleAccessToken(null);
        }}
        onDataImported={handleDataImported}
      />

      {/* PI Detail Modal / Drawer */}
      <PiDetailDrawer
        pi={selectedPi}
        onClose={() => setSelectedPi(null)}
        onUpdateStatus={handleUpdateStatus}
        onUpdatePI={handleUpdatePI}
      />
    </div>
  );
}
