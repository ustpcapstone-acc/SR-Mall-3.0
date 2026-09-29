import NotificationsPageClient from "@/components/notifications-page-client";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

// Customers see the public navbar + footer here (admin/tenant pages sit inside their dashboards).
export default function ProfileNotificationsPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black">
      <Navbar />
      <main className="pt-24 sm:pt-28 pb-16">
        <NotificationsPageClient />
      </main>
      <Footer />
    </div>
  );
}
