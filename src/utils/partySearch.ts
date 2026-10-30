import type { Party } from "../types";

export function indexParties(parties: Party[], created: Party[] = []) {
  const rows = new Map(parties.map(party => [party.id, party]));
  for (const party of created) rows.set(party.id, party);
  return [...rows.values()].map(party => ({
    party, name: party.name.trim().toLowerCase(), phone: (party.phone || "").replace(/\D/g, ""),
  }));
}

export function searchParties(index: ReturnType<typeof indexParties>, query: string, preferSuppliers = false, limit = 50) {
  const q = query.trim().toLowerCase();
  // Only phone-like queries may match normalized phone digits: F20 is a name, not phone 20.
  const digits = /^[+\d\s().-]+$/.test(q) ? q.replace(/\D/g, "") : "";
  const buckets: Party[][] = Array.from({ length: 6 }, () => []);
  let total = 0;
  for (const row of index) {
    const nameMatch = row.name.includes(q);
    if (!nameMatch && !(digits && row.phone.includes(digits))) continue;
    total++;
    const rank = q && row.name === q ? 0 : q && row.name.startsWith(q) ? 1 : 2;
    const bucket = buckets[rank * 2 + (preferSuppliers && row.party.type !== "Supplier" ? 1 : 0)];
    if (bucket.length < limit) bucket.push(row.party);
  }
  return { rows: buckets.flat().slice(0, limit), total };
}
