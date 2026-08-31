# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — apply non-destructive DB schema changes (dev only)
- `pnpm run validate:db-deployment` — validate the schema/deployment ordering safeguards
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Safe database update order

1. Update the Drizzle schema source and generate the checked-in migration artifacts under `lib/db/drizzle/`.
2. After the task is merged, `scripts/post-merge.sh` installs the locked dependencies and runs `pnpm --filter @workspace/db run push` against the development database.
3. Verify the application in development. The development sync is intentionally non-forced: it applies additive changes and stops on potentially destructive changes instead of truncating historical sales.
4. Publish the application. Replit compares development and production, shows possible renames for confirmation, and applies the approved schema diff to production before starting the new version.

The API production build and startup do not run database DDL. Do not add `db:push`, `drizzle-kit push`, or startup-time `ALTER TABLE`/`CREATE TABLE` commands to those paths. If Publish reports a destructive or ambiguous change, resolve it in the Publish UI before publishing rather than bypassing the safeguard.

## Application: Sistema de Panificación

A full-stack bakery management system with:

### Features
- **Proveedores**: CRUD for suppliers with contact info, cost tracking, and purchase history per supplier
- **Productos**: Product catalog with unique codes, descriptions, stock, cost/sale price, and supplier assignment
- **Ventas (POS)**: Point of sale with barcode/code entry, cart management, seller tracking. History grouped by day with per-day totals (sales + profit + margin)
- **Compras**: Purchase register tied to suppliers, stock replenishment with cost tracking
- **Reportes**: Financial summary (investment vs revenue vs profit), top products, sales by day chart, seller performance
- **Export**: CSV download per day showing all sales + profit breakdown (Excel-compatible with BOM)
- **Delete**: Individual sale deletion (restores stock) and full-day deletion with confirmation

### DB Schema
Tables: `proveedores`, `productos`, `ventas`, `items_venta`, `compras`, `items_compra`

### API Routes
- `GET/POST /api/proveedores` — suppliers CRUD
- `GET/PUT/DELETE /api/proveedores/:id` — single supplier
- `GET /api/proveedores/:id/productos` — supplier's products
- `GET /api/proveedores/:id/compras` — supplier's purchases
- `GET /api/proveedores/:id/resumen` — supplier financial summary
- `GET/POST /api/productos` — products CRUD
- `GET/PUT/DELETE /api/productos/:codigo` — single product by code
- `GET/POST /api/ventas` — sales
- `GET /api/ventas/dias` — all days with sales and daily totals
- `GET/DELETE /api/ventas/dia/:fecha` — specific day's sales / delete all
- `GET /api/ventas/dia/:fecha/exportar` — CSV export for a day
- `GET/DELETE /api/ventas/:id` — single sale
- `GET/POST /api/compras` — purchases
- `GET /api/reportes/resumen` — financial summary
- `GET /api/reportes/top-productos` — top selling products
- `GET /api/reportes/ventas-por-dia` — sales grouped by day
- `GET /api/reportes/vendedores` — seller performance
- `GET /api/reportes/stock-bajo` — low stock products

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
