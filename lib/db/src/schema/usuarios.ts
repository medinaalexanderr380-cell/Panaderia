import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usuariosTable = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  nombre: text("nombre"), // Quítale el .notNull() por si acaso está vacío en la base
  passwordHash: text("password_hash"),
  clave_venta: text("clave_venta").notNull(), // <-- Agrega esta línea que te falta
  rol: text("rol").notNull().default("vendedor"),
  activo: boolean("activo").notNull().default(true),
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
});

export const insertUsuarioSchema = createInsertSchema(usuariosTable).omit({ id: true, creadoEn: true });
export type InsertUsuario = z.infer<typeof insertUsuarioSchema>;
export type Usuario = typeof usuariosTable.$inferSelect;
