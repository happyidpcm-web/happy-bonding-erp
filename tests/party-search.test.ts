import assert from "node:assert/strict";
import { test } from "node:test";
import { indexParties, searchParties } from "../src/utils/partySearch.ts";
import type { Party } from "../src/types.ts";

const party = (id: number, name: string, phone = "", type: Party["type"] = "Customer"): Party => ({ id, name, phone, type, balance: 0 });

test("F20 matches the supplier name without unrelated phone matches", () => {
  const index = indexParties([party(1, "Subramani", "6369386020"), party(2, "F20", "", "Supplier"), party(3, "F20 Shirts")]);
  assert.deepEqual(searchParties(index, " F20 ", true).rows.map(p => p.id), [2, 3]);
  assert.deepEqual(searchParties(index, "9386020").rows.map(p => p.id), [1]);
});

test("formatted phone search still works", () => {
  assert.equal(searchParties(indexParties([party(1, "Supplier", "+91 98765-43210")]), "98765 43210").total, 1);
});

test("clearing a large search bounds rendered results and exact matches stay first", () => {
  const rows = Array.from({ length: 12000 }, (_, i) => party(i, `Customer ${i}`, "9000000020"));
  rows.push(party(12000, "F20", "", "Supplier"));
  const index = indexParties(rows);
  const cleared = searchParties(index, "", true);
  assert.equal(cleared.rows.length, 50);
  assert.equal(cleared.total, 12001);
  assert.equal(cleared.rows[0].name, "F20");
  assert.deepEqual(searchParties(index, "F20", true).rows.map(p => p.name), ["F20"]);
  assert.equal(searchParties(index, "Customer 11999").rows[0].id, 11999);
});

test("new suppliers are searchable and merged without duplicates", () => {
  const saved = party(2, "F20", "", "Supplier");
  assert.equal(searchParties(indexParties([saved], [saved]), "F20").total, 1);
  assert.equal(searchParties(indexParties([], [saved]), "F20").rows[0], saved);
});
