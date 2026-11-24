"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banner,
  Button,
  Checkbox,
  Dialog,
  Input,
  Loader,
  Select,
  Table,
  Tabs,
} from "@cloudflare/kumo";
import { PencilSimple, Plus, Trash, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  createStaffAction,
  deleteRoleAction,
  getMyStaffAccessAction,
  listRolesAction,
  listStaffAction,
  resetStaffPasswordAction,
  saveRoleAction,
  setStaffActiveAction,
  setStaffRoleAction,
  type RoleRow,
  type StaffRow,
} from "@/app/actions/staff";
import { STAFF_SECTIONS, type StaffPermission } from "@/lib/permissions";

const sectionLabel = (key: string) =>
  STAFF_SECTIONS.find((s) => s.key === key)?.label ?? key;

function DialogHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <Dialog.Title className="text-lg font-semibold text-kumo-default">
          {title}
        </Dialog.Title>
        {description && (
          <Dialog.Description className="text-sm text-kumo-subtle">
            {description}
          </Dialog.Description>
        )}
      </div>
      <Dialog.Close
        aria-label="Close"
        render={(props) => (
          <Button
            {...props}
            variant="secondary"
            shape="square"
            icon={<X />}
            aria-label="Close"
          />
        )}
      />
    </div>
  );
}

// ─── Role editor ─────────────────────────────────────────────────────────────

function RoleDialog({
  open,
  onOpenChange,
  role,
  grantable,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleRow | null;
  grantable: StaffPermission[];
  onSaved: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog
        size="lg"
        className="max-h-[90svh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto p-5 sm:p-7"
      >
        {open && (
          <RoleForm
            key={role?.id ?? "new"}
            role={role}
            grantable={grantable}
            onDone={() => (onOpenChange(false), onSaved())}
          />
        )}
      </Dialog>
    </Dialog.Root>
  );
}

function RoleForm({
  role,
  grantable,
  onDone,
}: {
  role: RoleRow | null;
  grantable: StaffPermission[];
  onDone: () => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<string[]>(
    role?.permissions ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await saveRoleAction({
      id: role?.id,
      name,
      description,
      permissions,
    });
    setSaving(false);
    if (!res.success) return setError(res.error);
    toast.success(role ? "Role updated." : "Role created.");
    onDone();
  };

  return (
    <>
      <DialogHeader
        title={role ? `Edit ${role.name}` : "New role"}
        description="Tick the sections people with this role can open."
      />
      <form onSubmit={save} className="space-y-5">
        {error && <Banner variant="error" description={error} />}
        <Input
          label="Role name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={50}
        />
        <Input
          label="Description"
          description="Optional. A short note on what this role is for."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={160}
        />
        <Checkbox.Group
          legend="Sections"
          value={permissions}
          onValueChange={setPermissions}
          appearance="card"
        >
          {STAFF_SECTIONS.map((s) => (
            <Checkbox.Item
              key={s.key}
              value={s.key}
              label={s.label}
              description={
                grantable.includes(s.key)
                  ? s.description
                  : "You can't grant a section you can't open."
              }
              disabled={!grantable.includes(s.key)}
            />
          ))}
        </Checkbox.Group>
        <div className="flex justify-end gap-2">
          <Dialog.Close
            render={(props) => (
              <Button {...props} variant="secondary">
                Cancel
              </Button>
            )}
          />
          <Button type="submit" variant="primary" loading={saving}>
            {role ? "Save changes" : "Create role"}
          </Button>
        </div>
      </form>
    </>
  );
}

// ─── New staff account ───────────────────────────────────────────────────────

function StaffDialog({
  open,
  onOpenChange,
  roles,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: RoleRow[];
  onSaved: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog
        size="lg"
        className="max-h-[90svh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto p-5 sm:p-7"
      >
        {open && (
          <StaffForm
            roles={roles}
            onDone={() => (onOpenChange(false), onSaved())}
          />
        )}
      </Dialog>
    </Dialog.Root>
  );
}

function StaffForm({
  roles,
  onDone,
}: {
  roles: RoleRow[];
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    roleId: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const usable = roles.filter((r) => r.canEdit);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.roleId) return setError("Choose a role.");
    setSaving(true);
    setError(null);
    const res = await createStaffAction(form);
    setSaving(false);
    if (!res.success) return setError(res.error);
    toast.success(
      "Staff account created. Share the email and temporary password with them.",
    );
    onDone();
  };

  return (
    <>
      <DialogHeader
        title="Add staff"
        description="Creates a separate staff account. It signs in at /staff-portal and can't use an email that another account already has."
      />
      <form onSubmit={save} className="space-y-4">
        {error && <Banner variant="error" description={error} />}
        <Input
          label="Full name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          label="Work email"
          type="email"
          autoComplete="off"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <Input
          label="Temporary password"
          type="password"
          autoComplete="new-password"
          description="At least 8 characters. They can change it in Profile Settings."
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <Select
          label="Role"
          placeholder="Choose a role"
          value={form.roleId || null}
          onValueChange={(v) =>
            setForm({ ...form, roleId: (v as string) || "" })
          }
          items={Object.fromEntries(usable.map((r) => [r.id, r.name]))}
        >
          {usable.map((r) => (
            <Select.Option key={r.id} value={r.id}>
              {r.name}
            </Select.Option>
          ))}
        </Select>
        <div className="flex justify-end gap-2 pt-1">
          <Dialog.Close
            render={(props) => (
              <Button {...props} variant="secondary">
                Cancel
              </Button>
            )}
          />
          <Button type="submit" variant="primary" loading={saving}>
            Create account
          </Button>
        </div>
      </form>
    </>
  );
}

