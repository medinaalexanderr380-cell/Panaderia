import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productosTable = pgTable("productos", {
  id: serial("id").primaryKey(),
  codigo: text("codigo").notNull().unique(),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion").notNull(),
  precioVenta: numeric("precio_venta", { precision: 10, scale: 2 }).notNull(),
  precioCosto: numeric("precio_costo", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").notNull().default(0),
  stockMinimo: integer("stock_minimo").notNull().default(5),
  unidad: text("unidad").notNull().default("unidad"),
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
  actualizadoEn: timestamp("actualizado_en").notNull().defaultNow(),
});

export const insertProductoSchema = createInsertSchema(productosTable).omit({ id: true, creadoEn: true, actualizadoEn: true });
export type InsertProducto = z.infer<typeof insertProductoSchema>;
export type Producto = typeof productosTable.$inferSelect;
