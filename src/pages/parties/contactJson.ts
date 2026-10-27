// Read contact details only. Backup financial records and identifiers are never restored.
export function parseContactsJson(text: string) {
  let backup: unknown;
  try {
    backup = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("Invalid JSON file. Please select a valid contacts or ERP backup JSON file.");
  }
  const object = backup as { data?: { parties?: unknown }; parties?: unknown; contacts?: unknown } | null;
  const rows = Array.isArray(backup) ? backup : object?.data?.parties ?? object?.parties ?? object?.contacts;
  if (!Array.isArray(rows)) {
    throw new Error("No contacts list found. Expected data.parties, parties, contacts, or a contact array.");
  }
  const value = (row: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      const field = row[key];
      if ((typeof field === "string" || typeof field === "number") && String(field).trim()) return String(field).trim();
    }
    return "";
  };
  return rows.filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row) && row.active !== false)
    .map(row => ({
      name: value(row, ["name", "Name", "Party Name", "Full Name"]),
      phone: value(row, ["phone", "mobile", "Phone", "Mobile", "Mobile Number"]),
      email: value(row, ["email", "Email"]),
      address: value(row, ["address", "Address", "Billing Address"]),
    }));
}
