import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import proveedoresRouter from "./proveedores";
import productosRouter from "./productos";
import ventasRouter from "./ventas";
import comprasRouter from "./compras";
import reportesRouter from "./reportes";
import camionetaRouter from "./camioneta";
import perdidasRouter from "./perdidas";
import usuariosRouter from "./usuarios";
import gastosRouter from "./gastos";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/proveedores", proveedoresRouter);
router.use("/productos", productosRouter);
router.use("/ventas", ventasRouter);
router.use("/compras", comprasRouter);
router.use("/reportes", reportesRouter);
router.use("/camioneta", camionetaRouter);
router.use("/perdidas", perdidasRouter);
router.use("/usuarios", usuariosRouter);
router.use("/gastos", gastosRouter);
router.use("/admin", adminRouter);

export default router;
