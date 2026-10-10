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
  invoiceDate?: string;
  model?: string;
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

  // Delivery Report / Challan Tracking Fields
  lastChallanNumber?: string;
  lastDeliveryDate?: string;
  allChallanNumbers?: string[];
  deliveryCount?: number;
  customerAddress?: string;
  deliveryAddress?: string;
  deliverToCompany?: string;
  deliveryVanNo?: string;

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
 * Known cancelled PIs identified by user or reports
 */
export const KNOWN_CANCELLED_PIS = new Set([
  'MPBL/00789/2026',
  'MPBL/02042/2026',
  'MPBL/03305/2026',
  'MPBL007892026',
  'MPBL020422026',
  'MPBL033052026',
]);

export function isCancelledPi(piNumber?: string): boolean {
  if (!piNumber) return false;
  const raw = String(piNumber).trim().toUpperCase();
  const clean = raw.replace(/[^A-Z0-9]/g, '');
  for (const c of KNOWN_CANCELLED_PIS) {
    const cClean = c.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (raw === c || clean === cClean || clean.includes(cClean)) return true;
  }
  return false;
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
 * Comprehensive check if an order or PI is Cancelled
 */
export function isCancelledOrder(item?: Partial<PIData> | null): boolean {
  if (!item) return false;
  if (isCancelledPi(item.piNumber)) return true;
  if (isCancelledStatus(item.orderStatus)) return true;
  if (isCancelledStatus(item.deliveryStatus)) return true;
  if (isCancelledStatus(item.tcStatus)) return true;
  return false;
}

/**
 * Robust date parser supporting YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD-MMM-YYYY, and Excel serial numbers.
 * Always normalizes to UTC midnight for exact calendar-day diffing.
 */
export function parseSmartDate(val?: any): Date | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return new Date(Date.UTC(val.getFullYear(), val.getMonth(), val.getDate()));
  }

  if (typeof val === 'number') {
    if (val > 20000 && val < 80000) {
      const utcMs = Math.round((val - 25569) * 86400 * 1000);
      const d = new Date(utcMs);
      if (!isNaN(d.getTime())) {
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      }
    }
    return null;
  }

  const str = String(val).trim();
  if (!str || str === '-' || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'pending') {
    return null;
  }

  // 1. Check numeric Excel serial string (e.g. "46290")
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (num > 20000 && num < 80000) {
      const utcMs = Math.round((num - 25569) * 86400 * 1000);
      const d = new Date(utcMs);
      if (!isNaN(d.getTime())) {
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      }
    }
  }

  // 2. Check YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  // 3. Check DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;

    let day = p1;
    let month = p2;
    if (p1 <= 12 && p2 > 12) {
      month = p1;
      day = p2;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  // 4. Fallback for text dates like "15-Aug-2026" or "Oct 5, 2026"
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    return new Date(Date.UTC(fallback.getFullYear(), fallback.getMonth(), fallback.getDate()));
  }

  return null;
}

/**
 * Normalizes any valid date input into standard YYYY-MM-DD string, or returns '' if empty/invalid.
 */
export function normalizeDateStr(val?: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (!str || str === '-') return '';
  const parsed = parseSmartDate(val);
  if (!parsed) return str;
  return parsed.toISOString().slice(0, 10);
}

/**
 * Calculates exact calendar days between two date strings (startStr -> endStr).
 */
