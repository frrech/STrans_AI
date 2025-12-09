import "@tensorflow/tfjs-node"
import * as tf from "@tensorflow/tfjs";
import { createQNetwork } from "../model/dqn_model.js";
import ReplayBuffer from "./replayBuffer.js";
import { buildState, VEHICLES, computeCost, rewardFromCost } from "./env.js";
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
  // hiperparâmetros (ajuste conforme recursos)
  const nEpisodes = 2000;
  const maxStepsPerEpisode = 10;
  const batchSize = 64;
  const gamma = 0.99;
  const learningRate = 1e-3;
  const epsilonStart = 1.0;
  const epsilonEnd = 0.05;
  const epsilonDecay = 0.995;
  let epsilon = epsilonStart;

  // carregar dados para simular ambiente (distâncias, disponibilidade, custos)
  const { rotas, veiculos } = loadAllData();

  // usamos o último snapshot de veiculos/rotas para disponibilidade / custos
  const lastVeiculos = veiculos[veiculos.length - 1] || {};
  const lastRotas = rotas[rotas.length - 1] || {};

  const baseCosts = {
    moto: lastVeiculos.custo_operacional_moto_dia || 20,
    bike: lastVeiculos.custo_operacional_bike_dia || 5,
    van: lastVeiculos.custo_operacional_van_dia || 100,
    caminhao: lastVeiculos.custo_operacional_caminhao_dia || 200
  };

  const disponibilidade = {
    motos_ativas: lastVeiculos.motos_ativas || 10,
    bikes_ativas: lastVeiculos.bikes_ativas || 5,
    vans_ativas: lastVeiculos.vans_ativas || 2,
    caminhoes_ativos: lastVeiculos.caminhoes_ativos || 1
  };

  const inputDim = 8; // conforme buildState
  const qNet = createQNetwork(inputDim, N_ACTIONS);
  const targetNet = createQNetwork(inputDim, N_ACTIONS);
  targetNet.setWeights(qNet.getWeights()); // sync

  const optimizer = tf.train.adam(learningRate);
  const buffer = new ReplayBuffer(200000);

  // Fill replay buffer with some random transitions (exploration)
  for (let i=0;i<5000;i++) {
    // gerar um estado aleatório de simulação para encher buffer
    const dist = Math.random()*20; // 0-20km
    const urgencia = Math.random()<0.2;
    const tipoCarga = Math.random()<0.7 ? "pequena":"grande";
    const state = buildState({ distKm: dist, urgencia, tipoCarga, disponibilidade });
    // ação aleatória
    const actionIdx = Math.floor(Math.random()*N_ACTIONS);
    const vehicle = VEHICLES[actionIdx];
    const cost = computeCost({ vehicle, distKm: dist, tempoH: dist/30, baseCosts, pedagio:0, urgencia });
    const reward = rewardFromCost(cost);
    const nextState = buildState({ distKm: dist + (Math.random()-0.5)*2, urgencia, tipoCarga, disponibilidade });

    buffer.add({
      s: state.arraySync()[0],
      a: actionIdx,
      r: reward,
      s2: nextState.arraySync()[0],
      done: false
    });
  }

  console.log("Starting training... bufferSize=", buffer.size());

  for (let ep=1; ep<=nEpisodes; ep++) {
    // simular episódio
    let epReward = 0;
    // sample a random 'delivery' scenario (dist, tipo, urgencia)
    let dist = Math.random()*25;
    let urg = Math.random() < 0.2;
    let tipo = Math.random() < 0.7 ? "pequena":"grande";

    let stateT = buildState({ distKm: dist, urgencia: urg, tipoCarga: tipo, disponibilidade });

    for (let step=0; step<maxStepsPerEpisode; step++) {
      // epsilon-greedy
      let actionIdx;
      if (Math.random() < epsilon) {
        actionIdx = Math.floor(Math.random()*N_ACTIONS);
      } else {
        const qvals = qNet.predict(stateT).arraySync()[0];
        actionIdx = qvals.indexOf(Math.max(...qvals));
      }

      const vehicle = VEHICLES[actionIdx];
      const cost = computeCost({ vehicle, distKm: dist, tempoH: dist/30, baseCosts, pedagio:0, urgencia: urg });
      const reward = rewardFromCost(cost);

      // next state - small random walk
      const nextDist = Math.max(0, dist + (Math.random()-0.5)*3);
      const nextStateT = buildState({ distKm: nextDist, urgencia: urg, tipoCarga: tipo, disponibilidade });

      const done = true; // cada decision aqui é um episódio curto (one-step)
      buffer.add({
        s: stateT.arraySync()[0],
        a: actionIdx,
        r: reward,
        s2: nextStateT.arraySync()[0],
        done
      });

      dist = nextDist;
      stateT = nextStateT;
      epReward += reward;
    }

    // treinamento por batch
    if (buffer.size() >= batchSize) {
      const batch = buffer.sample(batchSize);
      // preparar tensors
      const states = tf.tensor2d(batch.map(b => b.s));
      const actions = tf.tensor1d(batch.map(b => b.a), "int32");
      const rewards = tf.tensor1d(batch.map(b => b.r));
      const nextStates = tf.tensor2d(batch.map(b => b.s2));
      const dones = tf.tensor1d(batch.map(b => b.done ? 1 : 0));

      // Q-targets
      const nextQ = targetNet.predict(nextStates);
      const nextQMax = nextQ.max(1);
      const targetQ = rewards.add(nextQMax.mul(tf.scalar(gamma)).mul(tf.scalar(1).sub(dones)));

      // treino passo
      await optimizer.minimize(() => {
        const qVals = qNet.predict(states);
        const actionMasks = tf.oneHot(actions, N_ACTIONS);
        const predQForActions = qVals.mul(actionMasks).sum(1);
        const loss = tf.losses.meanSquaredError(targetQ, predQForActions);
        return loss;
      }, true);

      tf.dispose([states, actions, rewards, nextStates, dones, nextQ, nextQMax, targetQ]);
    }

    // atualizar target network periodicamente
    if (ep % 20 === 0) {
      targetNet.setWeights(qNet.getWeights());
    }

    epsilon = Math.max(epsilonEnd, epsilon * epsilonDecay);

    if (ep % 50 === 0) {
      console.log(`Episode ${ep}/${nEpisodes} - epReward=${epReward.toFixed(2)} - epsilon=${epsilon.toFixed(3)} - buffer=${buffer.size()}`);
    }
  }

  // salvar modelo final
  await qNet.save(finalModelUrl);
  console.log("Training complete. Model saved to ", finalModelUrl);
}

train().catch(err => {
  console.error("Erro no treino:", err);
});
