import * as tf from "@tensorflow/tfjs";
import { loadModel, escolherMelhorAcao } from "../model/model.js";
import { vi, describe, test, expect } from "vitest";


vi.mock("@tensorflow/tfjs");

describe("model.js", () => {
  beforeEach(() => {
    tf.loadLayersModel.mockResolvedValue({
      predict: () => ({
        arraySync: () => [[1, 5, -2, 0]] // maior valor = ação 1 = bike
      })
    });
  });

  test("loadModel carrega modelo corretamente", async () => {
    const model = await loadModel();
    expect(model).toBeDefined();
  });

  test("escolherMelhorAcao retorna a ação com maior Q-value", async () => {
    await loadModel();
    const result = await escolherMelhorAcao({
      arraySync: () => [[0,0,0,0,0,0,0,0]]
    });

    expect(result.vehicle).toBe("bike"); // índice 1
  });
});
