import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// A client cached before `prisma generate` added a model is missing that
// model's delegate (e.g. prisma.defaultEnvironment is undefined).
function isCurrent(client: PrismaClient) {
  return Object.values(Prisma.ModelName).every(
    (model) => (client as unknown as Record<string, unknown>)[model.charAt(0).toLowerCase() + model.slice(1)],
  );
}

// Reuse one client across hot reloads in dev, unless the schema has changed.
const cached = globalForPrisma.prisma;
if (cached && !isCurrent(cached)) void cached.$disconnect();
export const prisma = cached && isCurrent(cached) ? cached : createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
