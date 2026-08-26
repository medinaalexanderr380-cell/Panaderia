import { pgTable, serial, text, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productosTable } from "./productos";

export const combosTable = pgTable("combos", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion").notNull().default(""),
  precioVenta: numeric("precio_venta", { precision: 10, scale: 2 }).notNull(),
  tipo: text("tipo").notNull().default("fijo"),
  cantidadEleccion: integer("cantidad_eleccion").notNull().default(0),
  activo: boolean("activo").notNull().default(true),
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
  actualizadoEn: timestamp("actualizado_en").notNull().defaultNow(),
});

export const comboItemsTable = pgTable("combo_items", {
  id: serial("id").primaryKey(),
  comboId: integer("combo_id").notNull().references(() => combosTable.id, { onDelete: "cascade" }),
  productoCodigo: text("producto_codigo").notNull().references(() => productosTable.codigo),
  cantidad: integer("cantidad").notNull().default(1),
});

export const insertComboSchema = createInsertSchema(combosTable).omit({
  id: true,
  creadoEn: true,
  actualizadoEn: true,
});
export type InsertCombo = z.infer<typeof insertComboSchema>;
export type Combo = typeof combosTable.$inferSelect;
export type ComboItem = typeof comboItemsTable.$inferSelect;