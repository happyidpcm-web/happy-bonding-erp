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

test("persistent conflicts stop after six attempts", async () => {
  let attempts = 0;
  await assert.rejects(runSalesTransaction(async () => { attempts++; throw failure("P2034"); }));
  assert.equal(attempts, 6);
});

test("four simultaneous tills all commit distinct numbers without losing stock deductions", async () => {
  // Model serializable snapshots: only one transaction with a given version
  // can commit. Every other contender must replay against the new state.
  let version = 0;
  let stock = 20;
  let sequence = 100;
  let attempts = 0;
  const invoices = await Promise.all(Array.from({ length: 4 }, () => runSalesTransaction(async () => {
    attempts++;
    const snapshot = version;
    const available = stock;
    const number = sequence;
    await new Promise(resolve => setTimeout(resolve, 10));
    if (snapshot !== version) throw failure("P2034");
    stock = available - 2;
    sequence = number + 1;
    version++;
    return number;
  })));
  assert.deepEqual(invoices.sort((a, b) => a - b), [100, 101, 102, 103]);
  assert.equal(stock, 12);
  assert.ok(attempts > 4, "Concurrent snapshots must exercise the retry path");
});

test("a fourth contender can succeed after three serialization conflicts", async () => {
  let attempts = 0;
  const result = await runSalesTransaction(async () => {
    if (++attempts <= 3) throw failure("P2034");
    return "saved";
  });
  assert.equal(result, "saved");
  assert.equal(attempts, 4);
});

test("unknown outcomes, stock failures and transaction timeouts are not replayed", async () => {
  for (const error of [failure("P2028"), failure("P2002"), new Error("Insufficient stock"), new Error("Connection closed")]) {
    let attempts = 0;
    await assert.rejects(runSalesTransaction(async () => { attempts++; throw error; }), candidate => candidate === error);
    assert.equal(attempts, 1);
  }
});

test("slow conflicts stop at the shared deadline instead of starting another transaction", async () => {
  const originalNow = Date.now;
  let now = originalNow();
  let attempts = 0;
  const error = failure("P2034");
  Date.now = () => now;
  try {
    await assert.rejects(runSalesTransaction(async () => {
      attempts++;
      now += 49_500;
      throw error;
    }), candidate => candidate === error);
    assert.equal(attempts, 1);
  } finally {
    Date.now = originalNow;
  }
});
