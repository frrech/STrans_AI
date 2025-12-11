// run_scenarios_test.js
import * as tf from "@tensorflow/tfjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { VEHICLES, buildState, computeCost } from "./rl/env.js";
import { TEST_SCENARIOS } from "./test_scenarios.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega o modelo do disco SEM usar tfjs-node (só @tensorflow/tfjs + fs)
async function loadModelFromDisk() {
  const baseDir = path.join(__dirname, "model", "generated_dqn");
  const modelJsonPath = path.join(baseDir, "model.json");

  console.log("Carregando JSON do modelo em:", modelJsonPath);

  const modelJson = JSON.parse(fs.readFileSync(modelJsonPath, "utf8"));

  // Pelo seu esquema de save, tem 1 weightsManifest com 1 path: ["./weights.bin"]
  const weightsRelPath = modelJson.weightsManifest[0].paths[0]; // "./weights.bin"
  const weightsPath = path.join(baseDir, weightsRelPath);

  console.log("Carregando pesos em:", weightsPath);

  const weightBuffer = fs.readFileSync(weightsPath);
  const weightData = weightBuffer.buffer; // ArrayBuffer
  const weightSpecs = modelJson.weightsManifest[0].weights;

  // IOHandler custom que devolve os artifacts na memória
  const handler = {
    load: async () => ({
      modelTopology: modelJson.modelTopology,
      weightSpecs,
      weightData,
    }),
  };

  const model = await tf.loadLayersModel(handler);
  console.log("✅ Modelo carregado da memória!");
  return model;
}

function argMax(array) {
  let maxVal = -Infinity;
  let idx = -1;
  array.forEach((v, i) => {
    if (v > maxVal) {
      maxVal = v;
      idx = i;
    }
  });
  return idx;
}

/**
 * Calcula a melhor escolha segundo o professor (computeCost)
 * Retorna { bestVehicle, costsPorVeiculo }
 */
function getRuleBasedBestChoice({ distKm, urgencia, tipoCarga, disponibilidade, baseCosts }) {
  const costs = {};
  VEHICLES.forEach((v) => {
    const c = computeCost({
      vehicle: v,
      distKm,
      baseCosts,
      urgencia,
      tipoCarga,
      disponibilidade,
    });
    costs[v] = c;
  });

  const entries = Object.entries(costs);
  entries.sort((a, b) => a[1] - b[1]); // menor custo primeiro
  const bestVehicle = entries[0][0];

  return { bestVehicle, costs };
}

async function run() {
  const model = await loadModelFromDisk();

  // baseCosts: use os mesmos do treino (aqui fixei, mas pode importar da mesma fonte do train)
  const baseCosts = {
    moto: 20,
    bike: 5,
    van: 100,
    caminhao: 200,
  };

  console.log("\n==================== TESTE DE CENÁRIOS ====================\n");

  for (const scenario of TEST_SCENARIOS) {
    const { id, label, distKm, urgencia, tipoCarga, disponibilidade, expected } = scenario;

    const stateT = buildState({ distKm, urgencia, tipoCarga, disponibilidade });
    const out = model.predict(stateT);
    const qvals = out.dataSync(); // [Q_moto, Q_bike, Q_van, Q_caminhao]

    const modelIdx = argMax(Array.from(qvals));
    const modelVehicle = VEHICLES[modelIdx];

    out.dispose();
    stateT.dispose();

    const { bestVehicle: ruleVehicle, costs } = getRuleBasedBestChoice({
      distKm,
      urgencia,
      tipoCarga,
      disponibilidade,
      baseCosts,
    });

    console.log(`\n[${id}] ${label}`);
    console.log(` Estado: dist=${distKm}km | urgencia=${urgencia} | tipoCarga=${tipoCarga}`);
    console.log(` Disponibilidade:`, disponibilidade);
    console.log(
      ` - Regra (computeCost):     ${ruleVehicle.toUpperCase()}  | custos=${JSON.stringify(
        costs,
        null,
        2
      )}`
    );
    console.log(
      ` - Modelo (IA / argmaxQ):   ${modelVehicle.toUpperCase()}  | Qs=[${qvals
        .map((v) => v.toFixed(2))
        .join(", ")}]`
    );
    if (expected) {
      console.log(` - Esperado (negócio):      ${expected.toUpperCase()}`);
    }

    const okRegra = modelVehicle === ruleVehicle;
    const okExpected = expected ? modelVehicle === expected : "n/a";
    console.log(` ✔ Bateu com regra?    ${okRegra ? "SIM" : "NÃO"}`);
    if (expected) {
      console.log(` ✔ Bateu com esperado? ${okExpected ? "SIM" : "NÃO"}`);
    }
    console.log("-----------------------------------------------------------");
  }

  console.log("\n✅ Testes finalizados.");
}

run().catch(console.error);
