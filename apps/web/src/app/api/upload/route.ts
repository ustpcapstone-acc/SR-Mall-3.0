import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { validateImageFile } from "@/lib/cloud-storage";
import { PERMIT_FOLDER, PERMIT_MAX_BYTES, PERMIT_TYPES } from "@/lib/reservation-window";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "ads";
    const provider = process.env.NEXT_PUBLIC_CLOUD_PROVIDER || "local";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Business permits (space reservations): PDF / JPG / PNG up to 10 MB.
    const isPermit = folder === PERMIT_FOLDER;
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

    // ─── CLOUDINARY SERVER-SIDE UPLOAD ──────────────────────────────────────
    if (provider === "cloudinary") {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      if (!cloudName || !apiKey || !apiSecret) {
        return NextResponse.json(
          { error: "Cloudinary credentials missing in server environment" },
          { status: 500 },
        );
      }

      // PDFs go up as "raw" files: Cloudinary blocks PDF delivery as images by default.
      const resourceType = file.type.startsWith("video/") ? "video" : file.type === "application/pdf" ? "raw" : "image";
      const timestamp = Math.round(new Date().getTime() / 1000);

      // Lexicographically sort params: folder, timestamp
      const strToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
      const signature = require("crypto")
        .createHash("sha1")
        .update(strToSign)
        .digest("hex");

      const cloudinaryData = new FormData();
      cloudinaryData.append("file", file);
      cloudinaryData.append("folder", folder);
      cloudinaryData.append("timestamp", timestamp.toString());
      cloudinaryData.append("api_key", apiKey);
      cloudinaryData.append("signature", signature);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
        {
          method: "POST",
          body: cloudinaryData,
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[CLOUDINARY_API_ERROR]:", errorData);
        throw new Error(errorData.error?.message || "Cloudinary upload failed");
      }

      const result = await response.json();
      return NextResponse.json({
        success: true,
        url: result.secure_url,
        key: `cloudinary:${resourceType}:${result.public_id}`,
        mediaType: resourceType.toUpperCase(),
      });
    }

    // ─── LOCAL STORAGE FALLBACK ──────────────────────────────────────────────
    let basePublicDir = join(process.cwd(), "public");
    if (existsSync(join(process.cwd(), "apps/web/public"))) {
      basePublicDir = join(process.cwd(), "apps/web/public");
    }

    const uploadsDir = join(basePublicDir, "uploads", folder);
    try {
      await mkdir(uploadsDir, { recursive: true, mode: 0o777 });
    } catch (err: any) {
      if (err.code !== "EEXIST") throw err;
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const fileExtension = file.name.split(".").pop();
    const fileName = `${timestamp}_${randomString}.${fileExtension}`;
    const filePath = join(uploadsDir, fileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      url: `/uploads/${folder}/${fileName}`,
      key: `local:${folder}/${fileName}`,
      mediaType: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
    });
  } catch (error: any) {
    console.error("[UPLOAD_API_ERROR]:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");
    if (!key) return NextResponse.json({ error: "No key" }, { status: 400 });

    const [provider, ...rest] = key.split(":");

    if (provider === "cloudinary") {
      const resourceType = rest[0]; // e.g., 'image' or 'video'
      const publicId = rest.slice(1).join(":"); // e.g. folder/filename

      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      if (!cloudName || !apiKey || !apiSecret) {
        return NextResponse.json({
          success: true,
          message: "Cloudinary record detached (missing API keys to destroy)",
        });
      }

      const timestamp = Math.round(new Date().getTime() / 1000);
      const strToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
      const signature = require("crypto")
        .createHash("sha1")
        .update(strToSign)
        .digest("hex");

      const delData = new URLSearchParams();
      delData.append("public_id", publicId);
      delData.append("timestamp", timestamp.toString());
      delData.append("api_key", apiKey);
      delData.append("signature", signature);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: delData,
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[CLOUDINARY_DESTROY_ERROR]:", errorData);
      }

      return NextResponse.json({
        success: true,
        message: "Cloudinary record detached and destroyed",
      });
    }

    // Local cleanup
    let basePublicDir = join(process.cwd(), "public");
    if (existsSync(join(process.cwd(), "apps/web/public"))) {
      basePublicDir = join(process.cwd(), "apps/web/public");
    }
    const actualKey = rest.join(":");
    const filePath = join(basePublicDir, "uploads", actualKey);

    try {
      const { unlink } = require("fs/promises");
      await unlink(filePath);
      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
