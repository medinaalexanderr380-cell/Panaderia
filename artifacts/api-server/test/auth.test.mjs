import assert from "node:assert/strict";
import test from "node:test";
import { requireAdmin, requireAuth } from "../src/middleware/auth.ts";

function runMiddleware(middleware, session) {
  let statusCode = 200;
  let body;
  let nextCalled = false;

  const req = { session };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      body = value;
      return this;
    },
  };

  middleware(req, res, () => {
    nextCalled = true;
  });

  return { statusCode, body, nextCalled };
}

test("requireAuth rejects a request without a verified server session", () => {
  const result = runMiddleware(requireAuth, {});

  assert.equal(result.statusCode, 401);
  assert.deepEqual(result.body, { error: "No autenticado" });
  assert.equal(result.nextCalled, false);
});

test("requireAuth accepts a verified server session", () => {
  const result = runMiddleware(requireAuth, {
    userId: 2,
    username: "vendedor",
    rol: "vendedor",
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body, undefined);
  assert.equal(result.nextCalled, true);
});

test("requireAdmin returns 401 when no identity is present", () => {
  const result = runMiddleware(requireAdmin, { rol: "admin" });

  assert.equal(result.statusCode, 401);
  assert.deepEqual(result.body, { error: "No autenticado" });
  assert.equal(result.nextCalled, false);
});

test("requireAdmin rejects an authenticated non-administrator", () => {
  const result = runMiddleware(requireAdmin, {
    userId: 2,
    username: "vendedor",
    rol: "vendedor",
  });

  assert.equal(result.statusCode, 403);
  assert.deepEqual(result.body, {
    error: "Solo un administrador puede realizar esta acción",
  });
  assert.equal(result.nextCalled, false);
});

test("requireAdmin accepts an authenticated administrator", () => {
  const result = runMiddleware(requireAdmin, {
    userId: 1,
    username: "admin",
    rol: "admin",
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.body, undefined);
  assert.equal(result.nextCalled, true);
});