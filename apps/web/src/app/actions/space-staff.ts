"use server";

/**
 * Tenant staff for one space: roles (default Manager, Cashier, Marketing plus
 * custom ones) and staff accounts. Only the tenant owner can manage them, and
 * only for the space workspace they have open.
 */
import bcrypt from "bcryptjs";
import { prisma } from "@srmall/database";
import { AccessDenied, forgetAccount } from "@/lib/auth-server";
import { checkAccount } from "@/lib/tenant-onboarding";
import { DEFAULT_SPACE_ROLES, isSpacePermission } from "@/lib/tenant-permissions";
import { requireTenantOwner, resolveWorkspace } from "@/lib/workspace-server";

type Fail = { success: false; error: string };
class UserError extends Error {}

function failure(e: unknown, fallback: string): Fail {
  if (e instanceof AccessDenied || e instanceof UserError) return { success: false, error: e.message };
  if ((e as { code?: string })?.code === "P2002") return { success: false, error: "That name or email is already used." };
  console.error("[SPACE_STAFF]", e);
  return { success: false, error: fallback };
}

/** The owner and the space workspace they have open. */
async function ownerSpace() {
  const tenant = await requireTenantOwner();
  const { lease } = await resolveWorkspace(tenant.id);
  if (!lease) throw new UserError("Open a space workspace first. Staff belong to one space.");
  return { tenant, lease };
}

async function ensureDefaultRoles(leaseId: string) {
  await prisma.spaceRole.createMany({
    data: DEFAULT_SPACE_ROLES.map((r) => ({ leaseId, name: r.name, permissions: r.permissions, isDefault: true })),
    skipDuplicates: true,
  });
}

export type SpaceRoleRow = { id: string; name: string; permissions: string[]; isDefault: boolean; staffCount: number };
export type SpaceStaffRow = { id: string; name: string; email: string; roleId: string; roleName: string; isActive: boolean; createdAt: string };

export async function listSpaceStaffAction(): Promise<
  { success: true; data: { unitId: string; roles: SpaceRoleRow[]; staff: SpaceStaffRow[] } } | Fail
> {
  try {
    const { lease } = await ownerSpace();
    await ensureDefaultRoles(lease.id);
    const [roles, staff] = await Promise.all([
      prisma.spaceRole.findMany({
        where: { leaseId: lease.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        include: { _count: { select: { staff: true } } },
      }),
      prisma.spaceStaff.findMany({
        where: { leaseId: lease.id },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true, email: true } }, role: { select: { name: true } } },
      }),
    ]);
    return {
      success: true,
      data: {
        unitId: lease.unitId,
        roles: roles.map((r) => ({
          id: r.id,
          name: r.name,
          permissions: r.permissions,
          isDefault: r.isDefault,
          staffCount: r._count.staff,
        })),
        staff: staff.map((m) => ({
          id: m.id,
          name: m.user.name || m.user.email,
          email: m.user.email,
          roleId: m.roleId,
          roleName: m.role.name,
          isActive: m.isActive,
          createdAt: m.createdAt.toISOString(),
        })),
      },
    };
  } catch (e) {
    return failure(e, "Couldn't load staff.");
  }
}

function cleanPermissions(list: unknown) {
  const perms = [...new Set((Array.isArray(list) ? list : []).map(String))].filter(isSpacePermission);
  if (!perms.length) throw new UserError("Tick at least one section.");
  return perms;
}

export async function saveSpaceRoleAction(input: { id?: string; name: string; permissions: string[] }) {
  try {
    const { lease } = await ownerSpace();
    const name = String(input?.name ?? "").trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 40) return { success: false as const, error: "Use a role name of 2 to 40 characters." };
    const permissions = cleanPermissions(input?.permissions);
    if (input?.id) {
      const role = await prisma.spaceRole.findFirst({ where: { id: String(input.id), leaseId: lease.id } });
      if (!role) return { success: false as const, error: "Role not found." };
      await prisma.spaceRole.update({ where: { id: role.id }, data: { name, permissions } });
      const staff = await prisma.spaceStaff.findMany({ where: { roleId: role.id }, select: { userId: true } });
      staff.forEach((m) => forgetAccount(m.userId));
    } else {
      await prisma.spaceRole.create({ data: { leaseId: lease.id, name, permissions } });
    }
    return { success: true as const };
  } catch (e) {
    return failure(e, "Couldn't save the role.");
  }
}

