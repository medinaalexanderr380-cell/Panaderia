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
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/proveedores", requireAuth, proveedoresRouter);
router.use("/productos", requireAuth, productosRouter);
router.use("/ventas", requireAuth, ventasRouter);
router.use("/compras", requireAuth, comprasRouter);
router.use("/reportes", requireAuth, reportesRouter);
router.use("/camioneta", camionetaRouter);
router.use("/perdidas", perdidasRouter);

export default router;
