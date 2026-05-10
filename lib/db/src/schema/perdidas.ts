import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const perdidasTable = pgTable("perdidas", {
  id: serial("id").primaryKey(),
  productoCodigo: text("producto_codigo").notNull(),
  productoNombre: text("producto_nombre").notNull(),
  cantidad: integer("cantidad").notNull(),
  costoTotal: numeric("costo_total", { precision: 10, scale: 2 }).notNull().default("0"),
  motivo: text("motivo").notNull().default("caducado"),
  origen: text("origen").notNull().default("panaderia"),
  registradoPor: text("registrado_por").notNull(),
  fecha: timestamp("fecha").notNull().defaultNow(),
});

export const insertPerdidaSchema = createInsertSchema(perdidasTable).omit({ id: true, fecha: true });
export type InsertPerdida = z.infer<typeof insertPerdidaSchema>;
export type Perdida = typeof perdidasTable.$inferSelect;
