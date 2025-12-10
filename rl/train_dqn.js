import "@tensorflow/tfjs-node"
import * as tf from "@tensorflow/tfjs";
import { createQNetwork } from "../model/dqn_model.js";
import ReplayBuffer from "./replayBuffer.js";
import { buildState, VEHICLES, computeCost } from "./env.js"; // Removi rewardFromCost
import { loadAllData } from "../services/dataLoader.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const N_ACTIONS = VEHICLES.length;

// caminho absoluto
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// pasta ../model
export const modelDir = path.join(__dirname, "../model");

// pasta ../model/dqn_final
export const finalModelDir = path.join(modelDir, "dqn_final");

// caminho file:///...
export const finalModelUrl = `file://${finalModelDir.replace(/\\/g, "/")}`;

// cria dirs necessários
if (!fs.existsSync(modelDir)) fs.mkdirSync(modelDir, { recursive: true });
if (!fs.existsSync(finalModelDir)) fs.mkdirSync(finalModelDir, { recursive: true });
      // cria pasta se não existir
if (!fs.existsSync(finalModelDir)) {
  fs.mkdirSync(finalModelDir, { recursive: true });
}

async function train() {
  console.log("🚀 Iniciando treinamento DQN (Com Normalização de Reward)...");

  const nEpisodes = 4000; // Mais episódios pois agora o treino é eficaz
  const maxStepsPerEpisode = 1; 
  const batchSize = 32; // Batch menor atualiza pesos mais frequentemente
  const gamma = 0.90; 
  const learningRate = 0.001; // Adam padrão
  
  const epsilonStart = 1.0;
  const epsilonEnd = 0.05;
  const epsilonDecay = 0.999; // Decaimento bem lento para explorar muito
  let epsilon = epsilonStart;

  // --- CARREGAMENTO DE DADOS ---
  let rotas = [], veiculos = [];
  try {
      const data = loadAllData();
      rotas = data.rotas || [];
      veiculos = data.veiculos || [];
  } catch (e) {
      console.warn("⚠️ Aviso: Dados não carregados, usando defaults.");
  }

  const lastVeiculos = veiculos[veiculos.length - 1] || {};
  const baseCosts = {
    moto: lastVeiculos.custo_operacional_moto_dia || 20,
    bike: lastVeiculos.custo_operacional_bike_dia || 5,
    van: lastVeiculos.custo_operacional_van_dia || 100,
    caminhao: lastVeiculos.custo_operacional_caminhao_dia || 200
  };

  const disponibilidade = {
    motos_ativas: 10, bikes_ativas: 5, vans_ativas: 2, caminhoes_ativos: 1
  };

  const inputDim = 8; 
  const qNet = createQNetwork(inputDim, N_ACTIONS);
  const targetNet = createQNetwork(inputDim, N_ACTIONS);
  targetNet.setWeights(qNet.getWeights());

  const optimizer = tf.train.adam(learningRate);
  const buffer = new ReplayBuffer(100000);

  // --- FUNÇÃO AUXILIAR DE REWARD NORMALIZADO ---
  const getNormalizedReward = (cost) => {
      // Custo 500 vira -5.0
      // Custo 20 vira -0.2
      return -(cost / REWARD_SCALE);
  };

  // --- 1. AQUICIMENTO DO BUFFER (Exploração Pura) ---
  console.log("🔥 Aquecendo buffer...");
  for (let i=0; i<3000; i++) {
    const dist = Math.random() * 25; 
    const urgencia = Math.random() < 0.3;
    const tipoCarga = Math.random() < 0.5 ? "pequena" : "grande"; 
    
    const state = buildState({ distKm: dist, urgencia, tipoCarga, disponibilidade });
    const actionIdx = Math.floor(Math.random() * N_ACTIONS);
    const vehicle = VEHICLES[actionIdx];
    
    // Calcula custo real
    const cost = computeCost({ vehicle, distKm: dist, baseCosts, urgencia, tipoCarga });
    // Normaliza para a rede não explodir
    const reward = getNormalizedReward(cost);
    
    buffer.add({
      s: state.arraySync()[0],
      a: actionIdx,
      r: reward,
      s2: state.arraySync()[0], 
      done: true
    });
  }

  // --- 2. LOOP DE TREINAMENTO ---
  console.log(`🏋️ Treinando por ${nEpisodes} episódios...`);
  
  for (let ep=1; ep<=nEpisodes; ep++) {
    const dist = Math.random() * 30; 
    const urg = Math.random() < 0.3;
    const tipo = Math.random() < 0.5 ? "pequena" : "grande";

    const stateT = buildState({ distKm: dist, urgencia: urg, tipoCarga: tipo, disponibilidade });

    let actionIdx;
    if (Math.random() < epsilon) {
      actionIdx = Math.floor(Math.random() * N_ACTIONS);
    } else {
      const qvals = qNet.predict(stateT);
      actionIdx = qvals.argMax(1).dataSync()[0];
    }

    const vehicle = VEHICLES[actionIdx];
    const cost = computeCost({ vehicle, distKm: dist, baseCosts, urgencia: urg, tipoCarga: tipo });
    const reward = getNormalizedReward(cost); // <--- AQUI ESTÁ O SEGREDO

    buffer.add({
      s: stateT.arraySync()[0],
      a: actionIdx,
      r: reward,
      s2: stateT.arraySync()[0],
      done: true
    });

    stateT.dispose(); 

    if (buffer.size() >= batchSize) {
      const batch = buffer.sample(batchSize);
      const states = tf.tensor2d(batch.map(b => b.s));
      const actions = tf.tensor1d(batch.map(b => b.a), "int32");
      const rewards = tf.tensor1d(batch.map(b => b.r));
      const nextStates = tf.tensor2d(batch.map(b => b.s2));
      const dones = tf.tensor1d(batch.map(b => b.done ? 1 : 0));

      const nextQ = targetNet.predict(nextStates);
      const nextQMax = nextQ.max(1);
      const targetQ = rewards.add(nextQMax.mul(tf.scalar(gamma)).mul(tf.scalar(1).sub(dones)));

      optimizer.minimize(() => {
        const qVals = qNet.predict(states);
        const actionMasks = tf.oneHot(actions, N_ACTIONS);
        const predQForActions = qVals.mul(actionMasks).sum(1);
        return tf.losses.meanSquaredError(targetQ, predQForActions);
      });

      tf.dispose([states, actions, rewards, nextStates, dones, nextQ, nextQMax, targetQ]);
    }

    if (ep % 50 === 0) targetNet.setWeights(qNet.getWeights());

    epsilon = Math.max(epsilonEnd, epsilon * epsilonDecay);

    if (ep % 50 === 0) {
      console.log(`Episode ${ep}/${nEpisodes} - epReward=${epReward.toFixed(2)} - epsilon=${epsilon.toFixed(3)} - buffer=${buffer.size()}`);
    }
  }

  // salvar modelo final
  await qNet.save(finalModelUrl);
  console.log("Training complete. Model saved to ", finalModelUrl);
}

train().catch(console.error);