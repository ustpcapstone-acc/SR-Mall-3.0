"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button, Loader, Select, Table, cn } from "@cloudflare/kumo";
import { ArrowClockwise } from "@phosphor-icons/react";
import { AdminDialog, AdminPage, EmptyNote, Panel, Person, SearchField, Stat, PageTabs } from "@/components/admin/page-kit";
import { toast } from "sonner";
import { FixUserRolesBanner } from "@/components/admin/fix-user-roles-banner";
import { ReviewsModeration } from "@/components/admin/reviews-moderation";
import { useAuth } from "@/app/providers";
import { TenantHistory } from "@/components/admin/tenant-history";
import { useTabParam } from "@/lib/use-tab-param";

const TABS = [{ key: "users" }, { key: "feedback" }, { key: "history" }] as const;

const ROLE_FILTERS = [
  { value: "ALL", label: "All users" },
  { value: "CUSTOMER", label: "Customers" },
  { value: "TENANT", label: "Tenants" },
  { value: "ADMIN", label: "Staff" },
  { value: "BLACKLISTED", label: "Suspended" },
];
const ROLE_ITEMS: Record<string, string> = { CUSTOMER: "Customer", TENANT: "Tenant" };
const roleLabel = (role: string) =>
  ROLE_ITEMS[role] ?? (role === "ADMIN" ? "Staff" : role === "TENANT_STAFF" ? "Store staff" : role);

