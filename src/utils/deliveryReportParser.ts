import * as XLSX from 'xlsx';
import { PIData, DeliveryReportFileInfo } from '../types/tc';

export interface PiDeliveryChallanSummary {
  piNumber: string;
  normalizedPi: string;
  lastChallanNumber: string;
  lastDeliveryDate?: string;
  allChallanNumbers: string[];
  deliveryCount: number;
  totalDeliveredQtyInReport?: number;
}

const STORAGE_KEY_DELIVERY_MAP = 'mainetti_delivery_report_map_v1';
const STORAGE_KEY_DELIVERY_INFO = 'mainetti_delivery_report_info_v1';

function normalizeKey(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function normalizePiKey(pi: any): string {
  if (!pi) return '';
  return String(pi)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function normalizePiAlphaNum(pi: any): string {
  if (!pi) return '';
  return String(pi)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function parseExcelDate(val: any): string | undefined {
  if (!val) return undefined;
  if (typeof val === 'number' && val > 20000 && val < 90000) {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  if (!str) return undefined;
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1995 && parsed.getFullYear() < 2100) {
    return parsed.toISOString().split('T')[0];
  }
  return str;
}

function isValidChallanValue(val: any): boolean {
  if (val === null || val === undefined) return false;
  const s = String(val).trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (
    lower === '-' ||
    lower === '--' ||
    lower === '0' ||
    lower === 'n/a' ||
    lower === 'na' ||
    lower === 'nil' ||
    lower === 'none' ||
    lower === 'pending' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'total' ||
    lower === 'grand total'
  ) {
    return false;
  }
  return true;
}

export async function parseDeliveryReportFile(
  file: File,
  existingPiList: PIData[] = []
): Promise<{
  piChallanMap: Record<string, PiDeliveryChallanSummary>;
  updatedPiList: PIData[];
  fileInfo: DeliveryReportFileInfo;
  matchedLogs: {
    piNumber: string;
    previousChallan: string;
    newLastChallan: string;
    deliveryCount: number;
    lastDeliveryDate?: string;
  }[];
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The uploaded Delivery Report Excel file contains no sheets.');
  }

  interface RawEntry {
    rawPi: string;
    challanNo: string;
    deliveryDate?: string;
    deliveredQty: number;
    rowOrder: number;
  }

  const collectedEntries: RawEntry[] = [];
  let totalRowsScanned = 0;
  let globalRowOrder = 0;

  // Scan all sheets in the Delivery Report workbook
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const raw2D = XLSX.utils.sheet_to_json<any[]>(worksheet, {
      header: 1,
      defval: '',
      raw: true,
    });

    if (!raw2D || raw2D.length === 0) continue;

    // Detect Header Row in this sheet (scan top 20 rows)
    let bestHeaderRowIdx = 0;
    let bestHeaderScore = -1;

    const maxScan = Math.min(20, raw2D.length);
    for (let r = 0; r < maxScan; r++) {
      const row = raw2D[r] || [];
      let score = 0;
      row.forEach((cell: any) => {
        const norm = normalizeKey(cell);
        if (!norm) return;
        if (
          norm.includes('pino') ||
          norm.includes('pinumber') ||
          norm === 'pi' ||
          norm.includes('proforma') ||
          norm.includes('challan') ||
          norm.includes('gatepass') ||
          norm.includes('dcno') ||
          norm.includes('deliverydate') ||
          norm.includes('deliveryno') ||
          norm.includes('dono') ||
          norm.includes('orderno')
        ) {
          score += 3;
        } else if (
          norm.includes('buyer') ||
          norm.includes('customer') ||
          norm.includes('factory') ||
          norm.includes('qty') ||
          norm.includes('quantity') ||
          norm.includes('date') ||
          norm.includes('style') ||
          norm.includes('status')
        ) {
          score += 1;
        }
      });

      if (score > bestHeaderScore) {
        bestHeaderScore = score;
        bestHeaderRowIdx = r;
      }
    }

    const rawHeaders = (raw2D[bestHeaderRowIdx] || []).map((h: any) => String(h || '').trim());
    const normHeaders = rawHeaders.map((h) => normalizeKey(h));

    const findCol = (exactCandidates: string[], substringCandidates: string[], excludeSubstrings: string[] = []): number => {
      // 1. Exact match
      for (const cand of exactCandidates) {
        const normCand = normalizeKey(cand);
        const idx = normHeaders.findIndex((h) => h === normCand);
        if (idx !== -1) return idx;
      }
      // 2. Substring match
      for (const cand of substringCandidates) {
        const normCand = normalizeKey(cand);
        const idx = normHeaders.findIndex((h) => {
          if (!h) return false;
          if (excludeSubstrings.some((ex) => h.includes(normalizeKey(ex)))) return false;
          return h.includes(normCand);
        });
        if (idx !== -1) return idx;
      }
      return -1;
    };

    let piCol = findCol(
      [
        'pi number',
        'pi no',
        'pi no.',
        'pino',
        'pi#',
        'pi-number',
        'pi_no',
        'proforma invoice',
        'proforma invoice no',
        'p.i. no',
        'p.i no',
        'pi',
        'pi ref',
        'order no',
        'order number',
        'so no',
        'sales order',
      ],
      ['pinumber', 'pino', 'proforma', 'piref', 'orderno', 'salesorder'],
      ['date', 'qty', 'quantity', 'status', 'age', 'value', 'amount']
    );

    let challanCol = findCol(
      [
        'challan number',
        'challan no',
        'challan no.',
        'challanno',
        'challan#',
        'challan',
        'delivery challan no',
        'delivery challan number',
        'delivery challan',
        'last challan no',
        'last challan number',
        'last delivery challan',
        'dc no',
        'dc number',
        'd.c. no',
        'd/c no',
        'gate pass no',
        'gate pass number',
        'gate pass',
        'delivery no',
        'delivery number',
        'delivery note',
        'delivery note no',
        'do no',
        'do number',
        'dispatch no',
      ],
      ['challanno', 'challannumber', 'deliverychallan', 'lastchallan', 'gatepass', 'dcno', 'challan', 'deliverynote', 'deliveryno', 'dono'],
      ['date', 'qty', 'quantity', 'status', 'amount', 'value']
    );

    const deliveryDateCol = findCol(
      [
        'delivery date',
        'challan date',
        'dispatch date',
        'dc date',
        'delivered date',
        'shipped date',
        'gate pass date',
        'date',
      ],
      ['deliverydate', 'challandate', 'dispatchdate', 'dcdate', 'shippeddate'],
      ['pi', 'order', 'request', 'draft', 'final', 'invoice']
    );

    const delivQtyCol = findCol(
      [
        'delivery qty',
        'delivered qty',
        'deliverd qty',
        'challan qty',
        'delivery quantity',
        'delivered quantity',
        'dispatch qty',
        'shipped qty',
      ],
      ['deliveryqty', 'deliveredqty', 'deliverdqty', 'challanqty', 'dispatchqty'],
      ['date', 'no', 'number', 'status']
    );

    const dataRows = raw2D.slice(bestHeaderRowIdx + 1);

    // Fallback: If piCol was not detected by header name, inspect first 30 data rows for MPBL/... or PI-... pattern
    if (piCol === -1 && dataRows.length > 0) {
      const colScores: Record<number, number> = {};
      dataRows.slice(0, 30).forEach((row) => {
        row.forEach((cell: any, cIdx: number) => {
          const val = String(cell || '').trim().toUpperCase();
          if (/^(MPBL\/|PI-|PI\/|[A-Z]{2,5}\/\d{3,6}\/\d{2,4})/.test(val)) {
            colScores[cIdx] = (colScores[cIdx] || 0) + 1;
          }
        });
      });
      const bestPiCol = Object.entries(colScores).sort((a, b) => b[1] - a[1])[0];
      if (bestPiCol && bestPiCol[1] >= 1) {
        piCol = Number(bestPiCol[0]);
      }
    }

    if (piCol === -1 || challanCol === -1) {
      continue;
    }

    let lastSeenPi = '';

    dataRows.forEach((row) => {
      if (!row || row.length === 0) return;
      totalRowsScanned++;
      globalRowOrder++;

      const rawPiCell = row[piCol] !== undefined && row[piCol] !== null ? String(row[piCol]).trim() : '';
      const rawChallanCell = row[challanCol] !== undefined && row[challanCol] !== null ? String(row[challanCol]).trim() : '';

      // Skip total / header repetition rows
      const normPiCell = normalizeKey(rawPiCell);
      if (
        normPiCell === 'total' ||
        normPiCell === 'grandtotal' ||
        normPiCell === 'subtotal' ||
        normPiCell === 'pinumber' ||
        normPiCell === 'pino'
      ) {
        return;
      }

      let effectivePi = rawPiCell;
      if (!effectivePi && lastSeenPi && isValidChallanValue(rawChallanCell)) {
        // Merged/grouped PI cells in Excel where sub-rows leave PI blank
        effectivePi = lastSeenPi;
      } else if (effectivePi) {
        lastSeenPi = effectivePi;
      }

      if (!effectivePi || !isValidChallanValue(rawChallanCell)) {
        return;
      }

      const dDate = deliveryDateCol !== -1 ? parseExcelDate(row[deliveryDateCol]) : undefined;
      const dQtyRaw = delivQtyCol !== -1 ? parseFloat(String(row[delivQtyCol] || '0').replace(/,/g, '')) : 0;
      const dQty = isNaN(dQtyRaw) ? 0 : Math.max(0, dQtyRaw);

      collectedEntries.push({
        rawPi: effectivePi,
        challanNo: rawChallanCell,
        deliveryDate: dDate,
        deliveredQty: dQty,
        rowOrder: globalRowOrder,
      });
    });
  }

  if (collectedEntries.length === 0) {
    throw new Error(
      `Could not find valid PI Number + Challan Number rows in "${file.name}". Please ensure your Delivery Report has columns for PI Number (e.g., 'PI No' / 'PI Number') and Challan Number (e.g., 'Challan No' / 'Delivery Challan No' / 'DC No').`
    );
  }

  // Group entries by PI Number and determine the LAST Delivery Challan Number for each PI
  const groupedByPi: Record<
    string,
    {
      displayPi: string;
      entries: RawEntry[];
    }
  > = {};

  collectedEntries.forEach((entry) => {
    const key = normalizePiAlphaNum(entry.rawPi);
    if (!key) return;
    if (!groupedByPi[key]) {
      groupedByPi[key] = {
        displayPi: entry.rawPi.trim(),
        entries: [],
      };
    }
    groupedByPi[key].entries.push(entry);
  });

  const piChallanMap: Record<string, PiDeliveryChallanSummary> = {};

  Object.entries(groupedByPi).forEach(([alphaKey, group]) => {
    const entries = group.entries;

    // Sort entries chronologically if dates exist, otherwise preserve row order (bottom-most / latest row in report is last)
    // Also if multiple challans on the same date or no date, compare numeric challan numbers or rowOrder
    const sorted = [...entries].sort((a, b) => {
      if (a.deliveryDate && b.deliveryDate && a.deliveryDate !== b.deliveryDate) {
        return a.deliveryDate.localeCompare(b.deliveryDate);
      }
      // If both challan numbers are purely numeric (or end in numbers) on the same date, higher challan number is newer
      const numA = parseInt(a.challanNo.replace(/\D/g, ''), 10);
      const numB = parseInt(b.challanNo.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB && a.deliveryDate === b.deliveryDate) {
        return numA - numB;
      }
      return a.rowOrder - b.rowOrder;
    });

    const lastEntry = sorted[sorted.length - 1];

    // Collect unique challan numbers in chronological order
    const uniqueChallans: string[] = [];
    sorted.forEach((e) => {
      const cleanC = e.challanNo.trim();
      if (cleanC && !uniqueChallans.includes(cleanC)) {
        uniqueChallans.push(cleanC);
      }
    });

    const totalQty = entries.reduce((sum, e) => sum + (e.deliveredQty || 0), 0);

    const summary: PiDeliveryChallanSummary = {
      piNumber: group.displayPi,
      normalizedPi: alphaKey,
      lastChallanNumber: lastEntry.challanNo.trim(),
      lastDeliveryDate: lastEntry.deliveryDate,
      allChallanNumbers: uniqueChallans,
      deliveryCount: uniqueChallans.length,
      totalDeliveredQtyInReport: totalQty > 0 ? totalQty : undefined,
    };

    // Store by both alphaKey and exact normalized key for fast lookup
    piChallanMap[alphaKey] = summary;
    piChallanMap[normalizePiKey(group.displayPi)] = summary;
  });

  // Merge with existing saved map so previously uploaded delivery challans aren't lost
  const existingMap = getSavedDeliveryReportMap();
  const combinedMap: Record<string, PiDeliveryChallanSummary> = {
    ...existingMap,
    ...piChallanMap,
  };

  // Apply to existingPiList
  const matchedLogs: {
    piNumber: string;
    previousChallan: string;
    newLastChallan: string;
    deliveryCount: number;
    lastDeliveryDate?: string;
  }[] = [];

  let matchedDatabasePis = 0;
  const currentDateStr = new Date().toISOString().slice(0, 10);

  const updatedPiList = existingPiList.map((pi) => {
    const k1 = normalizePiAlphaNum(pi.piNumber);
    const k2 = normalizePiKey(pi.piNumber);
    const match = piChallanMap[k1] || piChallanMap[k2] || combinedMap[k1] || combinedMap[k2];

    if (match && match.lastChallanNumber) {
      matchedDatabasePis++;
      const prevChallan = pi.lastChallanNumber || '-';
      const isDifferent = prevChallan !== match.lastChallanNumber;

      if (piChallanMap[k1] || piChallanMap[k2]) {
        matchedLogs.push({
          piNumber: pi.piNumber,
          previousChallan: prevChallan,
          newLastChallan: match.lastChallanNumber,
          deliveryCount: match.deliveryCount,
          lastDeliveryDate: match.lastDeliveryDate,
        });
      }

      const historyEntry = isDifferent
        ? [
            ...(pi.changeHistory || []),
            {
              timestamp: currentDateStr,
              fieldLabel: 'Last Delivery Challan No',
              oldValue: prevChallan,
              newValue: match.lastChallanNumber,
            },
          ]
        : pi.changeHistory;

      return {
        ...pi,
        lastChallanNumber: match.lastChallanNumber,
        lastDeliveryDate: match.lastDeliveryDate || pi.lastDeliveryDate,
        allChallanNumbers: match.allChallanNumbers,
        deliveryCount: match.deliveryCount,
        changeHistory: historyEntry,
      };
    }

    return pi;
  });

  const uniquePisInReport = Object.keys(groupedByPi).length;

  const fileInfo: DeliveryReportFileInfo = {
    fileName: file.name,
    fileSize: file.size,
    uploadDate: new Date().toLocaleString(),
    totalRowsScanned,
    totalPisWithChallan: uniquePisInReport,
    matchedDatabasePis,
  };

  saveDeliveryReportToStorage(combinedMap, fileInfo);

  return {
    piChallanMap: combinedMap,
    updatedPiList,
    fileInfo,
    matchedLogs,
  };
}

export function saveDeliveryReportToStorage(
  map: Record<string, PiDeliveryChallanSummary>,
  info: DeliveryReportFileInfo | null
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_DELIVERY_MAP, JSON.stringify(map));
    if (info) {
      localStorage.setItem(STORAGE_KEY_DELIVERY_INFO, JSON.stringify(info));
    }
  } catch (err) {
    console.warn('Failed to save delivery report map to localStorage:', err);
  }
}

