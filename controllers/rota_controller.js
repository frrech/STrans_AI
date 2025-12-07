import { obterMelhorRota } from "../services/routeOptimizerService.js";

export async function calcularMelhorRota(req, res) {
  try {
    const { origem, destino, tipoCarga, urgencia } = req.body;

    if (!origem || !destino) {
      return res.status(400).json({
        error: "origem e destino são obrigatórios"
      });
    }

    const resultado = await obterMelhorRota({
      origem,
      destino,
      tipoCarga,
      urgencia,
    });

    res.json(resultado);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno ao calcular rota" });
  }
}
