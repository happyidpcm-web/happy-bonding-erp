import { Prisma } from "@prisma/client";

// Retry only a serialization failure: PostgreSQL has rolled that attempt back.
// Never replay unknown connection errors, whose commit outcome may be unclear.
export async function runSalesTransaction<T>(
  run: (options: { isolationLevel: "Serializable"; timeout: number; maxWait: number }) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000, maxWait: 5_000 });
    } catch (error) {
      if (attempt >= 1 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
    }
  }
}