export function getSavedDeliveryReportMap(): Record<string, PiDeliveryChallanSummary> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELIVERY_MAP);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getSavedDeliveryReportInfo(): DeliveryReportFileInfo | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELIVERY_INFO);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSavedDeliveryReport(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_DELIVERY_MAP);
    localStorage.removeItem(STORAGE_KEY_DELIVERY_INFO);
  } catch (err) {
    console.warn('Failed to clear delivery report storage:', err);
  }
}

/**
 * Enriches any PIData[] list with saved PI-wise Last Delivery Challan Numbers
 */
export function enrichPiListWithSavedChallanMap(list: PIData[]): PIData[] {
  const savedMap = getSavedDeliveryReportMap();
  if (!savedMap || Object.keys(savedMap).length === 0) return list;

  return list.map((item) => {
    const k1 = normalizePiAlphaNum(item.piNumber);
    const k2 = normalizePiKey(item.piNumber);
    const match = savedMap[k1] || savedMap[k2];
    if (match && match.lastChallanNumber) {
      return {
        ...item,
        lastChallanNumber: match.lastChallanNumber,
        lastDeliveryDate: match.lastDeliveryDate || item.lastDeliveryDate,
        allChallanNumbers: match.allChallanNumbers || item.allChallanNumbers,
        deliveryCount: match.deliveryCount || item.deliveryCount,
      };
    }
    return item;
  });
}

