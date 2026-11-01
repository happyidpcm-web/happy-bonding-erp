// Ignore spacing and punctuation within each field, and allow query words in any order.
export function matchesItemSearch(query: string, fields: Array<string | undefined>): boolean {
  const words = query.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  if (!words.length) return true;
  const normalized = fields.map(field => (field || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""));
  return words.every(word => normalized.some(field => field.includes(word)));
}
