import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gastosTable = pgTable("gastos", {
  id: serial("id").primaryKey(),
  descripcion: text("descripcion").notNull(),
  monto: numeric("monto", { precision: 10, scale: 2 }).notNull(),
  fecha: timestamp("fecha").notNull().defaultNow(),
});

export const insertGastoSchema = createInsertSchema(gastosTable).omit({ id: true }).extend({
  monto: z.coerce.number().positive(),
  descripcion: z.string().min(1),
});
export type InsertGasto = z.infer<typeof insertGastoSchema>;
export type Gasto = typeof gastosTable.$inferSelect;
