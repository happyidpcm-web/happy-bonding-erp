import { Prisma } from "@prisma/client";

// Retry only a serialization failure: PostgreSQL has rolled that attempt back.
// Never replay unknown connection errors, whose commit outcome may be unclear.
export async function runSalesTransaction<T>(
  run: (options: { isolationLevel: "Serializable"; timeout: number; maxWait: number }) => Promise<T>,
): Promise<T> {
  const deadline = Date.now() + 50_000;
  for (let attempt = 0; ; attempt++) {
    try {
      const remaining = Math.max(2, deadline - Date.now());
      const maxWait = Math.min(5_000, Math.floor(remaining / 2));
      return await run({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: Math.min(20_000, remaining - maxWait), maxWait });
    } catch (error) {
      if (attempt >= 5 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
      // Four tills can invalidate each other's serializable snapshots several
      // times. Jitter avoids repeatedly retrying together; the shared deadline
      // leaves room for the API response before the client's 60-second timeout.
      const delay = Math.min(800, 50 * 2 ** attempt) + Math.floor(Math.random() * 100);
      if (deadline - Date.now() < delay + 1_000) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
