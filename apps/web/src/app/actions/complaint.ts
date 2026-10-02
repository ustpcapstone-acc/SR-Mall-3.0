"use server";

/**
 * Tenant complaints: a ticket per complaint plus a comment thread between the
 * tenant and the mall admin. Tables come from migration
 * 20261001000100_complaints and are queried with raw SQL (no Prisma client
 * regeneration needed).
 *
 * Unread tracking: each side's last action (lastTenantActivityAt /
 * lastAdminActivityAt) is compared with when the other side last opened the
 * complaint (adminReadAt / tenantReadAt). Admin internal notes never touch the
 * tenant's side.
 */
import { prisma } from "@srmall/database";
import { randomUUID } from "crypto";
import { notify } from "@/lib/notify";
import {
  COMMENT_MAX,
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
  DETAILS_MAX,
  MAX_PHOTOS,
  STATUS_META,
  SUBJECT_MAX,
  type ComplaintComment,
  type ComplaintDetail,
  type ComplaintPriority,
  type ComplaintStatus,
  type ComplaintSummary,
} from "@/lib/complaints";

type Result<T = {}> = ({ success: true } & T) | { success: false; error: string };

interface Actor {
  id: string;
  name: string;
  role: "ADMIN" | "TENANT";
  tenant: { id: string; shopName: string; unitId: string } | null;
}

async function getActor(userId: string | undefined | null): Promise<Actor | null> {
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, tenant: { select: { id: true, shopName: true, unitId: true } } },
  });
  if (!user) return null;
  const role = (user.role || "").toUpperCase();
  if (role !== "ADMIN" && role !== "TENANT") return null;
  if (role === "TENANT" && !user.tenant) return null;
  return {
    id: user.id,
    name: user.name || user.email,
    role,
    tenant: user.tenant,
  };
}

