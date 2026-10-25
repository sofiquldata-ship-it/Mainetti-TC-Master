import React, { useState, useMemo, useEffect } from 'react';
import {
  Scale,
  PlusCircle,
  PackageCheck,
  Download,
  ArrowDownLeft,
  Layers,
  TrendingDown,
  Archive,
  Clock,
  Boxes,
  CheckCheck,
  Search,
  FilePlus2,
  X,
  AlertOctagon,
  BadgeCheck,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  PackageOpen,
  FileSpreadsheet,
  ExternalLink,
  Loader2,
  CloudUpload,
} from 'lucide-react';
import {
  syncMassBalanceToSpreadsheet,
  exportMassBalanceToNewSpreadsheet,
  getSavedLinkedSheet,
  LinkedSheetConfig,
} from '../utils/googleSheetsService';
import { googleSignIn, getAccessToken } from '../utils/googleAuth';


export interface PurchaseTCBatch {
  tcNo: string;
  standard: 'RCS' | 'GRS';
  totalInward: number;
  currentBalance: number;
  lotNo: string;
}

export interface MassBalanceLedgerEntry {
  id: number | string;
  purchaseTc: string;
  standard: 'RCS' | 'GRS';
  lotNo: string;
  openingQty: number;
  outputQty: number;
  inputQty: number;
  lossQty: number;
  remainingStock: number;
  soldQty: number;
  pendingSoldQty: number;
  soldTc: string;
  status: 'Certified' | 'Pending';
}

const INITIAL_PURCHASES: PurchaseTCBatch[] = [
  { tcNo: "03512485", standard: "RCS", totalInward: 14375.00, currentBalance: 693.37, lotNo: "60284N:LDPE 60283N:LDPE" },
  { tcNo: "04529379", standard: "GRS", totalInward: 10500.00, currentBalance: 10500.00, lotNo: "STM/EXP/GER115/2025" },
  { tcNo: "04532375", standard: "GRS", totalInward: 35000.00, currentBalance: 35000.00, lotNo: "STM/EXP/GER114/2025" },
  { tcNo: "04628981", standard: "GRS", totalInward: 70500.00, currentBalance: 70500.00, lotNo: "STM/EXP/GER117/2025" }
];

const INITIAL_LEDGER: MassBalanceLedgerEntry[] = [
  {
    id: 1,
    purchaseTc: "03512485",
    standard: "RCS",
    lotNo: "60284N:LDPE",
    openingQty: 14375.00,
    outputQty: 898.66,
    inputQty: 956.02,
    lossQty: 57.36,
    remainingStock: 13418.98,
    soldQty: 898.66,
    pendingSoldQty: 0.00,
    soldTc: "CUC-04754082",
    status: "Certified"
  },
  {
    id: 2,
    purchaseTc: "03512485",
    standard: "RCS",
    lotNo: "60283N:LDPE",
    openingQty: 13418.98,
    outputQty: 950.00,
    inputQty: 1010.64,
    lossQty: 60.64,
    remainingStock: 12408.34,
    soldQty: 950.00,
    pendingSoldQty: 0.00,
    soldTc: "CUC-04763111",
    status: "Certified"
  },
  {
    id: 3,
    purchaseTc: "03512485",
    standard: "RCS",
    lotNo: "60284N:LDPE",
    openingQty: 12408.34,
    outputQty: 1053.00,
    inputQty: 1120.21,
    lossQty: 67.21,
    remainingStock: 11288.13,
    soldQty: 1053.00,
    pendingSoldQty: 0.00,
    soldTc: "CUC-04659279",
    status: "Certified"
  },
  {
    id: 4,
    purchaseTc: "03512485",
    standard: "RCS",
    lotNo: "60283N:LDPE",
    openingQty: 11288.13,
    outputQty: 884.45,
    inputQty: 940.90,
    lossQty: 56.45,
    remainingStock: 10347.23,
    soldQty: 884.45,
    pendingSoldQty: 0.00,
    soldTc: "CUC-04812301",
    status: "Certified"
  },
  {
    id: 5,
    purchaseTc: "03512485",
    standard: "RCS",
    lotNo: "60284N:LDPE",
    openingQty: 10347.23,
    outputQty: 9074.43,
    inputQty: 9653.65,
    lossQty: 579.22,
    remainingStock: 693.58,
    soldQty: 9074.43,
    pendingSoldQty: 0.00,
    soldTc: "CUC-04829910",
    status: "Certified"
  },
  {
    id: 6,
    purchaseTc: "03512485",
    standard: "RCS",
    lotNo: "60284N:LDPE",
    openingQty: 693.58,
    outputQty: 0.20,
    inputQty: 0.21,
    lossQty: 0.01,
    remainingStock: 693.37,
    soldQty: 0.00,
    pendingSoldQty: 0.20,
    soldTc: "",
    status: "Pending"
  }
];

