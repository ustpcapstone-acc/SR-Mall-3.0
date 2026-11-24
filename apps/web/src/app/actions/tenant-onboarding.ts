"use server";

/**
 * "Become a Tenant": creates a tenant account (signs in at /tenant-portal)
 * with its business details and documents. The tenant starts as PENDING with
 * no space; renting a space is a separate request the admin approves.
 */
import { prisma } from "@srmall/database";
import bcrypt from "bcryptjs";
import { after } from "next/server";
import { startSession } from "@/lib/auth-server";
import { SHOP_CATEGORIES } from "@/lib/shop-categories";
import {
  checkAccount,
  checkBusiness,
  checkDocuments,
  type StepErrors,
  type TenantApplication,
} from "@/lib/tenant-onboarding";

type Result =
  | { success: true; redirectTo: string; user: { id: string; name: string; email: string; role: string } }
  | { success: false; error: string; fieldErrors?: StepErrors; step?: number };

/** Step 1 check that needs the database: is the email free? */
export async function checkTenantEmailAction(email: string): Promise<{ available: boolean }> {
  const taken = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
  return { available: !taken };
}

export async function registerTenantAction(input: TenantApplication): Promise<Result> {
  try {
    const a: TenantApplication = {
      name: String(input?.name ?? "").trim(),
      email: String(input?.email ?? "").trim().toLowerCase(),
      password: String(input?.password ?? ""),
      companyName: String(input?.companyName ?? "").trim(),
      shopName: String(input?.shopName ?? "").trim(),
      category: String(input?.category ?? ""),
      phone: String(input?.phone ?? "").trim(),
      businessAddress: String(input?.businessAddress ?? "").trim(),
      documents: Array.isArray(input?.documents) ? input.documents : [],
    };

    // Same checks as the form, run again here: the browser can't be trusted.
    const steps: [number, StepErrors][] = [
      [0, checkAccount(a)],
      [1, checkBusiness(a, SHOP_CATEGORIES)],
      [2, checkDocuments(a.documents)],
    ];
    for (const [step, errors] of steps) {
      if (Object.keys(errors).length) {
        return { success: false, error: "Please fix the highlighted fields.", fieldErrors: errors, step };
      }
    }

    if (await prisma.user.findUnique({ where: { email: a.email }, select: { id: true } })) {
      return {
        success: false,
        error: "An account already uses this email.",
        fieldErrors: { email: "An account already uses this email. Sign in instead, or use another email." },
        step: 0,
      };
    }

    // One document per type, only the fields we store.
    const documents = a.documents
      .filter((d, i, all) => all.findIndex((x) => x.type === d.type) === i)
      .map((d) => ({
        type: d.type,
        name: String(d.name || d.type).slice(0, 200),
        url: d.url,
        key: d.key || null,
        mime: d.mime,
        size: Number(d.size),
      }));

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: a.email,
          name: a.name,
          phone: a.phone,
          password: await bcrypt.hash(a.password, 10),
          role: "TENANT",
        },
        select: { id: true, name: true, email: true, role: true },
      });
      await tx.tenant.create({
        data: {
          userId: created.id,
          shopName: a.shopName,
          companyName: a.companyName,
          businessAddress: a.businessAddress,
          category: a.category,
          phone: a.phone,
          documents,
          unitId: "PENDING_ASSIGNMENT",
          status: "PENDING",
          isOpen: false,
        },
      });
      return created;
    });

    after(async () => {
      const { notify } = await import("@/lib/notify");
      await notify("NEW_TENANT_APPLICATION", {
        roles: ["ADMIN"],
        title: "New tenant registration",
        message: `${a.shopName} (${a.companyName}) registered as a tenant and uploaded their documents.`,
        link: "/admindashboard/tenant-monitoring",
      });
    });

    await startSession(user.id, "TENANT");
    return {
      success: true,
      redirectTo: "/tenantdashboard/home",
      user: { id: user.id, name: user.name || a.name, email: user.email, role: user.role },
    };
  } catch (error) {
    console.error("[TENANT_REGISTER_ERROR]:", error);
    return { success: false, error: "We couldn't finish your registration. Please try again." };
  }
}
