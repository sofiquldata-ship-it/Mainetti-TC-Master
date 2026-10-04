import { PIData, computeAutomatedTcStatus } from '../types/tc';

export interface GoogleSheetsExportResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  rowCount: number;
}

export interface LinkedSheetConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  lastSyncedAt: string;
  autoSync: boolean;
}

const LINKED_SHEET_KEY = 'mainetti_tc_linked_google_sheet_v1';

import { saveLinkedSheetToFirestore, fetchLinkedSheetFromFirestore } from './firestoreStorage';

export const getSavedLinkedSheet = (): LinkedSheetConfig | null => {
  try {
    const raw = localStorage.getItem(LINKED_SHEET_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.autoSync !== 'boolean') {
      parsed.autoSync = true;
    }
    return parsed;
  } catch (e) {
    console.error('Failed to load linked sheet configuration:', e);
    return null;
  }
};

export const syncLinkedSheetFromFirestore = async (): Promise<LinkedSheetConfig | null> => {
  const cloudConfig = await fetchLinkedSheetFromFirestore();
  if (cloudConfig) {
    try {
      localStorage.setItem(LINKED_SHEET_KEY, JSON.stringify(cloudConfig));
    } catch (e) {
      console.error('Failed to mirror cloud sheet config to localStorage:', e);
    }
    return cloudConfig;
  }
  return getSavedLinkedSheet();
};

export const saveLinkedSheetConfig = (config: LinkedSheetConfig | null) => {
  try {
    if (!config) {
      localStorage.removeItem(LINKED_SHEET_KEY);
    } else {
      localStorage.setItem(LINKED_SHEET_KEY, JSON.stringify(config));
    }
    // Also mirror to Firestore for cross-browser / multi-device synchronization
    saveLinkedSheetToFirestore(config);
  } catch (e) {
    console.error('Failed to save linked sheet configuration:', e);
  }
};

export const extractSpreadsheetIdFromUrlOrId = (input: string): string => {
  const trimmed = input.trim();
  // Regex to extract from standard Google Sheet URL: https://docs.google.com/spreadsheets/d/{ID}/edit...
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
};