function ResetPasswordDialog({
  staff,
  onClose,
}: {
  staff: StaffRow | null;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={!!staff} onOpenChange={(o) => !o && onClose()}>
      <Dialog className="w-[calc(100vw-1.5rem)] max-w-md p-5 sm:p-7">
        {staff && (
          <ResetPasswordForm key={staff.id} staff={staff} onDone={onClose} />
        )}
      </Dialog>
    </Dialog.Root>
  );
}

function ResetPasswordForm({
  staff,
  onDone,
}: {
  staff: StaffRow;
  onDone: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await resetStaffPasswordAction(staff.id, password);
    setSaving(false);
    if (!res.success) return setError(res.error);
    toast.success(`Password reset for ${staff.name}.`);
    onDone();
  };

  return (
    <>
      <DialogHeader
        title="Reset password"
        description={`Set a new temporary password for ${staff.name}.`}
      />
      <form onSubmit={save} className="space-y-4">
        {error && <Banner variant="error" description={error} />}
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          description="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="flex justify-end gap-2">
          <Dialog.Close
            render={(props) => (
              <Button {...props} variant="secondary">
                Cancel
              </Button>
            )}
          />
          <Button type="submit" variant="primary" loading={saving}>
            Reset password
          </Button>
        </div>
      </form>
    </>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RolesStaffPage() {
  const [tab, setTab] = useState("staff");
  const [roles, setRoles] = useState<RoleRow[] | null>(null);
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [grantable, setGrantable] = useState<StaffPermission[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roleDialog, setRoleDialog] = useState<{
    open: boolean;
    role: RoleRow | null;
  }>({ open: false, role: null });
  const [staffDialog, setStaffDialog] = useState(false);
  const [resetFor, setResetFor] = useState<StaffRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Bumped after every change to reload both lists.
  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listRolesAction(),
      listStaffAction(),
      getMyStaffAccessAction(),
    ]).then(([r, s, me]) => {
      if (!alive) return;
      if (!r.success) return setLoadError(r.error);
      if (!s.success) return setLoadError(s.error);
      setLoadError(null);
      setRoles(r.data);
      setStaff(s.data);
      setGrantable(me?.permissions ?? []);
    });
    return () => {
      alive = false;
    };
  }, [version]);

  const roleItems = useMemo(
    () =>
      Object.fromEntries(
        (roles ?? []).filter((r) => r.canEdit).map((r) => [r.id, r.name]),
      ),
    [roles],
  );

  const changeRole = async (member: StaffRow, roleId: string) => {
    if (!roleId || roleId === member.roleId) return;
    setBusyId(member.id);
    const res = await setStaffRoleAction(member.id, roleId);
    setBusyId(null);
    if (!res.success) return toast.error(res.error);
    toast.success(
      `${member.name} now has the ${roles?.find((r) => r.id === roleId)?.name} role.`,
    );
    load();
  };

  const toggleActive = async (member: StaffRow) => {
    setBusyId(member.id);
    const res = await setStaffActiveAction(member.id, !member.isActive);
    setBusyId(null);
    if (!res.success) return toast.error(res.error);
    toast.success(
      member.isActive
        ? `${member.name} can no longer sign in.`
        : `${member.name} can sign in again.`,
    );
    load();
  };

  const removeRole = async (role: RoleRow) => {
    if (!window.confirm(`Delete the ${role.name} role? This can't be undone.`))
      return;
    setBusyId(role.id);
    const res = await deleteRoleAction(role.id);
    setBusyId(null);
    if (!res.success) return toast.error(res.error);
    toast.success("Role deleted.");
    load();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-kumo-default">
            Roles &amp; Staff
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-kumo-subtle">
            Roles decide which sections a staff account can open. Staff accounts
            are separate from customer and tenant accounts and sign in at
            /staff-portal.
          </p>
        </div>
        {tab === "staff" ? (
          <Button
            variant="primary"
            icon={<Plus />}
            onClick={() => setStaffDialog(true)}
            disabled={!roles}
          >
            Add staff
          </Button>
        ) : (
          <Button
            variant="primary"
            icon={<Plus />}
            onClick={() => setRoleDialog({ open: true, role: null })}
          >
            New role
          </Button>
        )}
      </header>

      <Tabs
        value={tab}
        onValueChange={setTab}
        tabs={[
          {
            value: "staff",
            label: `Staff${staff ? ` (${staff.length})` : ""}`,
          },
          {
            value: "roles",
            label: `Roles${roles ? ` (${roles.length})` : ""}`,
          },
        ]}
      />

      {loadError ? (
        <Banner variant="error" description={loadError} />
      ) : !roles || !staff ? (
        <div className="flex justify-center py-20">
          <Loader />
        </div>
      ) : tab === "staff" ? (
        <div className="overflow-x-auto rounded-xl border border-kumo-line bg-kumo-base">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Name</Table.Head>
                <Table.Head>Role</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head className="text-right">Actions</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {staff.map((m) => {
                const locked =
                  m.isSuperuser ||
                  m.isMe ||
                  (!!m.roleId && !roleItems[m.roleId]);
                return (
                  <Table.Row key={m.id}>
                    <Table.Cell>
                      <p className="font-medium text-kumo-default">
                        {m.name}
                        {m.isMe && (
                          <span className="text-kumo-subtle"> (you)</span>
                        )}
                      </p>
                      <p className="text-sm text-kumo-subtle">{m.email}</p>
                    </Table.Cell>
                    <Table.Cell>
                      {m.isSuperuser ? (
                        <span className="text-sm text-kumo-default">
                          Superuser (every section)
                        </span>
                      ) : locked ? (
                        <span className="text-sm text-kumo-default">
                          {m.roleName ?? "No role"}
                        </span>
                      ) : (
                        <Select
                          aria-label={`Role for ${m.name}`}
                          value={m.roleId}
                          items={roleItems}
                          onValueChange={(v) =>
                            changeRole(m, (v as string) || "")
                          }
                          disabled={busyId === m.id}
                          className="min-w-44"
                        >
                          {Object.entries(roleItems).map(([id, name]) => (
                            <Select.Option key={id} value={id}>
                              {name}
                            </Select.Option>
                          ))}
                        </Select>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <span
                        className={
                          m.isActive
                            ? "text-sm text-kumo-success"
                            : "text-sm text-kumo-danger"
                        }
                      >
                        {m.isActive ? "Active" : "Deactivated"}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      {!locked && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setResetFor(m)}
                          >
                            Reset password
                          </Button>
                          <Button
                            size="sm"
                            variant={
                              m.isActive ? "secondary-destructive" : "secondary"
                            }
                            loading={busyId === m.id}
                            onClick={() => toggleActive(m)}
                          >
                            {m.isActive ? "Deactivate" : "Reactivate"}
                          </Button>
                        </div>
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {roles.length === 0 && (
            <li className="text-sm text-kumo-subtle">
              No roles yet. Create one to add staff.
            </li>
          )}
          {roles.map((r) => (
            <li
              key={r.id}
              className="flex flex-col rounded-xl border border-kumo-line bg-kumo-base p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-kumo-default">{r.name}</h2>
                  <p className="text-sm text-kumo-subtle">
                    {r.staffCount} staff{" "}
                    {r.staffCount === 1 ? "account" : "accounts"}
                  </p>
                </div>
                {r.canEdit && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      shape="square"
                      icon={<PencilSimple />}
                      aria-label={`Edit ${r.name}`}
                      onClick={() => setRoleDialog({ open: true, role: r })}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      shape="square"
                      icon={<Trash />}
                      aria-label={`Delete ${r.name}`}
                      loading={busyId === r.id}
                      onClick={() => removeRole(r)}
                    />
                  </div>
                )}
              </div>
              {r.description && (
                <p className="mt-3 text-sm text-kumo-default">
                  {r.description}
                </p>
              )}
              <p className="mt-3 text-sm text-kumo-subtle">
                <span className="text-kumo-default">Can open:</span>{" "}
                {r.permissions.map(sectionLabel).join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}

      <RoleDialog
        open={roleDialog.open}
        onOpenChange={(open) => setRoleDialog((d) => ({ ...d, open }))}
        role={roleDialog.role}
        grantable={grantable}
        onSaved={load}
      />
      <StaffDialog
        open={staffDialog}
        onOpenChange={setStaffDialog}
        roles={roles ?? []}
        onSaved={load}
      />
      <ResetPasswordDialog staff={resetFor} onClose={() => setResetFor(null)} />
    </div>
  );
}
