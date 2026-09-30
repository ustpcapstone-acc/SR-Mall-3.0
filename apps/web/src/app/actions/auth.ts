"use server";

import { prisma } from "@srmall/database";
import bcrypt from "bcryptjs";
import { getBaseUrl } from "@/utils/get-base-url";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getCloudStorageProvider } from "@/lib/cloud-storage";

// ─── Sign in with Google (Gmail only) ────────────────────────────────────────

/** Only @gmail.com addresses may create accounts / use Google sign-in. Flip to true to accept any Google account. */
const ALLOW_ANY_GOOGLE_ACCOUNT = false;

/** Stored in User.password for Google-only accounts (never matches a real password). */
const GOOGLE_ACCOUNT_PASSWORD = "GOOGLE_OAUTH";

function isAllowedEmail(email: string) {
  const e = email.toLowerCase();
  return ALLOW_ANY_GOOGLE_ACCOUNT || e.endsWith("@gmail.com") || e.endsWith("@googlemail.com");
}

/**
 * "Continue with Google". The browser sends the Supabase access token it
 * received from Google sign-in; the server asks Supabase who that token
 * belongs to, so the email comes from Google — never from the caller. (The
 * old flow trusted a magic password instead; that path is gone.)
 */
export async function signInWithGoogleAction(accessToken: string) {
  try {
    if (!accessToken) return { success: false as const, error: "Please sign in with Google." };

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase.auth.getUser(accessToken);
    const authUser = data?.user;
    if (error || !authUser?.email) {
      return { success: false as const, error: "Your Google sign-in expired. Please sign in again." };
    }

    const viaGoogle =
      authUser.app_metadata?.provider === "google" ||
      (authUser.identities || []).some((i) => i.provider === "google");
    if (!viaGoogle) return { success: false as const, error: "Please sign in with Google." };

    const email = authUser.email.trim().toLowerCase();
    if (!isAllowedEmail(email)) {
      return { success: false as const, error: "Please use a Gmail account (@gmail.com) to sign in." };
    }

    const meta = (authUser.user_metadata || {}) as Record<string, any>;
    const googleName: string | undefined = meta.full_name || meta.name || undefined;
    const googleAvatar: string | undefined = meta.avatar_url || meta.picture || undefined;

    let user = await prisma.user.findUnique({ where: { email }, include: { tenant: true } });
    if (!user) {
      // First Google sign-in → customer account.
      user = await prisma.user.create({
        data: {
          email,
          name: googleName || email.split("@")[0],
          avatarUrl: googleAvatar || null,
          password: GOOGLE_ACCOUNT_PASSWORD,
          role: "CUSTOMER",
        },
        include: { tenant: true },
      });
      const newName = user.name || email;
      after(async () => {
        const { notifyNewSignup } = await import("@/lib/notify-signups");
        await notifyNewSignup(newName);
      });
    } else if (!user.avatarUrl && googleAvatar) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: googleAvatar },
        include: { tenant: true },
      });
    }

    if (user.isBlacklisted) {
      return {
        success: false as const,
        error: "Authorization Revoked: This account has been restricted by system administration.",
      };
    }

    return {
      success: true as const,
      data: {
        id: user.id,
        name: user.name || user.email.split("@")[0],
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl || null,
        tenantId: user.tenant?.id || null,
        isBlacklisted: user.isBlacklisted,
      },
    };
  } catch (error: any) {
    console.error("[GOOGLE_SIGN_IN_ERROR]:", error);
    if (error?.message?.includes("Can't reach database") || error?.code === "P1001") {
      return { success: false as const, error: "Database connection failed. Please try again shortly." };
    }
    return { success: false as const, error: "An unexpected error occurred during sign-in." };
  }
}

// ─── Email + password ────────────────────────────────────────────────────────

/** Values stored for accounts that were created through Google (no real password). */
const PLACEHOLDER_PASSWORDS = new Set([GOOGLE_ACCOUNT_PASSWORD, "OAUTH_USER"]);

/**
 * Compare a typed password with the stored one: bcrypt hashes, plus the few
 * legacy plain-text rows. Placeholder values for Google accounts never match,
 * so nobody can "log in" by typing GOOGLE_OAUTH.
 */
async function passwordMatches(input: string, stored: string) {
  if (!input || !stored || PLACEHOLDER_PASSWORDS.has(stored)) return false;
  if (stored.startsWith("$2")) {
    try {
      return await bcrypt.compare(input, stored);
    } catch {
      return false;
    }
  }
  return stored === input; // legacy plain-text password
}

