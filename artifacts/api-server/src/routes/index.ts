import { Router, type IRouter } from "express";
import healthRouter from "./health";
import proveedoresRouter from "./proveedores";
import productosRouter from "./productos";
import ventasRouter from "./ventas";
import comprasRouter from "./compras";
import reportesRouter from "./reportes";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/proveedores", proveedoresRouter);
router.use("/productos", productosRouter);
router.use("/ventas", ventasRouter);
router.use("/compras", comprasRouter);
router.use("/reportes", reportesRouter);

export default router;
