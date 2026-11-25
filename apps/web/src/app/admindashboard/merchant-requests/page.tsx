import { redirect } from "next/navigation";

// Merchant Requests was removed: new tenants register on /become-a-tenant and
// are handled in Tenant Monitoring and Rent Requests. Old saved links land there.
export default function MerchantRequestsRedirect() {
  redirect("/admindashboard/tenant-monitoring");
}
