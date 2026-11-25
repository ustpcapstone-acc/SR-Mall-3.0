"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Presentation,
  MessageSquare,
  Receipt,
  Star,
  ClipboardList,
  Building2,
  Users,
  X,
  Plus,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@cloudflare/kumo";
import { toast } from "sonner";
import { getWorkspacesAction, setWorkspaceAction, type WorkspaceSpace } from "@/app/actions/workspace";
import { staffCanOpen } from "@/lib/tenant-permissions";
import { useAuth } from "@/app/providers";
import { useChatUnread } from "@/lib/chat-unread";
import { useComplaintUnread } from "@/lib/complaint-unread";
import clsx from "clsx";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; mobileLabel: string };

/** Home workspace: the tenant account. */
const homeItems: NavItem[] = [
  { href: "/tenantdashboard/home", label: "Home", icon: LayoutDashboard, mobileLabel: "Home" },
  { href: "/tenantdashboard/rent-a-space", label: "Rent a Space", icon: Building2, mobileLabel: "Rent a Space" },
  { href: "/tenantdashboard/customer-messenger?inbox=mall", label: "Messages", icon: MessageSquare, mobileLabel: "Messages" },
];

/** A space workspace: one rented space. */
const spaceItems: NavItem[] = [
  { href: "/tenantdashboard", label: "Overview", icon: LayoutDashboard, mobileLabel: "Overview" },
  { href: "/tenantdashboard/digital-storefront", label: "Storefront", icon: Store, mobileLabel: "Storefront" },
  { href: "/tenantdashboard/ad-promo-manager", label: "Ads & Promo", icon: Presentation, mobileLabel: "Ads & Promo" },
  { href: "/tenantdashboard/customer-messenger?inbox=customers", label: "Messages", icon: MessageSquare, mobileLabel: "Messages" },
  { href: "/tenantdashboard/payments", label: "Payments", icon: Receipt, mobileLabel: "Payments" },
  { href: "/tenantdashboard/feedback-reviews", label: "Reviews", icon: Star, mobileLabel: "Reviews" },
  { href: "/tenantdashboard/complaints", label: "Complaints", icon: ClipboardList, mobileLabel: "Complaints" },
  { href: "/tenantdashboard/staff", label: "Staff", icon: Users, mobileLabel: "Staff" },
];