/** Email + password sign-in (Google users go through signInWithGoogleAction). */
export async function loginAction(data: { email: string; password: string }) {
  try {
    const email = (data.email || "").trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email }, include: { tenant: true } });

    if (!user) return { success: false, error: "User does not exist." };

    if (PLACEHOLDER_PASSWORDS.has(user.password)) {
      return {
        success: false,
        error: "This account signs in with Google. Use \"Continue with Google\", or \"Forgot password\" to add a password.",
      };
    }

    if (!(await passwordMatches(data.password, user.password))) {
      return { success: false, error: "Invalid email or password." };
    }

    if (user.isBlacklisted) {
      return {
        success: false,
        error: "Authorization Revoked: This account has been restricted by system administration.",
      };
    }

    return {
      success: true,
      data: {
        id: user.id,
        name: user.name || user.email.split("@")[0],
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl || null,
        tenantId: user.tenant?.id || null,
        isBlacklisted: user.isBlacklisted,
      },
    };
  } catch (error: any) {
    console.error("[LOGIN_ERROR]:", error);
    if (error?.message?.includes("Can't reach database") || error?.code === "P1001") {
      return { success: false, error: "Database connection failed. Please ensure your local database is running." };
    }
    return { success: false, error: "An unexpected error occurred during login." };
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
    // New accounts must use a Gmail address.
    if (!isAllowedEmail(email)) {
      return { success: false, error: "Please use a Gmail address (@gmail.com) to create an account." };
    }
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
    after(async () => {
      const { notifyNewSignup } = await import("@/lib/notify-signups");
      await notifyNewSignup(fullName);
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
        avatarUrl: true,
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
  actingAdminId?: string,
) {
  try {
    if (isBlacklisted) {
      const guard = await adminLockoutGuard(userId, actingAdminId, "blacklist");
      if (guard) return { success: false, error: guard };
    }
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


/** Remove an account and what hangs off it (used by the admin and by "delete my account"). */
async function deleteUserCascade(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { tenant: true } });
  if (!user) return false;
  await prisma.$transaction(async (tx: any) => {
    if (user.tenant) {
      // Units held by the shop go back to AVAILABLE.
      await tx.areaSlot.updateMany({
        where: { OR: [{ tenant_id: user.tenant.id }, { tenant_id: userId }, { unit_id: user.tenant.unitId, status: "OCCUPIED" }] },
        data: { status: "AVAILABLE", tenant_id: null },
      });
      // Reviews ON the shop would otherwise turn into mall reviews (tenantId → NULL).
      await tx.review.deleteMany({ where: { tenantId: user.tenant.id } });
    }
    // Cascades: tenant, invoices, chats, reviews written, notifications…
    await tx.user.delete({ where: { id: userId } });
  });
  return true;
}

async function isAdminUser(userId?: string) {
  if (!userId) return false;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return u?.role === "ADMIN";
}

/** Admin: delete someone else's account. */
export async function deleteUserAction(userId: string, adminUserId?: string) {
  try {
    if (!(await isAdminUser(adminUserId))) return { success: false, error: "Admin access required." };
    if (userId === adminUserId) return { success: false, error: "You can't delete your own admin account here." };
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (target?.role === "ADMIN" && (await prisma.user.count({ where: { role: "ADMIN" } })) <= 1) {
      return { success: false, error: "You can't delete the last admin." };
    }
    if (!(await deleteUserCascade(userId))) return { success: false, error: "User not found." };
    revalidatePath("/admindashboard/user-management");
    return { success: true };
  } catch (error) {
    console.error("[DELETE_USER_ERROR]:", error);
    return { success: false, error: "Failed to delete user." };
  }
}

/**
 * Stops an admin from locking the mall out of its own back office:
 * no demoting/blacklisting yourself, and never the last admin.
 */
async function adminLockoutGuard(targetId: string, actingAdminId: string | undefined, what: "demote" | "blacklist") {
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true } });
  if (target?.role !== "ADMIN") return null;
  if (actingAdminId && actingAdminId === targetId) {
    return what === "demote" ? "You can't remove your own admin role." : "You can't blacklist your own account.";
  }
  const admins = await prisma.user.count({ where: { role: "ADMIN", isBlacklisted: false } });
  if (admins <= 1) return `You can't ${what} the last admin.`;
  return null;
}