// Format rows helper
const formatSheetRows = (data: PIData[]) => {
  const masterHeaders = [
    'Order Date',
    'PI Number',
    'Invoice Number',
    'Invoice Date',
    'Standard',
    'Buyer',
    'Garment Factory / Customer',
    'Contact Person',
    'Order Qty (PCS)',
    'Delivery Qty (PCS)',
    'Balance Qty (PCS)',
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
    'Certification Body',
    'Notes / Reason',
  ];

  const masterRows = data.map((item) => {
    const rawOrderQ = item.orderQuantity ?? item.quantityPcs ?? 0;
    let safeOrderQty = rawOrderQ <= 1 ? 0 : rawOrderQ;
    const delivQty =
      safeOrderQty === 0
        ? 0
        : item.deliveryQuantity !== undefined && item.deliveryQuantity > 1
        ? item.deliveryQuantity
        : item.deliveryStatus === 'Delivered'
        ? safeOrderQty
        : item.deliveryStatus === 'In Transit'
        ? Math.floor(safeOrderQty * 0.8)
        : 0;
    // Rule: If balance is 1, subtract 1 from order quantity so balance is 0
    if (safeOrderQty > 0 && safeOrderQty - delivQty === 1) {
      safeOrderQty = safeOrderQty - 1;
    }
    const balQty = Math.max(0, safeOrderQty - delivQty);

    const autoStatus = computeAutomatedTcStatus({
      tcRequestDate: item.tcRequestDate,
      receivedCommercialDocDate: item.receivedCommercialDocDate,
      draftTcDate: item.draftTcDate,
      draftConfirmationDate: item.draftConfirmationDate,
      revisionQty: item.revisionQty,
      finalTcApplyDate: item.finalTcApplyDate,
      finalTcReceivedDate: item.finalTcReceivedDate,
      tcNumber: item.tcNumber,
    });
    const finalStatus = autoStatus !== 'Not Requested' ? autoStatus : (item.tcStatus || 'Not Requested');

    return [
      item.orderDate || '',
      item.piNumber || '',
      item.invoiceNumber || '',
      item.invoiceDate || '',
      item.standard || 'GRS',
      item.buyer || '',
      item.customer || '',
      item.contactPerson || 'System',
      safeOrderQty,
      delivQty,
      balQty,
      item.deliveryStatus || 'Pending',
      item.tcRequestDate || '',
      item.receivedCommercialDocDate || '',
      item.draftTcDate || '',
      item.draftConfirmationDate || '',
      item.revisionQty || '',
      item.finalTcApplyDate || '',
      item.finalTcReceivedDate || '',
      item.tcNumber || '',
      finalStatus,
      item.tcCost || 0,
      item.piAgeDays || 0,
      item.certBody || 'Control Union',
      item.notes || item.attentionReason || '',
    ];
  });

  const buyerMap: Record<
    string,
    {
      buyer: string;
      piCount: number;
      orderQty: number;
      delivQty: number;
      balQty: number;
      tcCost: number;
      issued: number;
      pending: number;
      overdue: number;
    }
  > = {};

  data.forEach((item) => {
    const b = item.buyer || 'Unknown';
    const rawOrderQ = item.orderQuantity ?? item.quantityPcs ?? 0;
    let safeOrderQty = rawOrderQ <= 1 ? 0 : rawOrderQ;
    const delivQty =
      safeOrderQty === 0
        ? 0
        : item.deliveryQuantity !== undefined && item.deliveryQuantity > 1
        ? item.deliveryQuantity
        : item.deliveryStatus === 'Delivered'
        ? safeOrderQty
        : item.deliveryStatus === 'In Transit'
        ? Math.floor(safeOrderQty * 0.8)
        : 0;
    if (safeOrderQty > 0 && safeOrderQty - delivQty === 1) {
      safeOrderQty = safeOrderQty - 1;
    }
    const balQty = Math.max(0, safeOrderQty - delivQty);

    if (!buyerMap[b]) {
      buyerMap[b] = {
        buyer: b,
        piCount: 0,
        orderQty: 0,
        delivQty: 0,
        balQty: 0,
        tcCost: 0,
        issued: 0,
        pending: 0,
        overdue: 0,
      };
    }
    buyerMap[b].piCount += 1;
    buyerMap[b].orderQty += safeOrderQty;
    buyerMap[b].delivQty += delivQty;
    buyerMap[b].balQty += balQty;
    buyerMap[b].tcCost += item.tcCost;
    if (item.tcStatus === 'Issued') buyerMap[b].issued += 1;
    else if (item.tcStatus === 'Overdue') buyerMap[b].overdue += 1;
    else buyerMap[b].pending += 1;
  });

  const summaryHeaders = [
    'Buyer Name',
    'Total PIs',
    'Total Order Qty (PCS)',
    'Total Delivered Qty (PCS)',
    'Total Balance Qty (PCS)',
    'Total TC Cost (USD)',
    'Issued Count',
    'Pending Count',
    'Overdue Count',
  ];

  const summaryRows = Object.values(buyerMap).map((b) => [
    b.buyer,
    b.piCount,
    b.orderQty,
    b.delivQty,
    b.balQty,
    b.tcCost,
    b.issued,
    b.pending,
    b.overdue,
  ]);

  return { masterHeaders, masterRows, summaryHeaders, summaryRows };
};

/**
 * Sync data to an EXISTING Google Spreadsheet (Maintains Permanent Link & Single Tab)
 */