interface TenantSidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const TenantSidebar = ({
  isMobileOpen,
  onMobileClose,
}: TenantSidebarProps = {}) => {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  // Workspaces: Home, plus one per rented space.
  const [ws, setWs] = useState<{
    current: string;
    spaces: WorkspaceSpace[];
    staffPermissions: string[] | null;
    staffRole: string | null;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    getWorkspacesAction().then((res) => alive && res.success && setWs(res.data));
    return () => {
      alive = false;
    };
  }, [user?.id, pathname]);
  const switchTo = async (id: string) => {
    if (!ws || id === ws.current) return;
    const res = await setWorkspaceAction(id);
    if (!res.success) return toast.error(res.error);
    setWs({ ...ws, current: id });
    onMobileClose?.();
    router.push(res.redirectTo);
    router.refresh();
  };
  const staffPerms = ws?.staffPermissions ?? null;
  const navItems = staffPerms
    ? spaceItems.filter((item) => staffCanOpen(staffPerms, item.href.split("?")[0]))
    : (ws ? ws.current === "home" : pathname.startsWith("/tenantdashboard/home") || pathname.startsWith("/tenantdashboard/rent-a-space"))
      ? homeItems
      : spaceItems;
  const wsItems: Record<string, string> = {
    home: "Home",
    ...Object.fromEntries((ws?.spaces ?? []).map((sp) => [sp.id, `Unit ${sp.unitId}`])),
  };

  // Live unread chat count (same source as the bell's Messages tab).
  const unreadMessages = useChatUnread(user?.id).total;
  // Complaints with an admin reply / status change the tenant hasn't opened.
  const unreadComplaints = useComplaintUnread(user?.id);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleLinkClick = () => {
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className={clsx(
            "fixed",
            "inset-0",
            "bg-black/50",
            "z-40",
            "lg:hidden",
          )}
          onClick={onMobileClose}
        />
      )}
      {/* Sidebar */}
      <aside
        className={clsx(
          "bg-white dark:bg-[#161b26] border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 ease-in-out",
          "lg:fixed lg:top-20 lg:left-0 lg:h-[calc(100vh-5rem)] lg:w-72 lg:z-30",
          "fixed inset-y-0 left-0 w-72 z-50",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >

        <div
          className={clsx(
            "flex-1",
            "overflow-y-auto",
            "py-6",
            "lg:py-8",
            "px-4",
            "lg:px-5",
            "space-y-2",
          )}
        >
          <div className={clsx("px-3", "lg:px-5", "mb-4", "lg:mb-6")}>
            <p
              className={clsx(
                "text-xs",
                "font-semibold",
                "text-slate-500",
                "dark:text-slate-400",
                "font-sans",
              )}
            >
              Workspace
            </p>
            {ws && staffPerms && (
              <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                {ws.spaces[0] ? `Unit ${ws.spaces[0].unitId}` : "Your space"}
                {ws.staffRole && <span className="block text-xs font-normal text-slate-500">{ws.staffRole}</span>}
              </p>
            )}
            {ws && !staffPerms && (
              <Select
                aria-label="Workspace"
                value={ws.current}
                items={wsItems}
                onValueChange={(v) => switchTo((v as string) || "home")}
                className="mt-2 w-full"
              >
                <Select.Option value="home">Home</Select.Option>
                {ws.spaces.map((sp) => (
                  <Select.Option key={sp.id} value={sp.id}>
                    Unit {sp.unitId}
                    {sp.floor ? `, ${sp.floor} floor` : ""}
                  </Select.Option>
                ))}
              </Select>
            )}
            {ws && !staffPerms && (
              <Link
                href="/tenantdashboard/rent-a-space"
                onClick={() => onMobileClose?.()}
                className="mt-2 flex items-center gap-1.5 rounded-lg px-1 py-1 text-xs font-medium text-slate-500 transition-colors hover:text-primary dark:text-slate-400"
              >
                <Plus size={14} aria-hidden />
                Rent another space
              </Link>
            )}
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href.split("?")[0];
            const Icon = item.icon;
            const linkContent = (
              <>
                <div
                  className={clsx(
                    "p-2.5 rounded-xl transition-all shrink-0",
                    isActive
                      ? "bg-primary text-white scale-110 shadow-lg shadow-primary/30"
                      : "bg-slate-50 dark:bg-white/5 text-slate-400 group-hover:text-charcoal dark:group-hover:text-white group-hover:scale-110",
                  )}
                >
                  <Icon size={20} />
                </div>
                <span
                  className={clsx(
                    "tracking-tight",
                    "text-xs",
                    "lg:text-xs",
                    "flex-1"
                  )}
                >
                  {isMobile ? item.mobileLabel : item.label}
                </span>
                {(() => {
                  const badge = item.icon === MessageSquare ? unreadMessages : item.icon === ClipboardList ? unreadComplaints : 0;
                  return badge > 0 ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white mr-4 lg:mr-5 shadow-md">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null;
                })()}
                {isActive && (
                  <div
                    className={clsx(
                      "absolute",
                      "right-3",
                      "lg:right-4",
                      "w-2",
                      "h-2",
                      "bg-primary",
                      "rounded-full",
                      "animate-pulse",
                    )}
                  />
                )}
              </>
            );
            return (
              <div key={item.href} onClick={handleLinkClick}>
                {isActive ? (
                  <div
                    className={clsx(
                      "flex",
                      "items-center",
                      "gap-3",
                      "lg:gap-4",
                      "px-4",
                      "lg:px-5",
                      "py-4",
                      "rounded-[1.25rem]",
                      "transition-all",
                      "font-bold",
                      "text-sm",
                      "relative",
                      "group",
                      "min-h-[56px]",
                      "bg-primary/10",
                      "text-primary",
                      "border",
                      "border-primary/20",
                      "shadow-xs",
                    )}
                  >
                    {linkContent}
                  </div>
                ) : (
                  <Link href={item.href}>
                    <div
                      className={clsx(
                        "flex",
                        "items-center",
                        "gap-3",
                        "lg:gap-4",
                        "px-4",
                        "lg:px-5",
                        "py-4",
                        "rounded-[1.25rem]",
                        "transition-all",
                        "font-bold",
                        "text-sm",
                        "relative",
                        "group",
                        "min-h-[56px]",
                        "text-slate-500",
                        "hover:bg-slate-50",
                        "dark:hover:bg-white/5",
                        "dark:text-slate-400",
                        "dark:hover:text-white",
                        "cursor-pointer",
                      )}
                    >
                      {linkContent}
                    </div>
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
};