export async function updateUserRoleAction(userId: string, newRole: string, actingAdminId?: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });

    if (!user) return { success: false, error: "User not found." };
    if (user.role === "ADMIN" && newRole !== "ADMIN") {
      const guard = await adminLockoutGuard(userId, actingAdminId, "demote");
      if (guard) return { success: false, error: guard };
    }

    // Tenant leaving via a role change → history snapshot (before the unit is freed).
    if (user.role === "TENANT" && newRole !== "TENANT" && user.tenant && user.tenant.status !== "PAST") {
      const { recordTenantExit } = await import("@/lib/tenant-history");
      await recordTenantExit(user.tenant.id, "ROLE_CHANGED", { endedById: actingAdminId });
    }

    await prisma.$transaction(async (tx: any) => {
      // If demoting from TENANT to CUSTOMER/ADMIN, we should clean up their tenant profile
      if (user.role === "TENANT" && newRole !== "TENANT" && user.tenant) {
        if (user.tenant.unitId && user.tenant.unitId !== "UNASSIGNED" && user.tenant.unitId !== "PENDING_ASSIGNMENT") {
          const slot = await tx.areaSlot.findFirst({
            where: { unit_id: user.tenant.unitId },
          });
          if (slot) {
            await tx.areaSlot.update({
              where: { id: slot.id },
              data: { status: "AVAILABLE", tenant_id: null },
            });
          }
        }
        await tx.tenant.update({
          where: { id: user.tenant.id },
          data: { status: "PAST", unitId: "UNASSIGNED" }
        });
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
    const email = (data.email || "").trim().toLowerCase();
    if (email && !isAllowedEmail(email)) {
      return { success: false, error: "Your email must be a Gmail address (@gmail.com)." };
    }
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        ...(email ? { email } : {}),
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

    if (PLACEHOLDER_PASSWORDS.has(user.password)) {
      return {
        success: false,
        error: "Your account signs in with Google and has no password yet. Use \"Forgot password\" on the login screen to add one.",
      };
    }

    // Verify current password
    if (!(await passwordMatches(data.currentPassword, user.password))) {
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

export async function verifyPasswordResetTokenAction(email: string, token: string) {
  try {
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token,
        email: email.toLowerCase(),
      },
    });

    if (!resetToken) {
      return { success: false, error: "Invalid verification code. Please check your email and try again." };
    }

    if (resetToken.expires < new Date()) {
      return { success: false, error: "This verification code has expired. Please request a new password reset." };
    }

    return { success: true };
  } catch (error: any) {
    console.error("[VERIFY_TOKEN_ERROR]:", error);
    return { success: false, error: `Verification failed: ${error?.message || String(error)}` };
  }
}

// ─── My account (profile settings for every role) ────────────────────────────

const PHONE_RE = /^[+0-9()\-\s]{7,20}$/;

/** Profile fields for the settings pages (raw SQL for the newer columns). */
export async function getMyAccountAction(userId: string) {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id", "name", "email", "avatarUrl", "role", "password", "phone", "bio", "department"
         FROM "User" WHERE "id" = $1`,
      userId,
    );
    const u = rows[0];
    if (!u) return { success: false as const, error: "Account not found." };
    return {
      success: true as const,
      data: {
        id: u.id as string,
        name: (u.name as string | null) || "",
        email: u.email as string,
        avatarUrl: (u.avatarUrl as string | null) ?? null,
        role: u.role as string,
        phone: (u.phone as string | null) || "",
        bio: (u.bio as string | null) || "",
        department: (u.department as string | null) || "",
        /** false for accounts created through Google that never set a password */
        hasPassword: !PLACEHOLDER_PASSWORDS.has(u.password),
      },
    };
  } catch (error: any) {
    console.error("[GET_MY_ACCOUNT_ERROR]:", error);
    return { success: false as const, error: "Couldn't load your account." };
  }
}

export type MyAccount = Extract<Awaited<ReturnType<typeof getMyAccountAction>>, { success: true }>["data"];

/**
 * Save profile fields. The email can only change for accounts with a
 * password, and only to another Gmail — Google-only accounts keep the Gmail
 * they sign in with (changing it would orphan their Google sign-in).
 */
export async function updateMyAccountAction(
  userId: string,
  data: { name: string; email?: string; phone?: string; bio?: string; department?: string },
) {
  try {
    const current = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, password: true, role: true } });
    if (!current) return { success: false, error: "Account not found." };

    const name = (data.name || "").trim();
    if (name.length < 2) return { success: false, error: "Enter your name (at least 2 characters)." };
    if (name.length > 80) return { success: false, error: "Keep your name under 80 characters." };

    const phone = (data.phone || "").trim();
    if (phone && !PHONE_RE.test(phone)) return { success: false, error: "Enter a valid phone number, e.g. +63 912 345 6789." };

    const bio = (data.bio || "").trim().slice(0, 500);
    const department = (data.department || "").trim().slice(0, 120);

    let email = current.email;
    const wanted = (data.email || "").trim().toLowerCase();
    if (wanted && wanted !== current.email) {
      if (PLACEHOLDER_PASSWORDS.has(current.password)) {
        return { success: false, error: "Your account signs in with Google, so its email is your Gmail and can't be changed." };
      }
      if (!isAllowedEmail(wanted)) return { success: false, error: "Your email must be a Gmail address (@gmail.com)." };
      const taken = await prisma.user.findUnique({ where: { email: wanted }, select: { id: true } });
      if (taken) return { success: false, error: "That email is already used by another account." };
      email = wanted;
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "name" = $2, "email" = $3, "phone" = $4, "bio" = $5, "department" = $6, "updatedAt" = $7 WHERE "id" = $1`,
      userId,
      name,
      email,
      phone || null,
      current.role === "ADMIN" ? bio || null : null,
      current.role === "ADMIN" ? department || null : null,
      new Date(),
    );
    return { success: true, data: { name, email } };
  } catch (error: any) {
    console.error("[UPDATE_MY_ACCOUNT_ERROR]:", error);
    return { success: false, error: "Couldn't save your profile." };
  }
}

