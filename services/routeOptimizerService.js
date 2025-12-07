import { loadModel, escolherMelhorAcao } from "../model/model.js";
import { buildState, computeCost } from "../rl/env.js";
import { loadAllData } from "./dataLoader.js";
import { aplicarPricing } from "./pricingUtils.js";

/**
 * Deve ser chamado na inicialização do servidor:
 * await initRouteOptimizer();
 */
let dataSnapshot = null;

export async function initRouteOptimizer() {
  dataSnapshot = loadAllData();
  await loadModel(); // carrega o modelo salvo ou inicializa
}

export async function obterMelhorRota({ origem, destino, tipoCarga="pequena", urgencia=false }) {
  // 1) estimar distância (método simples: extrair de rotas CSV média; ideal: Google Maps API)
  // Aqui usamos uma heurística: distancia média de rotas * random factor
  const ds = dataSnapshot ?? { rotas: [], clientes: [], entregas: [], veiculos: [] };
  const rotas = ds.rotas ?? [];
  const avgDist = (rotas.length > 0) ? rotas[rotas.length-1].distancia_media_rota_km || 5 : 5;
  const distKm = Math.max(1, avgDist * (0.6 + Math.random()*1.4)); // 0.6x-2x

  // 2) construir estado
  const disponibilidade = (dataSnapshot.veiculos && dataSnapshot.veiculos[dataSnapshot.veiculos.length-1]) || {};
  const stateTensor = buildState({ distKm, urgencia, tipoCarga, disponibilidade });

  // 3) prever ação com DQN
  const { actionIndex, vehicle, qvals } = await escolherMelhorAcao(stateTensor);

  // 4) estimar custo para a ação selecionada (usamos custos base no CSV)
  const lastVeiculos = dataSnapshot.veiculos[dataSnapshot.veiculos.length-1] || {};
  const baseCosts = {
    moto: lastVeiculos.custo_operacional_moto_dia || 20,
    bike: lastVeiculos.custo_operacional_bike_dia || 5,
    van: lastVeiculos.custo_operacional_van_dia || 100,
    caminhao: lastVeiculos.custo_operacional_caminhao_dia || 200
  };

  const pedagio = 0; // poderia estimar por rota
  const tempoH = distKm / 30;
  const custo = computeCost({ vehicle, distKm, tempoH, baseCosts, pedagio, urgencia });
  const precoEstimado = aplicarPricing(custo, urgencia, 0); // desconto volume 0 por padrão

  return {
    origem, destino, tipoCarga, urgencia,
    escolha: vehicle,
    actionIndex,
    qvals,
    distanciaKm: distKm,
    tempoEstimadoMin: Math.round(tempoH*60),
    precoEstimado: Number(precoEstimado.toFixed(2)),
    meta: "DQN",
    timestamp: new Date().toISOString()
  };
}
