"use server";

import { prisma } from "@srmall/database";

export async function debugDatabaseAction() {
  // Local development only: it returns user names, emails and roles.
  if (process.env.NODE_ENV === "production") {
    return { success: false, error: "Not available" };
  }
  try {
    // Test database connection
    const userCount = await prisma.user.count();
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      take: 5,
    });

    return {
      success: true,
      data: {
        userCount,
        users: users.map((u: any) => ({
          ...u,
          password: "[HIDDEN]",
        })),
      },
    };
  } catch (error) {
    console.error("Database debug error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      details: {
        prismaAvailable: !!prisma,
        errorType: typeof error,
      },
    };
  }
}