export const syncDataToExistingSpreadsheet = async (
  accessToken: string,
  spreadsheetId: string,
  data: PIData[]
): Promise<GoogleSheetsExportResult> => {
  if (!accessToken) {
    throw new Error('Google access token is required. Please sign in with Google first.');
  }

  // 1. Fetch metadata to inspect existing sheet tabs
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaRes.ok) {
    const errText = await metaRes.text();
    throw new Error(`Cannot access spreadsheet (${spreadsheetId}): ${errText}`);
  }

  const metadata = await metaRes.json();
  const existingSheets: Array<{ properties: { sheetId: number; title: string } }> =
    metadata.sheets || [];

  // Find the primary sheet tab
  const primarySheet =
    existingSheets.find(
      (s) =>
        s.properties.title.toLowerCase() === 'tc master records' ||
        s.properties.title.toLowerCase() === 'mainetti tc records' ||
        s.properties.title === 'Sheet1'
    ) || existingSheets[0];

  const primaryTitle = primarySheet ? primarySheet.properties.title : 'TC Master Records';
  const primarySheetId = primarySheet ? primarySheet.properties.sheetId : 0;

  const { masterHeaders, masterRows } = formatSheetRows(data);

  // Clear previous values first to prevent orphaned rows
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${primaryTitle}'!A1:Z10000:clear`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
  } catch (clearErr) {
    console.warn('Optional clear step skipped:', clearErr);
  }

  // Update single tab with fresh data
  const valuesBatchResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `'${primaryTitle}'!A1`,
            values: [masterHeaders, ...masterRows],
          },
        ],
      }),
    }
  );

  if (!valuesBatchResponse.ok) {
    const errBody = await valuesBatchResponse.text();
    throw new Error(`Failed to update spreadsheet data: ${errBody}`);
  }

  // Ensure header is styled nicely
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: primarySheetId,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 11 / 255, green: 27 / 255, blue: 61 / 255 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                    fontSize: 10,
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
        ],
      }),
    });
  } catch (styleErr) {
    console.warn('Styling step skipped:', styleErr);
  }

  const now = new Date().toLocaleString();
  const title = metadata.properties?.title || 'Mainetti TC Master Database';
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Persist updated configuration
  const currentSaved = getSavedLinkedSheet();
  saveLinkedSheetConfig({
    spreadsheetId,
    spreadsheetUrl,
    title,
    lastSyncedAt: now,
    autoSync: currentSaved?.autoSync ?? true,
  });

  return {
    spreadsheetId,
    spreadsheetUrl,
    title,
    rowCount: data.length,
  };
};

/**
 * Create a new spreadsheet (only if not already linked) and permanently link it
 */
export const exportDataToGoogleSheets = async (
  accessToken: string,
  data: PIData[],
  customTitle?: string
): Promise<GoogleSheetsExportResult> => {
  if (!accessToken) {
    throw new Error('Google access token is required. Please sign in with Google first.');
  }

  // If a spreadsheet is already linked, reuse that same single sheet instead of creating duplicates!
  const existingLinked = getSavedLinkedSheet();
  if (existingLinked && existingLinked.spreadsheetId) {
    return syncDataToExistingSpreadsheet(accessToken, existingLinked.spreadsheetId, data);
  }

  const title = customTitle || `Mainetti TC Master Database`;

  // 1. Create a single clean Spreadsheet with 1 single sheet
  const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        {
          properties: {
            title: 'TC Master Records',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!createResponse.ok) {
    const errBody = await createResponse.text();
    throw new Error(`Failed to create Google Sheet: ${errBody}`);
  }

  const createResult = await createResponse.json();
  const spreadsheetId = createResult.spreadsheetId;
  const tcSheetId = createResult.sheets?.[0]?.properties?.sheetId ?? 0;

  const { masterHeaders, masterRows } = formatSheetRows(data);

  // 2. Batch Update Values
  const valuesBatchResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `'TC Master Records'!A1`,
            values: [masterHeaders, ...masterRows],
          },
        ],
      }),
    }
  );

  if (!valuesBatchResponse.ok) {
    const errBody = await valuesBatchResponse.text();
    console.error('Failed to populate spreadsheet data:', errBody);
  }

  // 3. Apply header formatting (Mainetti Blue #0B1B3D + Bold White text)
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: tcSheetId,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 11 / 255, green: 27 / 255, blue: 61 / 255 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                    fontSize: 10,
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: tcSheetId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 14,
              },
            },
          },
        ],
      }),
    });
  } catch (formatErr) {
    console.warn('Styling batch update optional step skipped:', formatErr);
  }

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  const now = new Date().toLocaleString();

  // Save permanent link configuration
  saveLinkedSheetConfig({
    spreadsheetId,
    spreadsheetUrl,
    title,
    lastSyncedAt: now,
    autoSync: true,
  });

  return {
    spreadsheetId,
    spreadsheetUrl,
    title,
    rowCount: data.length,
  };
};

/**
 * Import and pull live data FROM a Google Spreadsheet into PIData[]
 */
