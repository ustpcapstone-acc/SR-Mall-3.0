import { NextRequest, NextResponse } from "next/server";
import { validateImageFile } from "@/lib/cloud-storage";
import { currentAccount, type Account } from "@/lib/auth-server";
import { PERMIT_FOLDER, PERMIT_MAX_BYTES, PERMIT_TYPES } from "@/lib/reservation-window";
import { TENANT_DOC_FOLDER } from "@/lib/tenant-onboarding";
import type { SpacePermission } from "@/lib/tenant-permissions";
import { destroyFile, storeFile } from "@/lib/upload-server";

const signedIn = (account: Account | null) => !!account;
const staff = (account: Account | null) => account?.type === "ADMIN";
/** A tenant owner, or store staff whose role opens that section. */
const tenant = (permission: SpacePermission) => (account: Account | null) =>
  account?.type === "TENANT" && (!account.tenantStaff || account.tenantStaff.permissions.includes(permission));

/** Who may upload into each folder. A folder that isn't listed is refused. */
const FOLDERS: Record<string, (account: Account | null) => boolean> = {
  // Tenant onboarding: applicants have no account yet.
  [TENANT_DOC_FOLDER]: () => true,
  // Space reservations, event inquiries and complaint photos.
  [PERMIT_FOLDER]: signedIn,
  inquiries: signedIn,
  complaints: signedIn,
  // Tenant dashboard.
  storefront: tenant("storefront"),
  "tenant-promos": tenant("ads"),
  receipts: tenant("payments"),
  // Staff portal.
  ads: staff,
  "web-cms": staff,
  carousel: staff,
  postsales: staff,
  lostfound: staff,
  spaces: staff,
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "ads";

    if (!Object.hasOwn(FOLDERS, folder)) {
      return NextResponse.json({ error: "Unknown upload folder." }, { status: 400 });
    }
    const account = await currentAccount();
    if (!FOLDERS[folder](account)) {
      return account
        ? NextResponse.json({ error: "You don't have access to this." }, { status: 403 })
        : NextResponse.json({ error: "Please sign in again to upload files." }, { status: 401 });
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Business permits (space reservations) and tenant onboarding documents:
    // PDF / JPG / PNG up to 10 MB.
    const isPermit = folder === PERMIT_FOLDER || folder === TENANT_DOC_FOLDER;
    if (isPermit) {
      if (!PERMIT_TYPES.includes(file.type)) {
        return NextResponse.json({ error: "Please upload a PDF, JPG or PNG file." }, { status: 400 });
      }
      if (file.size > PERMIT_MAX_BYTES) {
        return NextResponse.json({ error: "The file must be 10 MB or smaller." }, { status: 400 });
      }
    } else {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, ...(await storeFile(file, folder)) });
  } catch (error: any) {
    console.error("[UPLOAD_API_ERROR]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Superuser only. The app removes files from server actions (destroyFile),
 * after checking the caller may delete the record that owns the file.
 */
export async function DELETE(request: NextRequest) {
  try {
    const account = await currentAccount();
    if (!account?.isSuperuser) {
      return NextResponse.json(
        { error: "You don't have access to this." },
        { status: account ? 403 : 401 },
      );
    }

    const key = new URL(request.url).searchParams.get("key");
    if (!key) return NextResponse.json({ error: "No key" }, { status: 400 });

    if (!(await destroyFile(key))) {
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[UPLOAD_DELETE_ERROR]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
