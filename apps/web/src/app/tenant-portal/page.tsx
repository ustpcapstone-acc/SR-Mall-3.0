import type { Metadata } from "next";
import { PortalLogin } from "@/components/portal-login";

export const metadata: Metadata = { title: "Tenant sign-in | SR Mall" };

export default function TenantPortalPage() {
  return <PortalLogin portal="TENANT" />;
}
