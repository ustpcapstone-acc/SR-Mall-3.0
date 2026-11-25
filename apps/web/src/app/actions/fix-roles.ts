"use server";

import { requireStaff } from "@/lib/auth-server";
import { prisma } from "@srmall/database";

/**
 * Fix existing users with 'USER' role to 'CUSTOMER'
 * Call this from admin dashboard to migrate old users
 */
export async function fixUserRolesAction() {
  try {
    await requireStaff("users");
    // Update all users with 'USER' role to 'CUSTOMER'
    const result = await prisma.user.updateMany({
      where: { role: "USER" },
      data: { role: "CUSTOMER" },
    });

    return {
      success: true,
      message: `Updated ${result.count} users from 'USER' to 'CUSTOMER'`,
      count: result.count,
    };
  } catch (error: any) {
    console.error("[FIX_USER_ROLES_ERROR]:", error);
    return {
      success: false,
      error: error.message || "Failed to fix user roles",
    };
  }
}

/**
 * Check how many users have incorrect 'USER' role
 */
export async function checkUserRolesAction() {
  try {
    await requireStaff("users");
    const userCount = await prisma.user.count({
      where: { role: "USER" },
    });

    const customerCount = await prisma.user.count({
      where: { role: "CUSTOMER" },
    });

    return {
      success: true,
      data: {
        userRole: userCount,
        customerRole: customerCount,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
