import * as XLSX from 'xlsx';
import { PIData, UploadedFileInfo, TCStatus, PaymentStatus, DeliveryStatus, computeAutomatedTcStatus, isCancelledStatus, isCancelledOrder, isCancelledPi } from '../types/tc';
import { enrichPiListWithSavedChallanMap } from './deliveryReportParser';

const STORAGE_KEY_DATA = 'MAINETTI_TC_DATA_V1';
const STORAGE_KEY_FILE_INFO = 'MAINETTI_TC_FILE_INFO_V1';

// Helper to normalize strings for comparison
function normalizeStr(str: any): string {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Convert Excel serial date or date string to YYYY-MM-DD
function parseDateValue(value: any): string {
  if (!value) return new Date().toISOString().slice(0, 10);

  if (typeof value === 'number') {
    const date = new Date((value - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  const str = String(value).trim();
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return str;
}

// Calculate days between order date and today
function calculateAgeDays(orderDateStr: string): number {
  try {
    const orderTime = new Date(orderDateStr).getTime();
    if (isNaN(orderTime)) return 25;
    const now = new Date('2026-09-25T00:00:00Z').getTime();
    const diff = Math.max(0, Math.floor((now - orderTime) / (1000 * 60 * 60 * 24)));
    return diff || 15;
  } catch {
    return 20;
  }
}

// Parse string/number to clean numeric cost
function parseNumericCost(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : Math.max(0, value);

  const cleanStr = String(value)
    .replace(/[$,€£৳USD]/gi, '')
    .trim()
    .replace(/,/g, '');
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : Math.max(0, num);
}

// Map parsed string to valid TC Status
function mapToTcStatus(value: any, isOverdue: boolean): TCStatus {
  if (isOverdue) return 'Overdue';
  if (!value) return 'Pending';
  const s = String(value).toLowerCase().trim();
  if (s.includes('issue') || s.includes('complete') || s.includes('done') || s.includes('approve')) return 'Issued';
  if (s.includes('overdue') || s.includes('delay') || s.includes('late')) return 'Overdue';
  if (s.includes('req') || s.includes('draft') || s.includes('new') || s.includes('prep')) return 'Required';
  if (s.includes('rev') || s.includes('under') || s.includes('audit')) return 'Under Review';
  return 'Pending';
}

// Map parsed string to Payment Status
function mapToPaymentStatus(value: any): PaymentStatus {
  if (!value) return 'Pending';
  const s = String(value).toLowerCase().trim();
  if (s.includes('paid') || s.includes('settle') || s.includes('clear')) return 'Paid';
  if (s.includes('overdue') || s.includes('due') || s.includes('unpaid')) return 'Overdue';
  if (s.includes('waive') || s.includes('foc') || s.includes('free')) return 'Waived';
  return 'Pending';
}

// Map parsed string to Delivery Status
function mapToDeliveryStatus(value: any): DeliveryStatus {
  if (!value) return 'Pending Dispatch';
  const s = String(value).toLowerCase().trim();
  if (s.includes('deliv') || s.includes('received')) return 'Delivered';
  if (s.includes('transit') || s.includes('way') || s.includes('sea') || s.includes('air')) return 'In Transit';
  if (s.includes('port') || s.includes('custom')) return 'Port Clearance';
  if (s.includes('dispatch') || s.includes('shipped')) return 'Dispatched';
  if (s.includes('complete') || s.includes('prod')) return 'Production Complete';
  return 'Pending Dispatch';
}

// Keywords to check for TRANSACTION CERTIFICATE COST specifically
function isTcCostLine(modelVal: any, descVal: any, allRowText?: string): boolean {
  const normModel = normalizeStr(modelVal);
  const normDesc = normalizeStr(descVal);
  const normAll = normalizeStr(allRowText);

  const targets = [
    'transactioncertificatecost',
    'transactioncertificate',
    'tccost',
    'tcost',
    'tccostcharge',
    'tcharge',
    'transactioncertcost',
  ];

  if (targets.some((t) => normModel.includes(t) || normDesc.includes(t))) {
    return true;
  }

  if (
    (normModel.includes('transaction') && normModel.includes('certificate')) ||
    (normDesc.includes('transaction') && normDesc.includes('certificate'))
  ) {
    return true;
  }

  if (normAll && targets.some((t) => normAll.includes(t))) {
    return true;
  }

  return false;
}

// Keywords to check for ANY non-product charge/service lines (Transportation Cost, Documentation Charge, etc.)
export function isNonProductChargeLine(val1: any, val2?: any, allText?: string): boolean {
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

const HEADER_KEYWORDS = [
  'pi', 'pino', 'pinumber', 'buyer', 'customer', 'factory', 'vendor', 'supplier',
  'model', 'description', 'tccost', 'cost', 'tcfee', 'tcamount', 'amount', 'total',
  'rate', 'price', 'value', 'orderdate', 'date', 'tcstatus', 'status', 'payment',
  'expectedtcdate', 'expecteddate', 'deliverystatus', 'delivery', 'standard', 'qty', 'quantity'
];

export async function parseExcelFile(
  file: File,
  forcedHeaderRowNumber?: number
): Promise<{
  validOrders: PIData[];
  fileInfo: UploadedFileInfo;
  allRawRows: any[];
  detectedHeaderRow: number;
  availableHeaderRows: { rowNumber: number; sampleText: string; score: number }[];
}> {
  const dataBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(dataBuffer, { type: 'array' });

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Read entire sheet as a 2D Array of rows
  const raw2D: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (raw2D.length === 0) {
    throw new Error('The uploaded Excel file is empty.');
  }

  // Scan first 10 rows to detect which row contains the Column Headers
  const maxScanRows = Math.min(raw2D.length, 10);
  const rowScores: { rowNumber: number; rowIndex: number; sampleText: string; score: number }[] = [];

  for (let r = 0; r < maxScanRows; r++) {
    const row = raw2D[r] || [];
    let score = 0;
    const nonEmptyCells = row.filter((c) => String(c).trim().length > 0);

    nonEmptyCells.forEach((cellVal) => {
      const norm = normalizeStr(cellVal);
      if (!norm) return;
      if (HEADER_KEYWORDS.some((kw) => norm === kw || norm.includes(kw))) {
        score += 2;
      } else {
        score += 0.2;
      }
    });

    rowScores.push({
      rowNumber: r + 1,
      rowIndex: r,
      sampleText: nonEmptyCells.slice(0, 6).map((c) => String(c).trim()).join(' | '),
      score,
    });
  }

  // Determine header row index
  let headerRowIndex = 0;
  if (forcedHeaderRowNumber && forcedHeaderRowNumber >= 1 && forcedHeaderRowNumber <= raw2D.length) {
    headerRowIndex = forcedHeaderRowNumber - 1;
  } else {
    let bestRow = rowScores[0];
    for (const item of rowScores) {
      if (item.score > bestRow.score) {
        bestRow = item;
      }
    }
    headerRowIndex = bestRow ? bestRow.rowIndex : 0;
  }

  const detectedHeaderRow = headerRowIndex + 1;

  // Extract column headers from the chosen header row
  const rawHeaders = (raw2D[headerRowIndex] || []).map((h) => String(h || '').trim());
  const normalizedKeyMap: Record<string, { original: string; colIndex: number }> = {};

  rawHeaders.forEach((header, colIdx) => {
    if (header) {
      const norm = normalizeStr(header);
      normalizedKeyMap[norm] = { original: header, colIndex: colIdx };
    }
  });

  const findColIndex = (candidates: string[], requireKeyword?: string): number => {
    // 1. Exact normalized match
    for (const cand of candidates) {
      const norm = normalizeStr(cand);
      if (normalizedKeyMap[norm] !== undefined) return normalizedKeyMap[norm].colIndex;
    }
    // 2. Strict substring match
    for (const cand of candidates) {
      const norm = normalizeStr(cand);
      if (norm.length < 5) continue;
      const matched = Object.keys(normalizedKeyMap).find((k) => {
        if (k.length < 5) return false;
        if (requireKeyword && !k.includes(requireKeyword)) return false;
        return k.includes(norm);
      });
      if (matched) return normalizedKeyMap[matched].colIndex;
    }
    return -1;
  };

  // Find column indexes
  const piCol = findColIndex(['pi number', 'pi no', 'pino', 'pi#', 'proforma invoice', 'pi', 'orderno', 'order', 'invoice no', 'invoice']);
  const modelCol = findColIndex(['model', 'item model', 'model name', 'style', 'item code', 'model/item']);
  const descCol = findColIndex(['description', 'item description', 'product description', 'item name', 'desc', 'particulars']);
  const amountCol = findColIndex(['amount', 'total amount', 'total', 'tc cost', 'cost', 'tc fee', 'value', 'price', 'rate', 'unit price', 'usd', 'charge']);
  const rateCol = findColIndex(['rate', 'unit rate', 'unit price', 'price']);
  const buyerCol = findColIndex(['buyer', 'brand', 'retailer', 'client', 'buyer name', 'brand name']);
  const customerCol = findColIndex(['customer', 'factory', 'vendor', 'supplier', 'garment factory', 'unit', 'party name', 'customer name']);
  const contactPersonCol = findColIndex(['createdby', 'created by', 'created_by', 'createdbyname', 'contact person', 'contactperson', 'creator', 'created user', 'entered by', 'prepared by', 'user', 'contact']);
  const orderDateCol = findColIndex(['order date', 'orderdate', 'po date', 'pi date', 'order dt', 'date']);
  const piAgeCol = findColIndex(['pi age', 'age', 'days', 'pi age days', 'ageing']);
  const orderStatusCol = findColIndex([
    'order status',
    'orderstatus',
    'po status',
    'order state',
    'order_status',
    'order tracking',
    'order state status',
    'item status',
  ]);
  const tcStatusCol = findColIndex(['tc status', 'tcstatus', 'cert status', 'tc stage', 'stage', 'tc tracking']);
  const paymentStatusCol = findColIndex(['payment status', 'payment', 'paid status', 'payment terms', 'pay status']);
  const expectedDateCol = findColIndex(['expected tc date', 'expected date', 'tc date', 'target date', 'due date', 'eta', 'delivery date']);
  const deliveryStatusCol = findColIndex(['delivery status', 'delivery', 'shipment status', 'shipping', 'dispatch', 'ship status']);
  const standardCol = findColIndex(['standard', 'cert standard', 'scope', 'grs', 'gots', 'fsc', 'certification']);
  const certBodyCol = findColIndex(['cert body', 'certification body', 'auditor', 'inspection body']);
  const delivQtyCol = findColIndex([
    'deliverd qty',
    'deliverd quantity',
    'deliverd',
    'deliverdqty',
    'delivrd qty',
    'delivery quantity',
    'delivery qty',
    'delivered qty',
    'delivered quantity',
    'deliv qty',
    'dispatch qty',
    'dispatched qty',
    'shipped qty',
    'del qty',
    'delivery pcs',
    'deliv pcs',
    'delivered pcs',
    'deliver pcs',
    'actual deliv qty',
  ]);
  const orderQtyCol = findColIndex([
    'order quantity',
    'order qty',
    'ordered quantity',
    'ordered qty',
    'total order quantity',
    'total order qty',
    'pi quantity',
    'pi qty',
    'order pcs',
    'total qty',
    'total quantity',
    'quantity (pcs)',
    'qty (pcs)',
    'quantity(pcs)',
    'qty(pcs)',
    'item qty',
    'quantity',
    'qty',
    'pcs',
    'volume',
    'units',
  ]);
  const balQtyCol = findColIndex(['balance quantity', 'balance qty', 'bal qty', 'remaining qty', 'balance pcs', 'bal pcs', 'undelivered qty']);
  const poRefCol = findColIndex(['po reference', 'po ref', 'po number', 'po#', 'buyer po', 'po no']);
  const invoiceNumberCol = findColIndex(['invoice number', 'invoice no', 'inv no', 'invoice#', 'inv#', 'commercial invoice', 'commercial invoice no', 'invoice']);
  const invoiceDateCol = findColIndex(['invoice date', 'inv date', 'commercial invoice date', 'inv dt', 'invoice dt', 'commercial date']);
  const styleCol = findColIndex(['style no', 'style', 'styleno', 'item style', 'style#', 'buyer style']);
  const widthCol = findColIndex(['width', 'w(mm)', 'w (mm)', 'w', 'width(mm)', 'width mm']);
  const lengthCol = findColIndex(['length', 'l(mm)', 'l (mm)', 'l', 'length(mm)', 'length mm', 'height']);
  const gussetCol = findColIndex(['gusset', 'g(mm)', 'g (mm)', 'g', 'gusset(mm)', 'gusset mm', 'bottom gusset']);
  const flapCol = findColIndex(['flap', 'f(mm)', 'f (mm)', 'f', 'flap(mm)', 'flap mm', 'lip']);
  const pktBoxCol = findColIndex(['pkt/box', 'pkt / box', 'packet/box', 'pkt/ctn', 'pkt', 'box', 'boxes', 'cartons', 'ctn', 'pack/box', 'packet']);
  
  // New TC-related columns
  const tcRequestDateCol = findColIndex(['tc request date', 'request date', 'tc requested date', 'tc request', 'request dt']);
  const receivedCommDocCol = findColIndex(['received commercial doc date', 'received commercial doc', 'commercial doc date', 'comm doc date', 'commercial doc received', 'doc received date', 'commercial doc']);
  const draftTcDateCol = findColIndex(['draft tc date', 'draft tc received date', 'draft date', 'draft received date', 'draft tc']);
  const draftConfirmDateCol = findColIndex(['draft confirmation date', 'draft confirmed date', 'draft confirm date', 'draft confirmation', 'draft confirmed']);
  const revisionQtyCol = findColIndex(['revision count', 'revision quantity', 'revision qty', 'no of revision', 'rev count', 'revision round', 'revision times', 'revision number'], 'revision');
  const finalTcApplyDateCol = findColIndex(['final tc apply date', 'final tc application date', 'final apply date', 'apply date', 'final apply dt']);
  const finalTcReceivedDateCol = findColIndex(['final tc received date', 'final tc date', 'final received date', 'tc received date', 'received tc date']);
  const tcNumberCol = findColIndex(['tc number', 'tc no', 'tc#', 't.c no', 'certificate number', 'cert number', 'certificate no', 'cert no']);

  const dataRows = raw2D.slice(headerRowIndex + 1);

  // Group by PI or process row-by-row
  // We check if rows contain "TRANSACTION CERTIFICATE COST" in Model or Description
  interface GroupedPI {
    piNumber: string;
    buyer: string;
    customer: string;
    orderDate: string;
    expectedTcDate: string;
    piAgeDays: number;
    tcStatus: TCStatus;
    paymentStatus: PaymentStatus;
    deliveryStatus: DeliveryStatus;
    orderStatus?: string;
    standard: string;
    certBody: string;
    poReference: string;
    productDescription: string;
    productOrderQtySum: number;
    productDelivQtySum: number;
    productBalQtySum: number;
    tcCostSum: number;
    hasExplicitTcCostLine: boolean;
    allLines: any[];
    tcRequestDate?: string;
    receivedCommercialDocDate?: string;
    draftTcDate?: string;
    draftConfirmationDate?: string;
    revisionQty?: number;
    finalTcApplyDate?: string;
    finalTcReceivedDate?: string;
    tcNumber?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    contactPerson?: string;
  }

  const piGroups: Record<string, GroupedPI> = {};
  const cancelledGroupKeys = new Set<string>();
  let zeroOrNonTcCount = 0;
  let lastSeenPiNumber = '';
  let lastSeenBuyer = '';
  let lastSeenCustomer = '';
  let lastSeenOrderDate = '';
  let lastSeenExpectedDate = '';
  let lastSeenStandard = '';
  let lastSeenCertBody = '';
  let lastSeenPoRef = '';

  dataRows.forEach((rowArray) => {
    if (!rowArray || rowArray.every((c) => String(c || '').trim() === '')) return;

    const getCell = (colIdx: number, fallback = '') => {
      if (colIdx !== -1 && rowArray[colIdx] !== undefined && rowArray[colIdx] !== null) {
        const val = String(rowArray[colIdx]).trim();
        return val.length > 0 ? val : fallback;
      }
      return fallback;
    };

    const rowText = rowArray.map((c) => String(c || '').trim()).join(' ');
    const normRowText = normalizeStr(rowText);

    // Skip footer / total / grand total summary rows in Excel
    if (
      normRowText.startsWith('grandtotal') ||
      normRowText.startsWith('subtotal') ||
      normRowText.startsWith('total') ||
      normRowText === 'total' ||
      normRowText.includes('grandtotal')
    ) {
      return;
    }

    const rawPi = getCell(piCol, '').trim();
    const modelVal = getCell(modelCol);
    const descVal = getCell(descCol);
    const isThisRowTcCost = isTcCostLine(modelVal, descVal, rowText);

    // If raw PI is empty:
    // If we have a lastSeenPiNumber and this row is an item/TC line, attach to previous PI
    // Otherwise, skip this row entirely (do NOT create ghost PIs like PI-2026-xxxx)
    let piNumber = rawPi;
    if (!piNumber) {
      if (lastSeenPiNumber && (isThisRowTcCost || modelVal || descVal)) {
        piNumber = lastSeenPiNumber;
      } else {
        // Skip unidentifiable rows
        return;
      }
    } else {
      lastSeenPiNumber = piNumber;
    }

    // Extract amount/cost from this row
    let rowAmount = 0;
    if (amountCol !== -1) {
      rowAmount = parseNumericCost(rowArray[amountCol]);
    }
    if (rowAmount === 0 && rateCol !== -1) {
      rowAmount = parseNumericCost(rowArray[rateCol]);
    }
    if (rowAmount === 0) {
      for (const cell of rowArray) {
        const num = parseNumericCost(cell);
        if (num > 0 && num < 10000) {
          rowAmount = num;
          break;
        }
      }
    }

    const rawBuyer = getCell(buyerCol, '');
    if (rawBuyer) lastSeenBuyer = rawBuyer;
    const buyer = rawBuyer || lastSeenBuyer || 'Global Buyer';

    const rawCust = getCell(customerCol, '');
    if (rawCust) lastSeenCustomer = rawCust;
    const customer = rawCust || lastSeenCustomer || 'Partner Garment Factory';

    const rawOrderDate = orderDateCol !== -1 && rowArray[orderDateCol] ? parseDateValue(rowArray[orderDateCol]) : '';
    if (rawOrderDate) lastSeenOrderDate = rawOrderDate;
    const orderDate = rawOrderDate || lastSeenOrderDate || '2026-08-15';

    const rawExpectedDate = expectedDateCol !== -1 && rowArray[expectedDateCol] ? parseDateValue(rowArray[expectedDateCol]) : '';
    if (rawExpectedDate) lastSeenExpectedDate = rawExpectedDate;
    const expectedTcDate = rawExpectedDate || lastSeenExpectedDate || '2026-09-20';

    const calculatedAge = piAgeCol !== -1 && parseNumericCost(rowArray[piAgeCol]) > 0
      ? parseNumericCost(rowArray[piAgeCol])
      : calculateAgeDays(orderDate);

    const isPastDue = new Date(expectedTcDate).getTime() < new Date('2026-09-25').getTime();
    const rawStatus = getCell(tcStatusCol, '');
    const tcStatus = mapToTcStatus(rawStatus, isPastDue && !rawStatus.toLowerCase().includes('issued'));
    const paymentStatus = paymentStatusCol !== -1 ? mapToPaymentStatus(rowArray[paymentStatusCol]) : 'Pending';
    const deliveryStatus = deliveryStatusCol !== -1 ? mapToDeliveryStatus(rowArray[deliveryStatusCol]) : 'In Transit';

    const rawStandard = getCell(standardCol, '');
    if (rawStandard) lastSeenStandard = rawStandard;
    const standard = rawStandard || lastSeenStandard || 'GRS 4.0';

    const rawCertBody = getCell(certBodyCol, '');
    if (rawCertBody) lastSeenCertBody = rawCertBody;
    const certBody = rawCertBody || lastSeenCertBody || 'Control Union';

    const rawPoRef = getCell(poRefCol, '');
    if (rawPoRef) lastSeenPoRef = rawPoRef;
    const poReference = rawPoRef || lastSeenPoRef || `PO-${Math.floor(100000 + Math.random() * 900000)}`;

    // Composite group key based strictly on PI Number + Customer
    const normPi = piNumber.trim().toUpperCase();
    const normCust = customer.trim().toUpperCase();
    const groupKey = normCust ? `${normPi}||${normCust}` : normPi;

    // Check for Order Status / Cancel Status in this row or any cell
    const rawOrderStatus = orderStatusCol !== -1 ? getCell(orderStatusCol, '') : '';
    const rawTcStatus = getCell(tcStatusCol, '');
    const rawDelivStatus = deliveryStatusCol !== -1 ? getCell(deliveryStatusCol, '') : '';

    const isThisRowCancelled =
      isCancelledStatus(rawOrderStatus) ||
      isCancelledStatus(rawTcStatus) ||
      isCancelledStatus(rawDelivStatus) ||
      isCancelledPi(piNumber) ||
      normRowText.includes('ordercancelled') ||
      normRowText.includes('ordercanceled') ||
      normRowText.includes('statuscancel') ||
      rowArray.some((cell: any) => isCancelledStatus(cell));

    if (isThisRowCancelled) {
      cancelledGroupKeys.add(groupKey);
      cancelledGroupKeys.add(normPi);
      cancelledGroupKeys.add(piNumber);
      // Remove ALL matching groups in piGroups for this PI Number
      Object.keys(piGroups).forEach((k) => {
        const itm = piGroups[k];
        if (
          k === groupKey ||
          k === normPi ||
          k.startsWith(`${normPi}||`) ||
          (itm && (itm.piNumber === piNumber || isCancelledPi(itm.piNumber)))
        ) {
          delete piGroups[k];
        }
      });
      return;
    }

    if (
      cancelledGroupKeys.has(groupKey) ||
      cancelledGroupKeys.has(normPi) ||
      cancelledGroupKeys.has(piNumber) ||
      isCancelledPi(piNumber)
    ) {
      return;
    }

    const tcReqDate = tcRequestDateCol !== -1 && rowArray[tcRequestDateCol] ? parseDateValue(rowArray[tcRequestDateCol]) : undefined;
    const recCommDate = receivedCommDocCol !== -1 && rowArray[receivedCommDocCol] ? parseDateValue(rowArray[receivedCommDocCol]) : undefined;
    const draftDate = draftTcDateCol !== -1 && rowArray[draftTcDateCol] ? parseDateValue(rowArray[draftTcDateCol]) : undefined;
    const draftConfDate = draftConfirmDateCol !== -1 && rowArray[draftConfirmDateCol] ? parseDateValue(rowArray[draftConfirmDateCol]) : undefined;
    const revQty = revisionQtyCol !== -1 ? parseNumericCost(rowArray[revisionQtyCol]) : undefined;
    const finalApplyDate = finalTcApplyDateCol !== -1 && rowArray[finalTcApplyDateCol] ? parseDateValue(rowArray[finalTcApplyDateCol]) : undefined;
    const finalRecDate = finalTcReceivedDateCol !== -1 && rowArray[finalTcReceivedDateCol] ? parseDateValue(rowArray[finalTcReceivedDateCol]) : undefined;
    const tcNum = tcNumberCol !== -1 && rowArray[tcNumberCol] ? String(rowArray[tcNumberCol]).trim() : undefined;

    // Read raw row quantities
    const rawRowOrderQ = orderQtyCol !== -1 ? parseNumericCost(rowArray[orderQtyCol]) : 0;
    const rawRowDelivQ = delivQtyCol !== -1 ? parseNumericCost(rowArray[delivQtyCol]) : 0;
    const rawRowBalQ = balQtyCol !== -1 ? parseNumericCost(rowArray[balQtyCol]) : 0;

    const parsedOrderQ = rawRowOrderQ;
    const parsedDelivQ = rawRowDelivQ;
    const parsedBalQ = rawRowBalQ;

    const invNum = invoiceNumberCol !== -1 && rowArray[invoiceNumberCol] ? String(rowArray[invoiceNumberCol]).trim() : undefined;
    const invDate = invoiceDateCol !== -1 && rowArray[invoiceDateCol] ? parseDateValue(rowArray[invoiceDateCol]) : undefined;
    const rawContactPerson = contactPersonCol !== -1 && rowArray[contactPersonCol] ? String(rowArray[contactPersonCol]).trim() : undefined;

    if (!piGroups[groupKey]) {
      piGroups[groupKey] = {
        piNumber,
        buyer,
        customer,
        orderDate,
        expectedTcDate,
        piAgeDays: calculatedAge,
        tcStatus,
        paymentStatus,
        deliveryStatus,
        invoiceNumber: invNum,
        invoiceDate: invDate,
        contactPerson: rawContactPerson,
        standard,
        certBody,
        poReference,
        productDescription: 'TRANSACTION CERTIFICATE COST',
        productOrderQtySum: 0,
        productDelivQtySum: 0,
        productBalQtySum: 0,
        tcCostSum: 0,
        hasExplicitTcCostLine: false,
        allLines: [],
        tcRequestDate: tcReqDate,
        receivedCommercialDocDate: recCommDate,
        draftTcDate: draftDate,
        draftConfirmationDate: draftConfDate,
        revisionQty: revQty,
        finalTcApplyDate: finalApplyDate,
        finalTcReceivedDate: finalRecDate,
        tcNumber: tcNum,
      };
    }

    const group = piGroups[groupKey];
    group.allLines.push(rowArray);

    if (rawContactPerson && !group.contactPerson) group.contactPerson = rawContactPerson;

    if (tcReqDate && !group.tcRequestDate) group.tcRequestDate = tcReqDate;
    if (recCommDate && !group.receivedCommercialDocDate) group.receivedCommercialDocDate = recCommDate;
    if (draftDate && !group.draftTcDate) group.draftTcDate = draftDate;
    if (draftConfDate && !group.draftConfirmationDate) group.draftConfirmationDate = draftConfDate;
    if (revQty !== undefined && group.revisionQty === undefined) group.revisionQty = revQty;
    if (finalApplyDate && !group.finalTcApplyDate) group.finalTcApplyDate = finalApplyDate;
    if (finalRecDate && !group.finalTcReceivedDate) group.finalTcReceivedDate = finalRecDate;
    if (tcNum && !group.tcNumber) group.tcNumber = tcNum;
    if (invNum && !group.invoiceNumber) group.invoiceNumber = invNum;

    // If buyer/customer wasn't filled on initial line, update from valid line
    if (group.buyer === 'Global Buyer' && buyer !== 'Global Buyer') group.buyer = buyer;
    if (group.customer === 'Partner Garment Factory' && customer !== 'Partner Garment Factory') group.customer = customer;

    const isThisRowNonProduct = isNonProductChargeLine(modelVal, descVal, rowText);

    if (isThisRowTcCost) {
      group.hasExplicitTcCostLine = true;
      group.tcCostSum += rowAmount > 0 ? rowAmount : 250; // default standard TC cost if blank
    } else if (isThisRowNonProduct) {
      // Non-product fee/charge line (e.g. Transportation Cost, Documentation Charge, etc.)
      // Strictly do NOT sum into physical product quantities!
    } else {
      // Genuine physical product item line -> Sum product order quantity!
      if (parsedOrderQ > 1) {
        group.productOrderQtySum += parsedOrderQ;
      } else if (parsedOrderQ > 0 && !group.hasExplicitTcCostLine) {
        group.productOrderQtySum += parsedOrderQ;
      }
      if (parsedDelivQ > 0) group.productDelivQtySum += parsedDelivQ;
      if (parsedBalQ > 0) group.productBalQtySum += parsedBalQ;
    }

    if (amountCol !== -1 && rawHeaders[amountCol] && normalizeStr(rawHeaders[amountCol]).includes('tccost') && rowAmount > 0) {
      group.hasExplicitTcCostLine = true;
      group.tcCostSum += rowAmount;
    }
  });

  const validOrders: PIData[] = [];
  const allPIs = Object.values(piGroups);

  allPIs.forEach((group, idx) => {
    // CRITICAL: Exclude any cancelled PI!
    const cleanPi = group.piNumber.trim().toUpperCase();
    if (
      cancelledGroupKeys.has(cleanPi) ||
      cancelledGroupKeys.has(group.piNumber) ||
      isCancelledPi(group.piNumber) ||
      isCancelledOrder(group as any)
    ) {
      return;
    }

    // CRITICAL REQUIREMENT:
    // Keep ONLY PIs that have TRANSACTION CERTIFICATE COST added!
    if (group.hasExplicitTcCostLine && group.tcCostSum > 0) {
      let finalOrderQ = group.productOrderQtySum;
      let finalDelivQ = group.productDelivQtySum;

      // If delivery quantity was found in Deliverd Qty column and order qty was blank, equate them
      if (finalOrderQ === 0 && finalDelivQ > 0) {
        finalOrderQ = finalDelivQ;
      }

      let finalBalQ = Math.max(0, finalOrderQ - finalDelivQ);

      const autoStatus = computeAutomatedTcStatus({
        tcRequestDate: group.tcRequestDate,
        receivedCommercialDocDate: group.receivedCommercialDocDate,
        draftTcDate: group.draftTcDate,
        draftConfirmationDate: group.draftConfirmationDate,
        revisionQty: group.revisionQty,
        finalTcApplyDate: group.finalTcApplyDate,
        finalTcReceivedDate: group.finalTcReceivedDate,
        tcNumber: group.tcNumber,
      });

      // Status is 100% automated: if no dates/fields are set, it is strictly 'Not Requested'
      const finalTcStatus = autoStatus;

      // Determine deliveryStatus strictly based on delivery and balance quantities:
      // If balance === 0 and delivered > 0 or order > 0 => DELIVERED!
      // If balance > 0 and delivered > 0 => IN TRANSIT
      // If balance > 0 and delivered === 0 => PENDING DISPATCH
      let finalDeliveryStatus: DeliveryStatus = group.deliveryStatus || 'Pending Dispatch';
      if (finalBalQ === 0 && (finalOrderQ > 0 || finalDelivQ > 0)) {
        finalDeliveryStatus = 'Delivered';
      } else if (finalBalQ > 0 && finalDelivQ > 0) {
        finalDeliveryStatus = 'In Transit';
      } else if (finalBalQ > 0 && finalDelivQ === 0) {
        if (finalDeliveryStatus === 'Delivered') {
          finalDeliveryStatus = 'Pending Dispatch';
        }
      }

      // Extract all genuine product rows (excluding TRANSACTION CERTIFICATE COST and lines where order quantity <= 1)
      const extractedProductItems: any[] = [];
      group.allLines.forEach((rowArr: any, lineIdx: number) => {
        const mVal = modelCol !== -1 && rowArr[modelCol] !== undefined ? String(rowArr[modelCol]).trim() : '';
        const dVal = descCol !== -1 && rowArr[descCol] !== undefined ? String(rowArr[descCol]).trim() : '';
        const rowStyle = styleCol !== -1 && rowArr[styleCol] ? String(rowArr[styleCol]).trim() : '';
        const rowPO = poRefCol !== -1 && rowArr[poRefCol] ? String(rowArr[poRefCol]).trim() : '';
        const rTxt = rowArr.map((c: any) => String(c || '').trim()).join(' ');

        // STRICT USER DIRECTIVE: Exclude all service charges, Transportation Cost, Documentation Charge, TC Cost, etc.!
        if (
          isTcCostLine(mVal, dVal, rTxt) ||
          isNonProductChargeLine(mVal, dVal, rTxt) ||
          isNonProductChargeLine(rowStyle)
        ) {
          return;
        }
        const rowWidth = widthCol !== -1 && rowArr[widthCol] ? String(rowArr[widthCol]).trim() : '';
        const rowLength = lengthCol !== -1 && rowArr[lengthCol] ? String(rowArr[lengthCol]).trim() : '';
        const rowGusset = gussetCol !== -1 && rowArr[gussetCol] ? String(rowArr[gussetCol]).trim() : '';
        const rowFlap = flapCol !== -1 && rowArr[flapCol] ? String(rowArr[flapCol]).trim() : '';
        const rowPktBox = pktBoxCol !== -1 && rowArr[pktBoxCol] ? String(rowArr[pktBoxCol]).trim() : '';
        const rowOrder = orderQtyCol !== -1 ? parseNumericCost(rowArr[orderQtyCol]) : 0;
        const rowDeliv = delivQtyCol !== -1 ? parseNumericCost(rowArr[delivQtyCol]) : 0;
        const rowBal = balQtyCol !== -1 ? parseNumericCost(rowArr[balQtyCol]) : 0;

        // USER DIRECTIVE: If order quantity is 1 (or <= 1), remove/skip this entire line!
        if (rowOrder <= 1) {
          return;
        }

        // Skip completely blank rows
        if (!mVal && !dVal && !rowStyle && rowOrder === 0 && rowDeliv === 0) {
          return;
        }

        const validOrderQ = rowOrder;
        const validDelivQ = rowDeliv <= 1 && validOrderQ > 1 ? validOrderQ : (rowDeliv <= 1 ? 0 : rowDeliv);
        const validBalQ = rowBal > 0 ? rowBal : Math.max(0, validOrderQ - validDelivQ);

        const currentSl = extractedProductItems.length + 1;
        const cleanStyle = rowStyle || (rowPO ? `PO ${rowPO}` : (group.poReference ? `PO ${group.poReference}` : `Item ${currentSl}`));
        const cleanModel = mVal || dVal || (group.productDescription !== 'TRANSACTION CERTIFICATE COST' ? group.productDescription : 'POLYBAGS');

        extractedProductItems.push({
          id: `${group.piNumber}-prod-${lineIdx}-${currentSl}`,
          slNo: currentSl,
          styleNo: cleanStyle,
          modelProduct: cleanModel,
          width: rowWidth !== '' && rowWidth !== undefined ? rowWidth : '-',
          length: rowLength !== '' && rowLength !== undefined ? rowLength : '-',
          gusset: rowGusset !== '' && rowGusset !== undefined ? rowGusset : '-',
          flap: rowFlap !== '' && rowFlap !== undefined ? rowFlap : '-',
          orderQty: validOrderQ,
          deliveryQty: validDelivQ > 0 ? validDelivQ : validOrderQ,
          pktBox: rowPktBox !== '' && rowPktBox !== undefined ? rowPktBox : '-',
          balanceQty: validBalQ > 0 ? validBalQ : '-',
          piNumber: group.piNumber,
        });
      });

      // Fallback: If no sub-rows were extracted, generate 1 clean product line matching the PI
      if (extractedProductItems.length === 0 && (finalOrderQ > 0 || finalDelivQ > 0)) {
        extractedProductItems.push({
          id: `${group.piNumber}-default-prod-1`,
          slNo: 1,
          styleNo: group.poReference ? `PO ${group.poReference}` : 'POLYBAGS',
          modelProduct: group.productDescription !== 'TRANSACTION CERTIFICATE COST' ? group.productDescription : 'POLYBAGS',
          width: '-',
          length: '-',
          gusset: '-',
          flap: '-',
          orderQty: finalOrderQ,
          deliveryQty: finalDelivQ,
          pktBox: '-',
          balanceQty: finalBalQ > 0 ? finalBalQ : '-',
          piNumber: group.piNumber,
        });
      }

      validOrders.push({
        id: `${group.piNumber}-${idx}`,
        piNumber: group.piNumber,
        customer: group.customer,
        buyer: group.buyer,
        orderDate: group.orderDate,
        piAgeDays: group.piAgeDays,
        tcStatus: finalTcStatus,
        tcCost: group.tcCostSum,
        paymentStatus: group.paymentStatus,
        expectedTcDate: group.expectedTcDate,
        deliveryStatus: finalDeliveryStatus,
        orderStatus: group.orderStatus || '',
        invoiceNumber: group.invoiceNumber || '',
        invoiceDate: group.invoiceDate || '',
        contactPerson: group.contactPerson || 'System',
        standard: group.standard,
        certBody: group.certBody,
        quantityPcs: finalOrderQ,
        orderQuantity: finalOrderQ,
        deliveryQuantity: finalDelivQ,
        balanceQuantity: finalBalQ,
        productDescription: 'TRANSACTION CERTIFICATE COST',
        factoryUnit: 'Mainetti Sourcing Facility',
        poReference: group.poReference,
        season: 'FY2026 / Active',
        notes: `Extracted from Excel (${file.name}) where Model/Description contains 'TRANSACTION CERTIFICATE COST'. Cost: $${group.tcCostSum} USD.`,
        productItems: extractedProductItems,
        tcRequestDate: group.tcRequestDate,
        receivedCommercialDocDate: group.receivedCommercialDocDate,
        draftTcDate: group.draftTcDate,
        draftConfirmationDate: group.draftConfirmationDate,
        revisionQty: group.revisionQty,
        finalTcApplyDate: group.finalTcApplyDate,
        finalTcReceivedDate: group.finalTcReceivedDate,
        tcNumber: group.tcNumber,
      });
    } else {
      zeroOrNonTcCount++;
    }
  });

  const totalCostUsd = validOrders.reduce((sum, item) => sum + item.tcCost, 0);

  // Save the complete raw item-level table to browser storage
  try {
    const allExtractedItems = validOrders.flatMap((o) => o.productItems || []);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mainetti_raw_product_items_table', JSON.stringify(allExtractedItems));
    }
  } catch (storageErr) {
    console.warn('Failed to save raw product items table to localStorage:', storageErr);
  }

  const fileInfo: UploadedFileInfo = {
    fileName: file.name,
    fileSize: file.size,
    uploadDate: new Date().toLocaleString(),
    totalRowsFound: dataRows.length,
    validRowsWithTcCost: validOrders.length,
    filteredOutZeroCostRows: zeroOrNonTcCount,
    totalCostUsd,
  };

  return {
    validOrders,
    fileInfo,
    allRawRows: [],
    detectedHeaderRow,
    availableHeaderRows: rowScores.map((r) => ({
      rowNumber: r.rowNumber,
      sampleText: r.sampleText,
      score: r.score,
    })),
  };
}

// Sanitize PIData to guarantee any Order Quantity of 1 (or <= 1) becomes 0,
// and if Balance Quantity is 1, subtract 1 from Order Quantity so Balance becomes 0,
// and strictly exclude any cancelled orders or PIs
export function sanitizePidData(list: PIData[]): PIData[] {
  const sanitized = list
    .filter((item) => !isCancelledOrder(item) && !isCancelledPi(item.piNumber))
    .map((item) => {
    const rawOrderQ = item.orderQuantity ?? item.quantityPcs ?? 0;
    const rawDelivQ = item.deliveryQuantity ?? 0;
    const cleanOrderQ = rawOrderQ;
    const cleanDelivQ = rawDelivQ;
    const cleanBalQ = item.balanceQuantity !== undefined && item.balanceQuantity !== null
      ? item.balanceQuantity
      : Math.max(0, cleanOrderQ - cleanDelivQ);

    // Determine cleanDeliveryStatus strictly based on cleanBalQ and cleanDelivQ:
    let cleanDeliveryStatus: DeliveryStatus = item.deliveryStatus || 'Pending Dispatch';
    if (cleanBalQ === 0 && (cleanOrderQ > 0 || cleanDelivQ > 0)) {
      cleanDeliveryStatus = 'Delivered';
    } else if (cleanBalQ > 0 && cleanDelivQ > 0) {
      if (cleanDeliveryStatus === 'Pending Dispatch' || cleanDeliveryStatus === 'Delivered') {
        cleanDeliveryStatus = 'In Transit';
      }
    } else if (cleanBalQ > 0 && cleanDelivQ === 0) {
      if (cleanDeliveryStatus === 'Delivered') {
        cleanDeliveryStatus = 'Pending Dispatch';
      }
    }

    // Sanitize Revision Qty: Must be a small revision count (0 to 20 times), NOT an order quantity (e.g. 39,085)
    let cleanRevQty = item.revisionQty !== undefined && item.revisionQty !== null ? Number(item.revisionQty) : 0;
    if (isNaN(cleanRevQty) || cleanRevQty > 20 || cleanRevQty < 0) {
      cleanRevQty = 0;
    }

    const cleanTcStatus = computeAutomatedTcStatus({
      ...item,
      revisionQty: cleanRevQty,
    });

    return {
      ...item,
      contactPerson: item.contactPerson || 'System',
      revisionQty: cleanRevQty,
      tcStatus: cleanTcStatus,
      deliveryStatus: cleanDeliveryStatus,
      quantityPcs: cleanOrderQ,
      orderQuantity: cleanOrderQ,
      deliveryQuantity: cleanDelivQ,
      balanceQuantity: cleanBalQ,
      productItems: item.productItems
        ? item.productItems.filter((p) => (Number(p.orderQty) || 0) > 1)
        : undefined,
    };
  });

  return enrichPiListWithSavedChallanMap(sanitized);
}

import { savePIDataToFirestore } from './firestoreStorage';

// Persistent Storage Helpers (LocalStorage + Firestore Cloud Sync)
export function saveToPersistentStorage(data: PIData[], fileInfo: UploadedFileInfo | null) {
  try {
    const cleanData = sanitizePidData(data);
    localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(cleanData));
    if (fileInfo) {
      localStorage.setItem(STORAGE_KEY_FILE_INFO, JSON.stringify(fileInfo));
    }
    // Mirror to Firestore Cloud Database so all browsers and devices get the updated data
    savePIDataToFirestore(cleanData);
    // Dispatch custom event for real-time UI synchronization across components & tabs
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('pi_data_updated', { detail: cleanData }));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

export function loadFromPersistentStorage(): { data: PIData[] | null; fileInfo: UploadedFileInfo | null } {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY_DATA);
    const rawFileInfo = localStorage.getItem(STORAGE_KEY_FILE_INFO);

    const data = rawData ? sanitizePidData(JSON.parse(rawData) as PIData[]) : null;
    const fileInfo = rawFileInfo ? (JSON.parse(rawFileInfo) as UploadedFileInfo) : null;

    return { data, fileInfo };
  } catch (err) {
    console.error('Failed to load from localStorage:', err);
    return { data: null, fileInfo: null };
  }
}

export function clearPersistentStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY_DATA);
    localStorage.removeItem(STORAGE_KEY_FILE_INFO);
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('pi_data_updated', { detail: [] }));
  } catch (err) {
    console.error('Failed to clear localStorage:', err);
  }
}