function fmt(val: number | undefined | null): string {
  return Number(val || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export interface MassBalancePageProps {
  onOpenGoogleSheetsSync?: () => void;
  googleUser?: any | null;
  googleAccessToken?: string | null;
  linkedSheet?: LinkedSheetConfig | null;
}

export const MassBalancePage: React.FC<MassBalancePageProps> = ({
  onOpenGoogleSheetsSync,
  googleUser,
  googleAccessToken,
  linkedSheet: propLinkedSheet,
}) => {
  // Loss Rate setting
  const [lossRate, setLossRate] = useState<number>(() => {
    const saved = localStorage.getItem('mainetti_mb_loss_rate');
    return saved ? parseFloat(saved) : 6.0;
  });

  // Master Purchases & Ledger with localStorage persistence
  const [purchaseLedger, setPurchaseLedger] = useState<PurchaseTCBatch[]>(() => {
    try {
      const saved = localStorage.getItem('mainetti_mass_balance_purchases_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse purchaseLedger from localStorage', e);
    }
    return INITIAL_PURCHASES;
  });

  const [ledgerData, setLedgerData] = useState<MassBalanceLedgerEntry[]>(() => {
    try {
      const saved = localStorage.getItem('mainetti_mass_balance_ledger_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse ledgerData from localStorage', e);
    }
    return INITIAL_LEDGER;
  });

  // Google Sheets integration state
  const [linkedSheet, setLinkedSheet] = useState<LinkedSheetConfig | null>(() => {
    return propLinkedSheet || getSavedLinkedSheet();
  });

  useEffect(() => {
    if (propLinkedSheet) {
      setLinkedSheet(propLinkedSheet);
    } else {
      setLinkedSheet(getSavedLinkedSheet());
    }
  }, [propLinkedSheet]);

  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [syncSuccessInfo, setSyncSuccessInfo] = useState<{
    url: string;
    time: string;
    rowCount: number;
    title: string;
  } | null>(null);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('mainetti_mass_balance_purchases_v1', JSON.stringify(purchaseLedger));
  }, [purchaseLedger]);

  useEffect(() => {
    localStorage.setItem('mainetti_mass_balance_ledger_v1', JSON.stringify(ledgerData));
  }, [ledgerData]);

  useEffect(() => {
    localStorage.setItem('mainetti_mb_loss_rate', String(lossRate));
  }, [lossRate]);

  // Modal Visibility
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isOutputModalOpen, setIsOutputModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [standardFilter, setStandardFilter] = useState<'ALL' | 'RCS' | 'GRS'>('ALL');
  const [purchaseTcFilter, setPurchaseTcFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Certified' | 'Pending'>('ALL');

  // Form states: Add Purchase TC
  const [ptcNumber, setPtcNumber] = useState('');
  const [ptcStandard, setPtcStandard] = useState<'RCS' | 'GRS'>('RCS');
  const [ptcLotNo, setPtcLotNo] = useState('');
  const [ptcQuantity, setPtcQuantity] = useState('');

  // Form states: Output Entry
  const [selectedSourceTc, setSelectedSourceTc] = useState<string>(() => {
    return purchaseLedger[0]?.tcNo || '';
  });
  const [userOutputQty, setUserOutputQty] = useState<string>('');
  const [userSoldTC, setUserSoldTC] = useState<string>('');
  const [userLotRef, setUserLotRef] = useState<string>('');

  // Form states: Assign Sold TC Modal
  const [assigningRow, setAssigningRow] = useState<MassBalanceLedgerEntry | null>(null);
  const [assignSoldTcInput, setAssignSoldTcInput] = useState('');

  // Toast feedback state
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);

  const showToast = (msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => {
      setToast(null);
    }, 3800);
  };

  // Find currently selected source TC object
  const activeSourceTC = useMemo(() => {
    return purchaseLedger.find((p) => p.tcNo === selectedSourceTc) || purchaseLedger[0] || null;
  }, [purchaseLedger, selectedSourceTc]);

  // Real-time calculation for output modal
  const liveCalc = useMemo(() => {
    const outQty = parseFloat(userOutputQty) || 0;
    const inputFactor = (100 - lossRate) / 100;
    const inputQty = outQty > 0 ? outQty / inputFactor : 0;
    const lossQty = inputQty > 0 ? inputQty * (lossRate / 100) : 0;
    const currentStock = activeSourceTC ? activeSourceTC.currentBalance : 0;
    const remainingStock = currentStock - inputQty;
    const isOverAllocated = outQty > 0 && inputQty > currentStock + 0.001;

    return {
      outputQty: outQty,
      inputQty,
      lossQty,
      soldQty: outQty,
      remainingStock,
      currentStock,
      isOverAllocated
    };
  }, [userOutputQty, lossRate, activeSourceTC]);

  // Filtered ledger records
  const filteredLedger = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return ledgerData.filter((r) => {
      const matchSearch =
        !q ||
        r.purchaseTc.toLowerCase().includes(q) ||
        r.lotNo.toLowerCase().includes(q) ||
        (r.soldTc && r.soldTc.toLowerCase().includes(q));

      const matchStd = standardFilter === 'ALL' || r.standard === standardFilter;
      const matchTC = purchaseTcFilter === 'ALL' || r.purchaseTc === purchaseTcFilter;
      const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;

      return matchSearch && matchStd && matchTC && matchStatus;
    });
  }, [ledgerData, searchQuery, standardFilter, purchaseTcFilter, statusFilter]);

  // Overall KPI metrics
  const kpis = useMemo(() => {
    const totalInward = purchaseLedger.reduce((sum, p) => sum + p.totalInward, 0);
    const totalInputUsed = ledgerData.reduce((sum, r) => sum + r.inputQty, 0);
    const totalLoss = ledgerData.reduce((sum, r) => sum + r.lossQty, 0);
    const stockBalance = purchaseLedger.reduce((sum, p) => sum + p.currentBalance, 0);
    const pendingSoldTC = ledgerData.reduce((sum, r) => sum + (r.pendingSoldQty || 0), 0);

    return {
      totalInward,
      totalInputUsed,
      totalLoss,
      stockBalance,
      pendingSoldTC
    };
  }, [purchaseLedger, ledgerData]);

  // 1. Submit New Purchase TC
  const handlePurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTc = ptcNumber.trim();
    const cleanLot = ptcLotNo.trim();
    const qty = parseFloat(ptcQuantity);

    if (!cleanTc) {
      showToast('Please enter a valid Purchase TC Number', true);
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      showToast('Please enter a valid net weight quantity', true);
      return;
    }
    if (purchaseLedger.some((p) => p.tcNo.toLowerCase() === cleanTc.toLowerCase())) {
      showToast(`Purchase TC #${cleanTc} is already registered!`, true);
      return;
    }

    const newBatch: PurchaseTCBatch = {
      tcNo: cleanTc,
      standard: ptcStandard,
      totalInward: qty,
      currentBalance: qty,
      lotNo: cleanLot || 'N/A'
    };

    setPurchaseLedger((prev) => [...prev, newBatch]);
    setIsPurchaseModalOpen(false);
    setPtcNumber('');
    setPtcLotNo('');
    setPtcQuantity('');
    showToast(`Purchase TC #${cleanTc} (${fmt(qty)} Kg) added successfully!`);
  };

  // 2. Submit Output / Issue Entry
  const handleOutputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSourceTC) {
      showToast('Please select a valid source Purchase TC', true);
      return;
    }

    const outQty = parseFloat(userOutputQty);
    if (isNaN(outQty) || outQty <= 0) {
      showToast('Please enter a valid Output Quantity', true);
      return;
    }

    const opening = activeSourceTC.currentBalance;
    const inputFactor = (100 - lossRate) / 100;
    const inputQty = parseFloat((outQty / inputFactor).toFixed(2));
    const lossQty = parseFloat((inputQty - outQty).toFixed(2));
    const remaining = parseFloat((opening - inputQty).toFixed(2));

    if (inputQty > opening + 0.01) {
      showToast(
        `Stock Shortage! Remaining stock: ${fmt(opening)} Kg, required input: ${fmt(inputQty)} Kg.`,
        true
      );
      return;
    }

    // Deduct stock balance from the source Purchase TC
    setPurchaseLedger((prev) =>
      prev.map((p) =>
        p.tcNo === activeSourceTC.tcNo
          ? { ...p, currentBalance: Math.max(0, remaining) }
          : p
      )
    );

    const cleanSoldTc = userSoldTC.trim();
    const isIssued = cleanSoldTc.length > 0;
    const soldQtyVal = isIssued ? outQty : 0.0;
    const pendingSoldQtyVal = isIssued ? 0.0 : outQty;

    const newEntry: MassBalanceLedgerEntry = {
      id: Date.now(),
      purchaseTc: activeSourceTC.tcNo,
      standard: activeSourceTC.standard,
      lotNo: userLotRef.trim() || activeSourceTC.lotNo,
      openingQty: opening,
      outputQty: outQty,
      inputQty: inputQty,
      lossQty: lossQty,
      remainingStock: remaining,
      soldQty: soldQtyVal,
      pendingSoldQty: pendingSoldQtyVal,
      soldTc: cleanSoldTc,
      status: isIssued ? 'Certified' : 'Pending'
    };

    setLedgerData((prev) => [...prev, newEntry]);
    setIsOutputModalOpen(false);
    setUserOutputQty('');
    setUserSoldTC('');
    setUserLotRef('');
    showToast(
      `Output ${fmt(outQty)} Kg saved! Auto deducted ${fmt(inputQty)} Kg from TC #${activeSourceTC.tcNo}.`
    );
  };

  // 3. Assign Sold TC to a Pending row
  const openAssignModal = (row: MassBalanceLedgerEntry) => {
    setAssigningRow(row);
    setAssignSoldTcInput('');
    setIsAssignModalOpen(true);
  };

  const handleAssignTCSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningRow) return;

    const cleanSoldTc = assignSoldTcInput.trim();
    if (!cleanSoldTc) {
      showToast('Please enter a valid Sold TC number', true);
      return;
    }

    setLedgerData((prev) =>
      prev.map((item) =>
        item.id === assigningRow.id
          ? {
              ...item,
              soldTc: cleanSoldTc,
              soldQty: item.outputQty,
              pendingSoldQty: 0.0,
              status: 'Certified'
            }
          : item
      )
    );

    setIsAssignModalOpen(false);
    showToast(`Sold TC #${cleanSoldTc} assigned! Item certified.`);
  };

  // 4. Delete Ledger Row and restore deducted stock
  const deleteLedgerRow = (id: number | string) => {
    const rowToDelete = ledgerData.find((r) => r.id === id);
    if (!rowToDelete) return;

    // Restore stock to the source Purchase TC
    setPurchaseLedger((prev) =>
      prev.map((p) =>
        p.tcNo === rowToDelete.purchaseTc
          ? { ...p, currentBalance: parseFloat((p.currentBalance + rowToDelete.inputQty).toFixed(2)) }
          : p
      )
    );

    setLedgerData((prev) => prev.filter((r) => r.id !== id));
    showToast('Transaction removed and purchase stock balance restored.');
  };

  // 5. Audit CSV Export
  const exportToCSV = () => {
    if (ledgerData.length === 0) {
      showToast('No transaction records available to export.', true);
      return;
    }

    let csv =
      'ID,Purchase TC No,Standard,Lot No,Opening Stock (Kg),Output Qty (Kg),Input Used (Kg),Process Loss 6% (Kg),Remaining Stock (Kg),Sold Qty (Kg),Sold but not applied for TC yet (Kg),Sold TC Number,Status\n';

    ledgerData.forEach((r, i) => {
      csv += `"${i + 1}","${r.purchaseTc}","${r.standard}","${r.lotNo.replace(/"/g, '""')}","${r.openingQty.toFixed(2)}","${r.outputQty.toFixed(2)}","${r.inputQty.toFixed(2)}","${r.lossQty.toFixed(2)}","${r.remainingStock.toFixed(2)}","${r.soldQty.toFixed(2)}","${r.pendingSoldQty.toFixed(2)}","${r.soldTc}","${r.status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Mass_Balance_Compliance_Audit_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Mass Balance Audit CSV downloaded successfully!');
  };

  // 6. Sync with Google Sheets
  const handleSyncGoogleSheets = async () => {
    setIsSyncingSheets(true);
    setSyncSuccessInfo(null);
    try {
      let token = googleAccessToken;
      if (!token) {
        token = await getAccessToken();
      }
      if (!token) {
        const authRes = await googleSignIn();
        if (authRes?.accessToken) {
          token = authRes.accessToken;
        }
      }
      if (!token) {
        if (onOpenGoogleSheetsSync) {
          onOpenGoogleSheetsSync();
          return;
        }
        throw new Error('Please sign in with Google to sync with Google Sheets.');
      }

      const currentSheet = linkedSheet || getSavedLinkedSheet();
      let result;
      if (currentSheet?.spreadsheetId) {
        result = await syncMassBalanceToSpreadsheet(
          token,
          currentSheet.spreadsheetId,
          purchaseLedger,
          ledgerData
        );
      } else {
        result = await exportMassBalanceToNewSpreadsheet(
          token,
          purchaseLedger,
          ledgerData
        );
      }

      const updatedConfig: LinkedSheetConfig = {
        spreadsheetId: result.spreadsheetId,
        spreadsheetUrl: result.spreadsheetUrl,
        title: result.title,
        lastSyncedAt: new Date().toLocaleTimeString(),
        autoSync: true,
      };

      setLinkedSheet(updatedConfig);
      setSyncSuccessInfo({
        url: result.spreadsheetUrl,
        time: new Date().toLocaleTimeString(),
        rowCount: result.rowCount,
        title: result.title,
      });

      showToast(`Saved to Google Sheets! Tabs 'Mass Balance Ledger' & 'Purchase TC Stock' updated.`);
    } catch (err: any) {
      console.error('Failed to sync Mass Balance with Google Sheets:', err);
      showToast(err.message || 'Failed to save data to Google Sheet', true);
    } finally {
      setIsSyncingSheets(false);
    }
  };

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen flex flex-col font-sans -m-4 sm:-m-6">
      {/* Top Banner & Action Controls */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Brand & Badges */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-sm font-bold text-lg shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                  Mass Balance & TC Manager
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  RCS &bull; GRS Compliant
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Automated Inward &bull; Consumption (Loss 6%) &bull; Outward Reconciliation
              </p>
            </div>
          </div>

          {/* Action Buttons & Standard Loss rate setting */}
          <div className="flex items-center space-x-2 sm:space-x-3 w-full md:w-auto justify-end flex-wrap gap-y-2">
            {/* Standard Loss Rate Setting */}
            <div className="flex items-center bg-slate-100 rounded-lg px-2.5 py-1.5 border border-slate-200 text-xs">
              <span className="text-slate-500 mr-2 font-medium">Std Loss %:</span>
              <input
                type="number"
                value={lossRate}
                min="0"
                max="40"
                step="0.5"
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setLossRate(val);
                  showToast(`Loss calculation adjusted to ${val}%`);
                }}
                className="w-14 text-center font-mono font-bold text-slate-800 bg-white border border-slate-300 rounded px-1 py-0.5 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
              <span className="ml-1 text-slate-600 font-semibold">%</span>
            </div>

            {/* Google Sheets Sync Button */}
            <button
              type="button"
              onClick={handleSyncGoogleSheets}
              disabled={isSyncingSheets}
              className={`inline-flex items-center space-x-1.5 text-xs sm:text-sm font-semibold py-2 px-3 sm:px-3.5 rounded-lg border shadow-xs transition-colors cursor-pointer ${
                linkedSheet
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
              }`}
              title={
                linkedSheet
                  ? `Save & Sync to: ${linkedSheet.title}`
                  : 'Save data to Google Sheet'
              }
            >
              {isSyncingSheets ? (
                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              )}
              <span>
                {isSyncingSheets
                  ? 'Saving to Sheet...'
                  : linkedSheet
                  ? 'Save to Google Sheet'
                  : 'Save to Google Sheet'}
              </span>
            </button>

            {linkedSheet && (
              <a
                href={linkedSheet.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 bg-white hover:bg-slate-50 text-slate-600 hover:text-emerald-700 text-xs font-medium py-2 px-2.5 rounded-lg border border-slate-200 transition-colors shadow-2xs"
                title="Open linked Google Spreadsheet in a new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Open Sheet</span>
              </a>
            )}

            {/* Add Purchase TC Button */}
            <button
              type="button"
              onClick={() => setIsPurchaseModalOpen(true)}
              className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-medium py-2 px-3 sm:px-3.5 rounded-lg border border-slate-300 shadow-xs transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              <span>Add Purchase TC</span>
            </button>

            {/* Record Output Button */}
            <button
              type="button"
              onClick={() => {
                if (purchaseLedger.length > 0 && !selectedSourceTc) {
                  setSelectedSourceTc(purchaseLedger[0].tcNo);
                }
                setIsOutputModalOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold py-2 px-3 sm:px-3.5 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <PackageCheck className="w-4 h-4" />
              <span>Entry Output Qty</span>
            </button>

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={exportToCSV}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              title="Export Audit-Ready CSV Report"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Google Sheets Sync Notification Banner */}
        {syncSuccessInfo && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-950">
                  Data Google Sheet এ সফলভাবে সেভ হয়েছে!
                </h4>
                <p className="text-xs text-emerald-800">
                  Spreadsheet <strong>"{syncSuccessInfo.title}"</strong> এ <strong>'Mass Balance Ledger'</strong> ({syncSuccessInfo.rowCount} records) এবং <strong>'Purchase TC Stock'</strong> ট্যাব আপডেট করা হয়েছে ({syncSuccessInfo.time})।
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <a
                href={syncSuccessInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <span>Google Sheet দেখুন</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => setSyncSuccessInfo(null)}
                className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        {/* KPI Summary Metrics (5 Critical Cards) */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
          {/* 1. Total Certified Inward */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Inward</span>
              <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-bold font-mono text-slate-900">
                {fmt(kpis.totalInward)}
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Certified Purchase (Kg)</span>
            </div>
          </div>

          {/* 2. Total Auto-Calculated Input */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Input Used (Auto)</span>
              <div className="p-1.5 rounded-md bg-amber-50 text-amber-600">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-bold font-mono text-amber-800">
                {fmt(kpis.totalInputUsed)}
              </div>
              <span className="text-[11px] text-amber-700 font-medium">Deducted from Raw Stock</span>
            </div>
          </div>

          {/* 3. Total Process Loss */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Process Loss ({lossRate.toFixed(0)}%)
              </span>
              <div className="p-1.5 rounded-md bg-rose-50 text-rose-600">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-bold font-mono text-rose-600">
                {fmt(kpis.totalLoss)}
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Auto Loss = Input - Output</span>
            </div>
          </div>

          {/* 4. Remaining Raw Stock Balance */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Stock in Hand</span>
              <div className="p-1.5 rounded-md bg-indigo-50 text-indigo-600">
                <Archive className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-bold font-mono text-indigo-700">
                {fmt(kpis.stockBalance)}
              </div>
              <span className="text-[11px] text-indigo-600 font-medium">Remaining Material (Kg)</span>
            </div>
          </div>

          {/* 5. Sold But Not Applied For TC Yet */}
          <div className="col-span-2 md:col-span-1 bg-amber-50/70 p-4 rounded-xl border border-amber-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-amber-800 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Pending TC Qty</span>
              <div className="p-1.5 rounded-md bg-amber-200/60 text-amber-800">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-2xl font-bold font-mono text-amber-900">
                {fmt(kpis.pendingSoldTC)}
              </div>
              <span className="text-[11px] text-amber-800 font-semibold">Sold but not applied yet</span>
            </div>
          </div>
        </section>

        {/* Purchase TC Batch Stock Overview (Visual Progress Bars) */}
        <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Boxes className="w-5 h-5 text-slate-700" />
              <h2 className="text-sm font-bold text-slate-800">
                Active Purchase TCs & Stock Utilization
              </h2>
            </div>
            <span className="text-xs text-slate-500">Live Batch Balances</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {purchaseLedger.map((item) => {
              const used = item.totalInward - item.currentBalance;
              const usedPct = Math.min(
                100,
                Math.max(0, (used / item.totalInward) * 100)
              ).toFixed(1);
              const stdColor =
                item.standard === 'GRS'
                  ? 'border-purple-200 bg-purple-50/60 text-purple-800'
                  : 'border-blue-200 bg-blue-50/60 text-blue-800';

              const barColor =
                parseFloat(usedPct) > 90
                  ? 'bg-rose-500'
                  : parseFloat(usedPct) > 50
                  ? 'bg-amber-500'
                  : 'bg-emerald-500';

              return (
                <div
                  key={item.tcNo}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-bold text-xs font-mono text-slate-800">
                        {item.tcNo}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${stdColor}`}
                      >
                        {item.standard}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {usedPct}% used
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2.5 overflow-hidden">
                    <div
                      className={`${barColor} h-1.5 rounded-full transition-all duration-500`}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-end text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Remaining</span>
                      <span className="font-bold text-slate-900">
                        {fmt(item.currentBalance)}
                      </span>{' '}
                      <span className="text-[10px] text-slate-400">Kg</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-sans">
                        Total Inward
                      </span>
                      <span className="text-slate-600 font-medium">
                        {fmt(item.totalInward)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Formula Guidance Banner */}
        <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 sm:p-4 flex items-center justify-between flex-wrap gap-2 text-xs text-emerald-900">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
              <CheckCheck className="w-4 h-4" />
            </div>
            <span>
              <strong>Excel Formula Active:</strong> Apni shudhu <strong>Output Qty (Kg)</strong> enter korben। System automatically calculate korbe: <code>Input = Output / {((100 - lossRate) / 100).toFixed(2)}</code>, <code>Loss ({lossRate.toFixed(0)}%) = Input * {lossRate.toFixed(0)}%</code>, ebong Purchase TC stock theke deduct hobe।
            </span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-800 bg-white border border-emerald-200 px-2 py-0.5 rounded shadow-2xs">
            RCS / GRS Certified
          </span>
        </div>

        {/* Main Mass Balance Ledger Table Container */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Search, Filters and Toolbar */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              {/* Text Search */}
              <div className="relative w-full sm:w-64">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Purchase TC, Sold TC, Lot..."
                  className="w-full text-xs sm:text-sm pl-9 pr-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Filter by Standard */}
              <select
                value={standardFilter}
                onChange={(e) => setStandardFilter(e.target.value as any)}
                className="text-xs sm:text-sm py-2 px-3 bg-white rounded-lg border border-slate-300 text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="ALL">All Standards</option>
                <option value="RCS">RCS Standard</option>
                <option value="GRS">GRS Standard</option>
              </select>

              {/* Filter by Specific Purchase TC */}
              <select
                value={purchaseTcFilter}
                onChange={(e) => setPurchaseTcFilter(e.target.value)}
                className="text-xs sm:text-sm py-2 px-3 bg-white rounded-lg border border-slate-300 text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              >
                <option value="ALL">All Purchase TCs</option>
                {purchaseLedger.map((p) => (
                  <option key={p.tcNo} value={p.tcNo}>
                    TC {p.tcNo} ({p.standard})
                  </option>
                ))}
              </select>

              {/* Filter by TC Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs sm:text-sm py-2 px-3 bg-white rounded-lg border border-slate-300 text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="ALL">All Outward Status</option>
                <option value="Certified">Sold TC Issued</option>
                <option value="Pending">Pending TC (Not Applied)</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 flex items-center justify-between md:justify-end gap-2 font-medium">
              <span>
                Showing <strong className="font-bold text-slate-800">{filteredLedger.length}</strong> entries
              </span>
            </div>
          </div>

          {/* Ledger Table (Exact Match with 14 Columns from Excel) */}
          <div className="overflow-x-auto min-h-[350px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 whitespace-nowrap">
                  <th className="py-3 px-3 text-center w-10">#</th>
                  <th className="py-3 px-3">Purchase TC No</th>
                  <th className="py-3 px-3">Standard</th>
                  <th className="py-3 px-3">Lot No</th>
                  <th className="py-3 px-3 text-right">Opening Stock (Kg)</th>
                  <th className="py-3 px-3 text-right text-emerald-900 bg-emerald-100/60 font-bold border-x border-emerald-200">
                    <span className="inline-flex items-center gap-1">
                      Output Qty (Kg){' '}
                      <span className="text-[9px] bg-emerald-300 text-emerald-950 px-1 rounded">
                        USER INPUT
                      </span>
                    </span>
                  </th>
                  <th className="py-3 px-3 text-right text-amber-800 bg-amber-50/50">
                    Input Used (Kg){' '}
                    <span className="text-[9px] text-amber-600 font-normal">[Auto]</span>
                  </th>
                  <th className="py-3 px-3 text-right text-rose-700">
                    Loss {lossRate.toFixed(0)}% (Kg){' '}
                    <span className="text-[9px] text-rose-500 font-normal">[Auto]</span>
                  </th>
                  <th className="py-3 px-3 text-right font-bold text-slate-900 bg-slate-50">
                    Remaining Stock (Kg)
                  </th>
                  <th className="py-3 px-3 text-right text-slate-800">Sold Qty (Kg)</th>
                  {/* The user's exact requested column */}
                  <th className="py-3 px-3 text-right bg-amber-50/80 text-amber-900 font-bold border-x border-amber-200">
                    Sold but not applied for TC yet (Kg)
                  </th>
                  <th className="py-3 px-3">Sold TC Number</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredLedger.map((row, idx) => {
                  const isPending = row.status === 'Pending' || !row.soldTc;
                  const stdClass =
                    row.standard === 'GRS'
                      ? 'bg-purple-100 text-purple-800 border-purple-200'
                      : 'bg-blue-100 text-blue-800 border-blue-200';

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 font-mono"
                    >
                      <td className="py-3 px-3 text-center text-slate-400 font-sans text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{row.purchaseTc}</td>
                      <td className="py-3 px-3 font-sans">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${stdClass}`}
                        >
                          {row.standard}
                        </span>
                      </td>
                      <td
                        className="py-3 px-3 text-slate-600 font-sans truncate max-w-[140px]"
                        title={row.lotNo}
                      >
                        {row.lotNo}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {fmt(row.openingQty)}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-950 font-bold bg-emerald-50/70 border-x border-emerald-100">
                        {fmt(row.outputQty)}
                      </td>
                      <td className="py-3 px-3 text-right text-amber-800 font-medium bg-amber-50/30">
                        {fmt(row.inputQty)}
                      </td>
                      <td className="py-3 px-3 text-right text-rose-600">{fmt(row.lossQty)}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 bg-slate-50/70">
                        {fmt(row.remainingStock)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-800">{fmt(row.soldQty)}</td>

                      {/* Exact requested column: Sold but not applied for TC yet */}
                      <td
                        className={`py-3 px-3 text-right font-bold border-x border-amber-100 ${
                          row.pendingSoldQty > 0
                            ? 'bg-amber-100/70 text-amber-900'
                            : 'bg-amber-50/20 text-slate-400'
                        }`}
                      >
                        {fmt(row.pendingSoldQty)}
                      </td>

                      <td className="py-3 px-3 font-sans">
                        {row.soldTc ? (
                          <span className="font-mono text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            {row.soldTc}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openAssignModal(row)}
                            className="inline-flex items-center space-x-1 text-[11px] text-amber-700 hover:text-amber-800 font-semibold bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-300 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Assign TC</span>
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center font-sans">
                        {isPending ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
                            Pending TC
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                            Certified
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center font-sans">
                        <button
                          type="button"
                          onClick={() => deleteLedgerRow(row.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                          title="Delete Row & Restore Stock"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {filteredLedger.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <PackageOpen className="w-12 h-12 mx-auto stroke-[1.5] mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">
                No mass balance transactions match your criteria.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Modal 1: Register New Purchase TC (Inward Stock)                          */}
      {/* ========================================================================= */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <FilePlus2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800">Add Inward Purchase TC</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPurchaseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePurchaseSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Purchase TC Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 04628981"
                  value={ptcNumber}
                  onChange={(e) => setPtcNumber(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Standard <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={ptcStandard}
                    onChange={(e) => setPtcStandard(e.target.value as any)}
                    required
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="RCS">RCS (Recycled Claim)</option>
                    <option value="GRS">GRS (Global Recycled)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lot / Batch No <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. STM/EXP/GER117/2025"
                    value={ptcLotNo}
                    onChange={(e) => setPtcLotNo(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Certified Purchase Net Weight (Kg) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="e.g. 70500.00"
                  value={ptcQuantity}
                  onChange={(e) => setPtcQuantity(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer"
                >
                  Save Purchase Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal 2: Output Entry (USER ONLY ENTERS OUTPUT QTY)                       */}
      {/* ========================================================================= */}
      {isOutputModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <PackageCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Record Production Output</h3>
                  <p className="text-[11px] text-slate-500">
                    Shudhu Output Qty enter korun &bull; System baki shob calculate korbe
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOutputModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleOutputSubmit} className="p-5 space-y-4">
              {/* 1. Select Source Purchase TC */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Purchase TC <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedSourceTc}
                  onChange={(e) => setSelectedSourceTc(e.target.value)}
                  required
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                >
                  {purchaseLedger.map((item) => (
                    <option key={item.tcNo} value={item.tcNo}>
                      TC {item.tcNo} ({item.standard}) &bull; Stock: {fmt(item.currentBalance)} Kg
                    </option>
                  ))}
                </select>
                <div className="flex justify-between items-center text-[11px] mt-1 font-mono">
                  <span className="text-slate-500">Available Stock:</span>
                  <span className="font-bold text-emerald-700">
                    {fmt(activeSourceTC?.currentBalance)} Kg
                  </span>
                </div>
              </div>

              {/* 2. Primary Required Field: Output Qty */}
              <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
                <label className="block text-xs font-bold text-emerald-950 mb-1">
                  Output Qty (Net weight in Kgs) <span className="text-rose-500">*</span>
                  <span className="text-[11px] font-normal text-emerald-700 ml-1">
                    (Shipped / Produced Finished Goods)
                  </span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="e.g. 898.66"
                  value={userOutputQty}
                  onChange={(e) => setUserOutputQty(e.target.value)}
                  className="w-full text-base font-bold py-2 px-3 rounded-lg border border-emerald-300 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-slate-900"
                />
              </div>

              {/* Live Calculation Feedback Box */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>Automated Formula Calculation</span>
                  <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                    Loss @ {lossRate.toFixed(1)}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-medium">
                      Input Used (Output / {((100 - lossRate) / 100).toFixed(2)})
                    </span>
                    <div className="text-sm font-bold text-amber-700 font-mono mt-0.5">
                      {fmt(liveCalc.inputQty)} Kg
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-medium">
                      Process Loss {lossRate.toFixed(0)}% (Input - Output)
                    </span>
                    <div className="text-sm font-bold text-rose-600 font-mono mt-0.5">
                      {fmt(liveCalc.lossQty)} Kg
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-medium">
                      Sold Qty (= Output)
                    </span>
                    <div className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                      {fmt(liveCalc.soldQty)} Kg
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-medium">
                      Remaining Raw Stock
                    </span>
                    <div className="text-sm font-bold text-emerald-700 font-mono mt-0.5">
                      {fmt(liveCalc.remainingStock)} Kg
                    </div>
                  </div>
                </div>

                {/* Over-Allocation Warning */}
                {liveCalc.isOverAllocated && (
                  <div className="text-rose-700 text-xs font-semibold bg-rose-50 border border-rose-200 p-2.5 rounded-lg flex items-center space-x-2">
                    <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      Insufficient Stock! Calculated input exceeds available purchase stock.
                    </span>
                  </div>
                )}
              </div>

              {/* 3. Sold TC Details & Pending Toggle */}
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Sold TC Number
                    </label>
                    <span className="text-[10px] text-amber-700 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Faka rakhle automatic "Pending TC"-te jabe
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. CUC-04754082 (Leave empty if not applied yet)"
                    value={userSoldTC}
                    onChange={(e) => setUserSoldTC(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Invoice / Delivery Lot Ref
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-091"
                    value={userLotRef}
                    onChange={(e) => setUserLotRef(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsOutputModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={liveCalc.isOverAllocated || liveCalc.outputQty <= 0}
                  className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-xs transition-colors cursor-pointer ${
                    liveCalc.isOverAllocated || liveCalc.outputQty <= 0
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  Save & Deduct Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Modal 3: Quick Assign / Update Sold TC Number                              */}
      {/* ========================================================================= */}
      {isAssignModalOpen && assigningRow && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2">
                <BadgeCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800">Assign Sold TC Number</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignTCSubmit} className="p-5 space-y-4">
              <div>
                <div className="text-xs text-slate-600 mb-2">
                  Output Qty:{' '}
                  <strong className="font-mono text-slate-900">
                    {fmt(assigningRow.outputQty)} Kg ({assigningRow.standard})
                  </strong>
                </div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Enter Issued Sold TC Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CUC-04754082"
                  value={assignSoldTcInput}
                  onChange={(e) => setAssignSoldTcInput(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  TC number assign korle "Sold but not applied" column-ti automatic{' '}
                  <strong>0</strong> hoye jabe ebong status <strong>Certified</strong> hobe।
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer"
                >
                  Update TC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Toast Notification                                                        */}
      {/* ========================================================================= */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 transform transition-all duration-300 px-4 py-3 rounded-xl shadow-xl flex items-center space-x-3 text-xs border ${
            toast.isError
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          {toast.isError ? (
            <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="font-medium">{toast.msg}</span>
        </div>
      )}
    </div>
  );
};