export async function deleteSpaceRoleAction(id: string) {
  try {
    const { lease } = await ownerSpace();
    const role = await prisma.spaceRole.findFirst({
      where: { id: String(id), leaseId: lease.id },
      include: { _count: { select: { staff: true } } },
    });
    if (!role) return { success: false as const, error: "Role not found." };
    if (role.isDefault) return { success: false as const, error: "Built-in roles can't be deleted. You can change what they open." };
    if (role._count.staff) return { success: false as const, error: "Move this role's staff to another role first." };
    await prisma.spaceRole.delete({ where: { id: role.id } });
    return { success: true as const };
  } catch (e) {
    return failure(e, "Couldn't delete the role.");
  }
}

async function roleInSpace(roleId: string, leaseId: string) {
  const role = await prisma.spaceRole.findFirst({ where: { id: String(roleId), leaseId }, select: { id: true } });
  if (!role) throw new UserError("Choose a role.");
  return role.id;
}

async function staffInSpace(staffId: string, leaseId: string) {
  const member = await prisma.spaceStaff.findFirst({ where: { id: String(staffId), leaseId }, select: { id: true, userId: true } });
  if (!member) throw new UserError("Staff member not found.");
  return member;
}

export async function createSpaceStaffAction(input: { name: string; email: string; password: string; roleId: string }) {
  try {
    const { tenant, lease } = await ownerSpace();
    const name = String(input?.name ?? "").trim();
    const email = String(input?.email ?? "").trim().toLowerCase();
    const password = String(input?.password ?? "");
    const errors = checkAccount({ name, email, password });
    const first = Object.values(errors)[0];
    if (first) return { success: false as const, error: first };
    const roleId = await roleInSpace(input?.roleId, lease.id);
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      return { success: false as const, error: "An account already uses this email. Staff need their own email." };
    }
    const hash = await bcrypt.hash(password, 10);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, name, password: hash, role: "TENANT_STAFF" }, select: { id: true } });
      await tx.spaceStaff.create({ data: { userId: user.id, tenantId: tenant.id, leaseId: lease.id, roleId } });
    });
    return { success: true as const };
  } catch (e) {
    return failure(e, "Couldn't add the staff member.");
  }
}

export async function setSpaceStaffRoleAction(staffId: string, roleId: string) {
  try {
    const { lease } = await ownerSpace();
    const member = await staffInSpace(staffId, lease.id);
    await prisma.spaceStaff.update({ where: { id: member.id }, data: { roleId: await roleInSpace(roleId, lease.id) } });
    forgetAccount(member.userId);
    return { success: true as const };
  } catch (e) {
    return failure(e, "Couldn't change the role.");
  }
}

export async function setSpaceStaffActiveAction(staffId: string, active: boolean) {
  try {
    const { lease } = await ownerSpace();
    const member = await staffInSpace(staffId, lease.id);
    await prisma.spaceStaff.update({ where: { id: member.id }, data: { isActive: !!active } });
    forgetAccount(member.userId);
    return { success: true as const };
  } catch (e) {
    return failure(e, "Couldn't update the staff member.");
  }
}

export async function resetSpaceStaffPasswordAction(staffId: string, password: string) {
  try {
    const { lease } = await ownerSpace();
    const member = await staffInSpace(staffId, lease.id);
    const error = checkAccount({ name: "ok", email: "a@b.co", password: String(password ?? "") }).password;
    if (error) return { success: false as const, error };
    await prisma.user.update({ where: { id: member.userId }, data: { password: await bcrypt.hash(String(password), 10) } });
    return { success: true as const };
  } catch (e) {
    return failure(e, "Couldn't reset the password.");
  }
}

/** Deletes the staff account (their sign-in stops working at once). */
export async function removeSpaceStaffAction(staffId: string) {
  try {
    const { lease } = await ownerSpace();
    const member = await staffInSpace(staffId, lease.id);
    await prisma.user.delete({ where: { id: member.userId } });
    forgetAccount(member.userId);
    return { success: true as const };
  } catch (e) {
    return failure(e, "Couldn't remove the staff member.");
  }
}
