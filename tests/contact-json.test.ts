import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { parseContactsJson } from "../src/pages/parties/contactJson.ts";

test("ERP backup imports only contact fields and ignores inactive entries", () => {
  const contacts = parseContactsJson(JSON.stringify({ data: { parties: [
    { name: " Customer ", phone: "9876543210", email: "a@example.com", address: "Town", id: "old", openingBalance: 500, bankAccountNumber: "secret" },
    { name: "Inactive", phone: "9876543211", active: false }, null,
  ], invoices: [{ grandTotal: 1000 }] } }));
  assert.deepEqual(contacts, [{ name: "Customer", phone: "9876543210", email: "a@example.com", address: "Town" }]);
});

test("supports contact arrays and common wrappers, including BOM", () => {
  for (const data of [[{ Name: "Test", Mobile: 9876543210 }], { contacts: [{ Name: "Test", Mobile: 9876543210 }] }, { parties: [{ Name: "Test", Mobile: 9876543210 }] }]) {
    assert.equal(parseContactsJson("\uFEFF" + JSON.stringify(data))[0].phone, "9876543210");
  }
  assert.throws(() => parseContactsJson("{"), /Invalid JSON/);
  assert.throws(() => parseContactsJson('{"data":{"invoices":[]}}'), /No contacts list/);
});

test("reads the existing August backup without restoring financial data", () => {
  const text = readFileSync(new URL("../backups/backup-2026-08-31.json", import.meta.url), "utf8");
  const backup = JSON.parse(text);
  const contacts = parseContactsJson(text);
  assert.equal(contacts.length, backup.data.parties.filter((p: { active?: boolean }) => p.active !== false).length);
  assert.ok(contacts.length > 0);
  assert.ok(contacts.every(contact => Object.keys(contact).join(",") === "name,phone,email,address"));
});
