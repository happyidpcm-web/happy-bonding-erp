// Opening sales number for Pavoorchatram's 2026–27 billing rollout.
// Keep this scoped to the established live branch and its legacy local copy.
const pavoorchatramBranches = new Set([
  'cmti1m17y0001w4zwwin3hmr8',
  'cmsdd5qr70001w4rooebz5yxo',
]);

export function salesNumberFloor(branchId: string, prefix: string): number {
  return pavoorchatramBranches.has(branchId) && prefix === 'HB/SL/26-27/' ? 1763 : 1;
}
