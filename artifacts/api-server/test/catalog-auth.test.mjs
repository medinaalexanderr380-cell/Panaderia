import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { requireAdmin, requireAuth } from "../src/middleware/auth.ts";

function runMiddlewareChain(middlewares, session) {
  let statusCode = 200;
  let body;
  let nextIndex = 0;

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

  const next = () => {
    const middleware = middlewares[nextIndex++];
    if (middleware) middleware(req, res, next);
  };
  next();

  return { statusCode, body, nextIndex };
}

function assertCatalogRouteGuards(routePath, writeGuards) {
  const source = readFileSync(routePath, "utf8");
  assert.match(source, /router\.use\(requireAuth\)/);

  for (const guard of writeGuards) {
    assert.match(source, guard);
  }
}

const anonymous = {};
const vendedor = { userId: 2, username: "vendedor", rol: "vendedor" };

test("proveedores declara autenticación y rol admin en todas sus escrituras", () => {
  assertCatalogRouteGuards(new URL("../src/routes/proveedores.ts", import.meta.url), [
    /router\.post\("\/", requireAdmin,/,
    /router\.put\("\/:id", requireAdmin,/,
    /router\.delete\("\/:id", requireAdmin,/,
  ]);
});

test("combos declara autenticación y rol admin en todas sus escrituras", () => {
  assertCatalogRouteGuards(new URL("../src/routes/combos.ts", import.meta.url), [
    /router\.post\("\/", requireAdmin,/,
    /router\.delete\("\/:id", requireAdmin,/,
  ]);
});

test("una escritura de catálogo directa sin identidad se rechaza con 401", () => {
  const result = runMiddlewareChain([requireAuth, requireAdmin], anonymous);

  assert.equal(result.statusCode, 401);
  assert.deepEqual(result.body, { error: "No autenticado" });
  assert.equal(result.nextIndex, 1);
});

test("una escritura de catálogo directa sin rol admin se rechaza con 403", () => {
  const result = runMiddlewareChain([requireAuth, requireAdmin], vendedor);

  assert.equal(result.statusCode, 403);
  assert.deepEqual(result.body, {
    error: "Solo un administrador puede realizar esta acción",
  });
  assert.equal(result.nextIndex, 2);
});