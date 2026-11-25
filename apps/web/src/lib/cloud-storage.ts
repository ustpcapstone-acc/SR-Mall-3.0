// Cloud Storage Service for SR Mall Ads
// Supports multiple providers: Local, AWS S3, Cloudinary, etc.
// Browser uploads go through /api/upload, which needs the visitor's session
// cookie. Server code uses lib/upload-server.ts instead.
import { getBaseUrl } from "@/utils/get-base-url";

export interface CloudStorageProvider {
  name: string;
  uploadFile: (
    file: File,
    folder?: string,
  ) => Promise<{ url: string; key: string }>;
  getUrl: (key: string) => Promise<string>;
}

// Local Storage Provider (Development)
class LocalStorageProvider implements CloudStorageProvider {
  name = "local";
  constructor() {}

  async uploadFile(
    file: File,
    folder = "ads",
  ): Promise<{ url: string; key: string }> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    try {
      const baseUrl = await getBaseUrl();
      const response = await fetch(`${baseUrl}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();
      return {
        url: result.url,
        key: result.key,
      };
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  }

  async getUrl(key: string): Promise<string> {
    const cloudUrl = process.env.NEXT_PUBLIC_CLOUD_URL;
    if (cloudUrl) return `${cloudUrl}/${key}`;

    const origin = await getBaseUrl();
    return `${origin}/uploads/${key}`;
  }
}

// Cloudinary Provider (Production via Server Gateway)
class CloudinaryProvider implements CloudStorageProvider {
  name = "cloudinary";

  async uploadFile(
    file: File,
    folder = "ads",
  ): Promise<{ url: string; key: string }> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    try {
      const baseUrl = await getBaseUrl();
      const response = await fetch(`${baseUrl}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const result = await response.json();
      return {
        url: result.url,
        key: result.key,
      };
    } catch (error) {
      console.error("Cloudinary gateway upload error:", error);
      throw error;
    }
  }

  async getUrl(key: string): Promise<string> {
    // If it's a gateway key, it maps directly to the URL in the gateway's logic
    // Usually the DB stores the full URL anyway.
    return "";
  }
}

// Factory function to get the appropriate storage provider
export function getCloudStorageProvider(): CloudStorageProvider {
  const provider = process.env.NEXT_PUBLIC_CLOUD_PROVIDER || "local";

  switch (provider) {
    case "cloudinary":
      return new CloudinaryProvider();
    case "aws":
      // TODO: Implement AWS S3 provider
      throw new Error("AWS S3 provider not implemented yet");
    case "local":
    default:
      return new LocalStorageProvider();
  }
}

// Utility functions
export const validateImageFile = (
  file: File,
): { valid: boolean; error?: string } => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/webm",
  ];
  const maxSize = 50 * 1024 * 1024; // 50MB

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: "Invalid file type. Only images and videos are allowed.",
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size must be less than 50MB. (Current: ${(file.size / (1024 * 1024)).toFixed(1)}MB)`,
    };
  }

  return { valid: true };
};
