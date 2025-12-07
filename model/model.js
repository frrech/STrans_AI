import * as tf from "@tensorflow/tfjs";
import { createQNetwork } from "./dqn_model.js";
import { VEHICLES } from "../rl/env.js";

let qModel = null;

export async function loadModel(modelPath = "./model/dqn_final") {
  try {
    qModel = await tf.loadLayersModel(`file://${modelPath}/model.json`);
    console.log("Modelo carregado de", modelPath);
  } catch (err) {
    console.warn("Não foi possível carregar modelo salvo. Inicializando novo.");
    qModel = createQNetwork(8, VEHICLES.length); // inicializa random
  }
  return qModel;
}

export async function escolherMelhorAcao(stateTensor) {
  if (!qModel) throw new Error("Modelo não carregado. Chame loadModel()");
  const qvals = qModel.predict(stateTensor).arraySync()[0];
  const bestIdx = qvals.indexOf(Math.max(...qvals));
  const bestVehicle = VEHICLES[bestIdx];
  return { actionIndex: bestIdx, vehicle: bestVehicle, qvals };
}