const excerpt = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n)}…` : s);

const cleanPhotos = (photos: unknown): string[] =>
  (Array.isArray(photos) ? photos : [])
    .filter((p): p is string => typeof p === "string" && /^https?:\/\//i.test(p) && p.length < 1000)
    .slice(0, MAX_PHOTOS);

const cleanPhoto = (url: unknown) => cleanPhotos([url])[0] ?? null;

const SUMMARY_SELECT = `
  SELECT c."id", c."tenantId", t."shopName", t."unitId", u."name" AS "ownerName",
         c."category", c."subject", c."details", c."photos", c."priority", c."status",
         c."createdAt", c."updatedAt", c."resolvedAt", c."userId",
         c."lastTenantActivityAt", c."lastAdminActivityAt", c."tenantReadAt", c."adminReadAt",
         (SELECT COUNT(*)::int FROM "ComplaintComment" cc
           WHERE cc."complaintId" = c."id" AND cc."authorRole" <> 'SYSTEM'
             AND (cc."isInternal" = false OR $1::boolean)) AS "commentCount"
    FROM "Complaint" c
    JOIN "Tenant" t ON t."id" = c."tenantId"
    LEFT JOIN "User" u ON u."id" = c."userId"`;

type Row = {
  id: string;
  tenantId: string;
  shopName: string;
  unitId: string;
  ownerName: string | null;
  category: string;
  subject: string;
  details: string;
  photos: string[] | null;
  priority: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  userId: string;
  lastTenantActivityAt: Date;
  lastAdminActivityAt: Date | null;
  tenantReadAt: Date;
  adminReadAt: Date | null;
  commentCount: number;
};

function toSummary(r: Row, role: Actor["role"]): ComplaintSummary {
  const lastActivity =
    r.lastAdminActivityAt && r.lastAdminActivityAt > r.lastTenantActivityAt ? r.lastAdminActivityAt : r.lastTenantActivityAt;
  const unread =
    role === "ADMIN"
      ? !r.adminReadAt || r.lastTenantActivityAt > r.adminReadAt
      : !!r.lastAdminActivityAt && r.lastAdminActivityAt > r.tenantReadAt;
  return {
    id: r.id,
    tenantId: r.tenantId,
    shopName: r.shopName,
    unitId: r.unitId,
    ownerName: r.ownerName,
    category: r.category,
    subject: r.subject,
    priority: r.priority as ComplaintPriority,
    status: r.status as ComplaintStatus,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    lastActivityAt: lastActivity.toISOString(),
    commentCount: r.commentCount,
    unread,
  };
}

/** Load a complaint the actor is allowed to see. */
async function loadComplaint(actor: Actor, id: string): Promise<Row | null> {
  const rows = await prisma.$queryRawUnsafe<Row[]>(`${SUMMARY_SELECT} WHERE c."id" = $2`, actor.role === "ADMIN", id);
  const row = rows[0];
  if (!row) return null;
  if (actor.role === "TENANT" && row.tenantId !== actor.tenant?.id) return null;
  return row;
}

async function insertComment(
  complaintId: string,
  c: { authorId: string | null; authorRole: "TENANT" | "ADMIN" | "SYSTEM"; authorName: string; message: string; photoUrl?: string | null; isInternal?: boolean },
  at: Date,
) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ComplaintComment" ("id", "complaintId", "authorId", "authorRole", "authorName", "message", "photoUrl", "isInternal", "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    randomUUID(),
    complaintId,
    c.authorId,
    c.authorRole,
    c.authorName,
    c.message,
    c.photoUrl ?? null,
    c.isInternal ?? false,
    at,
  );
}

/** Record activity by one side (and mark it read for that side). */
async function touch(id: string, role: Actor["role"], at: Date, extraSql = "", extraParams: unknown[] = []) {
  const side =
    role === "ADMIN"
      ? `"lastAdminActivityAt" = $2, "adminReadAt" = $2`
      : `"lastTenantActivityAt" = $2, "tenantReadAt" = $2`;
  await prisma.$executeRawUnsafe(
    `UPDATE "Complaint" SET ${side}, "updatedAt" = $2${extraSql} WHERE "id" = $1`,
    id,
    at,
    ...extraParams,
  );
}

const adminLink = (id: string) => `/admindashboard/complaints?id=${id}`;
const tenantLink = (id: string) => `/tenantdashboard/complaints?id=${id}`;

// ── Tenant ──────────────────────────────────────────────────────────────────

export async function createComplaintAction(
  userId: string,
  input: { category: string; subject: string; details: string; priority: string; photos?: string[] },
): Promise<Result<{ id: string }>> {
  try {
    const actor = await getActor(userId);
    if (!actor || actor.role !== "TENANT" || !actor.tenant) return { success: false, error: "Only tenants can file complaints." };

    const category = (COMPLAINT_CATEGORIES as readonly string[]).includes(input.category) ? input.category : null;
    const subject = (input.subject || "").trim();
    const details = (input.details || "").trim();
    const priority = (COMPLAINT_PRIORITIES as string[]).includes(input.priority) ? input.priority : "NORMAL";
    if (!category) return { success: false, error: "Please choose a category." };
    if (subject.length < 3) return { success: false, error: "Please add a short subject." };
    if (subject.length > SUBJECT_MAX) return { success: false, error: `Subject can be up to ${SUBJECT_MAX} characters.` };
    if (details.length < 10) return { success: false, error: "Please describe the problem (at least 10 characters)." };
    if (details.length > DETAILS_MAX) return { success: false, error: `Details can be up to ${DETAILS_MAX} characters.` };

    const id = randomUUID();
    const now = new Date();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Complaint" ("id", "tenantId", "userId", "category", "subject", "details", "priority", "status", "photos",
                                "createdAt", "updatedAt", "lastTenantActivityAt", "tenantReadAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'NEW', $8::text[], $9, $9, $9, $9)`,
      id,
      actor.tenant.id,
      actor.id,
      category,
      subject,
      details,
      priority,
      cleanPhotos(input.photos),
      now,
    );

    await notify("COMPLAINT_ACTIVITY", {
      title: `${priority === "URGENT" ? "URGENT: " : ""}New complaint from ${actor.tenant.shopName}`,
      message: `${category} · ${excerpt(subject, 100)} (Unit ${actor.tenant.unitId})`,
      link: adminLink(id),
      ctaLabel: "Open complaint",
    });

    return { success: true, id };
  } catch (error) {
    console.error("Create complaint error:", error);
    return { success: false, error: "Couldn't submit the complaint. Please try again." };
  }
}