/**
 * Delete your own account. The server re-checks it's really you: your
 * password, or — for Google-only accounts — a fresh Google session whose
 * email matches the account.
 */
export async function deleteMyAccountAction(
  userId: string,
  proof: { password?: string; googleAccessToken?: string },
) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, password: true, role: true } });
    if (!user) return { success: false, error: "Account not found." };
    if (user.role === "ADMIN") {
      return { success: false, error: "Admin accounts can't be deleted from here. Ask another admin in User Management." };
    }

    let verified = false;
    if (!PLACEHOLDER_PASSWORDS.has(user.password)) {
      verified = await passwordMatches(proof.password || "", user.password);
      if (!verified) return { success: false, error: "Incorrect password." };
    } else if (proof.googleAccessToken) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data } = await supabase.auth.getUser(proof.googleAccessToken);
      verified = data?.user?.email?.toLowerCase() === user.email.toLowerCase();
      if (!verified) return { success: false, error: "Please sign in with Google again, then retry." };
    } else {
      return { success: false, error: "Please sign in with Google again, then retry." };
    }

    await deleteUserCascade(userId);
    return { success: true };
  } catch (error: any) {
    console.error("[DELETE_MY_ACCOUNT_ERROR]:", error);
    return { success: false, error: "Couldn't delete the account." };
  }
}

// ─── Favourite shops ─────────────────────────────────────────────────────────

export async function getMyFavoritesAction(userId: string, mergeIds: string[] = []) {
  try {
    if (!userId) return { success: true as const, data: [] as string[] };
    // Merge favourites saved in this browser before they were stored per account.
    const valid = mergeIds.filter((id) => typeof id === "string" && id.length > 0).slice(0, 200);
    if (valid.length) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Favorite" ("id", "userId", "tenantId")
         SELECT gen_random_uuid()::text, $1, t."id" FROM "Tenant" t WHERE t."id" = ANY($2::text[])
         ON CONFLICT ("userId", "tenantId") DO NOTHING`,
        userId,
        valid,
      );
    }
    const rows = await prisma.$queryRawUnsafe<{ tenantId: string }[]>(
      `SELECT "tenantId" FROM "Favorite" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
      userId,
    );
    return { success: true as const, data: rows.map((r) => r.tenantId) };
  } catch (error: any) {
    console.error("[GET_FAVORITES_ERROR]:", error);
    return { success: false as const, error: "Couldn't load favourites." };
  }
}

export async function setFavoriteAction(userId: string, tenantId: string, favorite: boolean) {
  try {
    if (!userId || !tenantId) return { success: false, error: "Missing account or shop." };
    if (favorite) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Favorite" ("id", "userId", "tenantId")
         SELECT gen_random_uuid()::text, $1, t."id" FROM "Tenant" t WHERE t."id" = $2
         ON CONFLICT ("userId", "tenantId") DO NOTHING`,
        userId,
        tenantId,
      );
    } else {
      await prisma.$executeRawUnsafe(`DELETE FROM "Favorite" WHERE "userId" = $1 AND "tenantId" = $2`, userId, tenantId);
    }
    return { success: true };
  } catch (error: any) {
    console.error("[SET_FAVORITE_ERROR]:", error);
    return { success: false, error: "Couldn't update favourites." };
  }
}
