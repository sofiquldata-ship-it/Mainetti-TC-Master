export type TCStatus =
  | 'Not Requested'
  | 'TC Requested'
  | 'Commercial Doc Received'
  | 'Draft TC Received'
  | 'Draft Confirmed'
  | 'Revision'
  | 'Final TC Applied'
  | 'Final TC Received'
  | 'Pending'
  | 'Issued'
  | 'Overdue'
  | 'Required'
  | 'Under Review';

export type PaymentStatus = 'Paid' | 'Pending' | 'Overdue' | 'Waived';
export type DeliveryStatus =
  | 'Delivered'
  | 'In Transit'
  | 'Port Clearance'
  | 'Dispatched'
  | 'Production Complete'
  | 'Pending Dispatch';

export interface FieldChangeRecord {
  timestamp: string;
  fieldLabel: string;
  oldValue: any;
  newValue: any;
}

export interface PIProductItem {
  id: string;
  slNo?: number;
  styleNo: string;
  modelProduct: string;
  width?: string | number;
  length?: string | number;
  gusset?: string | number;
  flap?: string | number;
  orderQty: number;
  deliveryQty: number;
  pktBox?: string | number;
  balanceQty?: string | number;
  piNumber?: string;
}

export interface PIData {
  id: string;
  piNumber: string;
  customer: string;
  buyer: string;
  orderDate: string;
  piAgeDays: number;
  tcStatus: TCStatus;
  tcCost: number;
  paymentStatus: PaymentStatus;
  expectedTcDate: string;
  deliveryStatus: DeliveryStatus;
  invoiceNumber?: string;
  standard: string;
  certBody: string;
  quantityPcs: number;
  orderQuantity?: number;
  deliveryQuantity?: number;
  balanceQuantity?: number;
  productDescription: string;
  factoryUnit: string;
  poReference: string;
  season: string;
  contactPerson?: string;
  orderStatus?: string;
  attentionReason?: string;
  notes?: string;
  productItems?: PIProductItem[];

  // New TC-Related Workflow Fields
  tcRequestDate?: string;
  receivedCommercialDocDate?: string;
  draftTcDate?: string;
  draftConfirmationDate?: string;
  revisionQty?: number;
  finalTcApplyDate?: string;
  finalTcReceivedDate?: string;
  tcNumber?: string;

  // History & Audit Metadata
  lastUpdatedDate?: string;
  updatedBy?: string;
  changeHistory?: FieldChangeRecord[];
}

/**
 * Helper to identify if an order or status is Cancelled/Void
 */
export function isCancelledStatus(val: any): boolean {
  if (!val) return false;
  const s = String(val).toLowerCase().trim();
  return (
    s === 'cancel' ||
    s === 'cancelled' ||
    s === 'canceled' ||
    s.includes('cancel') ||
    s.includes('cancellation') ||
    s.includes('void') ||
    s.includes('dropped')
  );
}

/**
 * Calculate exact Age in Days from Order Date to Today (or fallback to stored age)
 */
export function calculatePiAgeDays(orderDateStr?: string, fallbackAge?: number): number {
  if (!orderDateStr || orderDateStr === '-' || orderDateStr.trim() === '') {
    return fallbackAge || 0;
  }
  const orderDate = new Date(orderDateStr);
  if (isNaN(orderDate.getTime())) {
    return fallbackAge || 0;
  }
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const orderUtc = Date.UTC(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
  const diffDays = Math.floor((todayUtc - orderUtc) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : (fallbackAge || 0);
}

/**
 * Automatically determine TC Status strictly based on workflow dates & age:
 * 1. Final TC Received (Date) → Complete
 * 2. Overdue: If Age > 360 Days and Final TC is NOT received
 * 3. Final TC Applied (Date) → Draft Confirmed (Date) → Revision → Draft TC Received (Date) → Commercial Doc Received (Date) → TC Requested (Date) → Not Requested
 */
export function computeAutomatedTcStatus(item: Partial<PIData>): TCStatus {
  // 1. Final TC Received ONLY if finalTcReceivedDate is filled in
  if (item.finalTcReceivedDate && item.finalTcReceivedDate.trim() !== '') {
    return 'Final TC Received';
  }

  // 2. Strict Rule: If Age > 360 days and Final TC is NOT received -> OVERDUE
  const ageDays = calculatePiAgeDays(item.orderDate, item.piAgeDays);
  if (ageDays > 360) {
    return 'Overdue';
  }

  // 3. Final TC Applied ONLY if finalTcApplyDate is filled in
  if (item.finalTcApplyDate && item.finalTcApplyDate.trim() !== '') {
    return 'Final TC Applied';
  }

  // 4. Draft Confirmed if draft confirmation date is filled in
  if (item.draftConfirmationDate && item.draftConfirmationDate.trim() !== '') {
    return 'Draft Confirmed';
  }

  // 5. Revision ONLY if revisionQty > 0 and draft/comm doc dates exist
  if (
    item.revisionQty !== undefined &&
    item.revisionQty !== null &&
    Number(item.revisionQty) > 0 &&
    Number(item.revisionQty) <= 10 &&
    (item.draftTcDate || item.receivedCommercialDocDate || item.draftConfirmationDate)
  ) {
    return 'Revision';
  }

  // 6. Draft TC Received if draft TC date is filled in
  if (item.draftTcDate && item.draftTcDate.trim() !== '') {
    return 'Draft TC Received';
  }

  // 7. Commercial Doc Received if receivedCommercialDocDate is filled in
  if (item.receivedCommercialDocDate && item.receivedCommercialDocDate.trim() !== '') {
    return 'Commercial Doc Received';
  }

  // 8. TC Requested if tcRequestDate is filled in
  if (item.tcRequestDate && item.tcRequestDate.trim() !== '') {
    return 'TC Requested';
  }

  // 9. Fallback: If tcNumber exists without dates
  if (item.tcNumber && item.tcNumber.trim() !== '') {
    return 'Final TC Applied';
  }

  // 10. Default: Not Requested when no workflow dates or TC numbers exist
  return 'Not Requested';
}

export interface FilterState {
  dateRange: string; // 'all' | '30days' | '60days' | '90days' | 'ytd' | 'custom'
  customer: string;
  buyer: string;
  tcStatus: string;
  deliveryStatus: string;
  searchQuery: string;
}

export interface KPIStats {
  totalPi: number;
  tcRequired: number;
  tcPending: number;
  tcIssued: number;
  totalTcCost: number;
  overdue: number;
}

export interface MonthlyTrendData {
  month: string;
  cost: number;
  tcIssuedCount: number;
  tcPendingCount: number;
  grsCost: number;
  fscCost: number;
  gotsCost: number;
}

export interface UploadedFileInfo {
  fileName: string;
  fileSize: number;
  uploadDate: string;
  totalRowsFound: number;
  validRowsWithTcCost: number;
  filteredOutZeroCostRows: number;
  totalCostUsd: number;
}


