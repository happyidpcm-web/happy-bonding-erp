// Prefer the established Pavoorchatram branch without expanding staff access.
export function orderBranches<T extends { code: string; name: string }>(branches: T[]): T[] {
  const priority = (branch: T) => branch.code.trim().toUpperCase() === 'PCM' ? 2
    : branch.name.trim().toLowerCase() === 'pavoorchatram' ? 1 : 0;
  return [...branches].sort((a, b) => priority(b) - priority(a) || a.name.localeCompare(b.name));
}
