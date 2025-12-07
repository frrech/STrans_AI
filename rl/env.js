/**
 * Ambiente simplificado:
 * - Estado: vetor com [dist_km_norm, urgencia_bin, tipoCarga_onehot(2), disponibilidade_moto_norm, disponibilidade_bike_norm, disponibilidade_van_norm, disponibilidade_truck_norm]
 * - Ações: escolher veículo entre [moto, bike, van, caminhao] e rota pré-selecionada (aqui simplificamos: ação => veículo)
 * - Recompensa: -custo_total (queremos minimizar custo). Para facilitar DQN, normalizamos reward.
 *
 * Nota: você pode ampliar ações para incluir roteamentos discretos (rotas possíveis)
 */

import * as tf from "@tensorflow/tfjs-node";
import _ from "lodash";

export const VEHICLES = ["moto","bike","van","caminhao"];

export function buildState({distKm, urgencia=false, tipoCarga="pequena", disponibilidade}) {
  // disponibilidade: objeto com counts por veículo
  const maxVeh = Math.max(1, disponibilidade.motos_ativas || 1);
  const state = [
    distKm / 100.0, // normaliza assumindo max 100km
    urgencia ? 1.0 : 0.0,
    tipoCarga === "pequena" ? 1.0 : 0.0,
    tipoCarga === "grande" ? 1.0 : 0.0,
    (disponibilidade.motos_ativas || 0) / (maxVeh),
    (disponibilidade.bikes_ativas || 0) / (maxVeh),
    (disponibilidade.vans_ativas || 0) / (maxVeh),
    (disponibilidade.caminhoes_ativos || 0) / (maxVeh)
  ];
  return tf.tensor2d([state]);
}

export function computeCost({vehicle, distKm, tempoH, baseCosts, pedagio=0, urgencia=false}) {
  // baseCosts: custos operacionais por dia por tipo (do CSV)
  // custo combustível aproximado por km simulado
  const costPerKm = {
    moto: 0.3,
    bike: 0.05,
    van: 1.2,
    caminhao: 2.5
  };
  let cost = (costPerKm[vehicle] || 1.0) * distKm + pedagio + (baseCosts[vehicle] || 0);
  if (urgencia) cost *= 1.5;
  return cost;
}

export function rewardFromCost(cost) {
  // queremos que reward alto = melhor (menor custo)
  // usamos reward = -cost (podemos escalar)
  return -cost;
}
