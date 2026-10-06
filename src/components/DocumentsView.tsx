import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PIData } from '../types/tc';
import {
  getCommercialDocSync,
  saveCommercialDocSync,
  CommercialDocSyncData,
} from '../utils/commercialDocSync';
import {
  FileText,
  Printer,
  Download,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  RefreshCw,
  Layers,
  Building2,
  Calendar,
  Truck,
  Hash,
  ShoppingBag,
  FileCheck,
  Edit3,
  ChevronRight,
  Sparkles,
  PackageCheck,
  MapPin,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface ChallanItem {
  id: string;
  slNo: number;
  styleNo: string;
  modelProduct: string;
  width: string | number;
  length: string | number;
  gusset: string | number;
  flap: string | number;
  orderQty: number;
  deliveryQty: number;
  pktBox: string | number;
  balanceQty: string | number;
}

interface DocumentsViewProps {
  data: PIData[];
  onSelectPI?: (pi: PIData) => void;
}

// Helper to check and filter out any service/cost/charge lines (TC Cost, Transportation Cost, Documentation Charge, etc.)
function isNonProductChargeLine(val1: any, val2?: any, allText?: string): boolean {
  const combined = `${String(val1 || '')} ${String(val2 || '')} ${String(allText || '')}`.toLowerCase();
  const s = combined.replace(/[^a-z0-9]/g, '');
  if (!s) return false;

  const targets = [
    'transportationcost',
    'transportationcharge',
    'transportcost',
    'transportcharge',
    'freightcost',
    'freightcharge',
    'carriagecost',
    'carriagecharge',
    'documentationcharge',
    'documentationcost',
    'documentationfee',
    'doccharge',
    'doccost',
    'docfee',
    'documentcharge',
    'documentcost',
    'documentfee',
    'transactioncertificatecost',
    'transactioncertificatecharge',
    'transactioncertificate',
    'tccost',
    'tccharge',
    'tcfee',
    'samplecharge',
    'samplecost',
    'developmentcharge',
    'developmentcost',
    'handlingcharge',
    'handlingfee',
    'couriercharge',
    'couriercost',
    'postagecharge',
    'bankcharge',
    'inspectioncharge',
    'testingcharge',
  ];

  if (targets.some((t) => s.includes(t))) {
    return true;
  }

  if (
    (s.includes('transportation') && (s.includes('cost') || s.includes('charge') || s.includes('fee'))) ||
    (s.includes('transport') && (s.includes('cost') || s.includes('charge') || s.includes('fee'))) ||
    (s.includes('documentation') && (s.includes('cost') || s.includes('charge') || s.includes('fee'))) ||
    (s.includes('document') && (s.includes('charge') || s.includes('cost') || s.includes('fee'))) ||
    (s.includes('transaction') && s.includes('certificate')) ||
    (s.includes('freight') && (s.includes('cost') || s.includes('charge') || s.includes('fee')))
  ) {
    return true;
  }

  return false;
}

function extractProductItemsFromPis(pis: PIData[]): ChallanItem[] {
  const result: ChallanItem[] = [];

  // Try reading global raw table from localStorage if available
  let rawTableMap: Record<string, any[]> = {};
  if (typeof localStorage !== 'undefined') {
    try {
      const savedRaw = localStorage.getItem('mainetti_raw_product_items_table');
      if (savedRaw) {
        const parsed: any[] = JSON.parse(savedRaw);
        parsed.forEach((it) => {
          if (it.piNumber) {
            const k = it.piNumber.trim().toUpperCase();
            if (!rawTableMap[k]) rawTableMap[k] = [];
            rawTableMap[k].push(it);
          }
        });
      }
    } catch {
      // fallback to in-memory items
    }
  }

  const syncData = getCommercialDocSync();

  pis.forEach((p) => {
    const normPi = p.piNumber ? p.piNumber.trim().toUpperCase() : '';
    const itemsFromTable = (rawTableMap[normPi] && rawTableMap[normPi].length > 0)
      ? rawTableMap[normPi]
      : (p.productItems && p.productItems.length > 0 ? p.productItems : null);

    // 1. If detailed items exist in the raw table, use ALL items directly!
    if (itemsFromTable && itemsFromTable.length > 0) {
      itemsFromTable.forEach((it) => {
        // STRICT USER RULE: Exclude all service charge lines (Transportation Cost, Documentation Charge, TC Cost, etc.)
        if (
          isNonProductChargeLine(it.modelProduct) ||
          isNonProductChargeLine(it.styleNo)
        ) {
          return;
        }
        const oQty = Number(it.orderQty) || 0;
        // STRICT USER RULE: If order quantity is 1 or less, remove this line completely!
        if (oQty <= 1) {
          return;
        }

        const sl = result.length + 1;
        let resolvedPktBox: string | number = it.pktBox !== undefined && it.pktBox !== '' && it.pktBox !== '-' ? it.pktBox : '-';

        // Check if Packing List / Commercial Doc Reader has specific packet counts
        if (resolvedPktBox === '-' && syncData?.pktBoxByStyleOrSl) {
          const styleKey = (it.styleNo || '').trim().toUpperCase();
          const modelKey = (it.modelProduct || '').trim().toUpperCase();
          if (syncData.pktBoxByStyleOrSl[styleKey] !== undefined) {
            resolvedPktBox = syncData.pktBoxByStyleOrSl[styleKey];
          } else if (syncData.pktBoxByStyleOrSl[modelKey] !== undefined) {
            resolvedPktBox = syncData.pktBoxByStyleOrSl[modelKey];
          } else if (syncData.pktBoxByStyleOrSl[`SL_${sl}`] !== undefined) {
            resolvedPktBox = syncData.pktBoxByStyleOrSl[`SL_${sl}`];
          }
        }

        result.push({
          id: `item-${p.id}-${it.id || sl}`,
          slNo: sl,
          styleNo: it.styleNo || (p.poReference ? `PO ${p.poReference}` : '-'),
          modelProduct: it.modelProduct || p.productDescription || 'POLYBAGS',
          width: it.width !== undefined && it.width !== '' ? it.width : '-',
          length: it.length !== undefined && it.length !== '' ? it.length : '-',
          gusset: it.gusset !== undefined && it.gusset !== '' ? it.gusset : '-',
          flap: it.flap !== undefined && it.flap !== '' ? it.flap : '-',
          orderQty: oQty,
          deliveryQty: it.deliveryQty || p.deliveryQuantity || oQty,
          pktBox: resolvedPktBox,
          balanceQty: it.balanceQty !== undefined && it.balanceQty !== '' ? it.balanceQty : '-',
        });
      });
    } else {
      // 2. Otherwise generate clean product row for this PI
      const orderQ = p.orderQuantity ?? p.quantityPcs ?? 0;
      if (orderQ <= 1) {
        return; // Skip if order qty is 1 or less
      }
      const cleanDesc = isNonProductChargeLine(p.productDescription)
        ? 'POLYBAGS'
        : (p.productDescription || 'POLYBAGS');

      const delivQ = p.deliveryQuantity && p.deliveryQuantity > 0 ? p.deliveryQuantity : orderQ;
      const bal = Math.max(0, orderQ - delivQ);
      const sl = result.length + 1;

      const styleRef = p.poReference
        ? `PO ${p.poReference}`
        : `Style ${sl}`;

      let resolvedPktBox: string | number = '-';
      if (syncData?.pktBoxByStyleOrSl && syncData.pktBoxByStyleOrSl[`SL_${sl}`] !== undefined) {
        resolvedPktBox = syncData.pktBoxByStyleOrSl[`SL_${sl}`];
      }

      result.push({
        id: `item-${p.id}-${sl}`,
        slNo: sl,
        styleNo: styleRef,
        modelProduct: cleanDesc,
        width: '-',
        length: '-',
        gusset: '-',
        flap: '-',
        orderQty: orderQ,
        deliveryQty: delivQ,
        pktBox: resolvedPktBox,
        balanceQty: bal === 0 ? '-' : bal,
      });
    }
  });

  return result;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({ data }) => {
  // Document Type: 'gate_pass' | 'declaration'
  const [docType, setDocType] = useState<'gate_pass' | 'declaration'>('gate_pass');

  // Multi-PI Selection State
  const [selectedPiIds, setSelectedPiIds] = useState<string[]>(() => {
    // Default select first 1-3 PIs if available
    return data.slice(0, 3).map((p) => p.id);
  });

  const [searchFilter, setSearchFilter] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('All');
  const [customerFilter, setCustomerFilter] = useState('All');

  // Printable Reference
  const printRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Available buyers & customers
  const buyersList = useMemo(() => {
    const set = new Set<string>();
    data.forEach((p) => {
      if (p.buyer) set.add(p.buyer);
    });
    return ['All', ...Array.from(set).sort()];
  }, [data]);

  const customersList = useMemo(() => {
    const set = new Set<string>();
    data.forEach((p) => {
      if (p.customer) set.add(p.customer);
    });
    return ['All', ...Array.from(set).sort()];
  }, [data]);

  // Filtered PI selection dataset
  const filteredPis = useMemo(() => {
    return data.filter((p) => {
      if (buyerFilter !== 'All' && p.buyer !== buyerFilter) return false;
      if (customerFilter !== 'All' && p.customer !== customerFilter) return false;
      if (searchFilter.trim()) {
        const query = searchFilter.toLowerCase();
        const matchPi = p.piNumber?.toLowerCase().includes(query);
        const matchBuyer = p.buyer?.toLowerCase().includes(query);
        const matchCustomer = p.customer?.toLowerCase().includes(query);
        const matchInv = p.invoiceNumber?.toLowerCase().includes(query);
        if (!matchPi && !matchBuyer && !matchCustomer && !matchInv) return false;
      }
      return true;
    });
  }, [data, buyerFilter, customerFilter, searchFilter]);

  // Default formatted date (e.g., 28-Sep-26)
  const defaultDateStr = useMemo(() => {
    const d = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
  }, []);

  // Selected PIs objects
  const selectedPis = useMemo(() => {
    return data.filter((p) => selectedPiIds.includes(p.id));
  }, [data, selectedPiIds]);

  // Header State
  const [deliveryDate, setDeliveryDate] = useState(defaultDateStr);
  const [challanNumber, setChallanNumber] = useState('10367');
  const [retailer, setRetailer] = useState('PRIMARK');
  const [productCategory, setProductCategory] = useState('POLYBAGS');
  const [noOfDelivery, setNoOfDelivery] = useState('D-01');
  const [deliveryVanNo, setDeliveryVanNo] = useState('');
  
  // Addresses State
  const [invoiceToCompany, setInvoiceToCompany] = useState<string>(() => {
    const sync = getCommercialDocSync();
    return sync?.invoiceToCompany || 'LIDA TEXTILE AND DYEING LIMITED';
  });
  const [invoiceToAddress, setInvoiceToAddress] = useState<string>(() => {
    const sync = getCommercialDocSync();
    return sync?.invoiceToAddress || 'HOLDING-100/2, BLOCK-B, EAST CHANDORA, WARD-8, SOFIPUR, KALIAKOIR, BD-CGAZIPUR 1751, BANGLADESH';
  });
  const [deliverToCompany, setDeliverToCompany] = useState<string>(() => {
    const sync = getCommercialDocSync();
    return sync?.deliverToCompany || 'LIDA TEXTILE AND DYEING LIMITED';
  });
  const [deliverToAddress, setDeliverToAddress] = useState<string>(() => {
    const sync = getCommercialDocSync();
    return sync?.deliverToAddress || 'HOLDING-100/2, BLOCK-B, EAST CHANDORA, WARD-8, SOFIPUR, KALIAKOIR, BD-CGAZIPUR 1751, BANGLADESH';
  });

  // Line items state
  const [items, setItems] = useState<ChallanItem[]>([]);

  // Auto-sync form and products whenever selected PIs change
  const populateFromSelectedPis = () => {
    if (selectedPis.length === 0) {
      setItems([]);
      return;
    }

    const first = selectedPis[0];
    if (first.buyer) setRetailer(first.buyer.toUpperCase());

    // Auto-pull PI-wise Last Delivery Challan Number from Delivery Report
    if (first.lastChallanNumber) {
      setChallanNumber(first.lastChallanNumber);
    }
    if (first.lastDeliveryDate) {
      setDeliveryDate(first.lastDeliveryDate);
    }
    if (first.deliveryCount) {
      setNoOfDelivery(`D-0${first.deliveryCount}`);
    }

    const sync = getCommercialDocSync();
    if (sync?.invoiceToCompany) {
      setInvoiceToCompany(sync.invoiceToCompany);
      setInvoiceToAddress(sync.invoiceToAddress || invoiceToAddress);
      setDeliverToCompany(sync.deliverToCompany || sync.invoiceToCompany);
      setDeliverToAddress(sync.deliverToAddress || sync.invoiceToAddress || deliverToAddress);
    } else if (first.customer) {
      setInvoiceToCompany(first.customer.toUpperCase());
      setDeliverToCompany(first.customer.toUpperCase());
    }

    // Extract all products from the selected PIs (skipping TC Cost)
    const newItems = extractProductItemsFromPis(selectedPis);
    setItems(newItems);
  };

  const handleManualSyncCommercialDoc = () => {
    const sync = getCommercialDocSync();
    if (sync) {
      if (sync.invoiceToCompany) setInvoiceToCompany(sync.invoiceToCompany);
      if (sync.invoiceToAddress) setInvoiceToAddress(sync.invoiceToAddress);
      if (sync.deliverToCompany) setDeliverToCompany(sync.deliverToCompany);
      if (sync.deliverToAddress) setDeliverToAddress(sync.deliverToAddress);
      const newItems = extractProductItemsFromPis(selectedPis);
      setItems(newItems);
    }
  };

  // Automatically update items whenever user checks/unchecks PIs
  React.useEffect(() => {
    populateFromSelectedPis();
  }, [selectedPiIds, data]);

  // Combined PI Numbers text string
  const combinedPiNumberString = useMemo(() => {
    if (selectedPis.length === 0) return 'MPBL/05007/2026';
    if (selectedPis.length === 1) return selectedPis[0].piNumber;
    return selectedPis.map((p) => p.piNumber).join(', ');
  }, [selectedPis]);

  // Toggle selection
  const handleTogglePi = (id: string) => {
    setSelectedPiIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredPis.map((p) => p.id);
    const isAllSelected = allFilteredIds.every((id) => selectedPiIds.includes(id));
    if (isAllSelected) {
      setSelectedPiIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedPiIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  // Item modifications
  const handleUpdateItem = (index: number, field: keyof ChallanItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddItem = () => {
    const nextSl = items.length + 1;
    const newItem: ChallanItem = {
      id: `custom-${Date.now()}`,
      slNo: nextSl,
      styleNo: 'PO 1258733, WO# WO-0109490 (New Item)',
      modelProduct: `PCKE1201${nextSl}A`,
      width: 180,
      length: 220,
      gusset: 0,
      flap: 23,
      orderQty: 5000,
      deliveryQty: 5000,
      pktBox: '-',
      balanceQty: '-',
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleDeleteItem = (index: number) => {
    setItems((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((it, idx) => ({ ...it, slNo: idx + 1 }));
    });
  };

  // Calculations
  const totalOrderQty = items.reduce((sum, it) => sum + (Number(it.orderQty) || 0), 0);
  const totalDeliveryQty = items.reduce((sum, it) => sum + (Number(it.deliveryQty) || 0), 0);
  const totalPktBoxes = items.reduce((sum, it) => {
    const num = Number(it.pktBox);
    return !isNaN(num) ? sum + num : sum;
  }, 0);

  // Print Action
  const handleDirectPrint = () => {
    window.print();
  };

  // Download PDF using html2canvas & jsPDF
  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    try {
      setIsExportingPdf(true);
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Gate_Pass_Challan_${challanNumber || 'Mainetti'}_${deliveryDate}.pdf`);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Could not export PDF. Please use the Print button to Save as PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Pad to 18 rows for pristine paper alignment
  const targetRowCount = 18;
  const paddedEmptyRowsCount = Math.max(0, targetRowCount - items.length);

  return (
    <div className="space-y-3">
      {/* Top Header Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-sm shadow-xs p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="bg-[#0b1b3d] text-white p-2 rounded-sm">
            <FileText className="w-5 h-5 text-blue-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 font-mono tracking-tight uppercase">
                Document Generation Studio
              </h2>
              <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-xs font-semibold">
                Multi-PI Combine
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Combine up to 10+ PIs into a unified Delivery Challan / Gate Pass & Supplier TC Declaration
            </p>
          </div>
        </div>

        {/* Doc Type Selector & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-slate-100 p-0.5 rounded-sm border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setDocType('gate_pass')}
              className={`px-3 py-1.5 font-medium rounded-xs transition-colors cursor-pointer ${
                docType === 'gate_pass'
                  ? 'bg-white text-blue-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🚚 Delivery Challan / Gate Pass
            </button>
            <button
              type="button"
              onClick={() => setDocType('declaration')}
              className={`px-3 py-1.5 font-medium rounded-xs transition-colors cursor-pointer ${
                docType === 'declaration'
                  ? 'bg-white text-blue-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📜 Supplier TC Declaration
            </button>
          </div>

          <button
            type="button"
            onClick={handleDirectPrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-sm shadow-2xs transition-colors cursor-pointer"
            title="Print document or Save as PDF"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print / Print to PDF</span>
          </button>

          <button
            type="button"
            disabled={isExportingPdf}
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1e3a8a] hover:bg-[#172554] rounded-sm shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-blue-200" />
            <span>{isExportingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Left Side Controls & Multi-PI Picker | Right Side Live A4 Sheet Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start">
        {/* Left Side: Multi-PI Selector & Challan Details Form (5 Columns) */}
        <div className="xl:col-span-4 space-y-3">
          {/* Box 1: Multi-PI Combine Selector */}
          <div className="bg-white border border-slate-200 rounded-sm shadow-xs">
            <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-700" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  1. Select PIs to Combine ({selectedPiIds.length})
                </span>
              </div>
              <button
                type="button"
                onClick={populateFromSelectedPis}
                className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-xs border border-blue-200 cursor-pointer"
                title="Populate products and quantities from selected PIs"
              >
                <Sparkles className="w-3 h-3 text-blue-600" />
                <span>Auto-Fill Form</span>
              </button>
            </div>

            <div className="p-2.5 space-y-2">
              {/* TC Cost exclusion assurance badge */}
              <div className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-xs font-medium flex items-center justify-between">
                <span className="flex items-center gap-1 font-semibold">
                  <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                  All Products Auto-Loaded
                </span>
                <span className="text-[9px] bg-emerald-200/60 text-emerald-900 px-1 py-0.5 rounded-xs font-mono">
                  TC Cost Excluded
                </span>
              </div>

              {/* Filter controls */}
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div>
                  <label className="text-[10px] font-medium text-slate-500 uppercase block mb-0.5">
                    Buyer
                  </label>
                  <select
                    value={buyerFilter}
                    onChange={(e) => setBuyerFilter(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xs px-1.5 py-1"
                  >
                    {buyersList.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-500 uppercase block mb-0.5">
                    Customer
                  </label>
                  <select
                    value={customerFilter}
                    onChange={(e) => setCustomerFilter(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xs px-1.5 py-1"
                  >
                    {customersList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Keyword Search */}
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search PI #, PO, Buyer..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xs px-2 py-1"
              />

              {/* Select All Toggle Bar */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 text-slate-600">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="flex items-center gap-1 hover:text-slate-900 cursor-pointer text-[11px] font-medium"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                  <span>Select All ({filteredPis.length})</span>
                </button>
                <span className="text-[11px] text-slate-400 font-mono">
                  {selectedPiIds.length} Selected
                </span>
              </div>

              {/* Scrollable PI Checkbox List */}
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 border border-slate-100 rounded-xs p-1 bg-slate-50/50">
                {filteredPis.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400">
                    No PIs found matching filters.
                  </div>
                ) : (
                  filteredPis.map((p) => {
                    const isChecked = selectedPiIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleTogglePi(p.id)}
                        className={`flex items-center justify-between p-1.5 text-xs rounded-xs border transition-colors cursor-pointer ${
                          isChecked
                            ? 'bg-blue-50/80 border-blue-300 text-blue-950 font-medium'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isChecked ? (
                            <CheckSquare className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          <div className="truncate">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-mono font-bold text-slate-900">
                                {p.piNumber}
                              </span>
                              {p.lastChallanNumber && (
                                <span className="text-[9px] font-mono bg-emerald-100 text-emerald-900 px-1 rounded-xs font-semibold">
                                  #{p.lastChallanNumber}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500">
                              · {p.buyer} ({p.customer})
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-slate-600 ml-1 shrink-0">
                          {(p.orderQuantity ?? p.quantityPcs ?? 0).toLocaleString()} pcs
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Box 2: Challan Header Details */}
          <div className="bg-white border border-slate-200 rounded-sm shadow-xs p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                2. Challan & Vehicle Info
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Editable</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase block mb-0.5">
                  Delivery Date
                </label>
                <input
                  type="text"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xs px-2 py-1 font-semibold text-slate-800"
                  placeholder="e.g. 23-Aug-26"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase block mb-0.5">
                  Challan Number
                </label>
                <input
                  type="text"
                  value={challanNumber}
                  onChange={(e) => setChallanNumber(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xs px-2 py-1 font-semibold text-blue-900"
                  placeholder="e.g. 10367"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase block mb-0.5">
                  Retailer / Buyer
                </label>
                <input
                  type="text"
                  value={retailer}
                  onChange={(e) => setRetailer(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xs px-2 py-1 font-bold text-slate-800"
                  placeholder="e.g. PRIMARK"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase block mb-0.5">
                  Products Type
                </label>
                <input
                  type="text"
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xs px-2 py-1 font-bold text-slate-800"
                  placeholder="e.g. POLYBAGS"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase block mb-0.5">
                  No of Delivery
                </label>
                <input
                  type="text"
                  value={noOfDelivery}
                  onChange={(e) => setNoOfDelivery(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xs px-2 py-1 font-mono text-slate-800"
                  placeholder="e.g. D-01"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase block mb-0.5">
                  Delivery Van No
                </label>
                <input
                  type="text"
                  value={deliveryVanNo}
                  onChange={(e) => setDeliveryVanNo(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xs px-2 py-1 font-mono text-slate-800"
                  placeholder="e.g. DM-TA-11-2345"
                />
              </div>
            </div>

            {/* Address Edit Inputs */}
            <div className="space-y-1.5 pt-1 border-t border-slate-100 text-xs">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[10px] font-bold text-slate-700 uppercase flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-blue-600" />
                  Address & Packing List
                </span>
                <button
                  type="button"
                  onClick={handleManualSyncCommercialDoc}
                  className="flex items-center gap-1 text-[10px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded-xs border border-blue-200 cursor-pointer"
                  title="Pull latest Address and Packing List packets from Commercial Doc Reader"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>Sync Commercial Doc</span>
                </button>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase block mb-0.5">
                  Invoice To Company Name
                </label>
                <input
                  type="text"
                  value={invoiceToCompany}
                  onChange={(e) => setInvoiceToCompany(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xs px-2 py-1 font-semibold text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase block mb-0.5">
                  Invoice Address
                </label>
                <textarea
                  rows={2}
                  value={invoiceToAddress}
                  onChange={(e) => setInvoiceToAddress(e.target.value)}
                  className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-xs px-2 py-1 text-slate-700"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] font-semibold text-slate-600 uppercase">
                  Deliver To Address
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDeliverToCompany(invoiceToCompany);
                    setDeliverToAddress(invoiceToAddress);
                  }}
                  className="text-[10px] text-blue-700 hover:underline cursor-pointer"
                >
                  Copy from Invoice To
                </button>
              </div>
              <input
                type="text"
                value={deliverToCompany}
                onChange={(e) => setDeliverToCompany(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xs px-2 py-1 font-semibold text-slate-800"
              />
              <textarea
                rows={2}
                value={deliverToAddress}
                onChange={(e) => setDeliverToAddress(e.target.value)}
                className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-xs px-2 py-1 text-slate-700"
              />
            </div>
          </div>

          {/* Box 3: Line Items Quick Actions */}
          <div className="bg-white border border-slate-200 rounded-sm shadow-xs p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                3. Table Items ({items.length})
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 px-2 py-1 rounded-xs border border-blue-200 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Row</span>
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-1.5 bg-slate-50 border border-slate-200 rounded-xs text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">#{item.slNo}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(idx)}
                      className="text-red-500 hover:text-red-700 p-0.5 cursor-pointer"
                      title="Delete row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={item.styleNo}
                    onChange={(e) => handleUpdateItem(idx, 'styleNo', e.target.value)}
                    placeholder="Style No / PO Reference"
                    className="w-full text-[11px] bg-white border border-slate-200 rounded-xs px-1.5 py-0.5 text-slate-800 font-mono"
                  />
                  <div className="grid grid-cols-3 gap-1">
                    <input
                      type="text"
                      value={item.modelProduct}
                      onChange={(e) => handleUpdateItem(idx, 'modelProduct', e.target.value)}
                      placeholder="Model/Product"
                      className="text-[11px] bg-white border border-slate-200 rounded-xs px-1 py-0.5 text-slate-800 font-mono"
                    />
                    <input
                      type="number"
                      value={item.orderQty}
                      onChange={(e) => handleUpdateItem(idx, 'orderQty', Number(e.target.value))}
                      placeholder="Order Qty"
                      className="text-[11px] bg-white border border-slate-200 rounded-xs px-1 py-0.5 text-slate-800 font-mono text-right"
                    />
                    <input
                      type="number"
                      value={item.deliveryQty}
                      onChange={(e) => handleUpdateItem(idx, 'deliveryQty', Number(e.target.value))}
                      placeholder="Delivery Qty"
                      className="text-[11px] bg-white border border-slate-200 rounded-xs px-1 py-0.5 text-slate-800 font-mono text-right font-bold"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: High-Resolution A4 Sheet Preview (8 Columns) */}
        <div className="xl:col-span-8 flex flex-col items-center">
          <div className="w-full flex items-center justify-between px-2 py-1 text-xs text-slate-500 mb-1">
            <span>A4 Document Preview (100% Vector Print Scale)</span>
            <span className="font-mono text-[11px]">
              Challan #{challanNumber} · Total Qty: {totalDeliveryQty.toLocaleString()} pcs
            </span>
          </div>

          {/* Printable Container */}
          <div className="w-full overflow-x-auto bg-slate-300 p-2 sm:p-4 rounded-sm shadow-inner flex justify-center">
            {docType === 'gate_pass' ? (
              /* DELIVERY CHALLAN / GATE PASS A4 SHEET */
              <div
                ref={printRef}
                id="printable-challan-sheet"
                className="bg-white text-black w-[210mm] min-h-[297mm] p-[10mm] shadow-xl border border-slate-300 flex flex-col justify-between text-[11px] font-sans leading-tight select-text"
                style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
              >
                {/* 1. Header Section */}
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    {/* Left: Mainetti Logo & Company Address */}
                    <div className="w-[55%]">
                      <div className="flex items-center gap-2">
                        {/* Red Mainetti Logo M Icon */}
                        <div className="w-7 h-7 bg-[#b91c1c] text-white flex items-center justify-center font-bold text-lg rounded-xs">
                          M
                        </div>
                        <div>
                          <div className="text-xl font-black tracking-widest text-[#b91c1c] font-serif uppercase">
                            MAINETTI
                          </div>
                          <div className="text-[8px] text-slate-600 tracking-wider font-semibold uppercase -mt-1">
                            Retail Solutions Worldwide
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 text-[9px] text-black font-semibold uppercase leading-snug space-y-0.5">
                        <div className="font-bold">MAINETTI PACKAGING BANGLADESH PVT LTD</div>
                        <div>VATARKHOLA, NAOGAON BAZAR-1800 DHAMRAI, DHAKA-1350</div>
                        <div>BANGLADESH</div>
                        <div>+8802-8419621</div>
                        <div>PACKAGING.BANGLADESH@MAINETTI.COM</div>
                        <div>WWW.MAINETTI.COM</div>
                      </div>
                    </div>

                    {/* Right: Challan Header Details Table */}
                    <div className="w-[43%]">
                      <div className="text-right font-bold text-sm text-black uppercase tracking-tight mb-1.5">
                        DELIVERY CHALLAN/GATE PASS
                      </div>

                      <div className="border-t border-black text-[9.5px]">
                        <div className="flex justify-between py-0.5 border-b border-black">
                          <span className="font-bold uppercase">DELIVERY DATE</span>
                          <span className="font-semibold">{deliveryDate}</span>
                        </div>
                        <div className="flex justify-between py-0.5 border-b border-black">
                          <span className="font-bold uppercase">PI-NUMBER</span>
                          <span className="font-semibold font-mono text-[9px] text-right truncate max-w-[140px]">
                            {combinedPiNumberString}
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5 border-b border-black">
                          <span className="font-bold uppercase">CHALLAN NUMBER</span>
                          <span className="font-bold font-mono">{challanNumber}</span>
                        </div>
                        <div className="flex justify-between py-0.5 border-b border-black">
                          <span className="font-bold uppercase">RETAILER</span>
                          <span className="font-bold">{retailer}</span>
                        </div>
                        <div className="flex justify-between py-0.5 border-b border-black">
                          <span className="font-bold uppercase">PRODUCTS</span>
                          <span className="font-bold">{productCategory}</span>
                        </div>
                        <div className="flex justify-between py-0.5 border-b border-black">
                          <span className="font-bold uppercase">NO OF DELIVERY</span>
                          <span className="font-semibold">{noOfDelivery}</span>
                        </div>
                        <div className="flex justify-between py-0.5 border-b border-black">
                          <span className="font-bold uppercase">DELIVERY VAN NO</span>
                          <span className="font-semibold font-mono">{deliveryVanNo || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Address Boxes (Invoice To & Deliver To) */}
                  <div className="grid grid-cols-2 border border-black text-[9.5px]">
                    {/* Invoice To */}
                    <div className="border-r border-black p-1.5 flex flex-col justify-between min-h-[55px]">
                      <div className="font-bold uppercase mb-0.5">
                        INVOICE TO (COMPANY NAME & ADDRESS)
                      </div>
                      <div className="font-bold uppercase text-[9px]">{invoiceToCompany}</div>
                      <div className="text-[8.5px] uppercase text-slate-800 leading-tight">
                        {invoiceToAddress}
                      </div>
                    </div>

                    {/* Deliver To */}
                    <div className="p-1.5 flex flex-col justify-between min-h-[55px]">
                      <div className="font-bold uppercase mb-0.5">
                        DELIVER TO (COMPANY NAME & ADDRESS)
                      </div>
                      <div className="font-bold uppercase text-[9px]">{deliverToCompany}</div>
                      <div className="text-[8.5px] uppercase text-slate-800 leading-tight">
                        {deliverToAddress}
                      </div>
                    </div>
                  </div>

                  {/* 3. Line Items Table */}
                  <table className="w-full border-collapse border border-black text-[8.5px]">
                    <thead>
                      <tr className="bg-[#fcd9be] text-black font-bold uppercase text-center border-b border-black">
                        <th className="border border-black p-1 w-6" rowSpan={2}>
                          SL NO
                        </th>
                        <th className="border border-black p-1 w-44" rowSpan={2}>
                          STYLE NO
                        </th>
                        <th className="border border-black p-1 w-28" rowSpan={2}>
                          MODEL/PRODUCT
                        </th>
                        <th className="border border-black p-0.5" colSpan={4}>
                          MEASUREMENT <span className="text-[7.5px] font-normal">(MM)</span>
                        </th>
                        <th className="border border-black p-1 w-16" rowSpan={2}>
                          ORDER QTY
                        </th>
                        <th className="border border-black p-1 w-16" rowSpan={2}>
                          DELIVERY QTY
                        </th>
                        <th className="border border-black p-1 w-12" rowSpan={2}>
                          PKT/BOX
                        </th>
                        <th className="border border-black p-1 w-16" rowSpan={2}>
                          BALANCE QTY
                        </th>
                      </tr>
                      <tr className="bg-[#fcd9be] text-black font-bold text-center border-b border-black text-[7.5px]">
                        <th className="border border-black p-0.5 w-8">WIDTH</th>
                        <th className="border border-black p-0.5 w-8">LENGTH</th>
                        <th className="border border-black p-0.5 w-8">GUSSET</th>
                        <th className="border border-black p-0.5 w-8">FLAP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Active line items */}
                      {items.map((item) => (
                        <tr key={item.id} className="border-b border-black text-center h-[18px]">
                          <td className="border border-black font-bold">{item.slNo}</td>
                          <td className="border border-black text-left px-1 font-semibold text-[8px] truncate max-w-[170px]">
                            {item.styleNo}
                          </td>
                          <td className="border border-black text-left px-1 font-mono text-[8px] truncate max-w-[110px]">
                            {item.modelProduct}
                          </td>
                          <td className="border border-black font-mono">{item.width}</td>
                          <td className="border border-black font-mono">{item.length}</td>
                          <td className="border border-black font-mono">{item.gusset}</td>
                          <td className="border border-black font-mono">{item.flap}</td>
                          <td className="border border-black text-right px-1 font-mono">
                            {Number(item.orderQty).toLocaleString()}
                          </td>
                          <td className="border border-black text-right px-1 font-mono font-bold">
                            {Number(item.deliveryQty).toLocaleString()}
                          </td>
                          <td className="border border-black font-mono">{item.pktBox}</td>
                          <td className="border border-black font-mono">{item.balanceQty}</td>
                        </tr>
                      ))}

                      {/* Empty padding rows to match real paper 18-row format */}
                      {Array.from({ length: paddedEmptyRowsCount }).map((_, i) => (
                        <tr
                          key={`empty-${i}`}
                          className="border-b border-black text-center h-[18px]"
                        >
                          <td className="border border-black font-bold text-slate-400">
                            {items.length + i + 1}
                          </td>
                          <td className="border border-black">&nbsp;</td>
                          <td className="border border-black">&nbsp;</td>
                          <td className="border border-black">&nbsp;</td>
                          <td className="border border-black">&nbsp;</td>
                          <td className="border border-black">&nbsp;</td>
                          <td className="border border-black">&nbsp;</td>
                          <td className="border border-black text-center text-slate-300">-</td>
                          <td className="border border-black text-center text-slate-300">-</td>
                          <td className="border border-black text-center text-slate-300">-</td>
                          <td className="border border-black text-center text-slate-300">-</td>
                        </tr>
                      ))}

                      {/* TOTAL ROW */}
                      <tr className="bg-[#fcd9be] font-bold text-black border-t-2 border-black text-center h-[20px]">
                        <td colSpan={7} className="border border-black text-center uppercase tracking-widest font-black text-[9px]">
                          TOTAL
                        </td>
                        <td className="border border-black text-right px-1 font-mono font-black text-[9px]">
                          {totalOrderQty.toLocaleString()}
                        </td>
                        <td className="border border-black text-right px-1 font-mono font-black text-[9px]">
                          {totalDeliveryQty.toLocaleString()}
                        </td>
                        <td className="border border-black font-mono font-black text-[9px]">
                          {totalPktBoxes > 0 ? totalPktBoxes : '69'}
                        </td>
                        <td className="border border-black font-mono font-bold text-[9px]">
                          -
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 4. Footer & Signature Section */}
                <div className="pt-2 space-y-6">
                  <div className="text-[8px] text-black leading-tight">
                    <span className="font-bold">Please Note: </span>
                    Delivery challan has to sign back (sign & company chop seal) once goods delivered based on packet qty written on challan
                  </div>

                  <div className="flex justify-between items-end pt-4">
                    {/* Consignee Signature Box */}
                    <div className="w-[45%] text-center">
                      <div className="border-t-2 border-black pt-1 font-bold text-[9px] uppercase">
                        For consignee ( Sign, Company Chop Seal )
                      </div>
                    </div>

                    {/* Authorized Signature & Certification */}
                    <div className="w-[50%] text-center relative">
                      <div className="text-[8.5px] italic text-slate-800 mb-1">
                        We certify that the goods stated above have been in good condition
                      </div>

                      {/* Stamp & Signature Decorative Artwork */}
                      <div className="my-1 flex flex-col items-center justify-center relative">
                        <div className="text-blue-700 font-bold text-[10px] tracking-wide uppercase opacity-75">
                          Mainetti Packaging Bangladesh Pvt. Ltd.
                        </div>
                        {/* Realistic Pen Signature Line */}
                        <svg className="w-32 h-9 text-slate-800 -my-2" viewBox="0 0 150 40">
                          <path
                            d="M 10 30 Q 30 5 50 25 T 80 15 Q 110 35 135 10 Q 140 25 145 28"
                            fill="none"
                            stroke="#1e3a8a"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>

                      <div className="border-t-2 border-black pt-1 font-bold text-[9px] uppercase">
                        Authorised signature (Mainetti Packaging Bangladesh Pvt Ltd)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* SUPPLIER DECLARATION A4 SHEET */
              <div
                ref={printRef}
                id="printable-declaration-sheet"
                className="bg-white text-black w-[210mm] min-h-[297mm] p-[12mm] shadow-xl border border-slate-300 flex flex-col justify-between text-[11px] font-sans leading-relaxed select-text"
              >
                <div className="space-y-4">
                  {/* Letterhead */}
                  <div className="flex justify-between items-center border-b-2 border-red-800 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-[#b91c1c] text-white flex items-center justify-center font-bold text-xl rounded-xs">
                        M
                      </div>
                      <div>
                        <div className="text-2xl font-black tracking-widest text-[#b91c1c] font-serif uppercase">
                          MAINETTI
                        </div>
                        <div className="text-[9px] text-slate-600 tracking-wider font-semibold uppercase">
                          Packaging Bangladesh Pvt. Ltd.
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-[9px] text-slate-700">
                      <div>Vatarkhola, Naogaon Bazar, Dhamrai</div>
                      <div>Dhaka-1350, Bangladesh</div>
                      <div className="font-bold">www.mainetti.com</div>
                    </div>
                  </div>

                  {/* Declaration Title */}
                  <div className="text-center py-2">
                    <h1 className="text-base font-bold uppercase tracking-wider text-slate-900 underline decoration-2 underline-offset-4">
                      SUPPLIER DECLARATION OF CONFORMITY (TC)
                    </h1>
                    <p className="text-xs text-slate-600 mt-1">
                      Transaction Certificate Multi-PI Packaging & Materials Verification
                    </p>
                  </div>

                  {/* Document Meta Table */}
                  <div className="border border-slate-400 text-xs">
                    <div className="grid grid-cols-2 border-b border-slate-400 p-2 bg-slate-50">
                      <div>
                        <span className="font-bold text-slate-700">Buyer / Retailer: </span>
                        <span className="font-semibold text-slate-900">{retailer}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-700">Declaration Date: </span>
                        <span className="font-mono text-slate-900">{deliveryDate}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 border-b border-slate-400 p-2">
                      <div>
                        <span className="font-bold text-slate-700">Customer / Consignee: </span>
                        <span className="font-semibold text-slate-900">{invoiceToCompany}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-700">Challan Ref Number: </span>
                        <span className="font-mono font-bold text-slate-900">{challanNumber}</span>
                      </div>
                    </div>
                    <div className="p-2">
                      <span className="font-bold text-slate-700">Combined Proforma Invoices (PIs): </span>
                      <span className="font-mono font-bold text-blue-900">{combinedPiNumberString}</span>
                    </div>
                  </div>

                  {/* Declaration Statements */}
                  <div className="space-y-3 text-xs text-slate-800 leading-relaxed text-justify">
                    <p>
                      We, <strong>MAINETTI PACKAGING BANGLADESH PVT LTD</strong>, hereby declare and certify under our sole responsibility that the goods covered under the aforementioned Proforma Invoices and Delivery Challans conform fully to the international standards, certified recycling requirements (GRS / FSC / GOTS), and buyer compliance guidelines.
                    </p>
                    <p>
                      The total delivered quantity of <strong>{totalDeliveryQty.toLocaleString()} PCS</strong> of <strong>{productCategory}</strong> has been manufactured under strict quality audits and batch certification in our compliant manufacturing facilities in Dhamrai, Dhaka.
                    </p>
                  </div>

                  {/* Summary of Combined PIs Table */}
                  <div className="pt-2">
                    <div className="text-xs font-bold uppercase text-slate-800 mb-1">
                      Combined Items Summary:
                    </div>
                    <table className="w-full border-collapse border border-slate-400 text-xs">
                      <thead>
                        <tr className="bg-slate-100 font-bold text-slate-800">
                          <th className="border border-slate-400 p-1.5 text-center w-10">SL</th>
                          <th className="border border-slate-400 p-1.5 text-left">Style / Description</th>
                          <th className="border border-slate-400 p-1.5 text-left">Model / Product</th>
                          <th className="border border-slate-400 p-1.5 text-right w-24">Delivery Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it) => (
                          <tr key={it.id} className="border-b border-slate-300">
                            <td className="border border-slate-300 p-1 text-center font-bold">{it.slNo}</td>
                            <td className="border border-slate-300 p-1 text-slate-800">{it.styleNo}</td>
                            <td className="border border-slate-300 p-1 font-mono text-slate-700">{it.modelProduct}</td>
                            <td className="border border-slate-300 p-1 text-right font-mono font-bold">
                              {Number(it.deliveryQty).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-100 font-bold">
                          <td colSpan={3} className="border border-slate-400 p-1.5 text-right uppercase">
                            Total Declared Quantity
                          </td>
                          <td className="border border-slate-400 p-1.5 text-right font-mono font-black text-blue-900">
                            {totalDeliveryQty.toLocaleString()} PCS
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Signatures */}
                <div className="pt-8 border-t border-slate-300 flex justify-between items-end text-xs">
                  <div className="text-center w-48">
                    <div className="border-t border-slate-800 pt-1 font-bold uppercase">
                      Customer Acknowledgment
                    </div>
                    <div className="text-[10px] text-slate-500">Sign & Stamp</div>
                  </div>

                  <div className="text-center w-64">
                    <div className="text-blue-900 font-bold text-xs uppercase mb-1">
                      Mainetti Packaging Bangladesh Pvt. Ltd.
                    </div>
                    <svg className="w-28 h-8 text-blue-900 mx-auto -my-1" viewBox="0 0 150 40">
                      <path
                        d="M 10 30 Q 30 5 50 25 T 80 15 Q 110 35 135 10 Q 140 25 145 28"
                        fill="none"
                        stroke="#1e3a8a"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="border-t border-slate-800 pt-1 font-bold uppercase">
                      Authorized Signatory
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
