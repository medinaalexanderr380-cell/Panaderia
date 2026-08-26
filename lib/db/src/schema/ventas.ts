import { pgTable, serial, text, integer, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { combosTable } from "./combos";

export const ventasTable = pgTable("ventas", {
  id: serial("id").primaryKey(),
  vendedor: text("vendedor").notNull(),
  fecha: timestamp("fecha").notNull().defaultNow(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  ganancia: numeric("ganancia", { precision: 10, scale: 2 }).notNull().default("0"),
  origen: text("origen").notNull().default("panaderia"),
});

export const itemsVentaTable = pgTable("items_venta", {
  id: serial("id").primaryKey(),
  ventaId: integer("venta_id").notNull().references(() => ventasTable.id),
  productoCodigo: text("producto_codigo").notNull(),
  productoNombre: text("producto_nombre").notNull(),
  cantidad: integer("cantidad").notNull(),
  precioUnitario: numeric("precio_unitario", { precision: 10, scale: 2 }).notNull(),
  precioCosto: numeric("precio_costo", { precision: 10, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  tipo: text("tipo").notNull().default("producto"),
  comboId: integer("combo_id").references(() => combosTable.id, { onDelete: "set null" }),
  selecciones: jsonb("selecciones").$type<Array<{ productoCodigo: string; productoNombre: string; cantidad: number }>>().notNull().default([]),
});

export const insertVentaSchema = createInsertSchema(ventasTable).omit({ id: true, fecha: true });
export type InsertVenta = z.infer<typeof insertVentaSchema>;
export type Venta = typeof ventasTable.$inferSelect;
export type ItemVenta = typeof itemsVentaTable.$inferSelect;
