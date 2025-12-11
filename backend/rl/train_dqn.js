// train_dqn.js
import * as tf from "@tensorflow/tfjs"; 
import { createQNetwork } from "../model/dqn_model.js";
import ReplayBuffer from "./replayBuffer.js";
import { buildState, VEHICLES, computeCost } from "./env.js"; 
import { loadAllData } from "../services/dataLoader.js";
import fs from "fs";
import path from "path";

const N_ACTIONS = VEHICLES.length;
const REWARD_SCALE = 100.0; 
const INPUT_DIM = 9; 

const STEPS_PER_EPISODE = 10;   // nº de entregas simuladas por episódio
const WARMUP_EPISODES     = 300;

function getNormalizedReward(c) {
  return -(c / REWARD_SCALE);
}

// helpers de disponibilidade (definidos aqui ou importados)
function atualizarDisponibilidade(disponibilidade, vehicle) {
  const novo = { ...disponibilidade };

  if (vehicle === "moto")      novo.motos_ativas      = Math.max(0, (novo.motos_ativas || 0) - 1);
  if (vehicle === "bike")      novo.bikes_ativas      = Math.max(0, (novo.bikes_ativas || 0) - 1);
  if (vehicle === "van")       novo.vans_ativas       = Math.max(0, (novo.vans_ativas || 0) - 1);
  if (vehicle === "caminhao")  novo.caminhoes_ativos  = Math.max(0, (novo.caminhoes_ativos || 0) - 1);

  return novo;
}

function frotaEsgotada(disponibilidade) {
  return (
    (disponibilidade.motos_ativas      || 0) <= 0 &&
    (disponibilidade.bikes_ativas      || 0) <= 0 &&
    (disponibilidade.vans_ativas       || 0) <= 0 &&
    (disponibilidade.caminhoes_ativos  || 0) <= 0
  );
}

// gerarCenario = o mesmo que você já tem
function gerarCenario() {
  const p = Math.random();
  let distKm, urgencia, tipoCarga;

  if (p < 0.25) {
    distKm = Math.random() * 4.5 + 0.1;
    urgencia = Math.random() < 0.5;
    const rC = Math.random();
    if (rC < 0.4) tipoCarga = "pequena";
    else if (rC < 0.7) tipoCarga = "media";
    else tipoCarga = "grande";
  } else if (p < 0.50) {
    distKm = Math.random() * 75 + 5.1;
    urgencia = Math.random() < 0.3;
    const rC = Math.random();
    if (rC < 0.33) tipoCarga = "pequena"; 
    else if (rC < 0.66) tipoCarga = "media";
    else tipoCarga = "grande";
  } else if (p < 0.75) {
    distKm = Math.random() * 40 + 80.1;
    urgencia = Math.random() < 0.5;
    tipoCarga = Math.random() < 0.2 ? "pequena" : "grande"; 
  } else {
    distKm = Math.random() * 180 + 120.1;
    urgencia = Math.random() < 0.4;
    tipoCarga = "grande";
  }

  return { distKm, urgencia, tipoCarga };
}

