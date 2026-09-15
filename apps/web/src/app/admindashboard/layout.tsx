import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminNavbar } from "@/components/admin/navbar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1117] font-sans selection:bg-primary selection:text-white flex">
      <AdminNavbar />
      <AdminSidebar />
      <main className="flex-1 ml-72 pt-20 flex flex-col min-h-screen w-[calc(100%-18rem)]">
        <div className="flex-1 overflow-x-hidden">{children}</div>
      </main>
    </div>
  );
}
