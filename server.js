import express from "express";
import routeRoutes from "./routes/routeRoutes.js";
import { initRouteOptimizer } from "./services/routeOptimizerService.js";

const app = express();
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
