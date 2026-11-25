import { redirect } from "next/navigation";

// Billing and payments are one page now. Old links (saved notifications,
// reminder emails, bookmarks) still land in the right place.
export default function LeasePaymentsRedirect() {
  redirect("/tenantdashboard/payments");
}
