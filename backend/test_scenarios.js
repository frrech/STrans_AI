// test_scenarios.js
import { VEHICLES } from "./rl/env.js";

// Disponibilidade padrão (a mesma da simulação de treinamento)
export const DEFAULT_DISPONIBILIDADE = {
  motos_ativas: 10,
  bikes_ativas: 5,
  vans_ativas: 2,
  caminhoes_ativos: 1,
};

/**
 * Cada cenário: 
 *  - id / label: descrição humana
 *  - distKm, urgencia, tipoCarga
 *  - disponibilidade: pode usar a default ou custom
 *  - expected: veículo ideal segundo a lógica de negócio (regra)
 */
export const TEST_SCENARIOS = [
  // ******* BIKES ********

  {
    id: "S1",
    label: "Curta distância, carga pequena, sem urgência → BIKE",
    distKm: 3,
    urgencia: false,
    tipoCarga: "pequena",
    disponibilidade: { ...DEFAULT_DISPONIBILIDADE },
    expected: "bike",
  },
  {
    id: "S2",
    label: "Curta distância, carga pequena, sem urgência, frota cheia → BIKE",
    distKm: 2,
    urgencia: false,
    tipoCarga: "pequena",
    disponibilidade: {
      motos_ativas: 20,
      bikes_ativas: 20,
      vans_ativas: 5,
      caminhoes_ativos: 2,
    },
    expected: "bike",
  },

  // ******* MOTO ********

  {
    id: "S3",
    label: "Curta distância, pequena, URGENTE → MOTO",
    distKm: 3,
    urgencia: true,
    tipoCarga: "pequena",
    disponibilidade: { ...DEFAULT_DISPONIBILIDADE },
    expected: "moto",
  },
  {
    id: "S4",
    label: "Distância média (20km), pequena, normal → MOTO",
    distKm: 20,
    urgencia: false,
    tipoCarga: "pequena",
    disponibilidade: { ...DEFAULT_DISPONIBILIDADE },
    expected: "moto",
  },
  {
    id: "S5",
    label: "Distância média (30km), carga média, normal → MOTO",
    distKm: 30,
    urgencia: false,
    tipoCarga: "media",
    disponibilidade: { ...DEFAULT_DISPONIBILIDADE },
    expected: "moto",
  },

  // ******* VAN ********

  {
    id: "S6",
    label: "Curta distância (3km), carga GRANDE, normal → VAN",
    distKm: 3,
    urgencia: false,
    tipoCarga: "grande",
    disponibilidade: { ...DEFAULT_DISPONIBILIDADE },
    expected: "van",
  },
  {
    id: "S7",
    label: "Distância média (40km), carga GRANDE, normal → VAN",
    distKm: 40,
    urgencia: false,
    tipoCarga: "grande",
    disponibilidade: { ...DEFAULT_DISPONIBILIDADE },
    expected: "van",
  },
  {
    id: "S8",
    label: "Longa (100km), carga GRANDE, URGENTE → VAN",
    distKm: 100,
    urgencia: true,
    tipoCarga: "grande",
    disponibilidade: { ...DEFAULT_DISPONIBILIDADE },
    expected: "van",
  },

  // ******* CAMINHÃO IDEAL ********

  {
    id: "S9",
    label: "Longa (100km), carga GRANDE, sem urgência → CAMINHÃO",
    distKm: 100,
    urgencia: false,
    tipoCarga: "grande",
    disponibilidade: { ...DEFAULT_DISPONIBILIDADE },
    expected: "caminhao",
  },
  {
    id: "S10",
    label: "Very longa (130km), carga GRANDE, sem urgência → CAMINHÃO",
    distKm: 130,
    urgencia: false,
    tipoCarga: "grande",
    disponibilidade: { ...DEFAULT_DISPONIBILIDADE },
    expected: "caminhao",
  },
  {
    id: "S11",
    label: "Extrema (200km), carga GRANDE, sem urgência → CAMINHÃO",
    distKm: 200,
    urgencia: false,
    tipoCarga: "grande",
    disponibilidade: { ...DEFAULT_DISPONIBILIDADE },
    expected: "caminhao",
  },

  // ******* CAMINHÃO x VAN – comparativo ********

  {
    id: "S12",
    label: "130km, GRANDE, urgente → VAN (para comparar com S10 CAMINHÃO)",
    distKm: 130,
    urgencia: true,
    tipoCarga: "grande",
    disponibilidade: { ...DEFAULT_DISPONIBILIDADE },
    expected: "van",
  },

  // ******* CASOS LIMITE DE DISPONIBILIDADE ********

  {
    id: "S13",
    label: "Caminhão é o ideal, mas SEM caminhões disponíveis → IA deve fugir de caminhão",
    distKm: 130,
    urgencia: false,
    tipoCarga: "grande",
    disponibilidade: {
      motos_ativas: 10,
      bikes_ativas: 5,
      vans_ativas: 2,
      caminhoes_ativos: 0, // sem caminhão
    },
    // expected aqui é o que a REGRA de custo escolher;
    // provavelmente VAN, mas você pode deixar expected = null para só observar.
    expected: null,
  },
  {
    id: "S14",
    label: "Caminhão ideal, mas uma única VAN sobrando → ver se IA preserva VAN ou usa CAMINHÃO",
    distKm: 130,
    urgencia: false,
    tipoCarga: "grande",
    disponibilidade: {
      motos_ativas: 0,
      bikes_ativas: 0,
      vans_ativas: 1,
      caminhoes_ativos: 1,
    },
    expected: "caminhao",
  },
];
