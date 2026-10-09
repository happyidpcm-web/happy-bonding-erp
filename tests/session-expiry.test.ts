import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeJwt, jwtVerify } from "jose";

// Token tests do not connect to a database or use live credentials.
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/session_test";
process.env.JWT_SECRET = "session-expiry-test-only-secret";
const { createToken } = await import("../server/auth.ts");
const key = new TextEncoder().encode(process.env.JWT_SECRET);

test("login stays valid across days and expires exactly seven days after login", async () => {
  const token = await createToken({ userId: "test-user", organizationId: "test-org", branchIds: ["test-branch"], permissions: ["sales.write"], tokenVersion: 0 });
  const payload = decodeJwt(token);
  assert.equal(payload.exp! - payload.iat!, 7 * 24 * 60 * 60);
  for (const seconds of [9 * 60 * 60, 24 * 60 * 60, 6 * 24 * 60 * 60, 7 * 24 * 60 * 60 - 1]) {
    const verified = await jwtVerify(token, key, { currentDate: new Date((payload.iat! + seconds) * 1000) });
    assert.equal(verified.payload.sub, payload.sub);
    assert.equal(verified.payload.userId, "test-user");
  }
  await assert.rejects(
    jwtVerify(token, key, { currentDate: new Date(payload.exp! * 1000) }),
    { code: "ERR_JWT_EXPIRED" },
  );
});
