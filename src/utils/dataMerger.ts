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
 * 1. Primary Key: PI No.
 * 2. New PI No in Excel -> Insert as new record
 * 3. Existing PI No in Excel -> Compare fields; update ONLY changed fields; keep unchanged fields
 * 4. Old PI omitted in Excel -> Retain existing record intact (no deletion)
 * 5. Track history log of changed fields
 */
export function mergeExcelDataWithDatabase(
  existingData: PIData[],
  incomingData: PIData[],
  updatedBy: string = 'Excel Import'
): MergeResult {
  const currentTimestamp = new Date().toISOString().slice(0, 10);
  
  // Map existing records by normalized PI Number
  const existingMap = new Map<string, PIData>();
  existingData.forEach((item) => {
    const normKey = item.piNumber.trim().toUpperCase();
    if (normKey) {
      existingMap.set(normKey, { ...item });
    }
  });

  const incomingPiSet = new Set<string>();
  const mergedDataList: PIData[] = [];
  const changesList: FieldChange[] = [];

  let newAddedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  // Process incoming Excel records
  incomingData.forEach((incoming) => {
    const normKey = incoming.piNumber.trim().toUpperCase();
    if (!normKey) return;

    incomingPiSet.add(normKey);
    const existing = existingMap.get(normKey);

    if (!existing) {
      // 1. NEW RECORD INSERT
      newAddedCount++;
      const newRecord: PIData = {
        ...incoming,
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
      // Auto compute TC status
      newRecord.tcStatus = computeAutomatedTcStatus(newRecord);
      mergedDataList.push(newRecord);
    } else {
      // 2. EXISTING RECORD FIELD-LEVEL COMPARISON
      const recordChanges: FieldChangeRecord[] = [];
      const updatedRecord: PIData = { ...existing };
      let isChanged = false;

      COMPARABLE_FIELDS.forEach((field) => {
        const key = field.key;
        const incomingVal = incoming[key];
        const existingVal = existing[key];

        // Skip if incoming Excel value is undefined or null (i.e. field not in Excel)
        if (incomingVal === undefined || incomingVal === null) return;

        if (field.type === 'number') {
          let numInc = Number(incomingVal);
          let numExist = Number(existingVal ?? 0);

          if (key === 'revisionQty') {
            if (isNaN(numInc) || numInc > 20) numInc = 0;
            if (isNaN(numExist) || numExist > 20) numExist = 0;
          }

          if (!isNaN(numInc) && numInc !== numExist) {
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

          // Only consider as change if incoming string is non-empty and different
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
        // Re-compute TC Status in case dates/TC numbers changed
        updatedRecord.tcStatus = computeAutomatedTcStatus(updatedRecord);
        mergedDataList.push(updatedRecord);
      } else {
        unchangedCount++;
        mergedDataList.push(existing);
      }
    }
  });

  // 3. RETAIN OLD PIs NOT PRESENT IN INCOMING EXCEL
  let retainedCount = 0;
  existingData.forEach((existing) => {
    const normKey = existing.piNumber.trim().toUpperCase();
    if (!incomingPiSet.has(normKey)) {
      retainedCount++;
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
