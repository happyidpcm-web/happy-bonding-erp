import { Prisma } from "@prisma/client";

// Opening sales number for Pavoorchatram's 2026–27 billing rollout.
// Keep this scoped to the established live branch and its legacy local copy.
const pavoorchatramBranches = new Set([
  'cmti1m17y0001w4zwwin3hmr8',
  'cmsdd5qr70001w4rooebz5yxo',
]);

export function salesNumberFloor(branchId: string, prefix: string): number {
  return pavoorchatramBranches.has(branchId) && prefix === 'HB/SL/26-27/' ? 1763 : 1;
}

// Return one aggregate row rather than transferring every historical invoice
// number on each save/preview. Parameters keep custom prefixes literal.
export async function nextAvailableSalesNumber(
  client: Pick<Prisma.TransactionClient, "$queryRaw">,
  organizationId: string,
  branchId: string,
  prefix: string,
): Promise<number> {
  const [row] = await client.$queryRaw<Array<{ maximum: Prisma.Decimal }>>(Prisma.sql`
    SELECT COALESCE(MAX(SUBSTRING(SUBSTRING("invoiceNumber", LENGTH(${prefix}) + 1)
      FROM '^[0-9]+')::numeric), 0) AS maximum
    FROM "SalesInvoice"
    WHERE "organizationId" = ${organizationId} AND "branchId" = ${branchId}
      AND LEFT("invoiceNumber", LENGTH(${prefix})) = ${prefix}
  `);
  return Math.max(Number(row.maximum) + 1, salesNumberFloor(branchId, prefix));
}
