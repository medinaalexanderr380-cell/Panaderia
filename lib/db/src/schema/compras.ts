import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const comprasTable = pgTable("compras", {
  id: serial("id").primaryKey(),
  proveedor: text("proveedor").notNull(),
  fecha: timestamp("fecha").notNull().defaultNow(),
  totalInvertido: numeric("total_invertido", { precision: 10, scale: 2 }).notNull().default("0"),
  notas: text("notas"),
});

export const itemsCompraTable = pgTable("items_compra", {
  id: serial("id").primaryKey(),
  compraId: integer("compra_id").notNull().references(() => comprasTable.id),
  productoCodigo: text("producto_codigo").notNull(),
  productoNombre: text("producto_nombre").notNull(),
  cantidad: integer("cantidad").notNull(),
  precioCosto: numeric("precio_costo", { precision: 10, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
});

export const insertCompraSchema = createInsertSchema(comprasTable).omit({ id: true, fecha: true });
export type InsertCompra = z.infer<typeof insertCompraSchema>;
export type Compra = typeof comprasTable.$inferSelect;
export type ItemCompra = typeof itemsCompraTable.$inferSelect;
