"use server";

/**
 * Roles & Staff: staff-portal roles (sets of permission keys) and the staff
 * accounts that hold them. Staff are always separate accounts made here;
 * customer or tenant accounts are never converted into staff.
 *
 * Anyone with the "staff" permission may use these, but only within their own
 * access: they can't create or hand out a role that opens more than they can,
 * and they can't touch the superuser.
 */
import { prisma } from "@srmall/database";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { AccessDenied, currentAccount, forgetAccount, requireStaff, staffAccess, type Account } from "@/lib/auth-server";
import { ALL_PERMISSIONS, isStaffPermission, type StaffAccess, type StaffPermission } from "@/lib/permissions";

type Result<T = undefined> = { success: true; data: T } | { success: false; error: string };

const PAGE = "/admindashboard/roles-staff";

function fail(error: unknown, fallback: string): { success: false; error: string } {
  if (error instanceof AccessDenied) return { success: false, error: error.message };
  console.error(`[STAFF] ${fallback}`, error);
  return { success: false, error: fallback };
}

/** Permissions the actor may grant: everything for the superuser, otherwise their own. */
function grantable(actor: Account): StaffPermission[] {
  return actor.isSuperuser ? [...ALL_PERMISSIONS] : actor.permissions;
}

function cleanPermissions(input: string[], actor: Account): StaffPermission[] | string {
  const keys = [...new Set(input)].filter(isStaffPermission);
  const allowed = grantable(actor);
  const extra = keys.filter((k) => !allowed.includes(k));
  if (extra.length) return "You can only grant sections you can open yourself.";
  return keys;
}

async function assertCanUseRole(roleId: string, actor: Account) {
  const role = await prisma.staffRole.findUnique({ where: { id: roleId }, select: { permissions: true } });
  if (!role) return "That role no longer exists.";
  const allowed = grantable(actor);
  if (role.permissions.some((p) => !allowed.includes(p as StaffPermission))) {
    return "You can't use a role that opens sections you can't open yourself.";
  }
  return null;
}

// ─── My access (sidebar) ─────────────────────────────────────────────────────

export async function getMyStaffAccessAction(): Promise<(StaffAccess & { roleName: string | null }) | null> {
  const account = await currentAccount();
  if (!account || account.type !== "ADMIN") return null;
  return { ...staffAccess(account), roleName: account.isSuperuser ? "Superuser" : account.roleName };
}

// ─── Roles ───────────────────────────────────────────────────────────────────

export type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  permissions: StaffPermission[];
  staffCount: number;
  canEdit: boolean;
};

export async function listRolesAction(): Promise<Result<RoleRow[]>> {
  try {
    const actor = await requireStaff("staff");
    const allowed = grantable(actor);
    const roles = await prisma.staffRole.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { staff: true } } },
    });
    return {
      success: true,
      data: roles.map((r) => {
        const permissions = r.permissions.filter(isStaffPermission);
        return {
          id: r.id,
          name: r.name,
          description: r.description,
          permissions,
          staffCount: r._count.staff,
          canEdit: permissions.every((p) => allowed.includes(p)),
        };
      }),
    };
  } catch (e) {
    return fail(e, "Couldn't load roles.");
  }
}

export async function saveRoleAction(input: {
  id?: string;
  name: string;
  description?: string;
  permissions: string[];
}): Promise<Result<{ id: string }>> {
  try {
    const actor = await requireStaff("staff");
    const name = input.name.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 50) return { success: false, error: "Role names are 2 to 50 characters." };
    const permissions = cleanPermissions(input.permissions, actor);
    if (typeof permissions === "string") return { success: false, error: permissions };
    if (!permissions.length) return { success: false, error: "Tick at least one section." };

    const clash = await prisma.staffRole.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, ...(input.id ? { NOT: { id: input.id } } : {}) },
      select: { id: true },
    });
    if (clash) return { success: false, error: "Another role already has this name." };

    const data = { name, description: input.description?.trim() || null, permissions };
    let id = input.id;
    if (id) {
      const problem = await assertCanUseRole(id, actor);
      if (problem) return { success: false, error: problem };
      await prisma.staffRole.update({ where: { id }, data });
      const holders = await prisma.user.findMany({ where: { staffRoleId: id }, select: { id: true } });
      holders.forEach((h) => forgetAccount(h.id));
    } else {
      id = (await prisma.staffRole.create({ data, select: { id: true } })).id;
    }
    revalidatePath(PAGE);
    return { success: true, data: { id } };
  } catch (e) {
    return fail(e, "Couldn't save the role.");
  }
}

export async function deleteRoleAction(roleId: string): Promise<Result> {
  try {
    const actor = await requireStaff("staff");
    const problem = await assertCanUseRole(roleId, actor);
    if (problem) return { success: false, error: problem };
    const inUse = await prisma.user.count({ where: { staffRoleId: roleId } });
    if (inUse) {
      return { success: false, error: `${inUse} staff ${inUse === 1 ? "account uses" : "accounts use"} this role. Give them another role first.` };
    }
    await prisma.staffRole.delete({ where: { id: roleId } });
    revalidatePath(PAGE);
    return { success: true, data: undefined };
  } catch (e) {
    return fail(e, "Couldn't delete the role.");
  }
}

