"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Banner, Button, Input } from "@cloudflare/kumo";
import { PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { AdminDialog } from "@/components/admin/page-kit";
import { addFloorsAction, deleteFloorAction, updateFloorAction } from "@/app/actions/floors";
import { FLOOR_LIMITS, defaultFloorName, type Floor } from "@/lib/floors";
import { refreshFloors, useFloors } from "@/lib/use-floors";

/** Floor Spaces & Map → Manage floors: add, rename, reorder and remove floors. */
export function FloorManager({
  open,
  onClose,
  unitsOn,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  /** How many units are on a floor. */
  unitsOn: (floorId: string) => number;
  /** Show the first floor that was just added. */
  onAdded: (floorId: string) => void;
}) {
  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Manage floors"
      description="Add as many floors as the mall has. A floor can be removed once it has no units."
    >
      {open && <FloorList unitsOn={unitsOn} onAdded={onAdded} />}
    </AdminDialog>
  );
}

function FloorList({ unitsOn, onAdded }: { unitsOn: (floorId: string) => number; onAdded: (floorId: string) => void }) {
  const { floors } = useFloors();
  const [editing, setEditing] = useState<{ id: string; name: string; level: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Runs one change, then reloads the list everywhere on the page. */
  const run = async (change: () => Promise<{ success: boolean; error?: string }>, done: string) => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      const res = await change();
      if (!res.success) {
        setError(res.error || "Something went wrong.");
        return false;
      }
      await refreshFloors(true);
      toast.success(done);
      return true;
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const ok = await run(
      () => updateFloorAction(editing.id, { name: editing.name, level: editing.level.trim() === "" ? NaN : Number(editing.level) }),
      "Floor saved",
    );
    if (ok) setEditing(null);
  };

  const remove = async (floor: Floor) => {
    if (await run(() => deleteFloorAction(floor.id), `${floor.name} removed`)) setRemoving(null);
  };

  return (
    <div className="space-y-5">
      {error && (
        <div role="alert">
          <Banner variant="error" description={error} />
        </div>
      )}

      {/* Top floor first, as in a building. */}
      <ul className="max-h-72 divide-y divide-kumo-line overflow-y-auto rounded-lg border border-kumo-line">
        {[...floors].reverse().map((floor) => {
          const units = unitsOn(floor.id);
          return (
            <li key={floor.id} className="p-3">
              {editing?.id === floor.id ? (
                <form onSubmit={save} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-40 flex-1">
                    <Input
                      label="Floor name"
                      value={editing.name}
                      maxLength={FLOOR_LIMITS.nameLength}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      className="w-full"
                    />
                  </div>
                  <Input
                    label="Floor number"
                    type="number"
                    value={editing.level}
                    onChange={(e) => setEditing({ ...editing, level: e.target.value })}
                    className="w-28"
                  />
                  <Button type="submit" variant="primary" loading={busy}>
                    Save
                  </Button>
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-kumo-default">{floor.name}</p>
                    <p className="text-sm text-kumo-subtle">
                      Floor number {floor.level}, {units === 0 ? "no units" : `${units} unit${units === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  {removing === floor.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-kumo-default">Remove this floor?</span>
                      <Button size="sm" variant="destructive" loading={busy} onClick={() => remove(floor)}>
                        Remove
                      </Button>
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => setRemoving(null)}>
                        Keep
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<PencilSimple />}
                        onClick={() => {
                          setError(null);
                          setRemoving(null);
                          setEditing({ id: floor.id, name: floor.name, level: String(floor.level) });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary-destructive"
                        shape="square"
                        icon={<Trash />}
                        aria-label={`Remove ${floor.name}`}
                        title={units > 0 ? "Move or delete its units first" : floors.length === 1 ? "The mall needs one floor" : "Remove floor"}
                        disabled={units > 0 || floors.length === 1}
                        onClick={() => {
                          setError(null);
                          setEditing(null);
                          setRemoving(floor.id);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Remounted when the top floor changes, so the next number is filled in. */}
      <AddFloors
        key={floors.at(-1)?.level ?? 0}
        next={(floors.at(-1)?.level ?? -1) + 1}
        busy={busy}
        onAdd={async (input) => {
          let first: string | undefined;
          const ok = await run(async () => {
            const res = await addFloorsAction(input);
            if (res.success) first = res.added?.[0]?.id;
            return res;
          }, input.count > 1 ? `${input.count} floors added` : "Floor added");
          if (ok && first) onAdded(first);
        }}
      />
    </div>
  );
}

function AddFloors({
  next,
  busy,
  onAdd,
}: {
  next: number;
  busy: boolean;
  onAdd: (input: { level: number; count: number; name?: string }) => void;
}) {
  const [level, setLevel] = useState(String(next));
  const [count, setCount] = useState("1");
  const [name, setName] = useState("");
  const from = level.trim() === "" ? NaN : Number(level);
  const many = Number(count);
  const valid = Number.isInteger(from) && Number.isInteger(many) && many >= 1 && many <= FLOOR_LIMITS.perAdd;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onAdd({ level: from, count: many, name: many === 1 ? name : undefined });
      }}
      className="space-y-3 rounded-lg bg-kumo-recessed p-4"
    >
      <h3 className="text-sm font-semibold text-kumo-default">Add floors</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Starting floor number"
          type="number"
          min={FLOOR_LIMITS.minLevel}
          max={FLOOR_LIMITS.maxLevel}
          description="0 is the ground floor, -1 a basement."
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="w-full"
        />
        <Input
          label="How many floors"
          type="number"
          min={1}
          max={FLOOR_LIMITS.perAdd}
          description={`Up to ${FLOOR_LIMITS.perAdd} at a time.`}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          className="w-full"
        />
      </div>
      {many === 1 && (
        <Input
          label="Floor name (optional)"
          placeholder={Number.isInteger(from) ? defaultFloorName(from) : "3rd Floor"}
          maxLength={FLOOR_LIMITS.nameLength}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full"
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-kumo-subtle" aria-live="polite">
          {!valid
            ? "Enter a floor number and how many floors."
            : many === 1
              ? `Adds ${name.trim() || defaultFloorName(from)}.`
              : `Adds ${defaultFloorName(from)} to ${defaultFloorName(from + many - 1)}.`}
        </p>
        <Button type="submit" variant="primary" icon={<Plus />} loading={busy} disabled={!valid}>
          {many > 1 ? "Add floors" : "Add floor"}
        </Button>
      </div>
    </form>
  );
}
