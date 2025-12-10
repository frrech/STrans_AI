import request from "supertest";
import express from "express";
import routeRoutes from "../routes/routeRoutes.js";
import * as controller from "../controllers/routeController.js";
import { vi, describe, test, expect } from "vitest";

vi.mock("../controllers/routeController.js");

const app = express();
app.use(express.json());
app.use("/api/rotas", routeRoutes);

describe("routeRoutes", () => {
  test("POST /api/rotas/calcular chama o controller", async () => {
    controller.calcularMelhorRota.mockImplementation((req, res) =>
      res.json({ ok: true })
    );

    const res = await request(app)
      .post("/api/rotas/calcular")
      .send({ origem: "A", destino: "B" });

    expect(res.body.ok).toBe(true);
  });
});
