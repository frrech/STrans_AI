import * as tf from "@tensorflow/tfjs";

export const VEHICLES = ["moto","bike","van","caminhao"];

export function buildState({distKm, urgencia=false, tipoCarga="pequena", disponibilidade}) {
  const MAX_FLEET = 50.0; 
  
  const state = [
    // 1. Distância normalizada
    Math.min(1.0, distKm / 100.0), 
    
    // 2. Urgência
    urgencia ? 1.0 : 0.0,
    
    // 3. Tipo de Carga (One-Hot Encoding de 3 posições)
    tipoCarga === "pequena" ? 1.0 : 0.0, 
    tipoCarga === "media"   ? 1.0 : 0.0, // <--- ADICIONADO: Agora a IA "vê" a carga média
    tipoCarga === "grande"  ? 1.0 : 0.0, 
    
    // 4. Disponibilidade
    Math.min(1.0, (disponibilidade.motos_ativas || 0) / MAX_FLEET),
    Math.min(1.0, (disponibilidade.bikes_ativas || 0) / MAX_FLEET),
    Math.min(1.0, (disponibilidade.vans_ativas || 0) / MAX_FLEET),
    Math.min(1.0, (disponibilidade.caminhoes_ativos || 0) / MAX_FLEET)
  ];

  return tf.tensor2d([state]);
}

export function computeCost({vehicle, distKm, baseCosts = {}, urgencia=false, tipoCarga="pequena", fragil=false}) {
  const costPerKm = { moto: 0.5, bike: 0.1, van: 2.0, caminhao: 4.5 };
  
  // Definição de Velocidade para cálculo de Urgência (Importante)
  const speeds = { moto: 40, bike: 15, van: 35, caminhao: 25 }; 

  // Custo base
  let cost = (costPerKm[vehicle] || 1.0) * distKm + (baseCosts[vehicle] || 0);

  // Fator Urgência Baseado em Tempo (Time is Money)
  // Isso ajuda a Van a ganhar do Caminhão na urgência
  if (urgencia) {
     const speed = speeds[vehicle] || 30;
     const timeHours = (distKm / speed) + 0.16; // +10min setup
     cost += timeHours * 80.0; // Cada hora gasta custa 80 pontos
  } else {
     // Pequeno multiplicador base se não houver lógica de tempo
     // cost *= 1.0; 
  }

  // --- REGRAS RÍGIDAS ---

  // 1. BIKE
  if (vehicle === "bike") {
    if (tipoCarga === "grande") cost += 1000;
    if (tipoCarga === "media") cost += 500;
    
    if (distKm > 5 || urgencia) {
      cost += 600; // Ficou longe ou urgente? Foge da bike.
    } else {
      cost -= 300; // Perto e leve? Bike é a rainha.
    }
  }

  // 2. MOTO
  if (vehicle === "moto") {
    if (tipoCarga === "grande") cost += 1000;
    if (distKm > 80) cost += 600;
    
    // Anti-canibalização: Não roube o lugar da bike se for muito perto e tranquilo
    if (distKm <= 5 && !urgencia) {
      cost += 600; 
    } else {
      cost -= 400; // Grande Bônus para dominar a média distância
    }
  }

  // 3. VAN
  if (vehicle === "van") {
    // Ineficiente para cargas leves/médias perto
    if (distKm < 5 && tipoCarga !== "grande") {
      cost += 500; 
    }
    
    // Lógica de Longa Distância (> 80km)
    if (tipoCarga === "grande" && distKm > 80) {
      if (urgencia) {
        cost += 100; // Punição leve, permitindo que a Van ganhe pela velocidade
      } else {
        cost += 600; // Sem urgência, força o uso do caminhão
      }    
    }
    
    // Extrema distância (> 120km): Van sofre mais se não for urgente
    if (tipoCarga === "grande" && distKm > 120 && !urgencia) {
      cost += 400; // Acumula com o 600 acima -> +1000 (Caminhão ganha fácil)
    }
  }

  // 4. CAMINHÃO
  if (vehicle === "caminhao") {
    if (tipoCarga === "pequena") cost += 600;
    if (tipoCarga === "media") cost += 400;
    
    // Caminhão ganha bônus se for o cenário ideal dele
    if (tipoCarga === "grande" && distKm > 80 && !urgencia) {
        cost -= 200;
    }
  }

 
  return Math.max(0, cost);
}