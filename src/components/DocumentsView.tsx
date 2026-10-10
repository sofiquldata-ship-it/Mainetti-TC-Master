import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PIData } from '../types/tc';
import {
  getCommercialDocSync,
  saveCommercialDocSync,
  CommercialDocSyncData,
  resolveCustomerAddress,
  saveCustomerAddressOverride,
  getCustomerAddressOverride,
  isInvalidExtractedField,
} from '../utils/commercialDocSync';
import {
  getMainettiLogo,
  saveMainettiLogo,
  resetMainettiLogo,
} from '../assets/mainettiLogoData';
import {
  getMainettiSealSignature,
  saveMainettiSealSignature,
  resetMainettiSealSignature,
} from '../assets/signatureData';
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
  Package,
  Calculator,
  HelpCircle,
  Check,
  X,
  Upload,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

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
    // Default select first 1 PI if available
    return data.slice(0, 1).map((p) => p.id);
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

  // Selected PIs objects preserving selection order (most recently selected is last)
  const selectedPis = useMemo(() => {
    return selectedPiIds
      .map((id) => data.find((p) => p.id === id))
      .filter((p): p is PIData => Boolean(p));
  }, [data, selectedPiIds]);

  // Header State
  const [deliveryDate, setDeliveryDate] = useState(defaultDateStr);
  const [challanNumber, setChallanNumber] = useState('10367');
  const [retailer, setRetailer] = useState('PRIMARK');
  const [productCategory, setProductCategory] = useState('POLYBAGS');
  const [noOfDelivery, setNoOfDelivery] = useState('D-01');
  const [deliveryVanNo, setDeliveryVanNo] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>(() => getMainettiLogo());
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setCompanyLogoUrl(dataUrl);
        saveMainettiLogo(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleResetLogo = () => {
    const defaultUrl = resetMainettiLogo();
    setCompanyLogoUrl(defaultUrl);
  };

  // Seal & Signature State (Synced with DeclarationView & Official Mainetti Stamp/Signature)
  const [signatureImage, setSignatureImage] = useState<string>(() => {
    return getMainettiSealSignature();
  });
  const sigInputRef = useRef<HTMLInputElement>(null);

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setSignatureImage(dataUrl);
        saveMainettiSealSignature(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleResetSignature = () => {
    const defaultSig = resetMainettiSealSignature();
    setSignatureImage(defaultSig);
  };
  
  // Addresses State (Initialized from first selected PI)
  const [invoiceToCompany, setInvoiceToCompany] = useState<string>(() => {
    const first = data[0];
    if (first?.customer) return first.customer.trim().toUpperCase();
    return 'LIDA TEXTILE AND DYEING LIMITED';
  });
  const [invoiceToAddress, setInvoiceToAddress] = useState<string>(() => {
    const first = data[0];
    return resolveCustomerAddress(first?.customer, first?.customerAddress || first?.factoryUnit);
  });
  const [deliverToCompany, setDeliverToCompany] = useState<string>(() => {
    const first = data[0];
    if (first?.deliverToCompany || first?.customer) {
      return (first.deliverToCompany || first.customer).trim().toUpperCase();
    }
    return 'LIDA TEXTILE AND DYEING LIMITED';
  });
  const [deliverToAddress, setDeliverToAddress] = useState<string>(() => {
    const first = data[0];
    return resolveCustomerAddress(
      first?.deliverToCompany || first?.customer,
      first?.deliveryAddress || first?.customerAddress || first?.factoryUnit
    );
  });

  // Line items state
  const [items, setItems] = useState<ChallanItem[]>([]);

  // Auto-sync form and products whenever selected PIs change
  const populateFromSelectedPis = () => {
    if (selectedPis.length === 0) {
      setItems([]);
      return;
    }

    // Use the most recently selected PI so clicking any PI immediately shows that PI's data
    const activePi = selectedPis[selectedPis.length - 1] || selectedPis[0];

    if (activePi.buyer) {
      setRetailer(activePi.buyer.trim().toUpperCase());
    }

    // Auto-pull PI-wise Last Delivery Challan Number & Date from Delivery Report / PI data
    if (activePi.lastChallanNumber) {
      setChallanNumber(activePi.lastChallanNumber);
    } else if (activePi.invoiceNumber) {
      setChallanNumber(activePi.invoiceNumber);
    }

    if (activePi.lastDeliveryDate) {
      setDeliveryDate(activePi.lastDeliveryDate);
    } else if (activePi.invoiceDate) {
      setDeliveryDate(activePi.invoiceDate);
    } else if (activePi.orderDate) {
      setDeliveryDate(activePi.orderDate);
    }

    if (activePi.deliveryCount) {
      setNoOfDelivery(`D-${String(activePi.deliveryCount).padStart(2, '0')}`);
    } else {
      setNoOfDelivery('D-01');
    }

    if (activePi.deliveryVanNo) {
      setDeliveryVanNo(activePi.deliveryVanNo);
    }

    // Strictly populate Invoice To & Deliver To from the selected PI's Customer & Address
    const custName = (activePi.customer || '').trim().toUpperCase();
    const delivCompName = (activePi.deliverToCompany || activePi.customer || '').trim().toUpperCase();
    const savedOverride = getCustomerAddressOverride(custName);

    const nextInvCompany = custName || savedOverride?.invoiceToCompany || 'LIDA TEXTILE AND DYEING LIMITED';
    const nextInvAddress = resolveCustomerAddress(
      custName,
      activePi.customerAddress || activePi.factoryUnit
    );
    const nextDelivCompany = delivCompName || savedOverride?.deliverToCompany || nextInvCompany;
    const nextDelivAddress =
      savedOverride?.deliverToAddress ||
      resolveCustomerAddress(
        delivCompName,
        activePi.deliveryAddress || activePi.customerAddress || activePi.factoryUnit
      );

    setInvoiceToCompany(nextInvCompany);
    setInvoiceToAddress(nextInvAddress);
    setDeliverToCompany(nextDelivCompany);
    setDeliverToAddress(nextDelivAddress);

    // Extract all products from the selected PIs (skipping TC Cost)
    const newItems = extractProductItemsFromPis(selectedPis);
    setItems(newItems);
  };

  const handleManualSyncCommercialDoc = () => {
    const sync = getCommercialDocSync();
    const activePi = selectedPis[selectedPis.length - 1] || selectedPis[0];
    if (sync) {
      if (sync.invoiceToCompany && !isInvalidExtractedField(sync.invoiceToCompany)) {
        setInvoiceToCompany(sync.invoiceToCompany);
      } else if (activePi?.customer) {
        setInvoiceToCompany(activePi.customer.trim().toUpperCase());
      }
      if (sync.invoiceToAddress && !isInvalidExtractedField(sync.invoiceToAddress)) {
        setInvoiceToAddress(sync.invoiceToAddress);
      }
      if (sync.deliverToCompany && !isInvalidExtractedField(sync.deliverToCompany)) {
        setDeliverToCompany(sync.deliverToCompany);
      } else if (activePi?.customer) {
        setDeliverToCompany(activePi.customer.trim().toUpperCase());
      }
      if (sync.deliverToAddress && !isInvalidExtractedField(sync.deliverToAddress)) {
        setDeliverToAddress(sync.deliverToAddress);
      }
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

  // Toggle selection (if clicking a PI of a different customer, switch directly to that PI so its data shows cleanly)
  const handleTogglePi = (id: string) => {
    const clickedPi = data.find((p) => p.id === id);
    setSelectedPiIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      if (clickedPi && prev.length > 0) {
        const lastId = prev[prev.length - 1];
        const lastPi = data.find((p) => p.id === lastId);
        const clickedCust = (clickedPi.customer || '').trim().toUpperCase();
        const lastCust = (lastPi?.customer || '').trim().toUpperCase();
        // If user selects a PI belonging to a different customer, switch directly to this PI
        if (clickedCust && lastCust && clickedCust !== lastCust) {
          return [id];
        }
      }
      return [...prev, id];
    });
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

  // Persist packet counts so they survive tab changes and reloads
  const persistPacketsToStorage = (updatedItems: ChallanItem[]) => {
    const existing = getCommercialDocSync() || {};
    const pktMap: Record<string, number | string> = { ...(existing.pktBoxByStyleOrSl || {}) };
    updatedItems.forEach((it, idx) => {
      if (it.pktBox !== undefined && it.pktBox !== '' && it.pktBox !== '-') {
        const sKey = (it.styleNo || '').trim().toUpperCase();
        const mKey = (it.modelProduct || '').trim().toUpperCase();
        if (sKey) pktMap[sKey] = it.pktBox;
        if (mKey) pktMap[mKey] = it.pktBox;
        pktMap[`SL_${idx + 1}`] = it.pktBox;
      }
    });
    saveCommercialDocSync({ pktBoxByStyleOrSl: pktMap });
  };

  // Item modifications
  const handleUpdateItem = (index: number, field: keyof ChallanItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'pktBox') {
        persistPacketsToStorage(updated);
      }
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

  // Packet Helper & Batch Auto-Calculation State
  const [isAutoPacketModalOpen, setIsAutoPacketModalOpen] = useState(false);
  const [isPacketHelpModalOpen, setIsPacketHelpModalOpen] = useState(false);
  const [packetCalcMode, setPacketCalcMode] = useState<'pcs_per_box' | 'total_packets' | 'uniform'>('pcs_per_box');
  const [pcsPerBoxInput, setPcsPerBoxInput] = useState<string>('500');
  const [totalPacketsBatchInput, setTotalPacketsBatchInput] = useState<string>('69');
  const [uniformPacketsBatchInput, setUniformPacketsBatchInput] = useState<string>('10');
  const [customTotalPackets, setCustomTotalPackets] = useState<string>('');

  const handleApplyAutoPackets = () => {
    if (items.length === 0) return;

    if (packetCalcMode === 'pcs_per_box') {
      const pcs = Number(pcsPerBoxInput) || 500;
      setItems((prev) => {
        const updated = prev.map((it) => {
          const qty = Number(it.deliveryQty || it.orderQty) || 0;
          const pkts = Math.max(1, Math.ceil(qty / pcs));
          return { ...it, pktBox: pkts };
        });
        persistPacketsToStorage(updated);
        return updated;
      });
    } else if (packetCalcMode === 'total_packets') {
      const targetTotal = Number(totalPacketsBatchInput) || 69;
      const totalDeliv = totalDeliveryQty || 1;
      setItems((prev) => {
        const updated = prev.map((it) => {
          const qty = Number(it.deliveryQty || it.orderQty) || 0;
          const pkts = Math.max(1, Math.round((qty / totalDeliv) * targetTotal));
          return { ...it, pktBox: pkts };
        });
        persistPacketsToStorage(updated);
        return updated;
      });
    } else if (packetCalcMode === 'uniform') {
      const val = Number(uniformPacketsBatchInput) || 10;
      setItems((prev) => {
        const updated = prev.map((it) => ({ ...it, pktBox: val }));
        persistPacketsToStorage(updated);
        return updated;
      });
    }
    setIsAutoPacketModalOpen(false);
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

  // Download PDF using html2canvas & jsPDF with exact A4 vector scale and robust fallback
  const handleDownloadPdf = async () => {
    const targetId = docType === 'gate_pass' ? 'printable-challan-sheet' : 'printable-declaration-sheet';
    const element = printRef.current;
    if (!element) {
      console.warn('PDF export target element not found');
      return;
    }

    try {
      setIsExportingPdf(true);

      // Pre-clone or configure html2canvas for max fidelity & cross-browser support
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1123,
        windowWidth: 1200,
        windowHeight: 1400,
        onclone: (clonedDoc) => {
          const clonedTarget = clonedDoc.getElementById(targetId);
          if (!clonedTarget) return;

          // Force exact A4 dimensions and clean borders on the cloned sheet
          clonedTarget.style.width = '794px';
          clonedTarget.style.minWidth = '794px';
          clonedTarget.style.maxWidth = '794px';
          clonedTarget.style.height = '1123px';
          clonedTarget.style.minHeight = '1123px';
          clonedTarget.style.maxHeight = '1123px';
          clonedTarget.style.padding = '36px 36px';
          clonedTarget.style.boxSizing = 'border-box';
          clonedTarget.style.border = 'none';
          clonedTarget.style.boxShadow = 'none';
          clonedTarget.style.transform = 'none';
          clonedTarget.style.margin = '0 auto';

          // Reset parent elements to prevent horizontal overflow or flex shifting
          let parent = clonedTarget.parentElement;
          while (parent && parent !== clonedDoc.body) {
            parent.style.padding = '0';
            parent.style.margin = '0';
            parent.style.overflow = 'visible';
            parent.style.width = '794px';
            parent.style.minWidth = '794px';
            parent.style.maxWidth = '794px';
            parent.style.display = 'block';
            parent.style.boxShadow = 'none';
            parent.style.background = '#ffffff';
            parent = parent.parentElement;
          }

          // Replace input elements in the table with crisp text
          const inputs = clonedTarget.querySelectorAll('input');
          inputs.forEach((inp) => {
            const span = clonedDoc.createElement('span');
            span.textContent = inp.value || inp.placeholder || '-';
            span.className = inp.className;
            span.style.border = 'none';
            span.style.background = 'transparent';
            span.style.display = 'inline-block';
            span.style.width = '100%';
            span.style.textAlign = 'center';
            inp.parentNode?.replaceChild(span, inp);
          });
        },
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Fit edge-to-edge on standard A4 page (210 x 297 mm) with zero offset margins
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      
      const fileName = docType === 'gate_pass'
        ? `Delivery_Challan_${challanNumber || 'Mainetti'}_${deliveryDate || 'Date'}.pdf`
        : `Supplier_Declaration_${challanNumber || 'Mainetti'}_${deliveryDate || 'Date'}.pdf`;

      // Method 1: standard jsPDF save
      try {
        pdf.save(fileName);
      } catch (saveErr) {
        // Fallback for iframe/browser sandbox restrictions: Blob anchor trigger
        console.warn('Direct pdf.save failed, using blob URL fallback:', saveErr);
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1500);
      }
    } catch (error) {
      console.error('PDF export failed:', error);
      // Fallback: trigger print dialog directly if download fails
      window.print();
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

            {/* Company Logo (Top-Left Red Box) Customizer */}
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  onClick={() => logoInputRef.current?.click()}
                  className="h-10 px-2 bg-white border border-red-300 rounded-xs flex items-center justify-center cursor-pointer hover:border-red-500 transition-colors shadow-2xs"
                  title="Click to upload Picture1.png"
                >
                  {companyLogoUrl && (
                    <img
                      src={companyLogoUrl}
                      alt="Mainetti Logo"
                      className="h-8 w-auto object-contain"
                    />
                  )}
                </div>
                <div>
                  <span className="text-[10.5px] font-bold text-slate-800 block">
                    Challan Top-Left Logo
                  </span>
                  <span className="text-[9.5px] text-emerald-700 font-medium">
                    ✓ Picture1.png Applied
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="px-2 py-1 text-[10.5px] font-bold bg-[#b91c1c] hover:bg-red-800 text-white rounded-xs flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                  title="Upload your Picture1.png logo file"
                >
                  <Upload className="w-3 h-3 text-white" />
                  <span>Upload Pic</span>
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={handleResetLogo}
                  className="text-[10px] text-slate-500 hover:text-red-700 hover:underline cursor-pointer px-1"
                  title="Reset to default Mainetti logo"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Seal & Signature (Red Box) Customizer */}
            <div className="p-2 bg-red-50/40 border border-red-300 rounded-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  onClick={() => sigInputRef.current?.click()}
                  className="h-12 w-28 bg-white border border-red-300 rounded-xs flex items-center justify-center p-1 cursor-pointer hover:border-red-500 transition-colors shadow-2xs"
                  title="Click to upload Seal & Signature image"
                >
                  <img
                    src={signatureImage || getMainettiSealSignature()}
                    alt="Seal & Sign"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div>
                  <span className="text-[10.5px] font-bold text-slate-800 block">
                    Seal & Signature (Red Box)
                  </span>
                  <span className="text-[9.5px] text-emerald-700 font-medium">
                    {signatureImage ? '✓ Seal & Sign Applied' : 'Default Stamp Active'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => sigInputRef.current?.click()}
                  className="px-2 py-1 text-[10.5px] font-bold bg-[#b91c1c] hover:bg-red-800 text-white rounded-xs flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                  title="Upload your Seal & Signature file"
                >
                  <Upload className="w-3 h-3 text-white" />
                  <span>Upload Sign</span>
                </button>
                <input
                  ref={sigInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureUpload}
                  className="hidden"
                />
                {signatureImage && (
                  <button
                    type="button"
                    onClick={handleResetSignature}
                    className="text-[10px] text-slate-500 hover:text-red-700 hover:underline cursor-pointer px-1"
                    title="Remove custom signature and revert to default"
                  >
                    Reset
                  </button>
                )}
              </div>
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setInvoiceToCompany(val);
                    const activePi = selectedPis[selectedPis.length - 1] || selectedPis[0];
                    if (activePi?.customer) {
                      saveCustomerAddressOverride(activePi.customer, { invoiceToCompany: val });
                    }
                  }}
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setInvoiceToAddress(val);
                    const activePi = selectedPis[selectedPis.length - 1] || selectedPis[0];
                    if (activePi?.customer) {
                      saveCustomerAddressOverride(activePi.customer, { invoiceToAddress: val });
                    }
                  }}
                  className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-xs px-2 py-1 text-slate-700"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] font-semibold text-slate-600 uppercase">
                  Deliver To Company & Address
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDeliverToCompany(invoiceToCompany);
                    setDeliverToAddress(invoiceToAddress);
                    const activePi = selectedPis[selectedPis.length - 1] || selectedPis[0];
                    if (activePi?.customer) {
                      saveCustomerAddressOverride(activePi.customer, {
                        deliverToCompany: invoiceToCompany,
                        deliverToAddress: invoiceToAddress,
                      });
                    }
                  }}
                  className="text-[10px] text-blue-700 hover:underline cursor-pointer"
                >
                  Copy from Invoice To
                </button>
              </div>
              <input
                type="text"
                value={deliverToCompany}
                onChange={(e) => {
                  const val = e.target.value;
                  setDeliverToCompany(val);
                  const activePi = selectedPis[selectedPis.length - 1] || selectedPis[0];
                  if (activePi?.customer) {
                    saveCustomerAddressOverride(activePi.customer, { deliverToCompany: val });
                  }
                }}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xs px-2 py-1 font-semibold text-slate-800"
              />
              <textarea
                rows={2}
                value={deliverToAddress}
                onChange={(e) => {
                  const val = e.target.value;
                  setDeliverToAddress(val);
                  const activePi = selectedPis[selectedPis.length - 1] || selectedPis[0];
                  if (activePi?.customer) {
                    saveCustomerAddressOverride(activePi.customer, { deliverToAddress: val });
                  }
                }}
                className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-xs px-2 py-1 text-slate-700"
              />
            </div>
          </div>

          {/* Box 3: Line Items Quick Actions */}
          <div className="bg-white border border-slate-200 rounded-sm shadow-xs p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  3. Table Items ({items.length})
                </span>
                <button
                  type="button"
                  onClick={() => setIsPacketHelpModalOpen(true)}
                  className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded-xs border border-amber-300 cursor-pointer"
                  title="Packet (Pkt/Box) কিভাবে বসাবেন তা জানতে ক্লিক করুন"
                >
                  <HelpCircle className="w-3 h-3 text-amber-600" />
                  <span>Packet গাইড</span>
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsAutoPacketModalOpen(true)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-xs border border-emerald-300 cursor-pointer shadow-2xs"
                  title="Auto calculate or batch set packet count for all rows"
                >
                  <Package className="w-3 h-3 text-emerald-600" />
                  <span>⚡ Auto Packet</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 px-2 py-0.5 rounded-xs border border-blue-200 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Row</span>
                </button>
              </div>
            </div>

            {/* Quick helper tip banner */}
            <div className="text-[10.5px] bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xs px-2 py-1 text-amber-900 flex items-center justify-between">
              <span className="truncate">
                💡 <strong>Pkt/Box বসানো:</strong> ডানের A4 টেবিলে সরাসরি ক্লিক করে অথবা নিচে টাইপ করুন
              </span>
              <button
                type="button"
                onClick={() => setIsAutoPacketModalOpen(true)}
                className="text-[10px] text-blue-700 font-bold hover:underline shrink-0 ml-1 cursor-pointer"
              >
                Auto-Calc ⚡
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-1.5 bg-slate-50 border border-slate-200 rounded-xs text-xs space-y-1 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-[11px]">#{item.slNo}</span>
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
                  <div className="grid grid-cols-4 gap-1">
                    <div>
                      <label className="text-[8.5px] text-slate-500 font-medium block">Model</label>
                      <input
                        type="text"
                        value={item.modelProduct}
                        onChange={(e) => handleUpdateItem(idx, 'modelProduct', e.target.value)}
                        placeholder="Model"
                        className="w-full text-[10.5px] bg-white border border-slate-200 rounded-xs px-1 py-0.5 text-slate-800 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[8.5px] text-slate-500 font-medium block">Order Qty</label>
                      <input
                        type="number"
                        value={item.orderQty}
                        onChange={(e) => handleUpdateItem(idx, 'orderQty', Number(e.target.value))}
                        placeholder="Order"
                        className="w-full text-[10.5px] bg-white border border-slate-200 rounded-xs px-1 py-0.5 text-slate-800 font-mono text-right"
                      />
                    </div>
                    <div>
                      <label className="text-[8.5px] text-slate-500 font-medium block">Deliv Qty</label>
                      <input
                        type="number"
                        value={item.deliveryQty}
                        onChange={(e) => handleUpdateItem(idx, 'deliveryQty', Number(e.target.value))}
                        placeholder="Deliv"
                        className="w-full text-[10.5px] bg-white border border-slate-200 rounded-xs px-1 py-0.5 text-slate-800 font-mono text-right font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[8.5px] font-bold text-amber-900 bg-amber-100/90 rounded-2xs px-1 block text-center truncate">
                        📦 Pkt/Box
                      </label>
                      <input
                        type="text"
                        value={item.pktBox === '-' ? '' : item.pktBox}
                        onChange={(e) => handleUpdateItem(idx, 'pktBox', e.target.value)}
                        placeholder="e.g. 10"
                        className="w-full text-[10.5px] bg-amber-50/80 border border-amber-300 rounded-xs px-1 py-0.5 text-blue-950 font-mono font-bold text-center focus:bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none"
                        title="Enter Packet / Box count for this line"
                      />
                    </div>
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
                      <div
                        onClick={() => logoInputRef.current?.click()}
                        className="inline-block cursor-pointer group"
                        title="Click to upload custom logo (Picture1.png)"
                      >
                        {companyLogoUrl && (
                          <img
                            src={companyLogoUrl}
                            alt="MAINETTI"
                            className="h-12 w-auto object-contain group-hover:opacity-90 transition-opacity"
                          />
                        )}
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
                          <span className="font-semibold font-mono text-[9px] text-right break-words max-w-[155px] leading-tight block">
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
                    <div className="border-r border-black flex flex-col min-h-[60px]">
                      <div className="font-bold uppercase px-1.5 py-1 border-b border-black">
                        INVOICE TO (COMPANY NAME & ADDRESS)
                      </div>
                      <div className="p-1.5 flex-1 flex flex-col justify-between">
                        <div className="font-bold uppercase text-[9px]">{invoiceToCompany}</div>
                        <div className="text-[8.5px] uppercase text-slate-800 leading-tight mt-0.5">
                          {invoiceToAddress}
                        </div>
                      </div>
                    </div>

                    {/* Deliver To */}
                    <div className="flex flex-col min-h-[60px]">
                      <div className="font-bold uppercase px-1.5 py-1 border-b border-black">
                        DELIVER TO (COMPANY NAME & ADDRESS)
                      </div>
                      <div className="p-1.5 flex-1 flex flex-col justify-between">
                        <div className="font-bold uppercase text-[9px]">{deliverToCompany}</div>
                        <div className="text-[8.5px] uppercase text-slate-800 leading-tight mt-0.5">
                          {deliverToAddress}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Line Items Table */}
                  <table className="w-full border-collapse border border-black text-[8.5px]">
                    <thead>
                      <tr className="text-black font-bold uppercase text-center">
                        <th
                          style={{ backgroundColor: '#fcd9be', verticalAlign: 'middle', height: '32px' }}
                          className="border border-black p-0.5 w-6"
                          rowSpan={2}
                        >
                          <div className="flex items-center justify-center h-full">SL NO</div>
                        </th>
                        <th
                          style={{ backgroundColor: '#fcd9be', verticalAlign: 'middle', height: '32px' }}
                          className="border border-black p-0.5 w-44"
                          rowSpan={2}
                        >
                          <div className="flex items-center justify-center h-full">STYLE NO</div>
                        </th>
                        <th
                          style={{ backgroundColor: '#fcd9be', verticalAlign: 'middle', height: '32px' }}
                          className="border border-black p-0.5 w-28"
                          rowSpan={2}
                        >
                          <div className="flex items-center justify-center h-full">MODEL/PRODUCT</div>
                        </th>
                        <th
                          style={{ backgroundColor: '#fcd9be', verticalAlign: 'middle', height: '16px' }}
                          className="border border-black py-0.5"
                          colSpan={4}
                        >
                          MEASUREMENT <span className="text-[7.5px] font-normal">(MM)</span>
                        </th>
                        <th
                          style={{ backgroundColor: '#fcd9be', verticalAlign: 'middle', height: '32px' }}
                          className="border border-black p-0.5 w-16"
                          rowSpan={2}
                        >
                          <div className="flex items-center justify-center h-full">ORDER QTY</div>
                        </th>
                        <th
                          style={{ backgroundColor: '#fcd9be', verticalAlign: 'middle', height: '32px' }}
                          className="border border-black p-0.5 w-16"
                          rowSpan={2}
                        >
                          <div className="flex items-center justify-center h-full">DELIVERY QTY</div>
                        </th>
                        <th
                          style={{ backgroundColor: '#fcd9be', verticalAlign: 'middle', height: '32px' }}
                          className="border border-black p-0.5 w-12"
                          rowSpan={2}
                        >
                          <div className="flex items-center justify-center h-full">PKT/BOX</div>
                        </th>
                        <th
                          style={{ backgroundColor: '#fcd9be', verticalAlign: 'middle', height: '32px' }}
                          className="border border-black p-0.5 w-16"
                          rowSpan={2}
                        >
                          <div className="flex items-center justify-center h-full">BALANCE QTY</div>
                        </th>
                      </tr>
                      <tr className="text-black font-bold text-center text-[7.5px]">
                        <th style={{ backgroundColor: '#fcd9be', verticalAlign: 'middle', height: '16px' }} className="border border-black p-0.5 w-8">WIDTH</th>
                        <th style={{ backgroundColor: '#fcd9be', verticalAlign: 'middle', height: '16px' }} className="border border-black p-0.5 w-8">LENGTH</th>
                        <th style={{ backgroundColor: '#fcd9be', verticalAlign: 'middle', height: '16px' }} className="border border-black p-0.5 w-8">GUSSET</th>
                        <th style={{ backgroundColor: '#fcd9be', verticalAlign: 'middle', height: '16px' }} className="border border-black p-0.5 w-8">FLAP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Active line items */}
                      {items.map((item, idx) => (
                        <tr key={item.id} className="border-b border-black text-center h-[18px]">
                          <td className="border border-black font-bold">{item.slNo}</td>
                          <td className="border border-black text-left px-1 font-semibold text-[8px] break-words leading-tight max-w-[170px]">
                            {item.styleNo}
                          </td>
                          <td className="border border-black text-left px-1 font-mono text-[8px] break-words leading-tight max-w-[110px]">
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
                          <td className="border border-black font-mono p-0 bg-amber-50/20 hover:bg-amber-100/50 transition-colors">
                            <input
                              type="text"
                              value={item.pktBox === '-' ? '' : item.pktBox}
                              onChange={(e) => handleUpdateItem(idx, 'pktBox', e.target.value)}
                              placeholder="-"
                              className="w-full h-full text-center bg-transparent border-0 outline-none p-0 font-mono text-[8.5px] text-black font-bold focus:bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none cursor-pointer"
                              title="Click to directly edit Packet / Box for this line"
                            />
                          </td>
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
                        <td className="border border-black font-mono font-black text-[9px] p-0 bg-amber-200/50 hover:bg-amber-200 transition-colors">
                          <input
                            type="text"
                            value={customTotalPackets !== '' ? customTotalPackets : (totalPktBoxes > 0 ? totalPktBoxes : '69')}
                            onChange={(e) => setCustomTotalPackets(e.target.value)}
                            className="w-full h-full text-center bg-transparent border-0 outline-none p-0 font-mono font-black text-[9px] text-black focus:bg-white focus:ring-1 focus:ring-blue-600"
                            title="Total Packets (Auto-calculated from items, click to override)"
                          />
                        </td>
                        <td className="border border-black font-mono font-bold text-[9px]">
                          -
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 4. Footer & Signature Section */}
                <div className="pt-4">
                  <div className="flex justify-between items-end gap-4">
                    {/* Consignee Signature Box (Sign & Company Chop Seal Area) */}
                    <div className="w-[48%] flex flex-col justify-end">
                      <div className="h-28 flex flex-col justify-end pb-1 bg-transparent">
                        <div className="border-t-2 border-black pt-1.5 text-center font-bold text-[9.5px] uppercase text-black">
                          For consignee ( Sign, Company Chop Seal )
                        </div>
                      </div>
                    </div>

                    {/* Authorized Signature Box (Official Mainetti Seal & Pen Signature) */}
                    <div className="w-[48%] flex flex-col justify-end">
                      <div
                        onClick={() => sigInputRef.current?.click()}
                        className="h-32 flex flex-col justify-end p-1.5 bg-transparent relative cursor-pointer group"
                        title="Click to Upload or Change Seal & Signature"
                      >
                        {/* Enlarged Seal & Signature Picture */}
                        <div className="flex-1 flex items-center justify-center overflow-hidden py-0.5">
                          <img
                            src={signatureImage || getMainettiSealSignature()}
                            alt="Mainetti Seal & Signature"
                            className="h-26 sm:h-28 w-auto max-w-[290px] object-contain transition-transform group-hover:scale-105"
                          />
                        </div>
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
                    <div
                      onClick={() => logoInputRef.current?.click()}
                      className="flex items-center gap-3 cursor-pointer group"
                      title="Click to upload custom logo (Picture1.png)"
                    >
                      {companyLogoUrl && (
                        <img
                          src={companyLogoUrl}
                          alt="MAINETTI"
                          className="h-12 w-auto object-contain group-hover:opacity-90 transition-opacity"
                        />
                      )}
                      <div className="text-[9px] text-slate-600 tracking-wider font-semibold uppercase border-l border-slate-300 pl-3">
                        Packaging Bangladesh Pvt. Ltd.
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

                  <div
                    onClick={() => sigInputRef.current?.click()}
                    className="text-center w-64 cursor-pointer group"
                    title="Click to Upload or Change Seal & Signature"
                  >
                    <div className="text-blue-900 font-bold text-xs uppercase mb-1">
                      Mainetti Packaging Bangladesh Pvt. Ltd.
                    </div>
                    <div className="h-24 w-auto max-w-[270px] mx-auto flex items-center justify-center my-1.5">
                      <img
                        src={signatureImage || getMainettiSealSignature()}
                        alt="Seal & Signature"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
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

      {/* ========================================================================= */}
      {/* 1. AUTO PACKET CALCULATOR MODAL */}
      {/* ========================================================================= */}
      {isAutoPacketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide">
                    📦 Auto-Calculate & Batch Set Packets
                  </h3>
                  <p className="text-[11px] text-blue-200">
                    Challan-এর প্রতিটি লাইনে Pkt/Box এক ক্লিকে অটো-হিসাব বা সেট করুন
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAutoPacketModalOpen(false)}
                className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded-xs transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Mode Selection Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-md text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPacketCalcMode('pcs_per_box')}
                  className={`py-2 px-2 text-center rounded-xs transition-colors cursor-pointer ${
                    packetCalcMode === 'pcs_per_box'
                      ? 'bg-white text-blue-900 shadow-xs font-bold border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🎯 Pcs Per Box
                </button>
                <button
                  type="button"
                  onClick={() => setPacketCalcMode('total_packets')}
                  className={`py-2 px-2 text-center rounded-xs transition-colors cursor-pointer ${
                    packetCalcMode === 'total_packets'
                      ? 'bg-white text-blue-900 shadow-xs font-bold border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⚖️ Split Total Packets
                </button>
                <button
                  type="button"
                  onClick={() => setPacketCalcMode('uniform')}
                  className={`py-2 px-2 text-center rounded-xs transition-colors cursor-pointer ${
                    packetCalcMode === 'uniform'
                      ? 'bg-white text-blue-900 shadow-xs font-bold border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🔢 Uniform (সব সমান)
                </button>
              </div>

              {/* Mode 1: Pcs Per Box */}
              {packetCalcMode === 'pcs_per_box' && (
                <div className="space-y-3 bg-blue-50/50 p-3.5 rounded-md border border-blue-200/60">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      প্রতি বক্সে কত পিস থাকবে? (Pcs / Box):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={pcsPerBoxInput}
                        onChange={(e) => setPcsPerBoxInput(e.target.value)}
                        placeholder="500"
                        className="w-32 px-3 py-1.5 bg-white border border-slate-300 rounded-xs text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <span className="text-xs text-slate-500 font-medium">পিস প্রতি কার্টন/বক্স</span>
                    </div>
                  </div>

                  {/* Preset quick buttons */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                      দ্রুত নির্বাচন করুন (Presets):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {['250', '500', '1000', '1500', '2000'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setPcsPerBoxInput(preset)}
                          className={`text-xs px-2.5 py-1 rounded-xs border font-mono font-semibold transition-colors cursor-pointer ${
                            pcsPerBoxInput === preset
                              ? 'bg-blue-700 text-white border-blue-700 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {preset} pcs/box
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-tight">
                    💡 সূত্র: <strong>Packet = Delivery Qty ÷ {pcsPerBoxInput || 500}</strong> (ভগ্নাংশ থাকলে পরবর্তী পূর্ণসংখ্যায় রাউন্ড হবে)
                  </p>
                </div>
              )}

              {/* Mode 2: Split Total Packets */}
              {packetCalcMode === 'total_packets' && (
                <div className="space-y-3 bg-amber-50/50 p-3.5 rounded-md border border-amber-200/60">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      মোট কতটি প্যাকেট বা কার্টন হবে? (Target Total Packets):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={totalPacketsBatchInput}
                        onChange={(e) => setTotalPacketsBatchInput(e.target.value)}
                        placeholder="69"
                        className="w-32 px-3 py-1.5 bg-white border border-slate-300 rounded-xs text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                      <span className="text-xs text-slate-500 font-medium">মোট কার্টন সংখ্যা</span>
                    </div>
                  </div>

                  {/* Preset quick buttons */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                      জনপ্রিয় প্যাকেট সংখ্যা:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {['50', '69', '75', '100', '120'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setTotalPacketsBatchInput(preset)}
                          className={`text-xs px-2.5 py-1 rounded-xs border font-mono font-semibold transition-colors cursor-pointer ${
                            totalPacketsBatchInput === preset
                              ? 'bg-amber-700 text-white border-amber-700 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {preset} Boxes
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-tight">
                    💡 এটি মোট ডেলিভারি কোয়ান্টিটি অনুসারে প্রতিটি লাইনের অনুপাতে প্যাকেট ভাগ করে দেবে।
                  </p>
                </div>
              )}

              {/* Mode 3: Uniform */}
              {packetCalcMode === 'uniform' && (
                <div className="space-y-3 bg-emerald-50/50 p-3.5 rounded-md border border-emerald-200/60">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      প্রতিটি লাইনে নির্দিষ্ট প্যাকেট সংখ্যা বসান:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={uniformPacketsBatchInput}
                        onChange={(e) => setUniformPacketsBatchInput(e.target.value)}
                        placeholder="10"
                        className="w-32 px-3 py-1.5 bg-white border border-slate-300 rounded-xs text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <span className="text-xs text-slate-500 font-medium">প্রতি আইটেমে</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">
                    💡 টেবিলের প্রতিটি লাইনে সমানভাবে এই সংখ্যাটি বসে যাবে।
                  </p>
                </div>
              )}

              {/* Live Preview List */}
              <div className="border border-slate-200 rounded-md overflow-hidden text-xs">
                <div className="bg-slate-100 px-3 py-1.5 font-bold text-slate-700 flex items-center justify-between border-b border-slate-200">
                  <span>ফলাফল প্রিভিউ ({items.length} টি আইটেম)</span>
                  <span className="font-mono text-[11px] text-slate-500">
                    মোট ডেলিভারি: {totalDeliveryQty.toLocaleString()} pcs
                  </span>
                </div>
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-100">
                  {items.map((it) => {
                    let previewPkt: number | string = it.pktBox;
                    const qty = Number(it.deliveryQty || it.orderQty) || 0;
                    if (packetCalcMode === 'pcs_per_box') {
                      const pcs = Number(pcsPerBoxInput) || 500;
                      previewPkt = Math.max(1, Math.ceil(qty / pcs));
                    } else if (packetCalcMode === 'total_packets') {
                      const target = Number(totalPacketsBatchInput) || 69;
                      const tot = totalDeliveryQty || 1;
                      previewPkt = Math.max(1, Math.round((qty / tot) * target));
                    } else if (packetCalcMode === 'uniform') {
                      previewPkt = uniformPacketsBatchInput || 10;
                    }

                    return (
                      <div key={it.id} className="px-3 py-1.5 flex items-center justify-between">
                        <div className="truncate max-w-[280px]">
                          <span className="font-bold text-slate-800">#{it.slNo}</span>{' '}
                          <span className="text-slate-600">{it.styleNo}</span>{' '}
                          <span className="text-[10px] text-slate-400 font-mono">({qty.toLocaleString()} pcs)</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-[11px] text-slate-400 line-through">
                            {it.pktBox}
                          </span>
                          <span className="text-[11px] font-bold text-blue-900 bg-amber-100 px-1.5 py-0.5 rounded-xs border border-amber-300">
                            {previewPkt} pkt
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsAutoPacketModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-300 rounded-xs bg-white cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleApplyAutoPackets}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-xs shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>সব আইটেমে প্রয়োগ করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PACKET HELPER GUIDE MODAL */}
      {/* ========================================================================= */}
      {isPacketHelpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-amber-600 to-orange-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-md bg-white/20 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide">
                    💡 Packet (Pkt/Box) কিভাবে বসাবেন?
                  </h3>
                  <p className="text-[11px] text-amber-100">
                    Delivery Challan-এ প্যাকেট সংখ্যা বসানোর ৪টি সহজ উপায়
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPacketHelpModalOpen(false)}
                className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded-xs transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Guide Steps */}
            <div className="p-5 space-y-3.5 overflow-y-auto text-xs text-slate-700 leading-relaxed">
              {/* Step 1 */}
              <div className="flex items-start gap-3 p-3 bg-amber-50/60 rounded-md border border-amber-200">
                <div className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  ১
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs mb-0.5">
                    সরাসরি ডানের A4 টেবিলে ক্লিক করে (Direct Click & Type)
                  </h4>
                  <p className="text-slate-600 text-[11.5px]">
                    ডানপাশে যে <strong>A4 Delivery Challan</strong> দেখা যাচ্ছে, তার টেবিলের <strong>PKT/BOX</strong> কলামে সরাসরি ক্লিক করে যেকোনো সংখ্যা (যেমন: 10, 15, 25) লিখে দিন। এটি সাথে সাথে সেভ হবে এবং প্রিন্ট/PDF-এ পারফেক্ট থাকবে।
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 p-3 bg-blue-50/60 rounded-md border border-blue-200">
                <div className="w-6 h-6 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  ২
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs mb-0.5">
                    বামপাশের "3. Table Items" ফর্ম থেকে (Form Inputs)
                  </h4>
                  <p className="text-slate-600 text-[11.5px]">
                    বামপাশের প্যানেলে <strong>3. Table Items</strong> লিস্টে প্রতিটি আইটেমের পাশে একটি হলুদ রঙের <strong>📦 Pkt/Box</strong> ইনপুট বক্স আছে। সেখানে আপনার কাঙ্ক্ষিত সংখ্যাটি লিখে দিলেই হবে।
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3 p-3 bg-emerald-50/60 rounded-md border border-emerald-200">
                <div className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  ৩
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs mb-0.5">
                    ⚡ Auto Packet ক্যালকুলেটর দিয়ে (1-Click Auto Calc)
                  </h4>
                  <p className="text-slate-600 text-[11.5px]">
                    <strong>"⚡ Auto Packet"</strong> বাটনে ক্লিক করে পিস প্রতি বক্সের সাইজ (যেমন 500 pcs/box বা 1000 pcs/box) দিলে পুরো টেবিলের সব প্রোডাক্টের প্যাকেট সংখ্যা এক সেকেন্ডে অটো-ক্যালকুলেট হয়ে যাবে।
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start gap-3 p-3 bg-purple-50/60 rounded-md border border-purple-200">
                <div className="w-6 h-6 rounded-full bg-purple-700 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  ৪
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-xs mb-0.5">
                    Excel বা Packing List আপলোড থেকে (Auto Sync)
                  </h4>
                  <p className="text-slate-600 text-[11.5px]">
                    আপনার এক্সেল ফাইল বা কমার্শিয়াল ডকুমেন্টে যদি <code>Packet</code>, <code>Box</code>, <code>Pkt/Box</code> বা <code>Cartons</code> কলাম থাকে, ফাইল আপলোড করার সময় সিস্টেম স্বয়ংক্রিয়ভাবে সেটি ডিটেক্ট করে এখানে বসিয়ে দেয়।
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setIsPacketHelpModalOpen(false);
                  setIsAutoPacketModalOpen(true);
                }}
                className="flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 cursor-pointer"
              >
                <span>⚡ Auto Packet ওপেন করুন</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPacketHelpModalOpen(false)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xs shadow-xs cursor-pointer"
              >
                বুঝেছি, ধন্যবাদ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
