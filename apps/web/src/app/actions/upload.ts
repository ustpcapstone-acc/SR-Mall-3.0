"use server";

import { v2 as cloudinary } from "cloudinary";

// Initialize Cloudinary with server-side secrets
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadImageServerAction(formData: FormData): Promise<string | null> {
  try {
    const file = formData.get("file") as File;
    if (!file) return null;

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64String = `data:${file.type};base64,${buffer.toString("base64")}`;

    // Upload to Cloudinary securely via server SDK
    const result = await cloudinary.uploader.upload(base64String, {
      folder: "sr-mall/chat-images",
    });

    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary server upload error:", error);
    return null;
  }
}
