import { calcularMelhorRota } from "../controllers/routeController.js";
import * as service from "../services/routeOptimizerService.js";
import { vi, describe, test, expect } from "vitest";

vi.mock("../services/routeOptimizerService.js");

describe("routeController", () => {
  test("retorna erro 400 se origem/destino não existirem", async () => {
    const req = { body: { destino: "B" } };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await calcularMelhorRota(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("retorna dados de rota do serviço", async () => {
    service.obterMelhorRota.mockResolvedValue({ escolha: "moto" });

    const req = { body: { origem: "A", destino: "B" } };
    const res = { json: vi.fn() };

    await calcularMelhorRota(req, res);
    expect(res.json).toHaveBeenCalledWith({ escolha: "moto" });
  });
});
