import * as tf from "@tensorflow/tfjs";
import fs from "fs";
import path from "path";
import { createQNetwork } from "./dqn_model.js";
import { VEHICLES } from "../rl/env.js";

let qModel = null;

// --- CLASSE DE CARREGAMENTO MANUAL (Para contornar falta do tfjs-node) ---
class NodeLoader {
  constructor(folderPath) {
    this.folderPath = folderPath;
  }

  async load() {
    const jsonPath = path.join(this.folderPath, "model.json");
    const weightsPath = path.join(this.folderPath, "weights.bin");

    // Validação de existência
    if (!fs.existsSync(jsonPath) || !fs.existsSync(weightsPath)) {
        throw new Error(`Arquivos não encontrados em: ${path.resolve(this.folderPath)}`);
    }

    console.log(`📂 Lendo arquivos de: ${this.folderPath}`);
    const modelJson = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    const weightsBuffer = fs.readFileSync(weightsPath);
    // Conversão Buffer -> ArrayBuffer (Necessário para o TFJS puro)
    const weightsArrayBuffer = weightsBuffer.buffer.slice(
      weightsBuffer.byteOffset, 
      weightsBuffer.byteOffset + weightsBuffer.byteLength
    );

    return {
      modelTopology: modelJson.modelTopology,
      weightSpecs: modelJson.weightsManifest[0].weights,
      weightData: weightsArrayBuffer,
    };
  }
}

// 1. AJUSTE DE CAMINHO: Apontando para onde o train_dqn.js salvou
export async function loadModel(modelPath = "./model/generated_dqn") {
  try {
    // Carrega usando o loader manual
    const ioHandler = tf.io.fromMemory(await new NodeLoader(modelPath).load());
    qModel = await tf.loadLayersModel(ioHandler);
    
    console.log("✅ Modelo DQN treinado carregado com sucesso!");
  } catch (err) {
    console.warn("⚠️ Falha ao carregar modelo salvo.");
    console.error(`Erro: ${err.message}`);
    
    console.log("🎲 Inicializando modelo aleatório (fallback)...");
    qModel = createQNetwork(8, VEHICLES.length);
  }
  return qModel;
}

// 2. MÁSCARA DE SEGURANÇA: Adicionamos parametros extras (tipoCarga)
export async function escolherMelhorAcao(stateTensor, context = {}) {
  if (!qModel) await loadModel(); // Garante carregamento
  
  // Predict retorna tensor, pegamos o array
  const qvals = qModel.predict(stateTensor).arraySync()[0];
  
  // --- MÁSCARA DE REALIDADE ---
  // Impede alucinações da IA (ex: Moto carregando Geladeira)
  const maskedQVals = [...qvals];
  
  if (context.tipoCarga === "grande") {
      // Índices: 0=Moto, 1=Bike (assumindo ordem do array VEHICLES)
      maskedQVals[0] = -Infinity; 
      maskedQVals[1] = -Infinity;
  }

  // Escolhe o melhor índice considerando a máscara
  let bestIdx = 0;
  let maxVal = -Infinity;
  
  for(let i=0; i < maskedQVals.length; i++){
      if(maskedQVals[i] > maxVal){
          maxVal = maskedQVals[i];
          bestIdx = i;
      }
  }

  // Fallback se tudo for -Infinity (caso impossível)
  if(maxVal === -Infinity) bestIdx = qvals.indexOf(Math.max(...qvals));
  
  const bestVehicle = VEHICLES[bestIdx];
  
  return { actionIndex: bestIdx, vehicle: bestVehicle, qvals };
}