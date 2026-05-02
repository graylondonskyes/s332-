import { PrismaClient } from "@prisma/client";

declare global {
  var __jobpingPrisma: PrismaClient | undefined;
}

export const prisma = global.__jobpingPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__jobpingPrisma = prisma;
}