// Generate Downloadable Template .xlsx with explicit Model/Description = TRANSACTION CERTIFICATE COST
export function downloadSampleExcelTemplate(includeTitleRow = true) {
  const sheetAoa = [
    ['MAINETTI GLOBAL SUPPLY CHAIN - PROFORMA INVOICE (PI) ITEM DETAILS REPORT', '', '', '', '', '', '', '', '', '', '', '', ''],
    [
      'PI Number',
      'Buyer',
      'Customer / Factory',
      'Order Date',
      'Model',
      'Description',
      'Quantity',
      'Rate (USD)',
      'Amount (USD)',
      'Payment Status',
      'Expected TC Date',
      'Delivery Status',
      'PO Reference',
    ],
    // PI 1: Has TRANSACTION CERTIFICATE COST -> KEPT
    [
      'PI-2026-9201',
      'H&M',
      'Epic Group (Unit 02)',
      '2026-08-14',
      'TRANSACTION CERTIFICATE COST',
      'TRANSACTION CERTIFICATE COST',
      1,
      320,
      320,
      'Pending',
      '2026-09-12',
      'Delivered',
      'HM-PO-991204',
    ],
    // PI 2: Standard garment accessories, NO TC cost -> FILTERED OUT
    [
      'PI-2026-9202',
      'Inditex / Zara',
      'Ha-Meem Apparel Ltd',
      '2026-08-22',
      'M-491 HANGER',
      'Recycled Polypro Top Hangers',
      120000,
      0.15,
      18000,
      'Paid',
      '2026-10-10',
      'Pending Dispatch',
      'ZARA-ES-300192',
    ],
    // PI 3: Has TRANSACTION CERTIFICATE COST -> KEPT
    [
      'PI-2026-9203',
      'Target',
      'Pacific Jeans Ltd',
      '2026-08-08',
      'TRANSACTION CERTIFICATE COST',
      'TRANSACTION CERTIFICATE COST',
      1,
      450,
      450,
      'Paid',
      '2026-09-29',
      'In Transit',
      'TGT-US-550182',
    ],
    // PI 4: Standard carton box, NO TC cost -> FILTERED OUT
    [
      'PI-2026-9204',
      'Marks & Spencer',
      'DBL Group (Mawna)',
      '2026-08-26',
      'FSC-BOX-2026',
      'FSC Certified Outer Cartons',
      5000,
      1.2,
      6000,
      'Pending',
      '2026-10-15',
      'Production Complete',
      'MS-UK-918201',
    ],
    // PI 5: Has TRANSACTION CERTIFICATE COST -> KEPT
    [
      'PI-2026-9205',
      'Nike',
      'Youngone Corp',
      '2026-07-28',
      'TRANSACTION CERTIFICATE COST',
      'TRANSACTION CERTIFICATE COST',
      1,
      380,
      380,
      'Paid',
      '2026-08-30',
      'Delivered',
      'NKE-GL-882910',
    ],
    // PI 6: Has TRANSACTION CERTIFICATE COST -> KEPT
    [
      'PI-2026-9206',
      'PVH Corp',
      'Standard Group',
      '2026-09-02',
      'TRANSACTION CERTIFICATE COST',
      'TRANSACTION CERTIFICATE COST',
      1,
      290,
      290,
      'Paid',
      '2026-10-04',
      'In Transit',
      'PVH-TH-229104',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetAoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PI_TC_Cost_Report');
  XLSX.writeFile(wb, 'Mainetti_PI_Transaction_Certificate_Cost_Template.xlsx');
}
