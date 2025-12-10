import express from "express";
import routeRoutes from "./routes/routeRoutes.js";
import { initRouteOptimizer } from "./services/routeOptimizerService.js";
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/rotas", routeRoutes);

const PORT = process.env.PORT || 3000;

initRouteOptimizer()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("Erro inicializando otimizador:", err);
    process.exit(1);
  });
