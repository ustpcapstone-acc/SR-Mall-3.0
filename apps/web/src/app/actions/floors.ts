"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@srmall/database";
import { AccessDenied } from "@/lib/auth-server";
import { requireStaffAny } from "@/lib/action-guard";
import { DEFAULT_FLOORS, FLOOR_LIMITS, defaultFloorName, floorIdFor, type Floor } from "@/lib/floors";
import { listFloorLayouts, listFloors } from "@/lib/floors-server";
import { clampBox, isPlanUrl, type Box } from "@/lib/floor-layout";

type Result = { success: true; added?: Floor[] } | { success: false; error: string };

const fail = (error: string): Result => ({ success: false, error });

function failure(e: unknown, fallback: string): Result {
  if (e instanceof AccessDenied) return fail(e.message);
  // Two people adding the same floor at once.
  if ((e as { code?: string })?.code === "P2002") return fail("A floor with that name or number already exists.");
  console.error("[FLOORS]", e);
  return fail(fallback);
}

const levelProblem = (level: number) =>
  Number.isInteger(level) && level >= FLOOR_LIMITS.minLevel && level <= FLOOR_LIMITS.maxLevel
    ? null
    : `Use a whole floor number from ${FLOOR_LIMITS.minLevel} to ${FLOOR_LIMITS.maxLevel}. 0 is the ground floor.`;

const cleanName = (name: unknown) => String(name ?? "").trim().replace(/\s+/g, " ").slice(0, FLOOR_LIMITS.nameLength);

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function changed() {
  revalidatePath("/admindashboard/space-manager");
  revalidatePath("/available-spaces");
  revalidatePath("/");
}

/** Public: floor names show on shop and space pages. */
export async function getFloorsAction() {
  try {
    return { success: true as const, data: await listFloors() };
  } catch (e) {
    console.error("[FLOORS]", e);
    return { success: false as const, error: "Couldn't load the floors.", data: DEFAULT_FLOORS };
  }
}

/** Public: how the floor map on Available Spaces is drawn. */
export async function getPublicFloorLayoutsAction() {
  try {
    return { success: true as const, data: await listFloorLayouts() };
  } catch (e) {
    console.error("[FLOORS]", e);
    return { success: false as const, error: "Couldn't load the floor map." };
  }
}

/** Admin: which floors were arranged by hand, and their floor plan pictures. */
export async function getFloorLayoutsAction() {
  try {
    await requireStaffAny("spaces", "bookings");
    return { success: true as const, data: await listFloorLayouts() };
  } catch (e) {
    console.error("[FLOORS]", e);
    return { success: false as const, error: "Couldn't load the floor layouts." };
  }
}

/**
 * Save where units sit on a floor, and its floor plan picture. With `arranged`
 * false the floor goes back to the automatic line-up.
 */
export async function saveFloorLayoutAction(
  floorId: string,
  input: { arranged: boolean; planUrl: string | null; units: ({ id: string } & Box)[] },
): Promise<Result> {
  try {
    await requireStaffAny("spaces");
    const arranged = Boolean(input?.arranged);
    const planUrl = input?.planUrl ?? null;
    if (!isPlanUrl(planUrl)) return fail("Upload the floor plan picture again.");
    const units = arranged && Array.isArray(input.units) ? input.units.slice(0, 500) : [];
    if (units.some((u) => ![u.x, u.y, u.width, u.height].every(Number.isFinite))) return fail("A unit has an invalid position.");

    const floor = await prisma.floor.findUnique({ where: { id: String(floorId) }, select: { id: true } });
    if (!floor) return fail("This floor no longer exists.");
    // Only units that are still on this floor.
    const onFloor = await prisma.areaSlot.findMany({ where: { floor: floor.id }, select: { id: true, updatedAt: true } });
    const wanted = new Map(units.map((u) => [u.id, u]));

    await prisma.$transaction([
      prisma.floor.update({ where: { id: floor.id }, data: { arranged, planUrl } }),
      ...onFloor
        .filter((slot) => wanted.has(slot.id))
        .map((slot) =>
          prisma.areaSlot.updateMany({
            // Skipped if the unit changed meanwhile, e.g. was just reserved.
            where: { id: slot.id, floor: floor.id, updatedAt: slot.updatedAt },
            // updatedAt times a reservation hold, so moving a unit leaves it alone.
            data: { ...clampBox(wanted.get(slot.id)!), updatedAt: slot.updatedAt },
          }),
        ),
    ]);
    changed();
    return { success: true };
  } catch (e) {
    return failure(e, "Couldn't save the layout.");
  }
}

