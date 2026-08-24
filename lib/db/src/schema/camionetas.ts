import { pgTable, serial, text, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productosTable } from "./productos";

export const camionetasTable = pgTable("camionetas", {
  id: serial("id").primaryKey(),
  codigo: text("codigo").notNull().unique(),
  nombre: text("nombre").notNull(),
  activo: boolean("activo").notNull().default(true),
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
});

export const migracionesCamionetasTable = pgTable("migraciones_camionetas", {
  id: serial("id").primaryKey(),
  version: text("version").notNull().unique(),
  aplicadoEn: timestamp("aplicado_en").notNull().defaultNow(),
});

export const stockCamionetaTable = pgTable("stock_camioneta", {
  id: serial("id").primaryKey(),
  camionetaId: integer("camioneta_id").notNull().references(() => camionetasTable.id, { onDelete: "cascade" }),
  productoCodigo: text("producto_codigo").notNull().references(() => productosTable.codigo),
  cantidad: integer("cantidad").notNull().default(0),
}, (table) => ({
  camionetaProductoUnico: unique("stock_camioneta_camioneta_producto_unico").on(
    table.camionetaId,
    table.productoCodigo,
  ),
}));

export const insertCamionetaSchema = createInsertSchema(camionetasTable).omit({
  id: true,
  creadoEn: true,
});
export type InsertCamioneta = z.infer<typeof insertCamionetaSchema>;
export type Camioneta = typeof camionetasTable.$inferSelect;
export type StockCamioneta = typeof stockCamionetaTable.$inferSelect;