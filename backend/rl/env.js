
import * as tf from "@tensorflow/tfjs";

export const VEHICLES = ["moto", "bike", "van", "caminhao"];
export const MAX_FLEET = 50.0;

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


export function computeCost({
  vehicle,
  distKm,
  baseCosts = {},
  urgencia = false,
  tipoCarga = "pequena",
  disponibilidade,
}) {
  const costPerKm = { moto: 0.5, bike: 0.1, van: 2.0, caminhao: 4.5 };
  const speeds = { moto: 40, bike: 15, van: 35, caminhao: 25 };

  let cost = (costPerKm[vehicle] || 1.0) * distKm + (baseCosts[vehicle] || 0);

  // URGÊNCIA BASEADA EM TEMPO
  if (urgencia) {
    const speed = speeds[vehicle] || 30;
    const timeHours = distKm / speed + 0.16; // +10min setup
    cost += timeHours * 80.0;
  }

  // REGRAS DE DISPONIBILIDADE
  if (disponibilidade) {
    const disponMap = {
      moto: disponibilidade.motos_ativas ?? 0,
      bike: disponibilidade.bikes_ativas ?? 0,
      van: disponibilidade.vans_ativas ?? 0,
      caminhao: disponibilidade.caminhoes_ativos ?? 0,
    };

    const disponAtual = disponMap[vehicle] ?? 0;

    if (disponAtual <= 0) {
      cost += 5000;
    } else {
      const frac = Math.min(1.0, disponAtual / MAX_FLEET);
      const scarcity = 1.0 - frac;
      cost *= 1.0 + 0.3 * scarcity;
    }
  }

  // REGRAS RÍGIDAS ESPECÍFICAS

  // 1. BIKE
  if (vehicle === "bike") {
    if (tipoCarga === "grande") cost += 5000;
    if (tipoCarga === "media") cost += 1000;

    if (distKm > 5 || urgencia) {
      cost += 600;
    } else {
      cost -= 40;
    }
  }

  // 2. MOTO
  if (vehicle === "moto") {
    if (tipoCarga === "grande") cost += 5000;
    if (distKm > 80) cost += 600;

    if (tipoCarga === "grande" && distKm > 80 && !urgencia) {
      cost += 1500;
    }

    if (tipoCarga === "media" && distKm > 50 && !urgencia) {
      cost += 400;
    }


    if (distKm <= 5 && !urgencia) {
      cost += 600;
    } else {
      cost -= 45;
    }
  }

  // 3. VAN
  if (vehicle === "van") {
    if (distKm < 5 && tipoCarga !== "grande") {
      cost += 500;
    }

    if (tipoCarga === "grande" && distKm > 80) {
      if (urgencia) {
        cost += 100;
      } else {
        cost += 600;
      }
    }

    if (tipoCarga === "grande" && distKm > 120 && !urgencia) {
      cost += 400;
    }
  }

  // 4. CAMINHÃO
  if (vehicle === "caminhao") {
    if (tipoCarga === "pequena") cost += 600;
    if (tipoCarga === "media") cost += 400;

    if (tipoCarga === "grande" && distKm > 80 && !urgencia) {
      cost -= 800;
    }
  }

  return Math.max(0, cost);
}
