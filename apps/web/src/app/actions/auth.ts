"use server";

import { prisma } from "@srmall/database";
import bcrypt from "bcryptjs";
import { getBaseUrl } from "@/utils/get-base-url";
import { revalidatePath } from "next/cache";
import { getCloudStorageProvider } from "@/lib/cloud-storage";

export async function loginAction(data: { email: string; password: string }) {
  try {
    const email = data.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      // If this is an OAuth login bypass but user doesn't exist in Prisma yet, 
      // we create them automatically as a CUSTOMER.
      if (data.password === "OAUTH_LOGIN_BYPASS") {
        const newUser = await prisma.user.create({
          data: {
            email,
            name: email.split("@")[0],
            password: "OAUTH_USER", // Placeholder password for OAuth users
            role: "CUSTOMER",
          },
        });
        return {
          success: true,
          data: {
            id: newUser.id,
            name: newUser.name || newUser.email.split("@")[0],
            email: newUser.email,
            role: newUser.role,
            avatarUrl: (newUser as any).avatarUrl || null,
            tenantId: null,
            isBlacklisted: false,
          },
        };
      }
      return { success: false, error: "User does not exist." };
    }

    // ── OAuth Bypass ──
    // If password is the bypass token, we trust the caller (AuthProvider) 
    // which has already verified the session via Supabase.
    let isMatch = false;
    if (data.password === "OAUTH_LOGIN_BYPASS") {
      isMatch = true;
    } else {
      // Attempt to compare hashed password first
      try {
        isMatch = await bcrypt.compare(data.password, user.password);
      } catch (err) {
        // bcrypt.compare might throw if the password in DB is not a valid hash
      }

      // Fallback to plain text for legacy users if bcrypt didn't match
      if (!isMatch) {
        isMatch = user.password === data.password;
      }
    }

    if (!isMatch) {
      return { success: false, error: "Invalid email or password." };
    }

    if ((user as any).isBlacklisted) {
      return {
        success: false,
        error:
          "Authorization Revoked: This account has been restricted by system administration.",
      };
    }

    return {
      success: true,
      data: {
        id: user.id,
        name: user.name || user.email.split("@")[0],
        email: user.email,
        role: user.role,
        avatarUrl: (user as any).avatarUrl || null,
        tenantId: user.tenant?.id || null,
        isBlacklisted: (user as any).isBlacklisted,
      },
    };
  } catch (error: any) {
    console.error("[LOGIN_ERROR]:", error);
    if (
      error?.message?.includes("Can't reach database") ||
      error?.code === "P1001"
    ) {
      return {
        success: false,
        error:
          "Database connection failed. Please ensure your local database is running.",
      };
    }
    return {
      success: false,
      error: "An unexpected error occurred during login.",
    };
  }
}

export async function signUpAction(data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role?: "CUSTOMER" | "TENANT";
}) {
  try {
    const email = data.email.trim().toLowerCase();
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return {
        success: false,
        error: "A user with this email already exists.",
      };
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const fullName = `${data.firstName} ${data.lastName}`;

    // Create user in database
    const user = await prisma.user.create({
      data: {
        email,
        name: fullName,
        password: hashedPassword,
        role: data.role || "CUSTOMER", // Default to CUSTOMER for regular users
      },
    });

    return {
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  } catch (error: any) {
    console.error("[SIGNUP_ERROR]:", error);
    return {
      success: false,
      error: "Failed to create account. Please try again.",
    };
  }
}

export async function getUserCountAction() {
  try {
    const count = await prisma.user.count({
      where: {
        role: {
          not: "ADMIN", // or simply omit to get all
        },
      },
    });
    return { success: true, data: count };
  } catch (error) {
    return { success: false, error: "Failed to fetch user count." };
  }
}

export async function getAllUsersAction() {
  try {
    const users = await (prisma as any).user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isBlacklisted: true,
        createdAt: true,
      },
    });
    return { success: true, data: users };
  } catch (error) {
    console.error("[GET_ALL_USERS_ERROR]:", error);
    return { success: false, error: "Failed to fetch users." };
  }
}

export async function toggleUserBlacklistAction(
  userId: string,
  isBlacklisted: boolean,
) {
  try {
    await (prisma as any).user.update({
      where: { id: userId },
      data: { isBlacklisted },
    });
    revalidatePath("/admindashboard/user-management");
    return { success: true };
  } catch (error: any) {
    console.error("[TOGGLE_BLACKLIST_ERROR]:", error);
    return { success: false, error: error.message };
  }
}


export async function deleteUserAction(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user) return { success: false, error: "User not found." };

    await prisma.$transaction(async (tx: any) => {
      // If user is a tenant, free up their assigned area slot before deletion
      if (user.tenant) {
        const slot = await tx.areaSlot.findFirst({
          where: { tenant_id: user.tenant.id },
        });
        if (slot) {
          await tx.areaSlot.update({
            where: { id: slot.id },
            data: { status: "AVAILABLE", tenant_id: null },
          });
        }
      }
      // Delete user (cascade will delete Tenant and other related records)
      await tx.user.delete({ where: { id: userId } });
    });

    revalidatePath("/admindashboard/user-management");
    return { success: true };
  } catch (error) {
    console.error("[DELETE_USER_ERROR]:", error);
    return { success: false, error: "Failed to delete user." };
  }
}

