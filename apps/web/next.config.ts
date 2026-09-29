import type { NextConfig } from "next";
import os from "os";

// Dynamically discover local network IPs to avoid manual updates when switching Wi-Fi
const getLocalOrigins = () => {
  if (process.env.NODE_ENV === "production") return [];
  const interfaces = os.networkInterfaces();
  const origins = ["localhost", "127.0.0.1", "0.0.0.0"];

  for (const interfaceName in interfaces) {
    const addresses = interfaces[interfaceName];
    if (addresses) {
      for (const addr of addresses) {
        if (addr.family === "IPv4" && !addr.internal) {
          origins.push(addr.address);
          // Also allow with port since Next.js sometimes checks for exact string matches
          origins.push(`${addr.address}:3000`);
        }
      }
    }
  }
  return origins;
};

const nextConfig: NextConfig = {
  // Dev server listens on 0.0.0.0 (see package.json), so allow this machine's
  // current LAN addresses to load dev assets from phones / other PCs.
  allowedDevOrigins: getLocalOrigins().filter((o) => !o.includes(":")),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  serverExternalPackages: [
    "@prisma/client",
    "@srmall/database",
    "jspdf",
    "jspdf-autotable",
  ],
  experimental: {
    serverActions: {
      allowedOrigins: ["*", ...getLocalOrigins()],
    },
  },
};

export default nextConfig;
