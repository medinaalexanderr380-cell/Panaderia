CREATE TABLE "proveedores" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"contacto" text,
	"telefono" text,
	"email" text,
	"direccion" text,
	"notas" text,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	"actualizado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text NOT NULL,
	"precio_venta" numeric(10, 2) NOT NULL,
	"precio_costo" numeric(10, 2) NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"stock_camioneta" integer DEFAULT 0 NOT NULL,
	"stock_camioneta_michel" integer DEFAULT 0 NOT NULL,
	"stock_camioneta_david" integer DEFAULT 0 NOT NULL,
	"stock_minimo" integer DEFAULT 5 NOT NULL,
	"unidad" text DEFAULT 'unidad' NOT NULL,
	"proveedor_id" integer,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	"actualizado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "productos_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "items_venta" (
	"id" serial PRIMARY KEY NOT NULL,
	"venta_id" integer NOT NULL,
	"producto_codigo" text NOT NULL,
	"producto_nombre" text NOT NULL,
	"cantidad" integer NOT NULL,
	"precio_unitario" numeric(10, 2) NOT NULL,
	"precio_costo" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"tipo" text DEFAULT 'producto' NOT NULL,
	"combo_id" integer,
	"selecciones" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ventas" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendedor" text NOT NULL,
	"fecha" timestamp DEFAULT now() NOT NULL,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"ganancia" numeric(10, 2) DEFAULT '0' NOT NULL,
	"origen" text DEFAULT 'panaderia' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compras" (
	"id" serial PRIMARY KEY NOT NULL,
	"proveedor_id" integer,
	"proveedor" text NOT NULL,
	"fecha" timestamp DEFAULT now() NOT NULL,
	"total_invertido" numeric(10, 2) DEFAULT '0' NOT NULL,
	"notas" text
);
--> statement-breakpoint
CREATE TABLE "items_compra" (
	"id" serial PRIMARY KEY NOT NULL,
	"compra_id" integer NOT NULL,
	"producto_codigo" text NOT NULL,
	"producto_nombre" text NOT NULL,
	"cantidad" integer NOT NULL,
	"precio_costo" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"nombre" text NOT NULL,
	"password_hash" text NOT NULL,
	"rol" text DEFAULT 'vendedor' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "perdidas" (
	"id" serial PRIMARY KEY NOT NULL,
	"producto_codigo" text NOT NULL,
	"producto_nombre" text NOT NULL,
	"cantidad" integer NOT NULL,
	"costo_total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"motivo" text DEFAULT 'caducado' NOT NULL,
	"origen" text DEFAULT 'panaderia' NOT NULL,
	"registrado_por" text NOT NULL,
	"fecha" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gastos" (
	"id" serial PRIMARY KEY NOT NULL,
	"descripcion" text NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"fecha" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "combo_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"combo_id" integer NOT NULL,
	"producto_codigo" text NOT NULL,
	"cantidad" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "combos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text DEFAULT '' NOT NULL,
	"precio_venta" numeric(10, 2) NOT NULL,
	"tipo" text DEFAULT 'fijo' NOT NULL,
	"cantidad_eleccion" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	"actualizado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "camionetas" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "camionetas_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "migraciones_camionetas" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"aplicado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "migraciones_camionetas_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "stock_camioneta" (
	"id" serial PRIMARY KEY NOT NULL,
	"camioneta_id" integer NOT NULL,
	"producto_codigo" text NOT NULL,
	"cantidad" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "stock_camioneta_camioneta_producto_unico" UNIQUE("camioneta_id","producto_codigo")
);
--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items_venta" ADD CONSTRAINT "items_venta_venta_id_ventas_id_fk" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items_venta" ADD CONSTRAINT "items_venta_combo_id_combos_id_fk" FOREIGN KEY ("combo_id") REFERENCES "public"."combos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_proveedor_id_proveedores_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items_compra" ADD CONSTRAINT "items_compra_compra_id_compras_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_combo_id_combos_id_fk" FOREIGN KEY ("combo_id") REFERENCES "public"."combos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_producto_codigo_productos_codigo_fk" FOREIGN KEY ("producto_codigo") REFERENCES "public"."productos"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_camioneta" ADD CONSTRAINT "stock_camioneta_camioneta_id_camionetas_id_fk" FOREIGN KEY ("camioneta_id") REFERENCES "public"."camionetas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_camioneta" ADD CONSTRAINT "stock_camioneta_producto_codigo_productos_codigo_fk" FOREIGN KEY ("producto_codigo") REFERENCES "public"."productos"("codigo") ON DELETE no action ON UPDATE no action;