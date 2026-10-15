import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

// Export type constants for SQLite compatibility
export type SlotStatus = "AVAILABLE" | "OCCUPIED" | "MAINTENANCE";

const databaseUrl = () =>
  process.env.DATABASE_URL || "postgresql://postgres:admin123@localhost:5435/srmalldb";

const logLevels = (): ("query" | "error" | "warn")[] =>
  process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"];

// ── Node (local dev, Vercel): one shared client, as before ──────────────────
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function nodeClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl() } },
      log: logLevels(),
    });
  }
  return globalForPrisma.prisma;
}

// ── Cloudflare Workers: one client per request ──────────────────────────────
// Workers can't reuse a database socket opened by another request, so each
// request gets its own client (through the `pg` driver adapter). OpenNext puts
// the current request's context on this global symbol.
const CF_CONTEXT = Symbol.for("__cloudflare-context__");
const perRequest = new WeakMap<object, PrismaClient>();

function workerClient(ctx: object, env: any): PrismaClient {
  let client = perRequest.get(ctx);
  if (!client) {
    // Loaded lazily so Node builds never pull in the adapter.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg");
    // Hyperdrive (pooled, warm connection) when bound; otherwise DATABASE_URL.
    const connectionString = env?.HYPERDRIVE?.connectionString || databaseUrl();
    const pool = new Pool({ connectionString, max: 5 });
    client = new PrismaClient({ adapter: new PrismaPg(pool), log: logLevels() });
    perRequest.set(ctx, client);
  }
  return client;
}

function currentClient(): PrismaClient {
  const cf = (globalThis as any)[CF_CONTEXT];
  return cf?.ctx ? workerClient(cf.ctx, cf.env) : nodeClient();
}

/**
 * The Prisma client. On Node it's the usual shared instance; on Cloudflare it
 * resolves to the current request's client on every use.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = currentClient() as any;
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