export const importDataFromGoogleSpreadsheet = async (
  accessToken: string,
  spreadsheetId: string
): Promise<{ data: PIData[]; title: string; rowCount: number }> => {
  if (!accessToken) {
    throw new Error('Google access token is required. Please sign in with Google first.');
  }

  // 1. Fetch metadata to find the primary tab
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaRes.ok) {
    const errText = await metaRes.text();
    throw new Error(`Cannot access spreadsheet (${spreadsheetId}): ${errText}`);
  }

  const metadata = await metaRes.json();
  const existingSheets: Array<{ properties: { sheetId: number; title: string } }> =
    metadata.sheets || [];

  if (existingSheets.length === 0) {
    throw new Error('Spreadsheet has no sheets/tabs.');
  }

  const tcTab =
    existingSheets.find((s) => s.properties.title.toLowerCase() === 'tc master records') ||
    existingSheets[0];

  const targetTabTitle = tcTab.properties.title;

  // 2. Fetch all values from target sheet tab
  const valuesRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${targetTabTitle}'!A1:Z5000`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!valuesRes.ok) {
    const errText = await valuesRes.text();
    throw new Error(`Failed to fetch spreadsheet rows: ${errText}`);
  }

  const valuesData = await valuesRes.json();
  const rows: any[][] = valuesData.values || [];

  if (rows.length <= 1) {
    throw new Error(`The sheet '${targetTabTitle}' does not contain any data rows.`);
  }

  // 3. Match headers
  const headers = rows[0].map((h: any) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
  const findCol = (keys: string[]): number => {
    for (const k of keys) {
      const idx = headers.findIndex((h) => h === k || h.includes(k) || k.includes(h));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const orderDateCol = findCol(['orderdate', 'date', 'podate']);
  const piCol = findCol(['pinumber', 'pino', 'pi', 'orderno']);
  const invoiceNumberCol = findCol(['invoicenumber', 'invoiceno', 'invno', 'invoice', 'inv']);
  const invoiceDateCol = findCol(['invoicedate', 'invdate', 'commercialinvoicedate', 'invdt', 'invoicedt']);
  const buyerCol = findCol(['buyer', 'brand', 'retailer']);
  const custCol = findCol(['customer', 'factory', 'vendor', 'garmentfactory']);
  const contactPersonCol = findCol(['contactperson', 'createdby', 'creator', 'createdbyname', 'user', 'contact']);
  const orderQtyCol = findCol(['orderqty', 'orderedqty', 'quantity', 'qty', 'orderquantity']);
  const delivQtyCol = findCol(['deliveryqty', 'deliveredqty', 'deliverdqty', 'delivqty', 'delivered']);
  const balQtyCol = findCol(['balanceqty', 'balqty', 'balance']);
  const delivStatusCol = findCol(['deliverystatus', 'delivery', 'shipstatus']);
  const tcStatusCol = findCol(['tcstatus', 'status']);
  const tcCostCol = findCol(['tccost', 'cost', 'fee', 'tcamount', 'amount']);
  const ageCol = findCol(['piage', 'age', 'days']);
  const standardCol = findCol(['standard', 'certstandard', 'scope']);
  const certBodyCol = findCol(['certbody', 'certificationbody', 'auditor']);
  const notesCol = findCol(['notes', 'reason', 'notesreason', 'remark']);
  const tcRequestDateCol = findCol(['tcrequestdate', 'requestdate', 'tcrequest', 'tcrequesteddate']);
  const receivedCommDocCol = findCol(['receivedcommercialdocdate', 'receivedcommercialdoc', 'commercialdocdate', 'docreceiveddate', 'commercialdoc']);
  const draftTcDateCol = findCol(['drafttcdate', 'draftdate', 'drafttcreceiveddate', 'drafttc']);
  const draftConfirmDateCol = findCol(['draftconfirmationdate', 'draftconfirmeddate', 'draftconfirmdate', 'draftconfirmation']);
  const revisionQtyCol = findCol(['revisionqty', 'revisionquantity', 'revqty', 'revisedqty']);
  const finalTcApplyDateCol = findCol(['finaltcapplydate', 'finalapplydate', 'applydate', 'finaltcapplicationdate']);
  const finalTcReceivedDateCol = findCol(['finaltcreceiveddate', 'finaltcdate', 'finalreceiveddate', 'tcreceiveddate']);
  const tcNumberCol = findCol(['tcnumber', 'tcno', 'certificatenumber', 'certificateno', 'certno']);

  const parseNum = (val: any): number => {
    if (!val) return 0;
    const clean = String(val).replace(/[^0-9.]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const parsedItems: PIData[] = [];
  const dataRows = rows.slice(1);

  dataRows.forEach((row, idx) => {
    if (!row || row.every((c) => String(c || '').trim() === '')) return;

    const getCell = (colIdx: number, fallback = '') => {
      if (colIdx !== -1 && row[colIdx] !== undefined && row[colIdx] !== null) {
        const str = String(row[colIdx]).trim();
        return str.length > 0 ? str : fallback;
      }
      return fallback;
    };

    const piNumber = getCell(piCol, `PI-GS-${idx + 1}`);
    const invoiceNumber = getCell(invoiceNumberCol, '');
    const invoiceDate = getCell(invoiceDateCol, '');
    const buyer = getCell(buyerCol, 'Global Buyer');
    const customer = getCell(custCol, 'Partner Garment Factory');
    const contactPerson = getCell(contactPersonCol, 'System');
    const orderDate = getCell(orderDateCol, '2026-08-15');
    const rawOrderQ = parseNum(row[orderQtyCol]);
    let orderQ = rawOrderQ <= 1 ? 0 : rawOrderQ;
    const rawDelivQ = parseNum(row[delivQtyCol]);
    let delivQ =
      orderQ === 0
        ? 0
        : rawDelivQ > 1
        ? rawDelivQ
        : 0;

    // Rule: If balance is 1, subtract 1 from order quantity
    if (orderQ > 0 && orderQ - delivQ === 1) {
      orderQ = orderQ - 1;
    }
    const balQ = Math.max(0, orderQ - delivQ);

    const tcCost = parseNum(row[tcCostCol]) || 250;
    const delivStatus: any = getCell(delivStatusCol, 'In Transit');
    const piAgeDays = parseNum(row[ageCol]) || 20;
    const standard = getCell(standardCol, 'GRS 4.0');
    const certBody = getCell(certBodyCol, 'Control Union');
    const notes = getCell(notesCol, '');

    const tcRequestDate = getCell(tcRequestDateCol, '');
    const receivedCommercialDocDate = getCell(receivedCommDocCol, '');
    const draftTcDate = getCell(draftTcDateCol, '');
    const draftConfirmationDate = getCell(draftConfirmDateCol, '');
    const revisionQty = parseNum(row[revisionQtyCol]);
    const finalTcApplyDate = getCell(finalTcApplyDateCol, '');
    const finalTcReceivedDate = getCell(finalTcReceivedDateCol, '');
    const tcNumber = getCell(tcNumberCol, '');

    const autoStatus = computeAutomatedTcStatus({
      tcRequestDate: tcRequestDate || undefined,
      receivedCommercialDocDate: receivedCommercialDocDate || undefined,
      draftTcDate: draftTcDate || undefined,
      draftConfirmationDate: draftConfirmationDate || undefined,
      revisionQty: revisionQty > 0 ? revisionQty : undefined,
      finalTcApplyDate: finalTcApplyDate || undefined,
      finalTcReceivedDate: finalTcReceivedDate || undefined,
      tcNumber: tcNumber || undefined,
    });

    const rawTcStatus = getCell(tcStatusCol, '');
    const tcStatus = autoStatus !== 'Not Requested' ? autoStatus : (rawTcStatus || 'Not Requested');

    parsedItems.push({
      id: `${piNumber}-${idx}`,
      piNumber,
      invoiceNumber,
      invoiceDate: invoiceDate || undefined,
      buyer,
      customer,
      contactPerson,
      orderDate,
      expectedTcDate: '2026-09-20',
      piAgeDays,
      tcStatus: tcStatus as any,
      tcCost,
      paymentStatus: 'Pending',
      deliveryStatus: delivStatus,
      standard,
      certBody,
      quantityPcs: orderQ,
      orderQuantity: orderQ,
      deliveryQuantity: delivQ,
      balanceQuantity: balQ,
      productDescription: 'TRANSACTION CERTIFICATE COST',
      factoryUnit: 'Mainetti Sourcing Facility',
      poReference: `PO-${idx + 1000}`,
      season: 'FY2026 / Active',
      notes,
      tcRequestDate: tcRequestDate || undefined,
      receivedCommercialDocDate: receivedCommercialDocDate || undefined,
      draftTcDate: draftTcDate || undefined,
      draftConfirmationDate: draftConfirmationDate || undefined,
      revisionQty: revisionQty > 0 ? revisionQty : undefined,
      finalTcApplyDate: finalTcApplyDate || undefined,
      finalTcReceivedDate: finalTcReceivedDate || undefined,
      tcNumber: tcNumber || undefined,
    });
  });

  const title = metadata.properties?.title || 'Mainetti Google Sheet';

  return {
    data: parsedItems,
    title,
    rowCount: parsedItems.length,
  };
};