export function getDaysBetweenDates(startStr?: string, endStr?: string): number | null {
  const start = parseSmartDate(startStr);
  const end = parseSmartDate(endStr);
  if (!start || !end) return null;
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Calculates exact calendar days from a given date string to Today.
 */
export function getDaysFromDateToToday(dateStr?: string): number | null {
  const start = parseSmartDate(dateStr);
  if (!start) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((todayUtc - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export interface DraftConfirmDaysInfo {
  days: number | null;
  isConfirmed: boolean;
  label: string;
}

/**
 * Calculates how many days elapsed from Draft TC Date until Draft Confirmation Date
 * (or until Today if confirmation has not arrived yet).
 */
export function getDraftToConfirmDays(item: Partial<PIData>): DraftConfirmDaysInfo {
  const hasDraftTc = !!(item.draftTcDate && item.draftTcDate.trim() && item.draftTcDate.trim() !== '-');
  const hasDraftConf = !!(
    item.draftConfirmationDate &&
    item.draftConfirmationDate.trim() &&
    item.draftConfirmationDate.trim() !== '-'
  );

  if (!hasDraftTc) {
    return { days: null, isConfirmed: false, label: '-' };
  }

  if (hasDraftConf) {
    const days = getDaysBetweenDates(item.draftTcDate, item.draftConfirmationDate);
    return {
      days,
      isConfirmed: true,
      label: days !== null ? `${days} ${days === 1 ? 'Day' : 'Days'}` : '-',
    };
  }

  const waitingDays = getDaysFromDateToToday(item.draftTcDate);
  return {
    days: waitingDays,
    isConfirmed: false,
    label: waitingDays !== null ? `${waitingDays} ${waitingDays === 1 ? 'Day' : 'Days'}` : '-',
  };
}

/**
 * Calculate exact Age in Days from Order Date to Today (or fallback to stored age)
 */
export function calculatePiAgeDays(orderDateStr?: string, fallbackAge?: number): number {
  const days = getDaysFromDateToToday(orderDateStr);
  if (days !== null) return days;
  return fallbackAge || 0;
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

export interface ActionableStatusInfo {
  statusLabel: string;
  stageCode: 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'DONE';
  stageName: string;
  actionText: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  isCompleted: boolean;
  isOverdue: boolean;
  daysWaiting: number | null;
}

function getDaysToNow(dateStr?: string): number | null {
  return getDaysFromDateToToday(dateStr);
}

/**
 * Computes the exact operational step this PI is waiting for right now,
 * prioritizing the latest reached workflow stage so skipped intermediate dates never show stale earlier stages.
 */
export function computeActionableWaitingStatus(item: Partial<PIData>): ActionableStatusInfo {
  const hasFinalRec = !!(item.finalTcReceivedDate && item.finalTcReceivedDate.trim());
  if (hasFinalRec) {
    return {
      statusLabel: 'Final TC Issued',
      stageCode: 'DONE',
      stageName: 'Completed',
      actionText: 'Transaction Certificate Successfully Issued',
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-800',
      badgeBorder: 'border-emerald-300',
      dotColor: 'bg-emerald-600',
      isCompleted: true,
      isOverdue: false,
      daysWaiting: null,
    };
  }

  const hasReq = !!(item.tcRequestDate && item.tcRequestDate.trim());
  const hasCommDoc = !!(item.receivedCommercialDocDate && item.receivedCommercialDocDate.trim());
  const hasDraftTc = !!(item.draftTcDate && item.draftTcDate.trim());
  const hasDraftConf = !!(item.draftConfirmationDate && item.draftConfirmationDate.trim());
  const hasFinalApply = !!(item.finalTcApplyDate && item.finalTcApplyDate.trim());

  // Stage 5: Final TC Applied -> Waiting for Final TC Certificate Release
  if (hasFinalApply) {
    const days = getDaysToNow(item.finalTcApplyDate);
    const isOver = days !== null && days > 5;
    return {
      statusLabel: days !== null ? `Waiting for Final Release (${days}d)` : 'Waiting for Final Release',
      stageCode: 'S5',
      stageName: 'Final TC Release',
      actionText: 'Waiting for Final Certificate from Certification Body',
      badgeBg: isOver ? 'bg-red-50' : 'bg-teal-50',
      badgeText: isOver ? 'text-red-800' : 'text-teal-800',
      badgeBorder: isOver ? 'border-red-300' : 'border-teal-300',
      dotColor: isOver ? 'bg-red-600' : 'bg-teal-600',
      isCompleted: false,
      isOverdue: isOver,
      daysWaiting: days,
    };
  }

  // Stage 4: Draft Confirmed -> Waiting for Final TC Application
  if (hasDraftConf) {
    const days = getDaysToNow(item.draftConfirmationDate);
    const isOver = days !== null && days > 3;
    return {
      statusLabel: days !== null ? `Waiting for Final Apply (${days}d)` : 'Waiting for Final Apply',
      stageCode: 'S4',
      stageName: 'Final Application',
      actionText: 'Pending Final Application Submission to Certifier',
      badgeBg: isOver ? 'bg-red-50' : 'bg-indigo-50',
      badgeText: isOver ? 'text-red-800' : 'text-indigo-800',
      badgeBorder: isOver ? 'border-red-300' : 'border-indigo-300',
      dotColor: isOver ? 'bg-red-600' : 'bg-indigo-600',
      isCompleted: false,
      isOverdue: isOver,
      daysWaiting: days,
    };
  }

  // Stage 3: Draft TC Done -> Waiting for Draft Confirmation
  if (hasDraftTc) {
    const days = getDaysToNow(item.draftTcDate);
    const isOver = days !== null && days > 3;
    return {
      statusLabel: days !== null ? `Waiting for Confirmation (${days}d)` : 'Waiting for Confirmation',
      stageCode: 'S3',
      stageName: 'Draft Confirmation',
      actionText: 'Pending Buyer / Internal Draft Approval',
      badgeBg: isOver ? 'bg-red-50' : 'bg-purple-50',
      badgeText: isOver ? 'text-red-800' : 'text-purple-800',
      badgeBorder: isOver ? 'border-red-300' : 'border-purple-300',
      dotColor: isOver ? 'bg-red-600' : 'bg-purple-600',
      isCompleted: false,
      isOverdue: isOver,
      daysWaiting: days,
    };
  }

  // Stage 2: Commercial Doc Received -> Waiting for Draft TC from Certifier
  if (hasCommDoc) {
    const days = getDaysToNow(item.receivedCommercialDocDate);
    const isOver = days !== null && days > 5;
    return {
      statusLabel: days !== null ? `Waiting for Draft TC (${days}d)` : 'Waiting for Draft TC',
      stageCode: 'S2',
      stageName: 'Draft TC',
      actionText: 'Waiting for Draft TC from Certification Body',
      badgeBg: isOver ? 'bg-red-50' : 'bg-blue-50',
      badgeText: isOver ? 'text-red-800' : 'text-blue-800',
      badgeBorder: isOver ? 'border-red-300' : 'border-blue-300',
      dotColor: isOver ? 'bg-red-600' : 'bg-blue-600',
      isCompleted: false,
      isOverdue: isOver,
      daysWaiting: days,
    };
  }

  // Stage 1: TC Requested -> Waiting for Commercial Document
  if (hasReq) {
    const days = getDaysToNow(item.tcRequestDate);
    const isOver = days !== null && days > 4;
    return {
      statusLabel: days !== null ? `Waiting for Comm Doc (${days}d)` : 'Waiting for Comm Doc',
      stageCode: 'S1',
      stageName: 'Commercial Doc',
      actionText: 'Waiting for Invoice / Shipping Documents from Factory',
      badgeBg: isOver ? 'bg-red-50' : 'bg-amber-50',
      badgeText: isOver ? 'text-red-800' : 'text-amber-800',
      badgeBorder: isOver ? 'border-red-300' : 'border-amber-300',
      dotColor: isOver ? 'bg-red-600' : 'bg-amber-600',
      isCompleted: false,
      isOverdue: isOver,
      daysWaiting: days,
    };
  }

  // Stage 0: Not Requested
  return {
    statusLabel: 'Waiting for TC Request',
    stageCode: 'S0',
    stageName: 'Initial Request',
    actionText: 'Pending TC Request Submission to Factory',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-600',
    badgeBorder: 'border-slate-300',
    dotColor: 'bg-slate-400',
    isCompleted: false,
    isOverdue: false,
    daysWaiting: null,
  };
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

export interface DeliveryReportFileInfo {
  fileName: string;
  fileSize: number;
  uploadDate: string;
  totalRowsScanned: number;
  totalPisWithChallan: number;
  matchedDatabasePis: number;
}



