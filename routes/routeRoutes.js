import { Router } from "express";
import { calcularMelhorRota } from "../controllers/routeController.js";

const router = Router();

router.post("/calcular", calcularMelhorRota);

export default router;