export async function getMyComplaintsAction(userId: string): Promise<Result<{ complaints: ComplaintSummary[] }>> {
  try {
    const actor = await getActor(userId);
    if (!actor || actor.role !== "TENANT" || !actor.tenant) return { success: false, error: "Not allowed." };
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `${SUMMARY_SELECT} WHERE c."tenantId" = $2
        ORDER BY GREATEST(c."lastTenantActivityAt", COALESCE(c."lastAdminActivityAt", c."lastTenantActivityAt")) DESC`,
      false,
      actor.tenant.id,
    );
    return { success: true, complaints: rows.map((r) => toSummary(r, "TENANT")) };
  } catch (error) {
    console.error("List complaints error:", error);
    return { success: false, error: "Couldn't load complaints." };
  }
}

// ── Admin ───────────────────────────────────────────────────────────────────

export async function getAdminComplaintsAction(userId: string): Promise<
  Result<{
    complaints: ComplaintSummary[];
    stats: { new: number; inProgress: number; urgentOpen: number; resolvedThisMonth: number };
  }>
> {
  try {
    const actor = await getActor(userId);
    if (!actor || actor.role !== "ADMIN") return { success: false, error: "Not allowed." };
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `${SUMMARY_SELECT}
        ORDER BY CASE WHEN c."status" IN ('NEW', 'IN_PROGRESS') THEN 0 ELSE 1 END,
                 CASE WHEN c."priority" = 'URGENT' AND c."status" IN ('NEW', 'IN_PROGRESS') THEN 0 ELSE 1 END,
                 GREATEST(c."lastTenantActivityAt", COALESCE(c."lastAdminActivityAt", c."lastTenantActivityAt")) DESC`,
      true,
    );
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const stats = {
      new: rows.filter((r) => r.status === "NEW").length,
      inProgress: rows.filter((r) => r.status === "IN_PROGRESS").length,
      urgentOpen: rows.filter((r) => r.priority === "URGENT" && (r.status === "NEW" || r.status === "IN_PROGRESS")).length,
      resolvedThisMonth: rows.filter((r) => r.status === "RESOLVED" && r.resolvedAt && r.resolvedAt >= monthStart).length,
    };
    return { success: true, complaints: rows.map((r) => toSummary(r, "ADMIN")), stats };
  } catch (error) {
    console.error("Admin complaints error:", error);
    return { success: false, error: "Couldn't load complaints." };
  }
}

export async function updateComplaintPriorityAction(userId: string, id: string, priority: string): Promise<Result> {
  try {
    const actor = await getActor(userId);
    if (!actor || actor.role !== "ADMIN") return { success: false, error: "Not allowed." };
    if (!(COMPLAINT_PRIORITIES as string[]).includes(priority)) return { success: false, error: "Unknown priority." };
    const row = await loadComplaint(actor, id);
    if (!row) return { success: false, error: "Complaint not found." };
    await prisma.$executeRawUnsafe(`UPDATE "Complaint" SET "priority" = $2, "updatedAt" = $3 WHERE "id" = $1`, id, priority, new Date());
    return { success: true };
  } catch (error) {
    console.error("Complaint priority error:", error);
    return { success: false, error: "Couldn't change the priority." };
  }
}

// ── Both sides ──────────────────────────────────────────────────────────────