async function train() {
  console.log("🚀 Iniciando treinamento DQN Multi-step...");

  const nEpisodes   = 8000;
  const batchSize   = 64;
  const gamma       = 0.90; 
  const learningRate = 0.001;
  
  const epsilonStart = 1.0;
  const epsilonEnd   = 0.05;
  const epsilonDecay = 0.9994; 
  let epsilon        = epsilonStart;

  // custos base
  let veiculos = [];
  try {
    const data = loadAllData();
    veiculos = data.veiculos || [];
  } catch (e) { console.warn("Usando defaults."); }

  const lastVeiculos = veiculos[veiculos.length - 1] || {};
  const baseCosts = {
    moto:     lastVeiculos.custo_operacional_moto_dia      || 20,
    bike:     lastVeiculos.custo_operacional_bike_dia      || 5,
    van:      lastVeiculos.custo_operacional_van_dia       || 100,
    caminhao: lastVeiculos.custo_operacional_caminhao_dia  || 200
  };

  const disponibilidadeInicial = {
    motos_ativas:      10,
    bikes_ativas:      5,
    vans_ativas:       2,
    caminhoes_ativos:  1
  };

  const qNet = createQNetwork(INPUT_DIM, N_ACTIONS);
  const targetNet = createQNetwork(INPUT_DIM, N_ACTIONS);
  targetNet.setWeights(qNet.getWeights());
  
  const optimizer = tf.train.adam(learningRate);
  const buffer = new ReplayBuffer(150000);

  // ==================================
  // 1) AQUECIMENTO (exploração aleatória)
  // ==================================
  console.log("🔥 Aquecendo buffer com episódios multi-step...");
  for (let ep = 0; ep < WARMUP_EPISODES; ep++) {
    let disponibilidade = { ...disponibilidadeInicial };
    let scenario = gerarCenario();

    for (let t = 0; t < STEPS_PER_EPISODE; t++) {
      const stateT = buildState({ 
        distKm: scenario.distKm,
        urgencia: scenario.urgencia,
        tipoCarga: scenario.tipoCarga,
        disponibilidade
      });

      const actionIdx = Math.floor(Math.random() * N_ACTIONS);
      const vehicle = VEHICLES[actionIdx];

      const cost = computeCost({
        vehicle,
        distKm: scenario.distKm,
        baseCosts,
        urgencia: scenario.urgencia,
        tipoCarga: scenario.tipoCarga,
        disponibilidade
      });
      const reward = getNormalizedReward(cost);

      const disponibilidadeDepois = atualizarDisponibilidade(disponibilidade, vehicle);
      const acabouFrota = frotaEsgotada(disponibilidadeDepois);
      const done = (t === STEPS_PER_EPISODE - 1) || acabouFrota;

      let nextScenario = scenario;
      if (!done) {
        nextScenario = gerarCenario();
      }

      const nextStateT = buildState({
        distKm: nextScenario.distKm,
        urgencia: nextScenario.urgencia,
        tipoCarga: nextScenario.tipoCarga,
        disponibilidade: disponibilidadeDepois
      });

      buffer.add({
        s:  stateT.arraySync()[0],
        a:  actionIdx,
        r:  reward,
        s2: nextStateT.arraySync()[0],
        done
      });

      stateT.dispose();
      nextStateT.dispose();

      disponibilidade = disponibilidadeDepois;
      scenario = nextScenario;

      if (done) break;
    }
  }

  // ======================
  // 2) TREINAMENTO RL
  // ======================
  console.log(`🏋️ Treinando por ${nEpisodes} episódios...`);

  for (let ep = 1; ep <= nEpisodes; ep++) {
    let disponibilidade = { ...disponibilidadeInicial };
    let scenario = gerarCenario();

    for (let t = 0; t < STEPS_PER_EPISODE; t++) {
      const stateT = buildState({
        distKm: scenario.distKm,
        urgencia: scenario.urgencia,
        tipoCarga: scenario.tipoCarga,
        disponibilidade
      });

      // Epsilon-greedy
      let actionIdx;
      if (Math.random() < epsilon) {
        actionIdx = Math.floor(Math.random() * N_ACTIONS);
      } else {
        const qvals = qNet.predict(stateT);
        actionIdx = qvals.argMax(1).dataSync()[0];
        qvals.dispose();
      }

      const vehicle = VEHICLES[actionIdx];

      const cost = computeCost({
        vehicle,
        distKm: scenario.distKm,
        baseCosts,
        urgencia: scenario.urgencia,
        tipoCarga: scenario.tipoCarga,
        disponibilidade
      });
      const reward = getNormalizedReward(cost);

      const disponibilidadeDepois = atualizarDisponibilidade(disponibilidade, vehicle);
      const acabouFrota = frotaEsgotada(disponibilidadeDepois);
      const done = (t === STEPS_PER_EPISODE - 1) || acabouFrota;

      let nextScenario = scenario;
      if (!done) {
        nextScenario = gerarCenario();
      }

      const nextStateT = buildState({
        distKm: nextScenario.distKm,
        urgencia: nextScenario.urgencia,
        tipoCarga: nextScenario.tipoCarga,
        disponibilidade: disponibilidadeDepois
      });

      buffer.add({
        s:  stateT.arraySync()[0],
        a:  actionIdx,
        r:  reward,
        s2: nextStateT.arraySync()[0],
        done
      });

      stateT.dispose();
      nextStateT.dispose();

      disponibilidade = disponibilidadeDepois;
      scenario = nextScenario;

      // Atualização da rede
      if (buffer.size() >= batchSize) {
        const batch = buffer.sample(batchSize);
        const states     = tf.tensor2d(batch.map(b => b.s));
        const actions    = tf.tensor1d(batch.map(b => b.a), "int32");
        const rewards    = tf.tensor1d(batch.map(b => b.r));
        const nextStates = tf.tensor2d(batch.map(b => b.s2));
        const dones      = tf.tensor1d(batch.map(b => b.done ? 1 : 0));

        const nextQ    = targetNet.predict(nextStates);
        const nextQMax = nextQ.max(1);
        const targetQ  = rewards.add(
          nextQMax.mul(tf.scalar(gamma)).mul(tf.scalar(1).sub(dones))
        );

        optimizer.minimize(() => {
          const qVals = qNet.predict(states);
          const actionMasks = tf.oneHot(actions, N_ACTIONS);
          const predQForActions = qVals.mul(actionMasks).sum(1);
          const loss = tf.losses.meanSquaredError(targetQ, predQForActions);
          qVals.dispose();
          return loss;
        });

        tf.dispose([states, actions, rewards, nextStates, dones, nextQ, nextQMax, targetQ]);
      }

      if (done) break;
    }

    if (ep % 50 === 0) {
      targetNet.setWeights(qNet.getWeights());
    }

    epsilon = Math.max(epsilonEnd, epsilon * epsilonDecay);

    // Logs de sanity check (mantendo seu estilo)
    if (ep % 1000 === 0) {
      console.log(`--- Ep ${ep} | Epsilon: ${epsilon.toFixed(2)} ---`);

      const disponibilidadeLog = { ...disponibilidadeInicial };

      const testScenarios = [
        { label: "130km/Grande/Normal", distKm: 130, urgencia: false, tipoCarga: "grande" },
        { label: "130km/Grande/Urgent", distKm: 130, urgencia: true,  tipoCarga: "grande" },
        { label: "3km/Pequena/Urgent",  distKm: 3,   urgencia: true,  tipoCarga: "pequena" },
      ];

      for (const ts of testScenarios) {
        const s = buildState({ 
          distKm: ts.distKm,
          urgencia: ts.urgencia,
          tipoCarga: ts.tipoCarga,
          disponibilidade: disponibilidadeLog
        });
        const out = qNet.predict(s);
        const q  = out.dataSync();
        const v  = VEHICLES[q.indexOf(Math.max(...q))];
        console.log(`> ${ts.label}: ${v.toUpperCase()} | Qs: [${q.map(v => v.toFixed(1)).join(", ")}]`);
        out.dispose();
        s.dispose();
      }
    }
  }

  // salvar igual você já fazia
  const saveDir = "./model/generated_dqn"; 
  if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
  
  await qNet.save(tf.io.withSaveHandler(async (artifacts) => {
    if (artifacts.weightData) fs.writeFileSync(path.join(saveDir, "weights.bin"), Buffer.from(artifacts.weightData));
    artifacts.weightData = undefined; 
    const manifest = {
      modelTopology: artifacts.modelTopology,
      format: artifacts.format,
      generatedBy: artifacts.generatedBy,
      convertedBy: artifacts.convertedBy,
      weightsManifest: [{ paths: ["./weights.bin"], weights: artifacts.weightSpecs }]
    };
    fs.writeFileSync(path.join(saveDir, "model.json"), JSON.stringify(manifest));
    return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: "JSON" } };
  }));

  console.log("✅ Modelo salvo!");
}

train().catch(console.error);
