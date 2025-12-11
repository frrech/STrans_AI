// env.js
import * as tf from "@tensorflow/tfjs";

export const VEHICLES = ["moto", "bike", "van", "caminhao"];
export const MAX_FLEET = 50.0;

/**
 * Monta o vetor de estado para a IA.
 * Ordem:
 *  [0] dist_normalizada
 *  [1] urgencia (0/1)
 *  [2..4] tipoCarga one-hot (pequena, media, grande)
 *  [5..8] disponibilidade normalizada (moto, bike, van, caminhao)
 */
export function buildState({
  distKm,
  urgencia = false,
  tipoCarga = "pequena",
  disponibilidade,
}) {
  const disp = disponibilidade || {
    motos_ativas: 0,
    bikes_ativas: 0,
    vans_ativas: 0,
    caminhoes_ativos: 0,
  };

  const state = [
    // 1. Distância normalizada
    // Usando 300km para não colapsar tudo >=100km em 1.0.
    Math.min(1.0, distKm / 300.0),

    // 2. Urgência
    urgencia ? 1.0 : 0.0,

    // 3. Tipo de Carga (One-Hot)
    tipoCarga === "pequena" ? 1.0 : 0.0,
    tipoCarga === "media" ? 1.0 : 0.0,
    tipoCarga === "grande" ? 1.0 : 0.0,

    // 4. Disponibilidade (normalizada pela frota máxima)
    Math.min(1.0, (disp.motos_ativas || 0) / MAX_FLEET),
    Math.min(1.0, (disp.bikes_ativas || 0) / MAX_FLEET),
    Math.min(1.0, (disp.vans_ativas || 0) / MAX_FLEET),
    Math.min(1.0, (disp.caminhoes_ativos || 0) / MAX_FLEET),
  ];

  return tf.tensor2d([state]);
}

/**
 * Custo total de usar um veículo num cenário.
 * Quanto MENOR o custo, melhor.
 * A reward da IA normalmente é reward = -cost / REWARD_SCALE.
 */
export function computeCost({
  vehicle,
  distKm,
  baseCosts = {},
  urgencia = false,
  tipoCarga = "pequena",
  fragil = false, // reservado para regras futuras
  disponibilidade,
}) {
  const costPerKm = { moto: 0.5, bike: 0.1, van: 2.0, caminhao: 4.5 };
  const speeds = { moto: 40, bike: 15, van: 35, caminhao: 25 };

  let cost = (costPerKm[vehicle] || 1.0) * distKm + (baseCosts[vehicle] || 0);

  // =============================
  // URGÊNCIA BASEADA EM TEMPO
  // =============================
  if (urgencia) {
    const speed = speeds[vehicle] || 30;
    const timeHours = distKm / speed + 0.16; // +10min setup
    cost += timeHours * 80.0;
  }

  // =============================
  // REGRAS DE DISPONIBILIDADE
  // =============================
  if (disponibilidade) {
    const disponMap = {
      moto: disponibilidade.motos_ativas ?? 0,
      bike: disponibilidade.bikes_ativas ?? 0,
      van: disponibilidade.vans_ativas ?? 0,
      caminhao: disponibilidade.caminhoes_ativos ?? 0,
    };

    const disponAtual = disponMap[vehicle] ?? 0;

    // 1) Sem veículo disponível: custo absurdo (praticamente proibido)
    if (disponAtual <= 0) {
      cost += 5000;
    } else {
      // 2) Escassez: quanto mais raro, mais caro (até +30%)
      const frac = Math.min(1.0, disponAtual / MAX_FLEET); // 0..1
      const scarcity = 1.0 - frac; // 0 = abundante, 1 = quase acabando
      cost *= 1.0 + 0.3 * scarcity;
    }
  }

  // =============================
  // REGRAS RÍGIDAS ESPECÍFICAS
  // =============================

  // 1. BIKE
  if (vehicle === "bike") {
    if (tipoCarga === "grande") cost += 1000;
    if (tipoCarga === "media") cost += 500;

    if (distKm > 5 || urgencia) {
      cost += 600; // longe ou urgente → desestimula bike
    } else {
      cost -= 300; // micro distância leve, sem urgência → bike reina
    }
  }

  // 2. MOTO
  if (vehicle === "moto") {
    if (tipoCarga === "grande") cost += 1000;
    if (distKm > 80) cost += 600;

    // ZONA CAMINHÃO: grande + >80km + sem urgência → moto deve perder feio
    if (tipoCarga === "grande" && distKm > 80 && !urgencia) {
      cost += 1500; // castigo extra forte para moto
    }

    // Anti-canibalização da bike em micro distância sem urgência
    if (distKm <= 5 && !urgencia) {
      cost += 600;
    } else {
      cost -= 400; // moto domina média distância / urgência
    }
  }

  // 3. VAN
  if (vehicle === "van") {
    // Ineficiente para cargas leves/médias muito perto
    if (distKm < 5 && tipoCarga !== "grande") {
      cost += 500;
    }

    // 80km+ com carga grande
    if (tipoCarga === "grande" && distKm > 80) {
      if (urgencia) {
        cost += 100; // leve punição: ainda pode ganhar pela urgência
      } else {
        cost += 600; // sem urgência, favorece caminhão
      }
    }

    // >120km, grande, sem urgência → van sofre ainda mais
    if (tipoCarga === "grande" && distKm > 120 && !urgencia) {
      cost += 400; // acumula com o 600 → +1000 total
    }
  }

  // 4. CAMINHÃO
  if (vehicle === "caminhao") {
    if (tipoCarga === "pequena") cost += 600;
    if (tipoCarga === "media") cost += 400;

    // ZONA CAMINHÃO: grande + >80km + sem urgência
    if (tipoCarga === "grande" && distKm > 80 && !urgencia) {
      cost -= 400; // bônus mais forte (era -200)
    }
  }

  // Mantém clamp para não ficar negativo
  return Math.max(0, cost);
}
