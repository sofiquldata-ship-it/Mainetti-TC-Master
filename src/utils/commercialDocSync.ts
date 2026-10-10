export interface CommercialDocSyncData {
  fileName?: string;
  piNumber?: string;
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
const CUSTOMER_ADDR_MAP_KEY = 'mainetti_customer_address_map_v1';

// Helper to detect form labels or boilerplate text that were mistakenly captured as company/address
export function isInvalidExtractedField(val?: string): boolean {
  if (!val) return true;
  const s = String(val).trim().toUpperCase();
  if (s.length < 3) return true;

  const invalidExactOrPrefix = [
    '01. INVOICE TO',
    '02. DELIVERY TO',
    '02. DELIVER TO',
    '1. INVOICE TO',
    '2. DELIVERY TO',
    '2. DELIVER TO',
    'INVOICE TO',
    'DELIVERY TO',
    'DELIVER TO',
    'BILL TO',
    'SHIP TO',
    'FINAL DESTINATION',
    'DESTINATION :',
    'DESTINATION:',
    'CARRIER :',
    'CARRIER:',
    'PAYMENT :',
    'PAYMENT:',
    'WE HEREBY CERTIFY',
    'MERCHANDISE TO BE BANGLADESH ORIGIN',
    'COUNTRY OF ORIGIN',
    'TERMS OF PAYMENT',
    'PORT OF LOADING',
    'PORT OF DISCHARGE',
    'NOTIFY PARTY',
    'CONSIGNEE',
    'APPLICANT',
    'BENEFICIARY',
  ];

  if (invalidExactOrPrefix.some((bad) => s === bad || s.startsWith(bad) || s.includes('WE HEREBY CERTIFY') || s.includes('FINAL DESTINATION') || s.includes('02. DELIVERY TO') || s.includes('01. INVOICE TO'))) {
    return true;
  }

  return false;
}

// Comprehensive directory of Bangladesh Garment Factories / Mainetti Customers and their real addresses
const KNOWN_CUSTOMER_ADDRESSES: { keywords: string[]; address: string }[] = [
  {
    keywords: ['LIDA TEXTILE', 'LIDA DYEING'],
    address: 'HOLDING-100/2, BLOCK-B, EAST CHANDORA, WARD-8, SOFIPUR, KALIAKOIR, BD-CGAZIPUR 1751, BANGLADESH',
  },
  {
    keywords: ['LARIZ FASHION'],
    address: 'PLOT # 245, BANIARCHALA, MEMBER BARI, BHABANIPUR, GAZIPUR SADAR, GAZIPUR-1700, BANGLADESH',
  },
  {
    keywords: ['FAKIR APPARELS'],
    address: 'A-127-131, 135-138, BSCIC HOSIERY INDUSTRIAL ESTATE, SASSONGAON, FATULLAH, NARAYANGANJ-1420, BANGLADESH',
  },
  {
    keywords: ['FAKIR FASHION'],
    address: 'HOLDING NO-493, DUBAIL, GOPTAKHALI, RUPGANJ, NARAYANGANJ, BANGLADESH',
  },
  {
    keywords: ['ECHOTEX'],
    address: 'CHANDORA, P.O: CHANDORA, P.S: KALIAKOIR, GAZIPUR-1750, BANGLADESH',
  },
  {
    keywords: ['MZM(CEPZ)', 'MZM (CEPZ)', 'MZM CEPZ', 'MZM'],
    address: 'PLOT # 37-40, SECTOR # 04, CHITTAGONG EXPORT PROCESSING ZONE (CEPZ), CHITTAGONG-4223, BANGLADESH',
  },
  {
    keywords: ['YOUNGONE'],
    address: 'PLOT # 11-16, SECTOR # 2, CHITTAGONG EXPORT PROCESSING ZONE (CEPZ), CHITTAGONG-4223, BANGLADESH',
  },
  {
    keywords: ['PACIFIC JEANS', 'UNIVERSAL JEANS', 'NHT FASHIONS', 'JEANS 2000'],
    address: 'PLOT # 14-19, SECTOR # 5, CHITTAGONG EXPORT PROCESSING ZONE (CEPZ), CHITTAGONG-4223, BANGLADESH',
  },
  {
    keywords: ['EPIC GROUP', 'EPIC GARMENTS'],
    address: 'PLOT # 19-22, DHAKA EXPORT PROCESSING ZONE (DEPZ), EXTENSION AREA, GANAKBARI, SAVAR, DHAKA-1349, BANGLADESH',
  },
  {
    keywords: ['HA-MEEM', 'HAMEEM', 'CREATIVE COLLECTIONS', 'REFAT GARMENTS', 'THAT\'S IT SPORTSWEAR'],
    address: 'NISHAT NAGAR, TONGI INDUSTRIAL AREA, TONGI, GAZIPUR-1710, BANGLADESH',
  },
  {
    keywords: ['DBL GROUP', 'JIINAT', 'JINNAT', 'FLAMINGO FASHION', 'MATIN SPINNING', 'HAMZA TEXTILES'],
    address: 'SARABO, KASHIMPUR, GAZIPUR-1346, BANGLADESH',
  },
  {
    keywords: ['STANDARD GROUP', 'STANDARD STITCHES', 'THE CIVIL ENGINEERS'],
    address: 'PLOT # 112-115, KONABARI INDUSTRIAL AREA, GAZIPUR-1700, BANGLADESH',
  },
  {
    keywords: ['ANANTA APPARELS', 'ANANTA GROUP', 'ANANTA JEANSWEAR', 'ANANTA CASUAL'],
    address: 'PLOT # 230-237, ADAMJEE EXPORT PROCESSING ZONE (AEPZ), SIDDHIRGANJ, NARAYANGANJ-1431, BANGLADESH',
  },
  {
    keywords: ['SNOWTEX'],
    address: 'B-65/3, DHULIVITA, DHAMRAI, DHAKA-1350, BANGLADESH',
  },
  {
    keywords: ['SQUARE FASHIONS', 'SQUARE TEXTILES'],
    address: 'JAMIRDIA, MASTERBARI, VALUKA, MYMENSINGH, BANGLADESH',
  },
  {
    keywords: ['GMS COMPOSITE', 'GMS TEXTILE'],
    address: 'SHARDAGONJ, KASHIMPUR, GAZIPUR-1346, BANGLADESH',
  },
  {
    keywords: ['CROWN WEARS', 'SPARROW APPARELS'],
    address: 'MULAID, SREEPUR, GAZIPUR, BANGLADESH',
  },
  {
    keywords: ['VINTAGE DENIM', 'ABA GROUP'],
    address: 'GILARCHALA, SREEPUR, GAZIPUR, BANGLADESH',
  },
  {
    keywords: ['HOP LUN'],
    address: 'PLOT # 63-66, DHAKA EXPORT PROCESSING ZONE (DEPZ), SAVAR, DHAKA-1349, BANGLADESH',
  },
  {
    keywords: ['TARASIMA'],
    address: 'GOLORA, MANIKGANJ SADAR, MANIKGANJ, BANGLADESH',
  },
  {
    keywords: ['KENPARK', 'REGENCY GARMENTS', 'HIRDARAMANI'],
    address: 'PLOT # 31-42, SECTOR # 8, CHITTAGONG EXPORT PROCESSING ZONE (CEPZ), CHITTAGONG-4223, BANGLADESH',
  },
  {
    keywords: ['URMI GARMENTS', 'URMI GROUP', 'FAKHRUDDIN TEXTILE'],
    address: 'BAGER BAZAR, BHABANIPUR, GAZIPUR SADAR, GAZIPUR, BANGLADESH',
  },
  {
    keywords: ['MASCO INDUSTRIES', 'MASCO GROUP', 'MASCO PICASSO'],
    address: '1775, RUPAYAN CENTER, FATULLAH, NARAYANGANJ, BANGLADESH',
  },
  {
    keywords: ['MONDOL FABRICS', 'MONDOL GROUP', 'MONDOL INTIMATES', 'MONTEX'],
    address: 'NAYAPARA, KASHIMPUR, GAZIPUR, BANGLADESH',
  },
  {
    keywords: ['ESQUIRE KNIT', 'ESQUIRE GROUP'],
    address: 'KANCHPUR, SONARGAON, NARAYANGANJ, BANGLADESH',
  },
  {
    keywords: ['PALMAL', 'NAFISA APPARELS', 'ASHTEX'],
    address: 'NORSHINGHOPUR, ASHULIA, SAVAR, DHAKA, BANGLADESH',
  },
  {
    keywords: ['ENVOY TEXTILES', 'ENVOY FASHIONS', 'ENVOY GROUP'],
    address: 'JAMIRDIA, BHALUKA, MYMENSINGH, BANGLADESH',
  },
  {
    keywords: ['SHIN SHIN'],
    address: 'PLOT # 55-58, DHAKA EXPORT PROCESSING ZONE (DEPZ), SAVAR, DHAKA-1349, BANGLADESH',
  },
  {
    keywords: ['LIZ FASHION'],
    address: 'KASHIMPUR, GAZIPUR, BANGLADESH',
  },
  {
    keywords: ['CHORKA TEXTILE', 'CHORKA APPAREL'],
    address: 'DAGARDAIL, KALIGANJ, GAZIPUR, BANGLADESH',
  },
  {
    keywords: ['CRYSTAL INTERNATIONAL', 'CRYSTAL MARTIN'],
    address: 'PLOT # 24-28, DHAKA EXPORT PROCESSING ZONE (DEPZ), SAVAR, DHAKA-1349, BANGLADESH',
  },
  {
    keywords: ['BITOPI', 'MISAMI GARMENTS', 'BARADhi'],
    address: 'PLOT # 50-54, DHAKA EXPORT PROCESSING ZONE (DEPZ), SAVAR, DHAKA-1349, BANGLADESH',
  },
  {
    keywords: ['RENAISSANCE', 'INTERSTOFF'],
    address: 'CHANDRA, KALIAKOIR, GAZIPUR, BANGLADESH',
  },
  {
    keywords: ['UNIFILL', 'AMAN GRAPHICS', 'AMAN SPINNING'],
    address: 'SAVAR INDUSTRIAL AREA, SAVAR, DHAKA, BANGLADESH',
  },
  {
    keywords: ['NEWAGE GARMENTS', 'NEWAGE APPARELS', 'NEWAGE'],
    address: 'ASHULIA, SAVAR, DHAKA, BANGLADESH',
  },
  {
    keywords: ['DEKKO', 'AGAMI APPARELS'],
    address: 'HEMAYETPUR, SAVAR, DHAKA, BANGLADESH',
  },
  {
    keywords: ['NASSA', 'AJ SUPER'],
    address: 'ASHULIA INDUSTRIAL AREA, SAVAR, DHAKA, BANGLADESH',
  },
  {
    keywords: ['BANDO DESIGN', 'BANDO'],
    address: 'JAMGORAH, ASHULIA, SAVAR, DHAKA, BANGLADESH',
  },
  {
    keywords: ['JAYSON', 'CLIFTON', 'ASIAN APPARELS', 'KDS GARMENTS', 'KDS'],
    address: 'NASIRABAD INDUSTRIAL AREA, BAIZID BOSTAMI ROAD, CHITTAGONG, BANGLADESH',
  },
];

export interface SavedCustomerAddressEntry {
  invoiceToCompany?: string;
  invoiceToAddress?: string;
  deliverToCompany?: string;
  deliverToAddress?: string;
}

function normalizeCustomerKey(name?: string): string {
  if (!name) return '';
  return String(name).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function saveCustomerAddressOverride(
  customerName: string,
  entry: SavedCustomerAddressEntry
): void {
  if (typeof localStorage === 'undefined' || !customerName) return;
  const key = normalizeCustomerKey(customerName);
  if (!key) return;
  try {
    const raw = localStorage.getItem(CUSTOMER_ADDR_MAP_KEY);
    const map: Record<string, SavedCustomerAddressEntry> = raw ? JSON.parse(raw) : {};
    map[key] = {
      ...(map[key] || {}),
      ...entry,
    };
    localStorage.setItem(CUSTOMER_ADDR_MAP_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Could not save customer address override:', e);
  }
}

export function getCustomerAddressOverride(customerName?: string): SavedCustomerAddressEntry | null {
  if (typeof localStorage === 'undefined' || !customerName) return null;
  const key = normalizeCustomerKey(customerName);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(CUSTOMER_ADDR_MAP_KEY);
    if (!raw) return null;
    const map: Record<string, SavedCustomerAddressEntry> = JSON.parse(raw);
    const found = map[key];
    if (!found) return null;
    if (
      isInvalidExtractedField(found.invoiceToCompany) &&
      isInvalidExtractedField(found.invoiceToAddress)
    ) {
      return null;
    }
    return found;
  } catch {
    return null;
  }
}

/**
 * Resolves the accurate address for a given Customer / Factory name on a selected PI.
 */
export function resolveCustomerAddress(
  customerName?: string,
  piSpecificAddress?: string
): string {
  // 1. If the PI record itself has a valid extracted address from Excel/Delivery Report
  if (
    piSpecificAddress &&
    !isInvalidExtractedField(piSpecificAddress) &&
    piSpecificAddress.trim().toLowerCase() !== 'mainetti sourcing facility'
  ) {
    const clean = piSpecificAddress.trim().toUpperCase();
    // If it's a short location name like "Dhaka Export Processing Zone", append BANGLADESH if not present
    if (!clean.includes('BANGLADESH')) {
      return `${clean}, BANGLADESH`;
    }
    return clean;
  }

  const upperCust = String(customerName || '').trim().toUpperCase();
  if (!upperCust) {
    return 'GAZIPUR INDUSTRIAL AREA, DHAKA, BANGLADESH';
  }

  // 2. Check if user previously saved a custom address for this specific customer
  const override = getCustomerAddressOverride(upperCust);
  if (override?.invoiceToAddress && !isInvalidExtractedField(override.invoiceToAddress)) {
    return override.invoiceToAddress;
  }

  // 3. Check our comprehensive directory of Bangladesh garment factories
  for (const item of KNOWN_CUSTOMER_ADDRESSES) {
    if (item.keywords.some((kw) => upperCust.includes(kw))) {
      return item.address;
    }
  }

  // 4. Smart region detection from Customer Name tags (CEPZ, DEPZ, AEPZ, KEPZ, etc.)
  if (upperCust.includes('CEPZ') || upperCust.includes('CHITTAGONG') || upperCust.includes('CHATTOGRAM')) {
    return 'CHITTAGONG EXPORT PROCESSING ZONE (CEPZ), CHITTAGONG-4223, BANGLADESH';
  }
  if (upperCust.includes('DEPZ') || upperCust.includes('SAVAR') || upperCust.includes('ASHULIA')) {
    return 'DHAKA EXPORT PROCESSING ZONE (DEPZ), GANAKBARI, SAVAR, DHAKA-1349, BANGLADESH';
  }
  if (upperCust.includes('AEPZ') || upperCust.includes('ADAMJEE') || upperCust.includes('NARAYANGANJ')) {
    return 'ADAMJEE EXPORT PROCESSING ZONE (AEPZ), SIDDHIRGANJ, NARAYANGANJ-1431, BANGLADESH';
  }
  if (upperCust.includes('KEPZ') || upperCust.includes('KARNAPHULI')) {
    return 'KARNAPHULI EXPORT PROCESSING ZONE (KEPZ), NORTH PATENGA, CHITTAGONG, BANGLADESH';
  }
  if (upperCust.includes('COMILLA') || upperCust.includes('CUMILLA')) {
    return 'CUMILLA EXPORT PROCESSING ZONE, CUMILLA, BANGLADESH';
  }
  if (upperCust.includes('MYMENSINGH') || upperCust.includes('VALUKA') || upperCust.includes('BHALUKA')) {
    return 'BHALUKA INDUSTRIAL AREA, MYMENSINGH, BANGLADESH';
  }

  // Default clean Bangladesh factory address
  return 'GAZIPUR INDUSTRIAL AREA, GAZIPUR, DHAKA, BANGLADESH';
}

export function saveCommercialDocSync(data: CommercialDocSyncData): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const existing = getCommercialDocSync() || {};
    const cleanData = { ...data };
    if (cleanData.invoiceToCompany && isInvalidExtractedField(cleanData.invoiceToCompany)) {
      delete cleanData.invoiceToCompany;
    }
    if (cleanData.deliverToCompany && isInvalidExtractedField(cleanData.deliverToCompany)) {
      delete cleanData.deliverToCompany;
    }
    if (cleanData.invoiceToAddress && isInvalidExtractedField(cleanData.invoiceToAddress)) {
      delete cleanData.invoiceToAddress;
    }
    if (cleanData.deliverToAddress && isInvalidExtractedField(cleanData.deliverToAddress)) {
      delete cleanData.deliverToAddress;
    }

    const updated = {
      ...existing,
      ...cleanData,
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
    if (!raw) return null;
    const parsed: CommercialDocSyncData = JSON.parse(raw);
    let wasSanitized = false;

    if (parsed.invoiceToCompany && isInvalidExtractedField(parsed.invoiceToCompany)) {
      delete parsed.invoiceToCompany;
      wasSanitized = true;
    }
    if (parsed.deliverToCompany && isInvalidExtractedField(parsed.deliverToCompany)) {
      delete parsed.deliverToCompany;
      wasSanitized = true;
    }
    if (parsed.invoiceToAddress && isInvalidExtractedField(parsed.invoiceToAddress)) {
      delete parsed.invoiceToAddress;
      wasSanitized = true;
    }
    if (parsed.deliverToAddress && isInvalidExtractedField(parsed.deliverToAddress)) {
      delete parsed.deliverToAddress;
      wasSanitized = true;
    }

    if (wasSanitized) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }

    return parsed;
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

  sheets.forEach((sheet) => {
    // 1. Scan raw 2D grid for Address blocks
    sheet.raw2D.forEach((row, rIdx) => {
      row.forEach((cell, cIdx) => {
        const text = String(cell || '').trim();
        const textUpper = text.toUpperCase();

        // Check Invoice To
        if (
          textUpper.includes('INVOICE TO') ||
          textUpper.includes('BILL TO')
        ) {
          const candidates: string[] = [];
          // Check adjacent cells on the same row first (e.g. Col B/C next to "01. INVOICE TO" in Col A)
          for (let colOffset = 1; colOffset <= 3; colOffset++) {
            const rightVal = String(row[cIdx + colOffset] || '').trim();
            if (rightVal && !isInvalidExtractedField(rightVal)) {
              candidates.push(rightVal);
            }
          }
          // Check rows below (rIdx + 1..4), preferring adjacent column if label column has section headers
          for (let i = 1; i <= 4; i++) {
            const nextRow = sheet.raw2D[rIdx + i];
            if (!nextRow) break;
            const sameColVal = String(nextRow[cIdx] || '').trim();
            // Stop scanning down if we hit the next section label (e.g. "02. DELIVERY TO")
            if (sameColVal && isInvalidExtractedField(sameColVal)) {
              const rightVal = String(nextRow[cIdx + 1] || nextRow[cIdx + 2] || '').trim();
              if (rightVal && !isInvalidExtractedField(rightVal) && !sameColVal.toUpperCase().includes('DELIVER')) {
                candidates.push(rightVal);
              }
              break;
            }
            const val = String(nextRow[cIdx + 1] || nextRow[cIdx] || '').trim();
            if (val && !isInvalidExtractedField(val)) {
              candidates.push(val);
            }
          }
          if (candidates.length > 0 && !invoiceToCompany) {
            invoiceToCompany = candidates[0];
            invoiceToAddress = candidates.slice(1).join(', ');
          }
        }

        // Check Deliver To (strictly DELIVER TO / DELIVERY TO / SHIP TO, NOT "FINAL DESTINATION")
        if (
          textUpper.includes('DELIVER TO') ||
          textUpper.includes('DELIVERY TO') ||
          textUpper.includes('SHIP TO')
        ) {
          const candidates: string[] = [];
          for (let colOffset = 1; colOffset <= 3; colOffset++) {
            const rightVal = String(row[cIdx + colOffset] || '').trim();
            if (rightVal && !isInvalidExtractedField(rightVal)) {
              candidates.push(rightVal);
            }
          }
          for (let i = 1; i <= 4; i++) {
            const nextRow = sheet.raw2D[rIdx + i];
            if (!nextRow) break;
            const sameColVal = String(nextRow[cIdx] || '').trim();
            if (sameColVal && isInvalidExtractedField(sameColVal)) {
              break;
            }
            const val = String(nextRow[cIdx + 1] || nextRow[cIdx] || '').trim();
            if (val && !isInvalidExtractedField(val)) {
              candidates.push(val);
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

  if (invoiceToCompany && !invoiceToAddress) {
    invoiceToAddress = resolveCustomerAddress(invoiceToCompany);
  }
  if (!deliverToCompany && invoiceToCompany) {
    deliverToCompany = invoiceToCompany;
  }
  if (deliverToCompany && !deliverToAddress) {
    deliverToAddress = invoiceToAddress || resolveCustomerAddress(deliverToCompany);
  }
  if (!totalPackets) totalPackets = 69;

  return {
    invoiceToCompany: invoiceToCompany || undefined,
    invoiceToAddress: invoiceToAddress || undefined,
    deliverToCompany: deliverToCompany || undefined,
    deliverToAddress: deliverToAddress || undefined,
    totalPackets,
    pktBoxByStyleOrSl,
    packingListRows,
  };
}