/** Add one floor, or several in a row (e.g. the 3rd to the 10th). */
export async function addFloorsAction(input: { level: number; count?: number; name?: string }): Promise<Result> {
  try {
    await requireStaffAny("spaces");
    const level = Number(input?.level);
    const count = Number(input?.count ?? 1);
    if (!Number.isInteger(count) || count < 1 || count > FLOOR_LIMITS.perAdd) {
      return fail(`Add between 1 and ${FLOOR_LIMITS.perAdd} floors at a time.`);
    }
    const problem = levelProblem(level) ?? levelProblem(level + count - 1);
    if (problem) return fail(problem);

    const floors = await listFloors();
    // A typed name only makes sense for a single floor.
    const typed = count === 1 ? cleanName(input?.name) : "";
    const ids = new Set(floors.map((f) => f.id));
    const added: Floor[] = [];
    for (let at = level; at < level + count; at++) {
      const name = typed || defaultFloorName(at);
      const taken = floors.find((f) => f.level === at);
      if (taken) return fail(`Floor number ${at} is already used by "${taken.name}".`);
      if (floors.some((f) => sameName(f.name, name))) return fail(`A floor named "${name}" already exists.`);
      // The usual id can still belong to a floor that was renumbered.
      let id = floorIdFor(at);
      if (ids.has(id)) id = `floor-${at}-${Math.random().toString(36).slice(2, 6)}`;
      added.push({ id, name, level: at });
    }
    await prisma.floor.createMany({ data: added });
    changed();
    return { success: true, added };
  } catch (e) {
    return failure(e, "Couldn't add the floor.");
  }
}

/** Rename a floor or move it to another floor number. Its units stay on it. */
export async function updateFloorAction(id: string, input: { name: string; level: number }): Promise<Result> {
  try {
    await requireStaffAny("spaces");
    const name = cleanName(input?.name);
    const level = Number(input?.level);
    if (!name) return fail("Enter a floor name.");
    const problem = levelProblem(level);
    if (problem) return fail(problem);
    const floors = await listFloors();
    if (!floors.some((f) => f.id === id)) return fail("This floor no longer exists.");
    const others = floors.filter((f) => f.id !== id);
    const taken = others.find((f) => f.level === level);
    if (taken) return fail(`Floor number ${level} is already used by "${taken.name}".`);
    if (others.some((f) => sameName(f.name, name))) return fail(`A floor named "${name}" already exists.`);
    await prisma.floor.update({ where: { id }, data: { name, level } });
    changed();
    return { success: true };
  } catch (e) {
    return failure(e, "Couldn't save the floor.");
  }
}

/** Remove an empty floor. Units are never deleted or moved by this. */
export async function deleteFloorAction(id: string): Promise<Result> {
  try {
    await requireStaffAny("spaces");
    const [floors, units] = await Promise.all([listFloors(), prisma.areaSlot.count({ where: { floor: id } })]);
    if (!floors.some((f) => f.id === id)) return fail("This floor no longer exists.");
    if (units > 0) {
      return fail(`This floor still has ${units} unit${units === 1 ? "" : "s"}. Move or delete ${units === 1 ? "it" : "them"} first.`);
    }
    if (floors.length === 1) return fail("The mall needs at least one floor.");
    await prisma.floor.delete({ where: { id } });
    changed();
    return { success: true };
  } catch (e) {
    return failure(e, "Couldn't remove the floor.");
  }
}