/**
 * Download a sample Delivery Report Excel template for user convenience
 */
export function downloadSampleDeliveryReportTemplate(): void {
  const sheetAoa = [
    ['MAINETTI PACKAGING BANGLADESH PVT LTD - DELIVERY CHALLAN REPORT'],
    [
      'Delivery Date',
      'PI Number',
      'Challan Number',
      'Buyer',
      'Customer / Factory',
      'Style / PO',
      'Delivered Qty',
      'Delivery Van No',
    ],
    ['2026-01-10', 'MPBL/00138/2026', '10115', 'BRAX', 'FAKIR APPARELS LTD', 'PO-867234', 150, 'DM-TA-11-2041'],
    ['2026-01-18', 'MPBL/00138/2026', '10289', 'BRAX', 'FAKIR APPARELS LTD', 'PO-867234', 200, 'DM-TA-11-2099'],
    ['2026-01-20', 'MPBL/00353/2026', '10312', 'MACHO WM', 'MZM(CEPZ)LTD', 'PO-110634', 5508, 'DM-TA-11-2105'],
    ['2026-01-25', 'MPBL/00529/2026', '10340', 'MOUNTAIN WAREHOUSE', 'ECHOTEX LIMITED', 'PO-190742', 7900, 'DM-TA-11-2150'],
    ['2026-03-04', 'MPBL/01570/2026', '10210', 'PRIMARK', 'LIDA TEXTILE AND DYEING LIMITED', 'PO-584878', 40000, 'DM-TA-11-2200'],
    ['2026-03-12', 'MPBL/01570/2026', '10367', 'PRIMARK', 'LIDA TEXTILE AND DYEING LIMITED', 'PO-584878', 42295, 'DM-TA-11-2345'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(sheetAoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Delivery_Report');
  XLSX.writeFile(wb, 'Mainetti_Delivery_Report_Sample_Template.xlsx');
}
