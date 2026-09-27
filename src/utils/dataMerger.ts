import { PIData, FieldChangeRecord, computeAutomatedTcStatus } from '../types/tc';

export interface FieldChange {
  piNumber: string;
  fieldLabel: string;
  fieldKey: string;
  oldValue: any;
  newValue: any;
}

export interface SyncReport {
  totalFinalRecords: number;
  newAddedCount: number;
  updatedCount: number;
  unchangedCount: number;
  retainedCount: number;
  changes: FieldChange[];
}

export interface MergeResult {
  mergedData: PIData[];
  report: SyncReport;
}

interface FieldDefinition {
  key: keyof PIData;
  label: string;
  type: 'string' | 'number' | 'date';
}

const COMPARABLE_FIELDS: FieldDefinition[] = [
  { key: 'orderDate', label: 'Order Date', type: 'date' },
  { key: 'customer', label: 'Customer', type: 'string' },
  { key: 'buyer', label: 'Buyer', type: 'string' },
  { key: 'contactPerson', label: 'Contact Person', type: 'string' },
  { key: 'tcCost', label: 'TC Cost ($)', type: 'number' },
  { key: 'orderQuantity', label: 'Order Quantity', type: 'number' },
  { key: 'deliveryQuantity', label: 'Delivery Quantity', type: 'number' },
  { key: 'balanceQuantity', label: 'Balance Quantity', type: 'number' },
  { key: 'quantityPcs', label: 'Quantity (Pcs)', type: 'number' },
  { key: 'paymentStatus', label: 'Payment Status', type: 'string' },
  { key: 'deliveryStatus', label: 'Delivery Status', type: 'string' },
  { key: 'invoiceNumber', label: 'Invoice Number', type: 'string' },
  { key: 'standard', label: 'Standard', type: 'string' },
  { key: 'certBody', label: 'Certifying Body', type: 'string' },
  { key: 'productDescription', label: 'Product Description', type: 'string' },
  { key: 'factoryUnit', label: 'Factory / Unit', type: 'string' },
  { key: 'poReference', label: 'PO Reference', type: 'string' },
  { key: 'season', label: 'Season', type: 'string' },
  { key: 'expectedTcDate', label: 'Expected TC Date', type: 'date' },
  { key: 'tcRequestDate', label: 'TC Request Date', type: 'date' },
  { key: 'receivedCommercialDocDate', label: 'Commercial Doc Date', type: 'date' },
  { key: 'draftTcDate', label: 'Draft TC Date', type: 'date' },
  { key: 'draftConfirmationDate', label: 'Draft Confirmation Date', type: 'date' },
  { key: 'revisionQty', label: 'Revision Qty', type: 'number' },
  { key: 'finalTcApplyDate', label: 'Final TC Apply Date', type: 'date' },
  { key: 'finalTcReceivedDate', label: 'Final TC Received Date', type: 'date' },
  { key: 'tcNumber', label: 'TC Number', type: 'string' },
];

/**
 * Intelligent Data Sync & Merger:
 * 1. Primary Match: Match by ID, then Composite Key (PI + Customer + PO Reference), then PI No.
 * 2. New PI in Excel -> Insert as new record
 * 3. Existing PI in Excel -> Compare fields; update ONLY changed fields; PRESERVE existing TC info if incoming is blank!
 * 4. Old PI omitted in Excel -> Retain existing record intact (no deletion)
 * 5. Track history log of changed fields
 */
