import { PrismaClient } from "@prisma/client";

/**
 * The shared Prisma client.
 *
 * Constructed on first use, not at import time. `new PrismaClient()` validates
 * the datasource as soon as it runs, so building it at module scope meant that
 * merely *importing* this file — which `next build` does for every route while
 * collecting page data — could fail the production build outright with
 * "Failed to collect page data for /api/…" on a deploy whose DATABASE_URL was
 * missing or malformed. Deferring it moves that failure to the one request that
 * actually needs the database, where it is a 500 with a real error in Sentry
 * rather than a build that never ships. `lib/email.ts` and `lib/rate-limit.ts`
 * are lazy for the same reason.
 *
 * The exported value is a proxy so callers keep writing `prisma.user.findMany()`
 * with no ceremony.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let client: PrismaClient | undefined;

function getClient(): PrismaClient {
  if (client) return client;

  // In dev, reuse the instance across hot reloads instead of opening a new pool
  // on every edit.
  client =
    globalForPrisma.prisma ??
    new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });

  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;

  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = getClient();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
  has(_target, property) {
    return property in getClient();
  },
});