// ─── Staff accounts ──────────────────────────────────────────────────────────

export type StaffRow = {
  id: string;
  name: string;
  email: string;
  roleId: string | null;
  roleName: string | null;
  isSuperuser: boolean;
  isActive: boolean;
  isMe: boolean;
  createdAt: string;
};

export async function listStaffAction(): Promise<Result<StaffRow[]>> {
  try {
    const actor = await requireStaff("staff");
    const staff = await prisma.user.findMany({
      where: { role: "ADMIN" },
      orderBy: [{ isSuperuser: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        isSuperuser: true,
        isBlacklisted: true,
        createdAt: true,
        staffRole: { select: { id: true, name: true } },
      },
    });
    return {
      success: true,
      data: staff.map((s) => ({
        id: s.id,
        name: s.name || s.email.split("@")[0],
        email: s.email,
        roleId: s.staffRole?.id ?? null,
        roleName: s.staffRole?.name ?? null,
        isSuperuser: s.isSuperuser,
        isActive: !s.isBlacklisted,
        isMe: s.id === actor.id,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  } catch (e) {
    return fail(e, "Couldn't load staff.");
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** New, separate staff account. The email can't belong to any other account. */
export async function createStaffAction(input: {
  name: string;
  email: string;
  password: string;
  roleId: string;
}): Promise<Result<{ id: string }>> {
  try {
    const actor = await requireStaff("staff");
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (name.length < 2) return { success: false, error: "Enter the person's name." };
    if (!EMAIL_RE.test(email)) return { success: false, error: "Enter a valid email address." };
    if ((input.password || "").length < 8) return { success: false, error: "Passwords are at least 8 characters." };
    const problem = await assertCanUseRole(input.roleId, actor);
    if (problem) return { success: false, error: problem };

    const taken = await prisma.user.findUnique({ where: { email }, select: { role: true } });
    if (taken) {
      return {
        success: false,
        error:
          taken.role === "ADMIN"
            ? "A staff account already uses this email."
            : "This email belongs to a customer or tenant account. Staff accounts need their own email.",
      };
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: await bcrypt.hash(input.password, 10),
        role: "ADMIN",
        isSuperuser: false,
        staffRoleId: input.roleId,
      },
      select: { id: true },
    });
    revalidatePath(PAGE);
    return { success: true, data: { id: user.id } };
  } catch (e) {
    return fail(e, "Couldn't create the staff account.");
  }
}

async function loadTarget(staffId: string, actor: Account) {
  const target = await prisma.user.findUnique({
    where: { id: staffId },
    select: { id: true, role: true, isSuperuser: true, staffRoleId: true },
  });
  if (!target || target.role !== "ADMIN") return { error: "Staff account not found." } as const;
  if (target.isSuperuser) return { error: "The superuser can't be changed here." } as const;
  if (target.id === actor.id) return { error: "You can't change your own access." } as const;
  if (target.staffRoleId) {
    const problem = await assertCanUseRole(target.staffRoleId, actor);
    if (problem) return { error: "This person has more access than you, so you can't change them." } as const;
  }
  return { target } as const;
}

export async function setStaffRoleAction(staffId: string, roleId: string): Promise<Result> {
  try {
    const actor = await requireStaff("staff");
    const t = await loadTarget(staffId, actor);
    if ("error" in t) return { success: false, error: t.error! };
    const problem = await assertCanUseRole(roleId, actor);
    if (problem) return { success: false, error: problem };
    await prisma.user.update({ where: { id: staffId }, data: { staffRoleId: roleId } });
    forgetAccount(staffId);
    revalidatePath(PAGE);
    return { success: true, data: undefined };
  } catch (e) {
    return fail(e, "Couldn't change the role.");
  }
}

/** Deactivated staff can't sign in; their history stays. */
export async function setStaffActiveAction(staffId: string, active: boolean): Promise<Result> {
  try {
    const actor = await requireStaff("staff");
    const t = await loadTarget(staffId, actor);
    if ("error" in t) return { success: false, error: t.error! };
    await prisma.user.update({ where: { id: staffId }, data: { isBlacklisted: !active } });
    forgetAccount(staffId);
    revalidatePath(PAGE);
    return { success: true, data: undefined };
  } catch (e) {
    return fail(e, "Couldn't update the account.");
  }
}

export async function resetStaffPasswordAction(staffId: string, password: string): Promise<Result> {
  try {
    const actor = await requireStaff("staff");
    const t = await loadTarget(staffId, actor);
    if ("error" in t) return { success: false, error: t.error! };
    if ((password || "").length < 8) return { success: false, error: "Passwords are at least 8 characters." };
    await prisma.user.update({ where: { id: staffId }, data: { password: await bcrypt.hash(password, 10) } });
    return { success: true, data: undefined };
  } catch (e) {
    return fail(e, "Couldn't reset the password.");
  }
}
