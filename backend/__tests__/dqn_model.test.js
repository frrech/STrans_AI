import { createQNetwork } from "../model/dqn_model.js";

describe("DQN Model", () => {
  test("cria uma rede neural com as camadas corretas", () => {
    const model = createQNetwork(8, 4); // 8 entradas, 4 ações
    expect(model.layers.length).toBe(3);
    expect(model.layers[0].units).toBe(128);
    expect(model.layers[2].units).toBe(4);
  });
});
