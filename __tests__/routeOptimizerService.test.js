import { vi, describe, test, expect } from "vitest";

// 1) Mocks primeiro!
vi.mock("../services/dataLoader.js", () => ({
  loadAllData: vi.fn(() => ({
    clientes: [],
    entregas: [],
    veiculos: [],
    rotas: []
  }))
}));

vi.mock("../model/model.js", () => ({
  loadModel: vi.fn(() => ({})),
  escolherMelhorAcao: vi.fn(() => 0),
  calcularPrecoBase: vi.fn(() => 50)
}));

vi.mock("../rl/env.js", () => ({
  buildState: vi.fn(() => ({ tensor: true })),
  computeCost: vi.fn(() => 10),
  calcularDistancia: vi.fn(() => 10),
  obterCaminho: vi.fn(() => ["A", "B", "C"])
}));

// 2) Só agora o módulo sendo testado
import { obterMelhorRota, initRouteOptimizer } from "../services/routeOptimizerService.js";

// Testes
describe("routeOptimizerService", () => {
  test("obterMelhorRota retorna estrutura correta", async () => {
    const result = await obterMelhorRota({
      origem: "A",
      destino: "B",
      urgencia: false,
      tipoCarga: "geral"
    });

    expect(result).toHaveProperty("precoFinal");
    expect(result).toHaveProperty("caminho");
    expect(result.caminho.length).toBeGreaterThan(0);
  });
});