/** Full complaint with its thread. Opening it marks it read for the viewer. */
export async function getComplaintAction(userId: string, id: string): Promise<Result<{ complaint: ComplaintDetail }>> {
  try {
    const actor = await getActor(userId);
    if (!actor) return { success: false, error: "Not allowed." };
    const row = await loadComplaint(actor, id);
    if (!row) return { success: false, error: "Complaint not found." };

    const comments = await prisma.$queryRawUnsafe<
      { id: string; authorId: string | null; authorRole: string; authorName: string; message: string; photoUrl: string | null; isInternal: boolean; createdAt: Date }[]
    >(
      `SELECT "id", "authorId", "authorRole", "authorName", "message", "photoUrl", "isInternal", "createdAt"
         FROM "ComplaintComment"
        WHERE "complaintId" = $1 AND ("isInternal" = false OR $2::boolean)
        ORDER BY "createdAt" ASC`,
      id,
      actor.role === "ADMIN",
    );

    // Summary flags are computed before marking read, so the caller can tell
    // the sidebar its count changed.
    const summary = toSummary(row, actor.role);
    await prisma.$executeRawUnsafe(
      `UPDATE "Complaint" SET ${actor.role === "ADMIN" ? `"adminReadAt"` : `"tenantReadAt"`} = $2 WHERE "id" = $1`,
      id,
      new Date(),
    );

    const thread: ComplaintComment[] = comments.map((c) => ({
      id: c.id,
      authorRole: c.authorRole as ComplaintComment["authorRole"],
      authorName: c.authorName,
      message: c.message,
      photoUrl: c.photoUrl,
      isInternal: c.isInternal,
      createdAt: c.createdAt.toISOString(),
      mine: c.authorId === actor.id,
    }));

    return {
      success: true,
      complaint: {
        ...summary,
        details: row.details,
        photos: row.photos || [],
        resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
        comments: thread,
      },
    };
  } catch (error) {
    console.error("Get complaint error:", error);
    return { success: false, error: "Couldn't load the complaint." };
  }
}

export async function addComplaintCommentAction(
  userId: string,
  id: string,
  input: { message: string; photoUrl?: string | null; isInternal?: boolean },
): Promise<Result> {
  try {
    const actor = await getActor(userId);
    if (!actor) return { success: false, error: "Not allowed." };
    const row = await loadComplaint(actor, id);
    if (!row) return { success: false, error: "Complaint not found." };

    const message = (input.message || "").trim();
    const photoUrl = cleanPhoto(input.photoUrl);
    if (!message && !photoUrl) return { success: false, error: "Write a comment or attach a photo." };
    if (message.length > COMMENT_MAX) return { success: false, error: `Comments can be up to ${COMMENT_MAX} characters.` };

    const isInternal = actor.role === "ADMIN" && !!input.isInternal;
    if (actor.role === "TENANT" && (row.status === "RESOLVED" || row.status === "CLOSED")) {
      return { success: false, error: "This complaint is no longer open. Reopen it to add a comment." };
    }

    const now = new Date();
    await insertComment(id, { authorId: actor.id, authorRole: actor.role, authorName: actor.role === "ADMIN" ? "SR Mall Admin" : actor.tenant!.shopName, message, photoUrl, isInternal }, now);

    if (isInternal) {
      await prisma.$executeRawUnsafe(`UPDATE "Complaint" SET "adminReadAt" = $2 WHERE "id" = $1`, id, now);
      return { success: true };
    }

    // An admin reply on a new complaint means it is being handled.
    const autoProgress = actor.role === "ADMIN" && row.status === "NEW";
    await touch(id, actor.role, now, autoProgress ? `, "status" = 'IN_PROGRESS'` : "");

    const text = message || "(photo)";
    if (actor.role === "ADMIN") {
      await notify("COMPLAINT_UPDATE", {
        recipients: [row.userId],
        title: "SR Mall Admin replied to your complaint",
        message: `${excerpt(row.subject, 80)}: "${excerpt(text)}"`,
        link: tenantLink(id),
        ctaLabel: "View complaint",
        quote: { author: "SR Mall Admin", text },
      });
    } else {
      await notify("COMPLAINT_ACTIVITY", {
        title: `${row.shopName} replied to a complaint`,
        message: `${excerpt(row.subject, 80)}: "${excerpt(text)}"`,
        link: adminLink(id),
        ctaLabel: "Open complaint",
        quote: { author: row.shopName, text },
      });
    }
    return { success: true };
  } catch (error) {
    console.error("Complaint comment error:", error);
    return { success: false, error: "Couldn't post the comment." };
  }
}

