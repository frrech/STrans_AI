import * as tf from "@tensorflow/tfjs"; 
import { createQNetwork } from "../model/dqn_model.js";
import ReplayBuffer from "./replayBuffer.js";
import { buildState, VEHICLES, computeCost } from "./env.js"; 
import { loadAllData } from "../services/dataLoader.js";
import fs from "fs";
import path from "path";

const N_ACTIONS = VEHICLES.length;
const REWARD_SCALE = 100.0; 

// INPUT_DIM = 9 (Dist, Urg, Carga(3), Disp(4))
const INPUT_DIM = 9; 

async function train() {
  console.log("🚀 Iniciando treinamento DQN (Cenários Dirigidos)...");

  const nEpisodes = 8000; // Aumentado para garantir convergência em regras complexas
  const batchSize = 64;
  const gamma = 0.90; 
  const learningRate = 0.001;
  
  const epsilonStart = 1.0;
  const epsilonEnd = 0.05;
  const epsilonDecay = 0.9994; 
  let epsilon = epsilonStart;

  // Carrega dados (apenas para custos base)
  let veiculos = [];
  try {
      const data = loadAllData();
      veiculos = data.veiculos || [];
  } catch (e) { console.warn("Usando defaults."); }

  const lastVeiculos = veiculos[veiculos.length - 1] || {};
  const baseCosts = {
    moto: lastVeiculos.custo_operacional_moto_dia || 20,
    bike: lastVeiculos.custo_operacional_bike_dia || 5,
    van: lastVeiculos.custo_operacional_van_dia || 100,
    caminhao: lastVeiculos.custo_operacional_caminhao_dia || 200
  };

  const disponibilidade = { motos_ativas: 10, bikes_ativas: 5, vans_ativas: 2, caminhoes_ativos: 1 };
  
  const qNet = createQNetwork(INPUT_DIM, N_ACTIONS);
  const targetNet = createQNetwork(INPUT_DIM, N_ACTIONS);
  targetNet.setWeights(qNet.getWeights());
  
  const optimizer = tf.train.adam(learningRate);
  const buffer = new ReplayBuffer(150000); // Buffer maior

  const getNormalizedReward = (c) => -(c / REWARD_SCALE);

  // --- GERADOR DE CENÁRIO "PROFESSOR" ---
  // Este gerador não é aleatório puro. Ele força a IA a estudar as matérias da prova.
  const gerarCenario = () => {
      const p = Math.random();
      let distKm, urgencia, tipoCarga;

      // LIÇÃO 1: "Micro-Logística" (0 a 5km) - 25% dos casos
      // Objetivo: Ensinar que Bike é boa (sem urgência), mas Moto ganha se for urgente.
      // Ensinar que Van é proibida aqui (<5km).
      if (p < 0.25) {
          distKm = Math.random() * 4.5 + 0.1; // 0.1km a 4.6km
          urgencia = Math.random() < 0.5; // 50% de chance de urgência (pra moto ganhar da bike)
          
          // Mistura cargas para punir Bike se for Média/Grande
          const rC = Math.random();
          if (rC < 0.4) tipoCarga = "pequena";
          else if (rC < 0.7) tipoCarga = "media";
          else tipoCarga = "grande";
      } 
      
      // LIÇÃO 2: "Zona Urbana/Regional" (5 a 80km) - 25% dos casos
      // Objetivo: Ensinar o domínio da Moto (Pequena/Media) e Van (Grande).
      // Ensinar que Bike morre (>5km).
      else if (p < 0.50) {
          distKm = Math.random() * 75 + 5.1; // 5.1km a 80km
          urgencia = Math.random() < 0.3;
          
          // Foca em cargas que a Moto e Van disputam
          const rC = Math.random();
          if (rC < 0.33) tipoCarga = "pequena"; 
          else if (rC < 0.66) tipoCarga = "media";
          else tipoCarga = "grande";
      }

      // LIÇÃO 3: "Interestadual Limítrofe" (80 a 120km) - 25% dos casos
      // Objetivo: Ensinar a batalha Van vs Caminhão.
      // Regra: Se Urgente -> Van (paga multa leve). Se Normal -> Caminhão (Van paga multa pesada).
      else if (p < 0.75) {
          distKm = Math.random() * 40 + 80.1; // 80.1km a 120km
          urgencia = Math.random() < 0.5; // Importante variar urgência aqui
          
          // Foca em Carga Grande, pois Caminhão odeia carga pequena
          tipoCarga = Math.random() < 0.2 ? "pequena" : "grande"; 
      }

      // LIÇÃO 4: "Distância Extrema" (> 120km) - 25% dos casos
      // Objetivo: Ensinar que Van morre se não for urgente (>120km rule).
      // Caminhão deve reinar aqui para carga grande.
      else {
          distKm = Math.random() * 180 + 120.1; // 120.1km a 300km
          urgencia = Math.random() < 0.4;
          tipoCarga = "grande"; // Força carga grande para o Caminhão brilhar
      }

      return { distKm, urgencia, tipoCarga };
  };

  // 1. AQUECIMENTO
  console.log("🔥 Aquecendo buffer com lições dirigidas...");
  for (let i=0; i<5000; i++) {
    const { distKm, urgencia, tipoCarga } = gerarCenario();
    const state = buildState({ distKm, urgencia, tipoCarga, disponibilidade });
    const actionIdx = Math.floor(Math.random() * N_ACTIONS);
    
    // Passando todos parâmetros para o custo
    const cost = computeCost({ vehicle: VEHICLES[actionIdx], distKm, baseCosts, urgencia, tipoCarga });
    const reward = getNormalizedReward(cost);
    
    buffer.add({ s: state.arraySync()[0], a: actionIdx, r: reward, s2: state.arraySync()[0], done: true });
  }

  // 2. TREINO
  console.log(`🏋️ Treinando por ${nEpisodes} episódios...`);
  for (let ep=1; ep<=nEpisodes; ep++) {
    const { distKm, urgencia, tipoCarga } = gerarCenario();
    const stateT = buildState({ distKm, urgencia, tipoCarga, disponibilidade });

    let actionIdx;
    if (Math.random() < epsilon) {
      actionIdx = Math.floor(Math.random() * N_ACTIONS);
    } else {
      const qvals = qNet.predict(stateT);
      actionIdx = qvals.argMax(1).dataSync()[0];
    }

    const cost = computeCost({ vehicle: VEHICLES[actionIdx], distKm, baseCosts, urgencia, tipoCarga });
    const reward = getNormalizedReward(cost);

    buffer.add({ s: stateT.arraySync()[0], a: actionIdx, r: reward, s2: stateT.arraySync()[0], done: true });
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

    // LOGS DE VALIDAÇÃO CRÍTICOS
    if (ep % 1000 === 0) {
      console.log(`--- Ep ${ep} | Epsilon: ${epsilon.toFixed(2)} ---`);
      
      // Teste 1: Extrema Distância (130km) Sem Urgência -> CAMINHÃO ESPERADO
      const s1 = buildState({ distKm: 130, urgencia: false, tipoCarga: "grande", disponibilidade });
      const q1 = qNet.predict(s1).dataSync();
      const v1 = VEHICLES[q1.indexOf(Math.max(...q1))];
      console.log(`> 130km/Grande/Normal: ${v1.toUpperCase()} (Esperado: CAMINHAO) | Van: ${q1[2].toFixed(1)} vs Truck: ${q1[3].toFixed(1)}`);
      s1.dispose();

      // Teste 2: Extrema Distância (130km) COM Urgência -> VAN ESPERADA
      const s2 = buildState({ distKm: 130, urgencia: true, tipoCarga: "grande", disponibilidade });
      const q2 = qNet.predict(s2).dataSync();
      const v2 = VEHICLES[q2.indexOf(Math.max(...q2))];
      console.log(`> 130km/Grande/Urgent: ${v2.toUpperCase()} (Esperado: VAN) | Van: ${q2[2].toFixed(1)} vs Truck: ${q2[3].toFixed(1)}`);
      s2.dispose();
      
      // Teste 3: Curta Urgente -> MOTO ESPERADA
      const s3 = buildState({ distKm: 3, urgencia: true, tipoCarga: "pequena", disponibilidade });
      const q3 = qNet.predict(s3).dataSync();
      const v3 = VEHICLES[q3.indexOf(Math.max(...q3))];
      console.log(`> 3km/Pequena/Urgent:  ${v3.toUpperCase()} (Esperado: MOTO)`);
      s3.dispose();
    }
  }

  // 3. SALVAR
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
  console.log(`✅ Modelo Salvo!`);
}

train().catch(console.error);