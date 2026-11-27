"use client";

import { confirmAction } from "@/components/confirm-dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Banner, Button, Checkbox, Dialog, Input, Loader, Select, Table, Tabs } from "@cloudflare/kumo";
import { PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  createSpaceStaffAction,
  deleteSpaceRoleAction,
  listSpaceStaffAction,
  removeSpaceStaffAction,
  resetSpaceStaffPasswordAction,
  saveSpaceRoleAction,
  setSpaceStaffActiveAction,
  setSpaceStaffRoleAction,
  type SpaceRoleRow,
  type SpaceStaffRow,
} from "@/app/actions/space-staff";
import { SPACE_SECTIONS } from "@/lib/tenant-permissions";
import { DialogHeader } from "@/components/leasing/shared";
import { useDraft } from "@/lib/drafts/use-draft";
import { DraftNote } from "@/components/drafts/draft-note";

const sectionLabel = (key: string) => SPACE_SECTIONS.find((s) => s.key === key)?.label ?? key;

type Data = { unitId: string; roles: SpaceRoleRow[]; staff: SpaceStaffRow[] };

export default function SpaceStaffPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("staff");
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; role: SpaceRoleRow | null }>({ open: false, role: null });
  const [staffDialog, setStaffDialog] = useState(false);
  const [resetFor, setResetFor] = useState<SpaceStaffRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    listSpaceStaffAction().then((res) => {
      if (!alive) return;
      if (!res.success) return setError(res.error);
      setError(null);
      setData(res.data);
    });
    return () => {
      alive = false;
    };
  }, [version]);

  const roleItems = useMemo(() => Object.fromEntries((data?.roles ?? []).map((r) => [r.id, r.name])), [data]);

  const run = async (id: string, fn: () => Promise<{ success: boolean; error?: string }>, done: string) => {
    setBusyId(id);
    const res = await fn();
    setBusyId(null);
    if (!res.success) return toast.error(res.error);
    toast.success(done);
    reload();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6 sm:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-kumo-default">Staff{data ? `, Unit ${data.unitId}` : ""}</h1>
          <p className="mt-1 max-w-2xl text-sm text-kumo-subtle">
            Staff sign in as a tenant on the sign-in page, with their own email and password. They only see this space, and only the
            sections their role opens.
          </p>
        </div>
        {data &&
          (tab === "staff" ? (
            <Button variant="primary" icon={<Plus />} onClick={() => setStaffDialog(true)}>
              Add staff
            </Button>
          ) : (
            <Button variant="primary" icon={<Plus />} onClick={() => setRoleDialog({ open: true, role: null })}>
              New role
            </Button>
          ))}
      </header>

      <Tabs
        value={tab}
        onValueChange={setTab}
        tabs={[
          { value: "staff", label: `Staff${data ? ` (${data.staff.length})` : ""}` },
          { value: "roles", label: `Roles${data ? ` (${data.roles.length})` : ""}` },
        ]}
      />

      {error ? (
        <Banner variant="error" description={error} />
      ) : !data ? (
        <div className="flex justify-center py-20">
          <Loader />
        </div>
      ) : tab === "staff" ? (
        data.staff.length === 0 ? (
          <p className="rounded-xl border border-kumo-line bg-kumo-base p-8 text-center text-sm text-kumo-subtle">
            No staff yet. Add someone to help run this space.
          </p>
        ) : (
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
                {data.staff.map((m) => (
                  <Table.Row key={m.id}>
                    <Table.Cell>
                      <p className="font-medium text-kumo-default">{m.name}</p>
                      <p className="text-sm text-kumo-subtle">{m.email}</p>
                    </Table.Cell>
                    <Table.Cell>
                      <Select
                        aria-label={`Role for ${m.name}`}
                        value={m.roleId}
                        items={roleItems}
                        disabled={busyId === m.id}
                        onValueChange={(v) =>
                          v && v !== m.roleId && run(m.id, () => setSpaceStaffRoleAction(m.id, v as string), `${m.name} is now ${roleItems[v as string]}.`)
                        }
                        className="min-w-40"
                      >
                        {data.roles.map((r) => (
                          <Select.Option key={r.id} value={r.id}>
                            {r.name}
                          </Select.Option>
                        ))}
                      </Select>
                    </Table.Cell>
                    <Table.Cell>
                      <span className={`text-sm ${m.isActive ? "text-kumo-success" : "text-kumo-danger"}`}>
                        {m.isActive ? "Active" : "Turned off"}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setResetFor(m)}>
                          Reset password
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busyId === m.id}
                          onClick={() =>
                            run(m.id, () => setSpaceStaffActiveAction(m.id, !m.isActive), m.isActive ? `${m.name} can no longer sign in.` : `${m.name} can sign in again.`)
                          }
                        >
                          {m.isActive ? "Turn off" : "Turn on"}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary-destructive"
                          shape="square"
                          icon={<Trash />}
                          aria-label={`Remove ${m.name}`}
                          onClick={async () => {
                            if (await confirmAction({ title: `Remove ${m.name}?`, description: "Their staff account is deleted.", confirmLabel: "Remove staff" })) {
                              run(m.id, () => removeSpaceStaffAction(m.id), `${m.name} was removed.`);
                            }
                          }}
                        />
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {data.roles.map((r) => (
            <li key={r.id} className="flex flex-col rounded-xl border border-kumo-line bg-kumo-base p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-kumo-default">{r.name}</h2>
                  <p className="text-sm text-kumo-subtle">
                    {r.staffCount} staff{r.isDefault ? ", built in" : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    shape="square"
                    icon={<PencilSimple />}
                    aria-label={`Edit ${r.name}`}
                    onClick={() => setRoleDialog({ open: true, role: r })}
                  />
                  {!r.isDefault && (
                    <Button
                      size="sm"
                      variant="ghost"
                      shape="square"
                      icon={<Trash />}
                      aria-label={`Delete ${r.name}`}
                      loading={busyId === r.id}
                      onClick={async () => {
                        if (await confirmAction({ title: `Delete the ${r.name} role?`, description: "This can't be undone.", confirmLabel: "Delete role" })) {
                          run(r.id, () => deleteSpaceRoleAction(r.id), "Role deleted.");
                        }
                      }}
                    />
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm text-kumo-subtle">
                <span className="text-kumo-default">Can open:</span> {r.permissions.map(sectionLabel).join(", ")}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Dialog.Root open={roleDialog.open} onOpenChange={(open) => setRoleDialog((d) => ({ ...d, open }))}>
        <Dialog size="lg" className="max-h-[90svh] w-[calc(100vw-1.5rem)] max-w-xl overflow-y-auto p-5 sm:p-7">
          {roleDialog.open && (
            <RoleForm
              key={roleDialog.role?.id ?? "new"}
              role={roleDialog.role}
              onDone={() => {
                setRoleDialog({ open: false, role: null });
                reload();
              }}
            />
          )}
        </Dialog>
      </Dialog.Root>

      <Dialog.Root open={staffDialog} onOpenChange={setStaffDialog}>
        <Dialog size="lg" className="max-h-[90svh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto p-5 sm:p-7">
          {staffDialog && data && (
            <StaffForm
              roles={data.roles}
              onDone={() => {
                setStaffDialog(false);
                reload();
              }}
            />
          )}
        </Dialog>
      </Dialog.Root>

      <Dialog.Root open={!!resetFor} onOpenChange={(o) => !o && setResetFor(null)}>
        <Dialog size="base" className="w-[calc(100vw-1.5rem)] max-w-md p-5 sm:p-7">
          {resetFor && <ResetForm key={resetFor.id} member={resetFor} onDone={() => setResetFor(null)} />}
        </Dialog>
      </Dialog.Root>
    </div>
  );
}

function RoleForm({ role, onDone }: { role: SpaceRoleRow | null; onDone: () => void }) {
  const [name, setName] = useState(role?.name ?? "");
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const draft = useDraft({
    form: "tenant.staff-role",
    workspace: true,
    scope: [role?.id ?? "new"],
    editing: Boolean(role),
    value: { name, permissions },
    initial: { name: role?.name ?? "", permissions: role?.permissions ?? [] },
    onRestore: (saved) => {
      setName(saved.name);
      setPermissions(saved.permissions);
    },
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await draft.send(() => saveSpaceRoleAction({ id: role?.id, name, permissions }));
    setSaving(false);
    if (!res) return;
    if (!res.success) return setError(res.error);
    draft.clear();
    toast.success(role ? "Role updated." : "Role created.");
    onDone();
  };

  return (
    <>
      <DialogHeader title={role ? `Edit ${role.name}` : "New role"} description="Tick the sections staff with this role can open." />
      <form onSubmit={save} className="space-y-5">
        {error && <Banner variant="error" description={error} />}
        <Input label="Role name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} />
        <Checkbox.Group legend="Sections" value={permissions} onValueChange={setPermissions} appearance="card">
          {SPACE_SECTIONS.map((s) => (
            <Checkbox.Item key={s.key} value={s.key} label={s.label} description={s.description} />
          ))}
        </Checkbox.Group>
        <DraftNote draft={draft} />
        <div className="flex justify-end gap-2">
          <Dialog.Close render={(props) => <Button {...props} variant="secondary">Cancel</Button>} />
          <Button type="submit" variant="primary" loading={saving}>
            {role ? "Save changes" : "Create role"}
          </Button>
        </div>
      </form>
    </>
  );
}

function StaffForm({ roles, onDone }: { roles: SpaceRoleRow[]; onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const items = Object.fromEntries(roles.map((r) => [r.id, r.name]));
  const draft = useDraft({
    form: "tenant.add-staff",
    workspace: true,
    value: { name, email, roleId },
    initial: { name: "", email: "", roleId: roles[0]?.id ?? "" },
    onRestore: (saved) => {
      setName(saved.name);
      setEmail(saved.email);
      setRoleId(roles.some((r) => r.id === saved.roleId) ? saved.roleId : (roles[0]?.id ?? ""));
    },
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await draft.send(() => createSpaceStaffAction({ name, email, password, roleId }));
    setSaving(false);
    if (!res) return;
    if (!res.success) return setError(res.error);
    draft.clear();
    toast.success(`${name} can now sign in as a tenant on the sign-in page.`);
    onDone();
  };

  return (
    <>
      <DialogHeader title="Add staff" description="Share the email and password with them yourself. They can sign in right away." />
      <form onSubmit={save} className="space-y-4">
        {error && <Banner variant="error" description={error} />}
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" />
        <Input
          label="Password"
          type="password"
          description="At least 8 characters with letters and numbers."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        <Select label="Role" value={roleId} items={items} onValueChange={(v) => setRoleId((v as string) || "")} className="w-full">
          {roles.map((r) => (
            <Select.Option key={r.id} value={r.id}>
              {r.name}
            </Select.Option>
          ))}
        </Select>
        <DraftNote draft={draft} />
        <div className="flex justify-end gap-2">
          <Dialog.Close render={(props) => <Button {...props} variant="secondary">Cancel</Button>} />
          <Button type="submit" variant="primary" loading={saving}>
            Add staff
          </Button>
        </div>
      </form>
    </>
  );
}

function ResetForm({ member, onDone }: { member: SpaceStaffRow; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await resetSpaceStaffPasswordAction(member.id, password);
    setSaving(false);
    if (!res.success) return setError(res.error);
    toast.success(`Password changed for ${member.name}.`);
    onDone();
  };

  return (
    <>
      <DialogHeader title={`Reset password for ${member.name}`} />
      <form onSubmit={save} className="space-y-4">
        {error && <Banner variant="error" description={error} />}
        <Input
          label="New password"
          type="password"
          description="At least 8 characters with letters and numbers."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        <div className="flex justify-end gap-2">
          <Dialog.Close render={(props) => <Button {...props} variant="secondary">Cancel</Button>} />
          <Button type="submit" variant="primary" loading={saving}>
            Save password
          </Button>
        </div>
      </form>
    </>
  );
}
