import * as tf from "@tensorflow/tfjs";
import { loadModel } from "./model/model.js"; // Ajuste o path se necessário
import { buildState } from "./rl/env.js";

async function teste() {
    console.log("🧠 Carregando modelo...");
    await loadModel();
    const model = tf.sequential(); // Apenas dummy, o loadModel carrega na variável global do módulo model.js
    
    // Simular Carga GRANDE e URGENTE (Cenário onde Moto/Bike devem ser proibidos)
    const disponibilidade = { motos_ativas: 10, bikes_ativas: 10, vans_ativas: 5, caminhoes_ativos: 2 };
    
    // Input
    const distKm = 15;
    const urgencia = true;
    const tipoCarga = "grande";
    
    console.log(`\n🧪 CENÁRIO: Dist: ${distKm}km | Urgente: ${urgencia} | Carga: ${tipoCarga}`);
    
    const state = buildState({ distKm, urgencia, tipoCarga, disponibilidade });
    
    // Importamos a função de predição ou usamos o modelo salvo se você exportou a variável global
    // Supondo que você tenha uma função 'predict' ou acesse o modelo carregado:
    // Vou usar a lógica interna do seu sistema:
    
    const { escolherMelhorAcao } = await import("./model/model.js");
    
    const resultado = await escolherMelhorAcao(state, { distKm, tipoCarga });
    
    console.log("-".repeat(30));
    console.log("ESCOLHA DA IA:", resultado.vehicle.toUpperCase());
    console.log("-".repeat(30));
    console.log("Q-Values (Expectativa de Custo Normalizado):");
    console.log("Moto:    ", resultado.qvals[0].toFixed(4));
    console.log("Bike:    ", resultado.qvals[1].toFixed(4));
    console.log("Van:     ", resultado.qvals[2].toFixed(4));
    console.log("Caminhão:", resultado.qvals[3].toFixed(4));
    console.log("-".repeat(30));
    
    if (resultado.vehicle === "moto" || resultado.vehicle === "bike") {
        console.log("❌ REPROVADO: Escolheu veículo pequeno para carga grande.");
    } else {
        console.log("✅ APROVADO: Escolheu veículo adequado.");
    }
}

teste();