export async function updateUserRoleAction(userId: string, newRole: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user) return { success: false, error: "User not found." };

    await prisma.$transaction(async (tx: any) => {
      // If demoting from TENANT to CUSTOMER/ADMIN, we should clean up their tenant profile
      if (user.role === "TENANT" && newRole !== "TENANT" && user.tenant) {
        const slot = await tx.areaSlot.findFirst({
          where: { tenant_id: user.tenant.id },
        });
        if (slot) {
          await tx.areaSlot.update({
            where: { id: slot.id },
            data: { status: "AVAILABLE", tenant_id: null },
          });
        }
        await tx.tenant.delete({ where: { id: user.tenant.id } });
      }

      await tx.user.update({
        where: { id: userId },
        data: { role: newRole },
      });
    });

    revalidatePath("/admindashboard/user-management");
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to update user role." };
  }
}

export async function updateProfileAction(
  userId: string,
  data: { name: string; email: string },
) {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        email: data.email.trim().toLowerCase(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return { success: true, data: updatedUser };
  } catch (error: any) {
    console.error("[UPDATE_PROFILE_ERROR]:", error);
    if (error.code === "P2002") {
      return {
        success: false,
        error: "Email already in use by another account.",
      };
    }
    return { success: false, error: "Failed to update profile." };
  }
}

export async function uploadAvatarAction(userId: string, formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file) return { success: false, error: "No file provided" };

    const storage = getCloudStorageProvider();
    const { url } = await storage.uploadFile(file, "avatars");

    // We can't use type safety here temporarily because we just added avatarUrl to schema
    const updatedUser = await (prisma as any).user.update({
      where: { id: userId },
      data: { avatarUrl: url },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
      },
    });

    revalidatePath("/profile");
    return { success: true, data: updatedUser };
  } catch (error: any) {
    console.error("[UPLOAD_AVATAR_ERROR]:", error);
    return { success: false, error: error.message || "Failed to upload avatar" };
  }
}

export async function updateSecurityAction(
  userId: string,
  data: { currentPassword?: string; newPassword?: string },
) {
  try {
    if (!data.currentPassword || !data.newPassword) {
      return {
        success: false,
        error: "Current and new passwords are required.",
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return { success: false, error: "User not found" };

    // Verify current password
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(data.currentPassword, user.password);
    } catch (err) {
      isMatch = false;
    }

    // Fallback for non-hashed legacy passwords
    if (!isMatch) isMatch = user.password === data.currentPassword;

    if (!isMatch) {
      return { success: false, error: "Incorrect current password." };
    }

    // Hash and update new password
    const hashedPassword = await bcrypt.hash(data.newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { success: true };
  } catch (error: any) {
    console.error("[SECURITY_UPDATE_ERROR]:", error);
    return { success: false, error: error.message };
  }
}

export async function requestPasswordResetAction(email: string) {
  // Step 1: Check if user exists in DB
  let user: any;
  try {
    user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  } catch (dbError: any) {
    console.error("[PWD_RESET_DB_FIND_ERROR]:", dbError);
    return { success: false, error: `Database error: ${dbError?.message || String(dbError)}` };
  }

  if (!user) {
    // For security, don't reveal if user exists
    return { success: true, message: "If an account exists, a reset link has been sent." };
  }

  // Step 2: Generate token and save to DB
  const token = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 3600000); // 1 hour expiry
  try {
    await prisma.passwordResetToken.upsert({
      where: { token },
      update: { token, expires },
      create: {
        email: email.toLowerCase(),
        token,
        expires,
      },
    });
  } catch (tokenError: any) {
    console.error("[PWD_RESET_TOKEN_SAVE_ERROR]:", tokenError);
    return { success: false, error: `Token save error: ${tokenError?.message || String(tokenError)}` };
  }

  // Step 3: Send recovery email
  try {
    const { sendGmail } = await import("@/lib/gmail");
    await sendGmail({
      to: email,
      subject: "🔒 Reset Your SR Mall Password",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
          <h2 style="color: #be1e2d; text-align: center;">Password Recovery</h2>
          <p>Hello,</p>
          <p>We received a request to reset your password. Use the verification code below to authorize the change:</p>
          <div style="background: #f8fafc; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #1e293b; border-radius: 8px; margin: 20px 0; border: 1px dashed #be1e2d;">
            ${token}
          </div>
          <p style="color: #64748b; font-size: 14px;">This code expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">
            SR Mall Experience Desk • Standard Security Protocol
          </p>
        </div>
      `,
    });
  } catch (emailError: any) {
    console.error("[PWD_RESET_EMAIL_ERROR]:", emailError);
    return { success: false, error: `Email error: ${emailError?.message || String(emailError)}` };
  }

  return { success: true, message: "A recovery code has been sent to your email." };
}

export async function resetPasswordAction(data: {
  email: string;
  token: string;
  newPassword: string;
}) {
  try {
    const { email, token, newPassword } = data;

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token,
        email: email.toLowerCase(),
      },
    });

    if (!resetToken || resetToken.expires < new Date()) {
      return { success: false, error: "Invalid or expired verification code." };
    }

    // Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { password: hashedPassword },
    });

    // Delete token after use
    await prisma.passwordResetToken.delete({
      where: { id: resetToken.id },
    });

    return { success: true, message: "Password updated successfully." };
  } catch (error) {
    console.error("[PWD_RESET_ERROR]:", error);
    return { success: false, error: "Failed to reset password." };
  }
}
