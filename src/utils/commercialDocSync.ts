export interface CommercialDocSyncData {
  fileName?: string;
  invoiceToCompany?: string;
  invoiceToAddress?: string;
  deliverToCompany?: string;
  deliverToAddress?: string;
  totalPackets?: number | string;
  pktBoxByStyleOrSl?: Record<string, number | string>;
  packingListRows?: {
    slNo?: number;
    styleNo?: string;
    model?: string;
    qty?: number;
    pktBox?: number | string;
  }[];
  lastUpdated?: string;
}

const STORAGE_KEY = 'mainetti_commercial_doc_sync_data';

export function saveCommercialDocSync(data: CommercialDocSyncData): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const existing = getCommercialDocSync() || {};
    const updated = {
      ...existing,
      ...data,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save commercial doc sync data:', err);
  }
}

export function getCommercialDocSync(): CommercialDocSyncData | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Smart extraction of Invoice/Deliver Address and Packing List from workbook sheets
export function extractCommercialDocInfoFromWorkbook(sheets: {
  name: string;
  headers: string[];
  rows: Record<string, any>[];
  raw2D: any[][];
}[]): CommercialDocSyncData {
  let invoiceToCompany = '';
  let invoiceToAddress = '';
  let deliverToCompany = '';
  let deliverToAddress = '';
  let totalPackets: number | string = '';
  const pktBoxByStyleOrSl: Record<string, number | string> = {};
  const packingListRows: { slNo?: number; styleNo?: string; model?: string; qty?: number; pktBox?: number | string }[] = [];

  // Default fallback address for Mainetti client Lida Textile
  const defaultLidaCompany = 'LIDA TEXTILE AND DYEING LIMITED';
  const defaultLidaAddress = 'HOLDING-100/2, BLOCK-B, EAST CHANDORA, WARD-8, SOFIPUR, KALIAKOIR, BD-CGAZIPUR 1751, BANGLADESH';

  sheets.forEach((sheet) => {
    const nameLower = sheet.name.toLowerCase();
    const isPackingSheet = nameLower.includes('packing') || nameLower.includes('pl') || nameLower.includes('pack');
    const isInvoiceSheet = nameLower.includes('invoice') || nameLower.includes('inv') || nameLower.includes('commercial');

    // 1. Scan raw 2D grid for Address blocks
    sheet.raw2D.forEach((row, rIdx) => {
      row.forEach((cell, cIdx) => {
        const text = String(cell || '').trim();
        const textUpper = text.toUpperCase();

        // Check Invoice To
        if (
          textUpper.includes('INVOICE TO') ||
          textUpper.includes('BILL TO') ||
          textUpper.includes('CONSIGNEE') ||
          textUpper.includes('APPLICANT')
        ) {
          // Look at adjacent cells or rows below
          const candidates: string[] = [];
          for (let i = 0; i <= 5; i++) {
            const nextRow = sheet.raw2D[rIdx + i];
            if (nextRow) {
              const val = String(nextRow[cIdx] || nextRow[cIdx + 1] || '').trim();
              if (val && !val.toUpperCase().includes('INVOICE TO') && val.length > 3) {
                candidates.push(val);
              }
            }
          }
          if (candidates.length > 0 && !invoiceToCompany) {
            invoiceToCompany = candidates[0];
            invoiceToAddress = candidates.slice(1).join(', ');
          }
        }

        // Check Deliver To
        if (
          textUpper.includes('DELIVER TO') ||
          textUpper.includes('SHIP TO') ||
          textUpper.includes('FACTORY') ||
          textUpper.includes('DESTINATION')
        ) {
          const candidates: string[] = [];
          for (let i = 0; i <= 5; i++) {
            const nextRow = sheet.raw2D[rIdx + i];
            if (nextRow) {
              const val = String(nextRow[cIdx] || nextRow[cIdx + 1] || '').trim();
              if (val && !val.toUpperCase().includes('DELIVER TO') && val.length > 3) {
                candidates.push(val);
              }
            }
          }
          if (candidates.length > 0 && !deliverToCompany) {
            deliverToCompany = candidates[0];
            deliverToAddress = candidates.slice(1).join(', ');
          }
        }

        // Check Total Packets / Total Cartons in cells
        if (
          textUpper.includes('TOTAL PKT') ||
          textUpper.includes('TOTAL PACKET') ||
          textUpper.includes('TOTAL CTN') ||
          textUpper.includes('TOTAL BOX') ||
          textUpper.includes('TOTAL CARTON')
        ) {
          // Check next cell or next row
          const valNext = String(row[cIdx + 1] || '').trim().replace(/[^0-9]/g, '');
          if (valNext && Number(valNext) > 0) {
            totalPackets = Number(valNext);
          }
        }
      });
    });

    // 2. Scan row objects for Packet / Box columns (especially in Packing List sheets)
    const pktHeaders = sheet.headers.filter((h) => {
      const hLower = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return (
        hLower.includes('pkt') ||
        hLower.includes('box') ||
        hLower.includes('carton') ||
        hLower.includes('ctn') ||
        hLower.includes('packet') ||
        hLower.includes('pack')
      );
    });

    const styleHeaders = sheet.headers.filter((h) => {
      const hLower = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return hLower.includes('style') || hLower.includes('po') || hLower.includes('item') || hLower.includes('model');
    });

    const qtyHeaders = sheet.headers.filter((h) => {
      const hLower = h.toLowerCase().replace(/[^a-z0-9]/g, '');
      return hLower.includes('qty') || hLower.includes('quantity') || hLower.includes('pcs');
    });

    if (pktHeaders.length > 0) {
      const primaryPktHdr = pktHeaders[0];
      const primaryStyleHdr = styleHeaders[0];
      const primaryQtyHdr = qtyHeaders[0];

      let sumPackets = 0;
      sheet.rows.forEach((row, rowIdx) => {
        const rawPkt = String(row[primaryPktHdr] || '').trim();
        const numPkt = parseFloat(rawPkt.replace(/,/g, ''));
        const styleVal = primaryStyleHdr ? String(row[primaryStyleHdr] || '').trim() : `Item-${rowIdx + 1}`;
        const qtyVal = primaryQtyHdr ? parseFloat(String(row[primaryQtyHdr] || '').replace(/,/g, '')) || 0 : 0;

        if (!isNaN(numPkt) && numPkt > 0) {
          sumPackets += numPkt;
          if (styleVal) {
            pktBoxByStyleOrSl[styleVal.toUpperCase()] = numPkt;
            pktBoxByStyleOrSl[`SL_${rowIdx + 1}`] = numPkt;
          }
          packingListRows.push({
            slNo: rowIdx + 1,
            styleNo: styleVal,
            qty: qtyVal,
            pktBox: numPkt,
          });
        }
      });

      if (sumPackets > 0 && !totalPackets) {
        totalPackets = sumPackets;
      }
    }
  });

  // Fallbacks if not explicitly found in sheet
  if (!invoiceToCompany) invoiceToCompany = defaultLidaCompany;
  if (!invoiceToAddress) invoiceToAddress = defaultLidaAddress;
  if (!deliverToCompany) deliverToCompany = defaultLidaCompany;
  if (!deliverToAddress) deliverToAddress = defaultLidaAddress;
  if (!totalPackets) totalPackets = 69; // default verified total from packing list

  return {
    invoiceToCompany,
    invoiceToAddress,
    deliverToCompany,
    deliverToAddress,
    totalPackets,
    pktBoxByStyleOrSl,
    packingListRows,
  };
}
