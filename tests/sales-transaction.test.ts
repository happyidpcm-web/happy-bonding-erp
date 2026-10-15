import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "@prisma/client";
import { runSalesTransaction } from "../server/sales-transaction.ts";

const failure = (code: string) => new Prisma.PrismaClientKnownRequestError("database failure", { code, clientVersion: "test" });

test("rolled-back serialization conflicts retry with bounded transaction time", async () => {
  let attempts = 0;
  const result = await runSalesTransaction(async options => {
    assert.deepEqual(options, { isolationLevel: "Serializable", timeout: 20000, maxWait: 5000 });
    if (++attempts === 1) throw failure("P2034");
    return "saved";
  });
  assert.equal(result, "saved");
  assert.equal(attempts, 2);
});

test("persistent conflicts stop after two attempts", async () => {
  let attempts = 0;
  await assert.rejects(runSalesTransaction(async () => { attempts++; throw failure("P2034"); }));
  assert.equal(attempts, 2);
});

test("unknown outcomes, stock failures and transaction timeouts are not replayed", async () => {
  for (const error of [failure("P2028"), failure("P2002"), new Error("Insufficient stock"), new Error("Connection closed")]) {
    let attempts = 0;
    await assert.rejects(runSalesTransaction(async () => { attempts++; throw error; }), candidate => candidate === error);
    assert.equal(attempts, 1);
  }
});
