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

// ... imports ...

export async function obterMelhorRota({ origem, destino, tipoCarga="pequena", urgencia=false, distancia = null }) {
  // 1) DEFINIÇÃO DA DISTÂNCIA
  let distKm;

  if (distancia) {
    // Se o usuário mandou no JSON, usamos ela!
    distKm = parseFloat(distancia);
  } else {
    // Fallback: Se não mandou, usamos a heurística aleatória baseada no CSV
    // Isso garante que o sistema não quebre se o campo faltar
    const ds = dataSnapshot ?? { rotas: [] };
    const rotas = ds.rotas ?? [];
    const avgDist = (rotas.length > 0) ? rotas[rotas.length-1].distancia_media_rota_km || 5 : 5;
    
    // Gera algo entre 0.5x e 1.5x a média
    distKm = Math.max(1, avgDist * (0.5 + Math.random())); 
  }

  console.log(`📍 Calculando rota: ${distKm.toFixed(1)} km | Carga: ${tipoCarga}`);

  // 2) CONSTRUIR ESTADO
  // Importante: Passar a distKm calculada acima
  const disponibilidade = (dataSnapshot?.veiculos && dataSnapshot.veiculos[dataSnapshot.veiculos.length-1]) || {};
  
  // Normaliza inputs para o tensor
  const stateTensor = buildState({ distKm, urgencia, tipoCarga, disponibilidade });

  // 3) PREVER AÇÃO (DQN)
  const { actionIndex, vehicle, qvals } = await escolherMelhorAcao(stateTensor, { 
    tipoCarga, 
    distKm // Passamos distKm para a máscara de segurança interna (se houver)
  });

  // 4) ESTIMAR CUSTO E RETORNO
  const lastVeiculos = dataSnapshot?.veiculos?.[dataSnapshot.veiculos.length-1] || {};
  const baseCosts = {
    moto: lastVeiculos.custo_operacional_moto_dia || 20,
    bike: lastVeiculos.custo_operacional_bike_dia || 5,
    van: lastVeiculos.custo_operacional_van_dia || 100,
    caminhao: lastVeiculos.custo_operacional_caminhao_dia || 200
  };

  const tempoH = distKm / (vehicle === 'bike' ? 15 : vehicle === 'moto' ? 40 : 60); // Ajuste de velocidade
  const custo = computeCost({ vehicle, distKm, baseCosts, urgencia, tipoCarga });
  const precoEstimado = aplicarPricing(custo, urgencia, 0);

  return {
    origem, destino, tipoCarga, urgencia,
    escolha: vehicle,
    distanciaKm: Number(distKm.toFixed(2)), // Retorna a distância usada
    tempoEstimadoMin: Math.round(tempoH*60),
    precoEstimado: Number(precoEstimado.toFixed(2)),
    qvals, // Útil para debug
    meta: "DQN"
  };
}
