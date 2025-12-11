// routeOptimizerService.js
import { loadModel, escolherMelhorAcao } from "../model/model.js";
import { buildState, computeCost, VEHICLES } from "../rl/env.js"; // <-- adicionado VEHICLES
import { loadAllData } from "./dataLoader.js";
import { aplicarPricing } from "./pricingUtils.js";

/**
 * Snapshot dos dados de entrada (CSV carregado na inicialização)
 */
let dataSnapshot = null;

/**
 * Inicializa o otimizador de rotas.
 * Deve ser chamado na subida do servidor.
 */
export async function initRouteOptimizer() {
  dataSnapshot = loadAllData();
  await loadModel(); // carrega o modelo salvo (treinado) ou inicializa fallback
}

/**
 * Converte string numérica no formato brasileiro ("39,77") para Number (39.77).
 * Se já for número, devolve direto. Se der ruim, cai no fallback.
 */
function parseBRFloat(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;

  if (typeof value === "number") {
    return Number.isNaN(value) ? fallback : value;
  }

  const str = String(value).trim();
  if (!str) return fallback;

  // remove separador de milhar e troca vírgula por ponto
  const normalized = str.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isNaN(n) ? fallback : n;
}

/**
 * Normaliza a disponibilidade vinda do CSV para a mesma escala usada no treino.
 * No treino, a IA via algo como: 10 motos, 5 bikes, 2 vans, 1 caminhão,
 * com MAX_FLEET = 50 (ou seja, valores na casa de 0..50).
 *
 * Aqui, os CSVs têm milhares de veículos. Então trazemos tudo para
 * uma "frota equivalente" de no máximo 50 unidades.
 */
function normalizarDisponibilidadeCSV(rawVeiculos = {}) {
  const motosCSV     = rawVeiculos.motos_ativas     || 0;
  const bikesCSV     = rawVeiculos.bikes_ativas     || 0;
  const vansCSV      = rawVeiculos.vans_ativas      || 0;
  const caminhoesCSV = rawVeiculos.caminhoes_ativos || 0;

  // usa total_veiculos se existir, senão soma
  const total =
    rawVeiculos.total_veiculos ||
    motosCSV + bikesCSV + vansCSV + caminhoesCSV ||
    1;

  // Queremos mapear o total real para algo equivalente a um "MAX_FLEET" de 50
  const fator = 50 / total; // se total = 3524 → fator ~ 0.014

  return {
    motos_ativas:     Math.round(motosCSV     * fator),
    bikes_ativas:     Math.round(bikesCSV     * fator),
    vans_ativas:      Math.round(vansCSV      * fator),
    caminhoes_ativos: Math.round(caminhoesCSV * fator),
  };
}

/**
 * Calcula a melhor rota/veículo a partir dos dados de entrada.
 */
export async function obterMelhorRota({
  origem,
  destino,
  tipoCarga = "pequena",
  urgencia = false,
  distancia = null
}) {
  // 1) DEFINIÇÃO DA DISTÂNCIA
  let distKm;

  if (distancia != null) {
    // Se o usuário mandou no JSON, usamos ela!
    distKm = parseFloat(distancia);
  } else {
    // Fallback: heurística aleatória baseada no CSV de rotas
    const ds = dataSnapshot ?? { rotas: [] };
    const rotas = ds.rotas ?? [];
    const avgDist =
      rotas.length > 0
        ? rotas[rotas.length - 1].distancia_media_rota_km || 5
        : 5;

    // Gera algo entre 0.5x e 1.5x a média
    distKm = Math.max(1, avgDist * (0.5 + Math.random()));
  }

  console.log(`📍 Calculando rota: ${distKm.toFixed(1)} km | Carga: ${tipoCarga}`);

  // 2) CONSTRUIR ESTADO
  // Pegamos a última linha de veículos do snapshot (estado mais recente)
  const rawVeiculos =
    dataSnapshot?.veiculos?.[dataSnapshot.veiculos.length - 1] || {};

  // Converte CSV → escala compatível com o treino (0..50 aprox.)
  const disponibilidade = normalizarDisponibilidadeCSV(rawVeiculos);

  // Normaliza inputs para o tensor (distância, urgência, carga, disponibilidade)
  const stateTensor = buildState({ distKm, urgencia, tipoCarga, disponibilidade });

  // 3) PREVER AÇÃO (DQN)
  let { actionIndex, vehicle, qvals } = await escolherMelhorAcao(stateTensor, {
    tipoCarga,
    distKm // Passamos distKm para a máscara de segurança interna (se houver)
  });

  // ============ OVERRIDE DE NEGÓCIO: MICRO DISTÂNCIA LEVE ============
  const BIKE_INDEX = VEHICLES.indexOf("bike"); // deve ser 1 na ordem ["moto","bike","van","caminhao"]
  const haBikeDisponivel = (disponibilidade.bikes_ativas || 0) > 0;

  if (
    BIKE_INDEX >= 0 &&
    !urgencia &&
    tipoCarga === "pequena" &&
    distKm <= 5 &&
    haBikeDisponivel
  ) {
    // Se as regras de negócio mandam priorizar BIKE, sobrescreve escolha da IA
    actionIndex = BIKE_INDEX;
    vehicle = "bike";

    // (Opcional) ajustar qvals só pra debug ficar coerente
    if (Array.isArray(qvals)) {
      const maxQ = Math.max(...qvals);
      qvals = [...qvals];
      qvals[BIKE_INDEX] = maxQ + 1; // garante que bike apareça como melhor nos logs
    }
  }
  // ==========================================================

  // 4) ESTIMAR CUSTO E RETORNO (usando computeCost + pricing)
  const lastVeiculos =
    dataSnapshot?.veiculos?.[dataSnapshot.veiculos.length - 1] || {};

  const baseCosts = {
    moto:     parseBRFloat(lastVeiculos.custo_operacional_moto_dia, 20),
    bike:     parseBRFloat(lastVeiculos.custo_operacional_bike_dia, 5),
    van:      parseBRFloat(lastVeiculos.custo_operacional_van_dia, 100),
    caminhao: parseBRFloat(lastVeiculos.custo_operacional_caminhao_dia, 200),
  };

  const tempoH =
    distKm /
    (vehicle === "bike" ? 15 : vehicle === "moto" ? 40 : 60); // velocidades aproximadas

  const custo = computeCost({
    vehicle,
    distKm,
    baseCosts,
    urgencia,
    tipoCarga,
    disponibilidade,
  });

  const precoEstimado = aplicarPricing(custo, urgencia, 0);

  return {
    origem,
    destino,
    tipoCarga,
    urgencia,
    escolha: vehicle,
    distanciaKm: Number(distKm.toFixed(2)),
    tempoEstimadoMin: Math.round(tempoH * 60),
    precoEstimado: Number(precoEstimado.toFixed(2)),
    qvals,
    meta: "DQN",
  };
}
