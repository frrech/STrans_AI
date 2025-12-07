import model from "../model/model.js";

export async function obterMelhorRota(input) {
  
  // Aqui você pode aplicar regras da STrans com base nos datasets:
  // - tabelas de custo por tipo de veículo
  // - distância média das rotas
  // - eficiência por km
  // - urgência (+50% no pricing)
  // - disponibilidade da frota

  const resultado = await model.calcularMelhorRota(input);

  return {
    ...resultado,
    timestamp: new Date()
  };
}