/**
 * Admin: any status. Tenant: mark their own complaint Resolved, or reopen a
 * Resolved one (Closed is final — that is the admin saying it isn't valid).
 */
export async function updateComplaintStatusAction(userId: string, id: string, status: string): Promise<Result> {
  try {
    const actor = await getActor(userId);
    if (!actor) return { success: false, error: "Not allowed." };
    if (!(COMPLAINT_STATUSES as string[]).includes(status)) return { success: false, error: "Unknown status." };
    const row = await loadComplaint(actor, id);
    if (!row) return { success: false, error: "Complaint not found." };
    if (row.status === status) return { success: true };

    let next = status as ComplaintStatus;
    if (actor.role === "TENANT") {
      const resolving = next === "RESOLVED" && (row.status === "NEW" || row.status === "IN_PROGRESS");
      const reopening = row.status === "RESOLVED" && (next === "NEW" || next === "IN_PROGRESS");
      if (!resolving && !reopening) return { success: false, error: "You can only mark a complaint resolved or reopen it." };
      if (reopening) next = row.lastAdminActivityAt ? "IN_PROGRESS" : "NEW";
    }

    const now = new Date();
    const who = actor.role === "ADMIN" ? "SR Mall Admin" : row.shopName;
    const label = STATUS_META[next].label;
    const reopened = row.status === "RESOLVED" && (next === "NEW" || next === "IN_PROGRESS");
    await insertComment(
      id,
      { authorId: actor.id, authorRole: "SYSTEM", authorName: who, message: reopened ? `${who} reopened this complaint` : `${who} marked this complaint ${label}` },
      now,
    );
    await touch(id, actor.role, now, `, "status" = $3, "resolvedAt" = $4`, [next, next === "RESOLVED" ? now : null]);

    if (actor.role === "ADMIN") {
      await notify("COMPLAINT_UPDATE", {
        recipients: [row.userId],
        title: `Your complaint is now ${label}`,
        message: excerpt(row.subject, 120),
        link: tenantLink(id),
        ctaLabel: "View complaint",
      });
    } else {
      await notify("COMPLAINT_ACTIVITY", {
        title: `${row.shopName} ${reopened ? "reopened" : "marked as resolved"} a complaint`,
        message: excerpt(row.subject, 120),
        link: adminLink(id),
        ctaLabel: "Open complaint",
      });
    }
    return { success: true };
  } catch (error) {
    console.error("Complaint status error:", error);
    return { success: false, error: "Couldn't change the status." };
  }
}

/** Sidebar badge: complaints with something new for this viewer. */
export async function getComplaintUnreadCountAction(userId: string): Promise<number> {
  try {
    const actor = await getActor(userId);
    if (!actor) return 0;
    const rows =
      actor.role === "ADMIN"
        ? await prisma.$queryRawUnsafe<{ n: number }[]>(
            `SELECT COUNT(*)::int AS n FROM "Complaint"
              WHERE "status" IN ('NEW', 'IN_PROGRESS')
                AND ("adminReadAt" IS NULL OR "lastTenantActivityAt" > "adminReadAt")`,
          )
        : await prisma.$queryRawUnsafe<{ n: number }[]>(
            `SELECT COUNT(*)::int AS n FROM "Complaint"
              WHERE "tenantId" = $1 AND "lastAdminActivityAt" IS NOT NULL AND "lastAdminActivityAt" > "tenantReadAt"`,
            actor.tenant!.id,
          );
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}
