import { PrismaClient } from "@prisma/client";
import { tenantIsolationExtension } from "./middleware/tenantIsolation";

const basePrisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["error", "warn"]
      : ["error"],
});

export const prisma = basePrisma.$extends(tenantIsolationExtension) as unknown as PrismaClient;
