import { obterMelhorRota } from "../services/routeOptimizerService.js";

export async function calcularMelhorRota(req, res) {
  try {
    // 1. ADICIONADO: Extrair 'distancia' do body
    const { origem, destino, tipoCarga, urgencia, distancia } = req.body;

    if (!origem || !destino) {
      return res.status(400).json({
        error: "origem e destino são obrigatórios"
      });
    }

    // 2. ADICIONADO: Repassar 'distancia' para o serviço
    const resultado = await obterMelhorRota({
      origem,
      destino,
      tipoCarga,
      urgencia,
      distancia // <--- Fundamental para o cálculo funcionar
    });

    res.json(resultado);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao calcular rota" });
  }
}