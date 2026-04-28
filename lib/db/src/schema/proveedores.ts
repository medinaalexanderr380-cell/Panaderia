import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const proveedoresTable = pgTable("proveedores", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  contacto: text("contacto"),
  telefono: text("telefono"),
  email: text("email"),
  direccion: text("direccion"),
  notas: text("notas"),
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
  actualizadoEn: timestamp("actualizado_en").notNull().defaultNow(),
});

export const insertProveedorSchema = createInsertSchema(proveedoresTable).omit({ id: true, creadoEn: true, actualizadoEn: true });
export type InsertProveedor = z.infer<typeof insertProveedorSchema>;
export type Proveedor = typeof proveedoresTable.$inferSelect;
