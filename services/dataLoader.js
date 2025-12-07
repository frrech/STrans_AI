import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import _ from "lodash";

/**
 * Carrega CSVs da pasta /data e retorna objetos normalizados.
 * Usa o Manual Técnico (colunas esperadas) para mapear e preencher missing values.
 */

const DATA_DIR = path.resolve("./data");

function readCSV(fileName) {
  const csv = fs.readFileSync(path.join(DATA_DIR, fileName), "utf8");
  return parse(csv, { columns: true, skip_empty_lines: true });
}

export function loadAllData() {
  const clientes = readCSV("strans_clientes.csv");
  const entregas = readCSV("strans_entregas.csv");
  const rotas = readCSV("strans_rotas.csv");
  const veiculos = readCSV("strans_veiculos.csv");

  // Normalizações básicas (convert types)
  const clientesNorm = clientes.map(r => ({
    cliente_id: Number(r.cliente_id),
    tipo_cliente: r.tipo_cliente,
    porte_empresa: r.porte_empresa,
    regiao: r.regiao,
    volume_mensal_entregas: Number(r.volume_mensal_entregas || 0),
    valor_medio_entrega: Number(r.valor_medio_entrega || 0),
    data_contrato: r.data_contrato
  }));

  const entregasNorm = entregas.map(r => ({
    data: r.data,
    total_entregas: Number(r.total_entregas || 0),
    entregas_pequenas: Number(r.entregas_pequenas || 0),
    entregas_grandes: Number(r.entregas_grandes || 0),
    entregas_moto: Number(r.entregas_moto || 0),
    entregas_bike: Number(r.entregas_bike || 0),
    entregas_van: Number(r.entregas_van || 0),
    entregas_caminhao: Number(r.entregas_caminhao || 0),
    valor_medio_pequena: Number(r.valor_medio_pequena || 0),
    valor_medio_grande: Number(r.valor_medio_grande || 0),
    receita_total: Number(r.receita_total || 0)
  }));

  const rotasNorm = rotas.map(r => ({
    data: r.data,
    rotas_ativas: Number(r.rotas_ativas || 0),
    distancia_media_rota_km: Number(r.distancia_media_rota_km || 0),
    tempo_medio_rota_h: Number(r.tempo_medio_rota_h || 0),
    custo_combustivel_medio_rota: Number(r.custo_combustivel_medio_rota || 0),
    custo_pedagio_medio_rota: Number(r.custo_pedagio_medio_rota || 0)
  }));

  const veiculosNorm = veiculos.map(r => ({
    data: r.data,
    total_veiculos: Number(r.total_veiculos || 0),
    motos_ativas: Number(r.motos_ativas || 0),
    bikes_ativas: Number(r.bikes_ativas || 0),
    vans_ativas: Number(r.vans_ativas || 0),
    caminhoes_ativos: Number(r.caminhoes_ativos || 0),
    custo_operacional_moto_dia: Number(r.custo_operacional_moto_dia || 0),
    custo_operacional_bike_dia: Number(r.custo_operacional_bike_dia || 0),
    custo_operacional_van_dia: Number(r.custo_operacional_van_dia || 0),
    custo_operacional_caminhao_dia: Number(r.custo_operacional_caminhao_dia || 0)
  }));

  return {
    clientes: clientesNorm,
    entregas: entregasNorm,
    rotas: rotasNorm,
    veiculos: veiculosNorm
  };
}
