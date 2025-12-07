import * as tf from "@tensorflow/tfjs-node";

/**
 * Arquitetura simples: MLP -> outputs Q-values (dim = nActions)
 */

export function createQNetwork(inputDim, nActions) {
  const model = tf.sequential();
  model.add(tf.layers.dense({ inputShape: [inputDim], units: 128, activation: "relu" }));
  model.add(tf.layers.dense({ units: 128, activation: "relu" }));
  model.add(tf.layers.dense({ units: nActions })); // Q-values (linear)
  return model;
}
