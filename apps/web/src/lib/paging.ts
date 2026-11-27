/** Records per page in the admin lists. */
export const PAGE_SIZE = 10;

/** The page to show for a request: a whole number from 1 to the last page. */
export const clampPage = (page: unknown, total: number) =>
  Math.min(Math.max(1, Math.floor(Number(page)) || 1), Math.max(1, Math.ceil(total / PAGE_SIZE)));

/** Search text for LIKE and Prisma `contains`, where %, _ and \ are otherwise wildcards. */
export const likeText = (value: unknown) => String(value ?? "").trim().slice(0, 100).replace(/[\\%_]/g, "\\$&");
