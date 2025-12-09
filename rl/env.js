/**
 * Ambiente simplificado:
 * - Estado: vetor com [dist_km_norm, urgencia_bin, tipoCarga_onehot(2), disponibilidade_moto_norm, disponibilidade_bike_norm, disponibilidade_van_norm, disponibilidade_truck_norm]
 * - Ações: escolher veículo entre [moto, bike, van, caminhao] e rota pré-selecionada (aqui simplificamos: ação => veículo)
 * - Recompensa: -custo_total (queremos minimizar custo). Para facilitar DQN, normalizamos reward.
 *
 * Nota: você pode ampliar ações para incluir roteamentos discretos (rotas possíveis)
 */

import * as tf from "@tensorflow/tfjs";
import _ from "lodash";

export const VEHICLES = ["moto","bike","van","caminhao"];

export function buildState({distKm, urgencia=false, tipoCarga="pequena", disponibilidade}) {
  // CONFIGURAÇÃO: Número fixo para normalizar a frota. 
  // Se tiver 10 motos, vira 0.2. Se tiver 50, vira 1.0.
  const MAX_FLEET = 50.0; 
  
  const state = [
    // 1. Distância normalizada (0.0 a 1.0)
    Math.min(1.0, distKm / 100.0), 
    
    // 2. Flags (0 ou 1)
    urgencia ? 1.0 : 0.0,
    tipoCarga === "pequena" ? 1.0 : 0.0, 
    tipoCarga === "grande" ? 1.0 : 0.0, 
    
    // 3. Disponibilidade normalizada (0.0 a 1.0)
    Math.min(1.0, (disponibilidade.motos_ativas || 0) / MAX_FLEET),
    Math.min(1.0, (disponibilidade.bikes_ativas || 0) / MAX_FLEET),
    Math.min(1.0, (disponibilidade.vans_ativas || 0) / MAX_FLEET),
    Math.min(1.0, (disponibilidade.caminhoes_ativos || 0) / MAX_FLEET)
  ];

  return tf.tensor2d([state]);
}

export function computeCost({vehicle, distKm, baseCosts = {}, urgencia=false, tipoCarga="pequena"}) {
  const costPerKm = {
    moto: 0.5,
    bike: 0.1,
    van: 2.0,
    caminhao: 4.5
  };

  // Custo base da viagem
  let cost = (costPerKm[vehicle] || 1.0) * distKm + (baseCosts[vehicle] || 0);

  if (urgencia) cost *= 1.2; 

  // --- REGRAS DE PUNIÇÃO (CALIBRADAS) ---

  // 1. IMPOSSÍVEL FÍSICO (Obrigatório corrigir o viés da Bike)
  // Van percorrendo 100km custa ~240. A punição deve ser maior que isso.
  // Aumentamos de 150 para 500.
  if ((vehicle === "bike" || vehicle === "moto") && tipoCarga === "grande") {
    cost += 500; 
  }

  // 2. INVIÁVEL (Bike longe ou urgente)
  // Mantemos baixo para que ele aprenda a preferir Moto, mas não proíba totalmente se for perto
  if (vehicle === "bike" && (distKm > 10 || urgencia)) {
    cost += 50; 
  }

  // 3. INEFICIÊNCIA (Van para carta pequena perto)
  if (vehicle === "van" && tipoCarga === "pequena" && distKm < 5) {
     cost += 30;
  }

  // 4. DESPERDÍCIO (Caminhão)
  if (vehicle === "caminhao" && tipoCarga === "pequena") {
    cost += 100;
  }

  return cost;
}

export function rewardFromCost(cost) {
  // queremos que reward alto = melhor (menor custo)
  // usamos reward = -cost (podemos escalar)
  return -cost;
}
