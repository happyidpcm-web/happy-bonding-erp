import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesItemSearch } from "../src/utils/itemSearch.ts";

test("item names match regardless of spacing, case and word order", () => {
  for (const query of ["MOMFIT", "mom fit", "PANT MOMFIT", "pant mom fit", "  FIT   PANT MOM  "]) {
    assert.equal(matchesItemSearch(query, ["MOM FIT PANT"]), true, query);
  }
  assert.equal(matchesItemSearch("MOM FIT", ["MOMFIT PANT"]), true);
  assert.equal(matchesItemSearch("MOMFIT", ["MOM-FIT PANT"]), true);
  assert.equal(matchesItemSearch("MOMFIT SHIRT", ["MOM FIT PANT"]), false);
});

test("SKU and HSN search work along with names and empty queries", () => {
  const fields = ["MOM FIT PANT", "MF-001", "6204", undefined];
  assert.equal(matchesItemSearch("mf001", fields), true);
  assert.equal(matchesItemSearch("6204 pant", fields), true);
  assert.equal(matchesItemSearch("", fields), true);
  assert.equal(matchesItemSearch("unknown", fields), false);
});