export function mergeExcelDataWithDatabase(
  existingData: PIData[],
  incomingData: PIData[],
  updatedBy: string = 'Excel Import'
): MergeResult {
  const currentTimestamp = new Date().toISOString().slice(0, 10);
  
  // Composite Key Builder (PI Number + Customer)
  const getCompositeKey = (item: Partial<PIData>): string => {
    const pi = (item.piNumber || '').trim().toUpperCase();
    const cust = (item.customer || '').trim().toUpperCase();
    return cust ? `${pi}||${cust}` : pi;
  };

  const getNormPi = (item: Partial<PIData>): string => {
    return (item.piNumber || '').trim().toUpperCase();
  };

  // Map existing records cleanly without letting duplicate PI numbers overwrite each other!
  const byIdMap = new Map<string, PIData>();
  const byCompositeMap = new Map<string, PIData>();
  const byPiListMap = new Map<string, PIData[]>();

  existingData.forEach((item) => {
    if (item.id) byIdMap.set(item.id, item);
    const compKey = getCompositeKey(item);
    if (compKey) byCompositeMap.set(compKey, item);

    const piKey = getNormPi(item);
    if (piKey) {
      const list = byPiListMap.get(piKey) || [];
      list.push(item);
      byPiListMap.set(piKey, list);
    }
  });

  const matchedExistingIds = new Set<string>();
  const mergedDataList: PIData[] = [];
  const changesList: FieldChange[] = [];

  let newAddedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  // Process incoming records
  incomingData.forEach((incoming) => {
    const normPi = getNormPi(incoming);
    if (!normPi) return;

    // 1. Try finding existing match
    let existing: PIData | undefined = undefined;

    if (incoming.id && byIdMap.has(incoming.id) && !matchedExistingIds.has(incoming.id)) {
      existing = byIdMap.get(incoming.id);
    }

    if (!existing) {
      const compKey = getCompositeKey(incoming);
      if (compKey && byCompositeMap.has(compKey)) {
        const candidate = byCompositeMap.get(compKey);
        if (candidate && !matchedExistingIds.has(candidate.id)) {
          existing = candidate;
        }
      }
    }

    if (!existing) {
      const candidates = byPiListMap.get(normPi) || [];
      const unmatched = candidates.filter((c) => !matchedExistingIds.has(c.id));
      if (unmatched.length === 1) {
        existing = unmatched[0];
      } else if (unmatched.length > 1) {
        // Try matching buyer or customer
        const bestMatch = unmatched.find(
          (c) =>
            (c.customer && incoming.customer && c.customer.trim().toUpperCase() === incoming.customer.trim().toUpperCase()) ||
            (c.buyer && incoming.buyer && c.buyer.trim().toUpperCase() === incoming.buyer.trim().toUpperCase())
        );
        existing = bestMatch || unmatched[0];
      }
    }

    if (!existing) {
      // 2. NEW RECORD INSERT
      newAddedCount++;
      const newRecord: PIData = {
        ...incoming,
        id: incoming.id || `${incoming.piNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        lastUpdatedDate: currentTimestamp,
        updatedBy: updatedBy,
        changeHistory: [
          {
            timestamp: currentTimestamp,
            fieldLabel: 'Record Status',
            oldValue: 'New',
            newValue: 'Imported from Excel',
          },
        ],
      };
      newRecord.tcStatus = computeAutomatedTcStatus(newRecord);
      mergedDataList.push(newRecord);
    } else {
      // Mark as matched so it is not processed twice or retained as orphan
      matchedExistingIds.add(existing.id);

      // 3. EXISTING RECORD FIELD-LEVEL MERGE WITH TC PRESERVATION RULE
      const recordChanges: FieldChangeRecord[] = [];
      const updatedRecord: PIData = { ...existing };
      let isChanged = false;

      COMPARABLE_FIELDS.forEach((field) => {
        const key = field.key;
        const incomingVal = incoming[key];
        const existingVal = existing[key];

        // Skip if incoming value is undefined or null
        if (incomingVal === undefined || incomingVal === null) return;

        // PRESERVATION RULE: If existing record has TC dates / numbers / info, and incoming value is blank, PRESERVE EXISTING!
        const isTcField = [
          'tcRequestDate',
          'receivedCommercialDocDate',
          'draftTcDate',
          'draftConfirmationDate',
          'finalTcApplyDate',
          'finalTcReceivedDate',
          'tcNumber',
          'invoiceNumber',
        ].includes(key as string);

        if (field.type === 'number') {
          let numInc = Number(incomingVal);
          let numExist = Number(existingVal ?? 0);

          if (key === 'revisionQty') {
            if (isNaN(numInc) || numInc > 20) numInc = 0;
            if (isNaN(numExist) || numExist > 20) numExist = 0;
          }

          // If incoming quantity is 0, but existing had a valid quantity and incoming didn't explicitly clear it, preserve existing
          if (!isNaN(numInc) && numInc !== numExist) {
            if (numInc === 0 && numExist > 0 && isTcField) return; // preserve
            isChanged = true;
            (updatedRecord as any)[key] = numInc;
            recordChanges.push({
              timestamp: currentTimestamp,
              fieldLabel: field.label,
              oldValue: existingVal ?? 0,
              newValue: numInc,
            });
            changesList.push({
              piNumber: existing.piNumber,
              fieldKey: key as string,
              fieldLabel: field.label,
              oldValue: existingVal ?? 0,
              newValue: numInc,
            });
          }
        } else if (field.type === 'string' || field.type === 'date') {
          const strInc = String(incomingVal).trim();
          const strExist = String(existingVal || '').trim();

          // PRESERVATION RULE: If incoming string is empty/blank and existing string is non-empty, DO NOT OVERWRITE!
          if (strInc === '' && strExist !== '') {
            return; // keep existing value!
          }

          if (strInc !== '' && strInc !== strExist) {
            isChanged = true;
            (updatedRecord as any)[key] = strInc;
            recordChanges.push({
              timestamp: currentTimestamp,
              fieldLabel: field.label,
              oldValue: strExist || '-',
              newValue: strInc,
            });
            changesList.push({
              piNumber: existing.piNumber,
              fieldKey: key as string,
              fieldLabel: field.label,
              oldValue: strExist || '-',
              newValue: strInc,
            });
          }
        }
      });

      if (isChanged) {
        updatedCount++;
        updatedRecord.lastUpdatedDate = currentTimestamp;
        updatedRecord.updatedBy = updatedBy;
        updatedRecord.changeHistory = [
          ...(existing.changeHistory || []),
          ...recordChanges,
        ];
        updatedRecord.tcStatus = computeAutomatedTcStatus(updatedRecord);
        mergedDataList.push(updatedRecord);
      } else {
        unchangedCount++;
        // Even if no values changed, re-compute TC status for certainty
        existing.tcStatus = computeAutomatedTcStatus(existing);
        mergedDataList.push(existing);
      }
    }
  });

  // 4. RETAIN UNMATCHED EXISTING RECORDS INTACT
  let retainedCount = 0;
  existingData.forEach((existing) => {
    if (!matchedExistingIds.has(existing.id)) {
      retainedCount++;
      existing.tcStatus = computeAutomatedTcStatus(existing);
      mergedDataList.push(existing);
    }
  });

  return {
    mergedData: mergedDataList,
    report: {
      totalFinalRecords: mergedDataList.length,
      newAddedCount,
      updatedCount,
      unchangedCount,
      retainedCount,
      changes: changesList,
    },
  };
}
