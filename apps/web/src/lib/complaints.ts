/**
 * Tenant complaints — shared constants and types. Client/server safe.
 */

export const COMPLAINT_CATEGORIES = [
  "Maintenance & Repairs",
  "Electricity / Water",
  "Cleanliness",
  "Security",
  "Billing & Payments",
  "Noise / Neighbouring Tenant",
  "Others",
] as const;

export type ComplaintStatus = "NEW" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type ComplaintPriority = "LOW" | "NORMAL" | "URGENT";

export const COMPLAINT_STATUSES: ComplaintStatus[] = ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"];
export const COMPLAINT_PRIORITIES: ComplaintPriority[] = ["LOW", "NORMAL", "URGENT"];

export const STATUS_META: Record<ComplaintStatus, { label: string; badge: string }> = {
  NEW: { label: "New", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  IN_PROGRESS: { label: "In Progress", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  RESOLVED: { label: "Resolved", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  CLOSED: { label: "Closed", badge: "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20" },
};

export const PRIORITY_META: Record<ComplaintPriority, { label: string; badge: string }> = {
  LOW: { label: "Low", badge: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
  NORMAL: { label: "Normal", badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20" },
  URGENT: { label: "Urgent", badge: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
};

export const SUBJECT_MAX = 120;
export const DETAILS_MAX = 2000;
export const COMMENT_MAX = 1500;
export const MAX_PHOTOS = 3;

export interface ComplaintSummary {
  id: string;
  tenantId: string;
  shopName: string;
  unitId: string;
  ownerName: string | null;
  category: string;
  subject: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  commentCount: number;
  /** Something new from the other side since this viewer last opened it. */
  unread: boolean;
}

export interface ComplaintComment {
  id: string;
  authorRole: "TENANT" | "ADMIN" | "SYSTEM";
  authorName: string;
  message: string;
  photoUrl: string | null;
  isInternal: boolean;
  createdAt: string;
  mine: boolean;
}

export interface ComplaintDetail extends ComplaintSummary {
  details: string;
  photos: string[];
  resolvedAt: string | null;
  comments: ComplaintComment[];
}

/** Fired after any complaint change so sidebars refresh their badge. */
export const COMPLAINTS_CHANGED_EVENT = "complaints:changed";
