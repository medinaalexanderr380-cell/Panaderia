import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usuariosTable = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  username: text("nombre").notNull().unique(),
  nombre: text("nombre").notNull(),
  passwordHash: text("password_hash").notNull(),
  rol: text("rol").notNull().default("vendedor"),
  activo: boolean("activo").notNull().default(true),
  creadoEn: timestamp("creado_en").notNull().defaultNow(),
});

export const insertUsuarioSchema = createInsertSchema(usuariosTable).omit({ id: true, creadoEn: true });
export type InsertUsuario = z.infer<typeof insertUsuarioSchema>;
export type Usuario = typeof usuariosTable.$inferSelect;