export default function UserManagement() {
  const [activeTab, setActiveTab] = useState<"users" | "feedback" | "history">("users");
  useTabParam(TABS, setActiveTab);
  const [pastTenants, setPastTenants] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [blacklistTarget, setBlacklistTarget] = useState<any | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const { user: currentUser } = useAuth();
  // Needs review + flagged, reported by <ReviewsModeration> for the tab badge.
  const [reviewAttention, setReviewAttention] = useState(0);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { getAllUsersAction } = await import("@/app/actions/auth");
      const result = await getAllUsersAction();
      if (result.success && result.data) {
        setUsers(result.data);
      }
    } catch (err) {
      toast.error("Couldn't load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const { getPastTenantsAction } = await import("@/app/actions/tenant");
      const res = await getPastTenantsAction();
      if (res.success && res.data) {
        setPastTenants(res.data);
      }
    } catch (err) {
      toast.error("Failed to load tenant history.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleToggleBlacklist = async (id: string, currentStatus: boolean) => {
    setIsProcessing(id);
    try {
      const { toggleUserBlacklistAction } = await import("@/app/actions/auth");
      const res = await toggleUserBlacklistAction(id, !currentStatus, currentUser?.id);
      if (res.success) {
        toast.success(!currentStatus ? "Account suspended" : "Access restored");
        setUsers((current) =>
          current.map((u) =>
            u.id === id ? { ...u, isBlacklisted: !currentStatus } : u,
          ),
        );
        setSelectedUser((current: any) =>
          current?.id === id ? { ...current, isBlacklisted: !currentStatus } : current,
        );
      } else {
        toast.error((res as any).error || "Couldn't update the account.");
      }
    } catch {
      toast.error("Couldn't update the account.");
    } finally {
      setIsProcessing(null);
    }
  };

  const confirmBlacklistToggle = async () => {
    if (!blacklistTarget) return;
    const target = blacklistTarget;
    await handleToggleBlacklist(target.id, target.isBlacklisted);
    setBlacklistTarget(null);
  };


  const handleRoleChange = async (id: string, newRole: string) => {
    setIsProcessing(id);
    const { updateUserRoleAction } = await import("@/app/actions/auth");
    const res = await updateUserRoleAction(id, newRole, currentUser?.id);
    if (res.success) {
      toast.success(`Role changed to ${roleLabel(newRole)}`);
      setUsers(users.map((u) => (u.id === id ? { ...u, role: newRole } : u)));
    } else {
      toast.error((res as any).error || "Couldn't change the role.");
    }
    setIsProcessing(null);
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole =
      roleFilter === "ALL" ||
      (roleFilter === "BLACKLISTED" ? u.isBlacklisted : u.role === roleFilter);
    return matchesSearch && matchesRole;
  });


  const countOf = (filter: string) =>
    users.filter((u) => (filter === "ALL" ? true : filter === "BLACKLISTED" ? u.isBlacklisted : u.role === filter)).length;
  const dateOf = (value?: string | Date | null) =>
    value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not recorded";
  const nameOf = (u: any) => u?.name || u?.email || "No name";

  return (
    <AdminPage
      title="User Management"
      description="Manage registered users, update roles and permissions, and review customer feedback."
      actions={
        <Button variant="secondary" icon={<ArrowClockwise />} loading={loading} onClick={loadUsers}>
          Refresh
        </Button>
      }
    >
      <FixUserRolesBanner onFixed={loadUsers} />

      <PageTabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "users" | "feedback" | "history")}
        tabs={[
          { value: "users", label: `Users (${users.length})` },
          { value: "feedback", label: reviewAttention > 0 ? `Feedback & Reviews (${reviewAttention})` : "Feedback & Reviews" },
          { value: "history", label: "Tenant History" },
        ]}
      />

      {activeTab === "users" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {ROLE_FILTERS.map((f) => (
              <Stat
                key={f.value}
                label={f.label}
                value={loading ? "-" : countOf(f.value)}
                tone={f.value === "BLACKLISTED" && countOf(f.value) ? "danger" : "default"}
                active={roleFilter === f.value}
                onClick={() => setRoleFilter(f.value)}
              />
            ))}
          </div>

          <Panel
            flush
            title={ROLE_FILTERS.find((f) => f.value === roleFilter)?.label}
            description={loading ? "Loading..." : `${filteredUsers.length} shown`}
            actions={<SearchField value={searchQuery} onChange={setSearchQuery} placeholder="Search name or email" />}
          >
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader />
              </div>
            ) : filteredUsers.length === 0 ? (
              <EmptyNote
                title="No users match"
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearchQuery("");
                      setRoleFilter("ALL");
                    }}
                  >
                    Clear search and filter
                  </Button>
                }
              >
                Try a different name, email or group.
              </EmptyNote>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>User</Table.Head>
                      <Table.Head>Role</Table.Head>
                      <Table.Head>Status</Table.Head>
                      <Table.Head className="text-right">Actions</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {filteredUsers.map((item) => (
                      <Table.Row key={item.id}>
                        <Table.Cell>
                          <button type="button" onClick={() => setSelectedUser(item)} className="block cursor-pointer text-left">
                            <Person name={nameOf(item)} detail={item.email} image={item.avatarUrl} />
                          </button>
                        </Table.Cell>
                        <Table.Cell>
                          {item.role === "ADMIN" ? (
                            <p className="text-sm text-kumo-default">
                              Staff.{" "}
                              <Link href="/admindashboard/roles-staff" className="text-kumo-link hover:underline">
                                Manage in Roles &amp; Staff
                              </Link>
                            </p>
                          ) : item.role === "CUSTOMER" || item.role === "TENANT" ? (
                            <Select
                              aria-label={`Role of ${nameOf(item)}`}
                              value={item.role}
                              items={ROLE_ITEMS}
                              disabled={isProcessing === item.id}
                              onValueChange={(v) => v && v !== item.role && handleRoleChange(item.id, v as string)}
                              className="w-36"
                            >
                              {Object.entries(ROLE_ITEMS).map(([value, label]) => (
                                <Select.Option key={value} value={value}>
                                  {label}
                                </Select.Option>
                              ))}
                            </Select>
                          ) : (
                            <p className="text-sm text-kumo-default">{roleLabel(item.role)}</p>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <span className={cn("text-sm font-medium", item.isBlacklisted ? "text-kumo-danger" : "text-kumo-success")}>
                            {item.isBlacklisted ? "Suspended" : "Active"}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="secondary" onClick={() => setSelectedUser(item)}>
                              Details
                            </Button>
                            {item.role !== "ADMIN" && (
                              <Button
                                size="sm"
                                variant={item.isBlacklisted ? "secondary" : "secondary-destructive"}
                                loading={isProcessing === item.id}
                                onClick={() => setBlacklistTarget(item)}
                              >
                                {item.isBlacklisted ? "Restore access" : "Suspend"}
                              </Button>
                            )}
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table>
              </div>
            )}
          </Panel>
        </>
      )}

      {activeTab === "feedback" && (
        <ReviewsModeration adminId={currentUser?.id} onAttentionCount={setReviewAttention} />
      )}

      {activeTab === "history" && <TenantHistory rows={pastTenants} loading={loadingHistory} />}

      <AdminDialog
        open={!!blacklistTarget}
        onClose={() => !isProcessing && setBlacklistTarget(null)}
        size="sm"
        title={blacklistTarget?.isBlacklisted ? "Restore this account?" : "Suspend this account?"}
        footer={
          <>
            <Button variant="secondary" disabled={!!isProcessing} onClick={() => setBlacklistTarget(null)}>
              Cancel
            </Button>
            <Button
              variant={blacklistTarget?.isBlacklisted ? "primary" : "destructive"}
              loading={!!isProcessing}
              onClick={confirmBlacklistToggle}
            >
              {blacklistTarget?.isBlacklisted ? "Restore access" : "Suspend account"}
            </Button>
          </>
        }
      >
        {blacklistTarget && (
          <div className="space-y-3 text-sm text-kumo-default">
            <p>
              <strong>{nameOf(blacklistTarget)}</strong>{" "}
              {blacklistTarget.isBlacklisted
                ? "will be able to sign in, shop and send messages again."
                : "will be signed out and blocked from signing in, shopping and sending messages until restored."}
            </p>
            <p className="rounded-lg bg-kumo-recessed p-3 text-kumo-subtle">
              {blacklistTarget.isBlacklisted
                ? "Their listings and message history stay exactly as they are."
                : "Their existing listings and message history are kept; access is paused, not deleted."}
            </p>
          </div>
        )}
      </AdminDialog>

      <AdminDialog
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="User details"
        footer={
          <Button variant="secondary" onClick={() => setSelectedUser(null)}>
            Close
          </Button>
        }
      >
        {selectedUser && (
          <div className="space-y-5">
            <Person name={nameOf(selectedUser)} detail={selectedUser.email} image={selectedUser.avatarUrl} />
            <dl className="grid grid-cols-2 gap-4">
              {[
                ["Role", roleLabel(selectedUser.role)],
                ["Status", selectedUser.isBlacklisted ? "Suspended" : "Active"],
                ["Joined", dateOf(selectedUser.createdAt)],
                ["Last sign-in", dateOf(selectedUser.lastLogin)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-kumo-subtle">{label}</dt>
                  <dd className="text-sm text-kumo-default">{value}</dd>
                </div>
              ))}
              <div className="col-span-2">
                <dt className="text-xs text-kumo-subtle">Account ID</dt>
                <dd className="break-all text-sm text-kumo-default">{selectedUser.id}</dd>
              </div>
            </dl>
          </div>
        )}
      </AdminDialog>
    </AdminPage>
  );
}
